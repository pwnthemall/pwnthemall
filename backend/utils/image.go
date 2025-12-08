package utils

import (
	"github.com/pwnthemall/pwnthemall/backend/debug"
	"bytes"
	"context"
	"errors"
	"fmt"
	"image"
	_ "image/gif"  // Register GIF format
	_ "image/jpeg" // Register JPEG format
	_ "image/png"  // Register PNG format
	
	"time"

	"github.com/disintegration/imaging"
	"github.com/minio/minio-go/v7"
	"github.com/pwnthemall/pwnthemall/backend/config"
	_ "golang.org/x/image/webp" // Register WebP format
)

const (
	// Image constraints
	maxImageFileSize   = 5 * 1024 * 1024 // 5MB
	maxImageWidth      = 8000
	maxImageHeight     = 8000
	targetImageWidth   = 800
	targetImageHeight  = 450
)

// validateImageData performs security checks on image data
func validateImageData(data []byte) (string, error) {
	// Check file size
	if len(data) > maxImageFileSize {
		return "", fmt.Errorf("image file too large: %d bytes (max %d)", len(data), maxImageFileSize)
	}

	// Decode image to validate format and check dimensions
	img, format, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		return "", fmt.Errorf("invalid image format or corrupt file: %w", err)
	}

	// Check supported formats (magic bytes validated by image.Decode)
	if format != "jpeg" && format != "png" && format != "gif" && format != "webp" {
		return "", fmt.Errorf("unsupported image format: %s (supported: jpeg, png, gif, webp)", format)
	}

	// Check dimensions to prevent image bombs
	bounds := img.Bounds()
	width := bounds.Dx()
	height := bounds.Dy()

	if width > maxImageWidth || height > maxImageHeight {
		return "", fmt.Errorf("image dimensions too large: %dx%d (max %dx%d)", width, height, maxImageWidth, maxImageHeight)
	}

	if width < 1 || height < 1 {
		return "", errors.New("invalid image dimensions")
	}

	debug.Log("Image validated: format=%s, size=%dx%d, bytes=%d", format, width, height, len(data))
	return format, nil
}

// resizeImageToPNG resizes image to target dimensions and converts to PNG
func resizeImageToPNG(data []byte) ([]byte, error) {
	// Decode image
	img, _, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		return nil, fmt.Errorf("failed to decode image: %w", err)
	}

	// Resize to target dimensions using Lanczos resampling (high quality)
	// Fill mode ensures aspect ratio is maintained while filling target dimensions
	resized := imaging.Fill(img, targetImageWidth, targetImageHeight, imaging.Center, imaging.Lanczos)

	// Encode as WebP (using PNG with high quality as WebP encoder)
	var buf bytes.Buffer
	if err := imaging.Encode(&buf, resized, imaging.PNG); err != nil {
		return nil, fmt.Errorf("failed to encode image: %w", err)
	}

	debug.Log("Image resized: %dx%d -> %dx%d, output size: %d bytes", 
		img.Bounds().Dx(), img.Bounds().Dy(), 
		targetImageWidth, targetImageHeight, 
		buf.Len())

	return buf.Bytes(), nil
}

// ProcessChallengeCoverImage loads, validates, resizes, and stores a challenge cover image
func ProcessChallengeCoverImage(ctx context.Context, slug, filename string) (string, error) {
	// Create timeout context
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	// Channel for result
	type result struct {
		path string
		err  error
	}
	resultCh := make(chan result, 1)

	// Process in goroutine to respect context timeout
	go func() {
		path, err := processImageSync(slug, filename)
		resultCh <- result{path, err}
	}()

	// Wait for result or timeout
	select {
	case res := <-resultCh:
		return res.path, res.err
	case <-ctx.Done():
		return "", fmt.Errorf("image processing timeout after 5 seconds")
	}
}

// processImageSync performs the actual image processing synchronously
func processImageSync(slug, filename string) (string, error) {
	const bucketName = "challenges"
	
	// 1. Load original image from MinIO
	originalPath := fmt.Sprintf("%s/%s", slug, filename)
	debug.Log("Loading cover image: %s", originalPath)

	obj, err := config.FS.GetObject(context.Background(), bucketName, originalPath, minio.GetObjectOptions{})
	if err != nil {
		return "", fmt.Errorf("failed to load image from MinIO: %w", err)
	}
	defer obj.Close()

	// Read image data
	var buf bytes.Buffer
	if _, err := buf.ReadFrom(obj); err != nil {
		return "", fmt.Errorf("failed to read image data: %w", err)
	}
	imageData := buf.Bytes()

	// 2. Validate image and get format
	format, err := validateImageData(imageData)
	if err != nil {
		return "", fmt.Errorf("image validation failed: %w", err)
	}

	// 3. If GIF, keep original to preserve animation
	if format == "gif" {
		resizedPath := fmt.Sprintf("%s/cover_resized.gif", slug)
		debug.Log("GIF detected, storing original: %s", resizedPath)

		_, err = config.FS.PutObject(
			context.Background(),
			bucketName,
			resizedPath,
			bytes.NewReader(imageData),
			int64(len(imageData)),
			minio.PutObjectOptions{
				ContentType: "image/gif",
			},
		)
		if err != nil {
			return "", fmt.Errorf("failed to store GIF: %w", err)
		}

		debug.Log("Cover image processed successfully: %s", resizedPath)
		return "cover_resized.gif", nil
	}

	// 4. For other formats, store original without resizing
	// Resizing is disabled - focal point cropping is now handled on frontend via CSS object-position
	// resizedData, err := resizeImageToPNG(imageData)
	// if err != nil {
	// 	return "", fmt.Errorf("image resize failed: %w", err)
	// }

	// 5. Store image in MinIO (keeping original dimensions)
	resizedPath := fmt.Sprintf("%s/cover_resized.png", slug)
	debug.Log("Storing image: %s", resizedPath)

	// Convert to PNG without resizing
	img, _, err := image.Decode(bytes.NewReader(imageData))
	if err != nil {
		return "", fmt.Errorf("failed to decode image: %w", err)
	}
	var pngBuf bytes.Buffer
	if err := imaging.Encode(&pngBuf, img, imaging.PNG); err != nil {
		return "", fmt.Errorf("failed to encode image: %w", err)
	}

	_, err = config.FS.PutObject(
		context.Background(),
		bucketName,
		resizedPath,
		bytes.NewReader(pngBuf.Bytes()),
		int64(pngBuf.Len()),
		minio.PutObjectOptions{
			ContentType: "image/png",
		},
	)
	if err != nil {
		return "", fmt.Errorf("failed to store image: %w", err)
	}

	debug.Log("Cover image processed successfully: %s", resizedPath)
	return "cover_resized.png", nil
}

// GetChallengeCoverImage retrieves a challenge's cover image from MinIO
func GetChallengeCoverImage(slug, coverImg string) ([]byte, string, error) {
	const bucketName = "challenges"
	coverPath := fmt.Sprintf("%s/%s", slug, coverImg)

	obj, err := config.FS.GetObject(context.Background(), bucketName, coverPath, minio.GetObjectOptions{})
	if err != nil {
		return nil, "", fmt.Errorf("cover image not found: %w", err)
	}
	defer obj.Close()

	var buf bytes.Buffer
	if _, err := buf.ReadFrom(obj); err != nil {
		return nil, "", fmt.Errorf("failed to read cover image: %w", err)
	}

	// Determine content type from filename
	contentType := "image/png"
	if len(coverImg) >= 4 && coverImg[len(coverImg)-4:] == ".gif" {
		contentType = "image/gif"
	}

	return buf.Bytes(), contentType, nil
}
