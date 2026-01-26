package controllers

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jinzhu/copier"
	"github.com/minio/minio-go/v7"
	"github.com/pwnthemall/pwnthemall/backend/config"
	"github.com/pwnthemall/pwnthemall/backend/dto"
	"github.com/pwnthemall/pwnthemall/backend/models"
	"github.com/pwnthemall/pwnthemall/backend/utils"
)

const pagesBucket = "pages"

// GetPages returns all pages
func GetPages(c *gin.Context) {
	var pages []models.Page

	if err := config.DB.Order("created_at DESC").Find(&pages).Error; err != nil {
		utils.InternalServerError(c, "Failed to fetch pages")
		return
	}
	var pagesDTO []dto.PageDTO
	copier.Copy(&pagesDTO, &pages)
	utils.SuccessResponse(c, http.StatusOK, gin.H{"pages": pagesDTO})
}

func GetAdminPages(c *gin.Context) {
	var pages []models.Page

	if err := config.DB.Order("created_at DESC").Find(&pages).Error; err != nil {
		utils.InternalServerError(c, "Failed to fetch pages")
		return
	}

	utils.SuccessResponse(c, http.StatusOK, gin.H{"pages": pages})
}

// GetPage returns a single page by ID
func GetPage(c *gin.Context) {
	id := c.Param("id")

	var page models.Page
	if err := config.DB.First(&page, id).Error; err != nil {
		utils.NotFoundError(c, "Page not found")
		return
	}

	// Fetch HTML content from MinIO
	objectKey := fmt.Sprintf("%s.html", page.Slug)
	ctx := context.Background()

	obj, err := config.FS.GetObject(ctx, pagesBucket, objectKey, minio.GetObjectOptions{})
	if err != nil {
		utils.InternalServerError(c, "Failed to fetch page content")
		return
	}
	defer obj.Close()

	buf := new(bytes.Buffer)
	if _, err := buf.ReadFrom(obj); err != nil {
		utils.InternalServerError(c, "Failed to read page content")
		return
	}

	utils.SuccessResponse(c, http.StatusOK, gin.H{
		"page": page,
		"html": buf.String(),
	})
}

func GetAdminPage(c *gin.Context) {
	id := c.Param("id")

	var page models.Page
	if err := config.DB.First(&page, id).Error; err != nil {
		utils.NotFoundError(c, "Page not found")
		return
	}

	// Fetch HTML content from MinIO
	objectKey := fmt.Sprintf("%s.html", page.Slug)
	ctx := context.Background()

	obj, err := config.FS.GetObject(ctx, pagesBucket, objectKey, minio.GetObjectOptions{})
	if err != nil {
		utils.InternalServerError(c, "Failed to fetch page content")
		return
	}
	defer obj.Close()

	buf := new(bytes.Buffer)
	if _, err := buf.ReadFrom(obj); err != nil {
		utils.InternalServerError(c, "Failed to read page content")
		return
	}

	utils.SuccessResponse(c, http.StatusOK, gin.H{
		"page": page,
		"html": buf.String(),
	})
}

// CreatePage creates a new custom page
func CreatePage(c *gin.Context) {
	var input struct {
		Slug        string `json:"slug" binding:"required"`
		Title       string `json:"title" binding:"required"`
		HTML        string `json:"html" binding:"required"`
		IsInSidebar *bool  `json:"is_in_sidebar"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		utils.BadRequestError(c, "Invalid input: "+err.Error())
		return
	}

	// Validate slug
	if err := utils.ValidatePageSlug(input.Slug); err != nil {
		utils.BadRequestError(c, err.Error())
		return
	}

	// Check slug uniqueness
	unique, err := utils.IsSlugUnique(input.Slug, 0)
	if err != nil {
		utils.InternalServerError(c, "Failed to check slug uniqueness")
		return
	}
	if !unique {
		utils.BadRequestError(c, fmt.Sprintf("Slug '%s' is already in use", input.Slug))
		return
	}

	// Sanitize HTML content
	sanitizedHTML := utils.SanitizePageHTML(input.HTML)

	// Validate content size (max 1MB)
	if len(sanitizedHTML) > 1024*1024 {
		utils.BadRequestError(c, "HTML content is too large (max 1MB)")
		return
	}

	// Ensure MinIO bucket exists
	ctx := context.Background()
	exists, err := config.FS.BucketExists(ctx, pagesBucket)
	if err != nil {
		utils.InternalServerError(c, "Failed to check bucket existence")
		return
	}
	if !exists {
		if err := config.FS.MakeBucket(ctx, pagesBucket, minio.MakeBucketOptions{}); err != nil {
			utils.InternalServerError(c, "Failed to create bucket")
			return
		}
	}

	// Create database record
	page := models.Page{
		Slug:     input.Slug,
		Title:    input.Title,
		MinioKey: fmt.Sprintf("%s.html", input.Slug),
	}

	// Set sidebar visibility if provided
	if input.IsInSidebar != nil {
		page.IsInSidebar = *input.IsInSidebar
	}

	if err := config.DB.Create(&page).Error; err != nil {
		utils.InternalServerError(c, "Failed to create page: "+err.Error())
		return
	}

	// Upload HTML to MinIO
	objectKey := fmt.Sprintf("%s.html", page.Slug)
	reader := bytes.NewReader([]byte(sanitizedHTML))

	_, err = config.FS.PutObject(
		ctx,
		pagesBucket,
		objectKey,
		reader,
		int64(len(sanitizedHTML)),
		minio.PutObjectOptions{ContentType: "text/html; charset=utf-8"},
	)

	if err != nil {
		// Rollback database record
		config.DB.Delete(&page)
		utils.InternalServerError(c, "Failed to upload page content")
		return
	}

	// Broadcast sidebar update if page is in sidebar
	if page.IsInSidebar {
		broadcastSidebarPagesUpdate()
	}

	utils.CreatedResponse(c, gin.H{"page": page})
}

// UpdatePage updates an existing custom page
func UpdatePage(c *gin.Context) {
	id := c.Param("id")

	var page models.Page
	if err := config.DB.First(&page, id).Error; err != nil {
		utils.NotFoundError(c, "Page not found")
		return
	}

	// Store old sidebar state to detect changes
	oldIsInSidebar := page.IsInSidebar

	var input struct {
		Slug        string `json:"slug" binding:"required"`
		Title       string `json:"title" binding:"required"`
		HTML        string `json:"html" binding:"required"`
		IsInSidebar *bool  `json:"is_in_sidebar"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		utils.BadRequestError(c, "Invalid input: "+err.Error())
		return
	}

	// Validate new slug
	if err := utils.ValidatePageSlug(input.Slug); err != nil {
		utils.BadRequestError(c, err.Error())
		return
	}

	// Check slug uniqueness (exclude current page)
	if input.Slug != page.Slug {
		unique, err := utils.IsSlugUnique(input.Slug, page.ID)
		if err != nil {
			utils.InternalServerError(c, "Failed to check slug uniqueness")
			return
		}
		if !unique {
			utils.BadRequestError(c, fmt.Sprintf("Slug '%s' is already in use", input.Slug))
			return
		}
	}

	// Sanitize HTML content
	sanitizedHTML := utils.SanitizePageHTML(input.HTML)

	// Validate content size (max 1MB)
	if len(sanitizedHTML) > 1024*1024 {
		utils.BadRequestError(c, "HTML content is too large (max 1MB)")
		return
	}

	ctx := context.Background()
	oldObjectKey := page.MinioKey
	newObjectKey := fmt.Sprintf("%s.html", input.Slug)

	// Upload new HTML content
	reader := bytes.NewReader([]byte(sanitizedHTML))
	_, err := config.FS.PutObject(
		ctx,
		pagesBucket,
		newObjectKey,
		reader,
		int64(len(sanitizedHTML)),
		minio.PutObjectOptions{ContentType: "text/html; charset=utf-8"},
	)

	if err != nil {
		utils.InternalServerError(c, "Failed to upload page content")
		return
	}

	// Delete old MinIO object if slug changed
	if oldObjectKey != newObjectKey {
		config.FS.RemoveObject(ctx, pagesBucket, oldObjectKey, minio.RemoveObjectOptions{})
	}

	// Update database record
	page.Slug = input.Slug
	page.Title = input.Title
	page.MinioKey = newObjectKey

	// Update sidebar visibility if provided
	if input.IsInSidebar != nil {
		page.IsInSidebar = *input.IsInSidebar
	}

	if err := config.DB.Save(&page).Error; err != nil {
		utils.InternalServerError(c, "Failed to update page")
		return
	}

	// Broadcast sidebar update if sidebar visibility changed
	if oldIsInSidebar != page.IsInSidebar {
		broadcastSidebarPagesUpdate()
	}

	utils.SuccessResponse(c, http.StatusOK, gin.H{"page": page})
}

// DeletePage deletes a custom page (hard delete)
func DeletePage(c *gin.Context) {
	id := c.Param("id")

	var page models.Page
	if err := config.DB.First(&page, id).Error; err != nil {
		utils.NotFoundError(c, "Page not found")
		return
	}

	// Store sidebar state before deletion
	wasInSidebar := page.IsInSidebar

	// Delete from MinIO
	ctx := context.Background()
	if err := config.FS.RemoveObject(ctx, pagesBucket, page.MinioKey, minio.RemoveObjectOptions{}); err != nil {
		utils.InternalServerError(c, "Failed to delete page content")
		return
	}

	// Delete from database
	if err := config.DB.Delete(&page).Error; err != nil {
		utils.InternalServerError(c, "Failed to delete page")
		return
	}

	// Broadcast sidebar update if page was in sidebar
	if wasInSidebar {
		broadcastSidebarPagesUpdate()
	}

	utils.SuccessResponse(c, http.StatusOK, gin.H{"message": "Page deleted successfully"})
}

// ServePublicPage serves a custom page to the public
func ServePublicPage(c *gin.Context) {
	slug := c.Param("slug")

	// Lookup page in database
	var page models.Page
	if err := config.DB.Where("slug = ?", slug).First(&page).Error; err != nil {
		// Page not found, let Next.js handle 404
		c.JSON(http.StatusNotFound, gin.H{"error": "Page not found"})
		return
	}

	// Fetch HTML content from MinIO
	ctx := context.Background()
	obj, err := config.FS.GetObject(ctx, pagesBucket, page.MinioKey, minio.GetObjectOptions{})
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Page content not found"})
		return
	}
	defer obj.Close()

	buf := new(bytes.Buffer)
	if _, err := buf.ReadFrom(obj); err != nil {
		utils.InternalServerError(c, "Failed to read page content")
		return
	}

	// Sanitize HTML content before serving
	sanitizedHTML := utils.SanitizePageHTML(buf.String())

	// Set security headers
	c.Header("Content-Type", "text/html; charset=utf-8")
	c.Header("X-Content-Type-Options", "nosniff")
	c.Header("X-Frame-Options", "SAMEORIGIN")
	c.Header("Content-Security-Policy", utils.GetPageContentSecurityPolicy())
	c.Header("Cache-Control", "public, max-age=300") // Cache for 5 minutes

	// Serve sanitized HTML
	c.Data(http.StatusOK, "text/html; charset=utf-8", []byte(sanitizedHTML))
}

// ServePublicPageAPI serves a custom page as JSON (for Next.js SSR)
func ServePublicPageAPI(c *gin.Context) {
	slug := c.Param("slug")

	// Lookup page in database
	var page models.Page
	if err := config.DB.Where("slug = ?", slug).First(&page).Error; err != nil {
		// Page not found
		c.JSON(http.StatusNotFound, gin.H{"error": "Page not found"})
		return
	}

	// Fetch HTML content from MinIO
	ctx := context.Background()
	obj, err := config.FS.GetObject(ctx, pagesBucket, page.MinioKey, minio.GetObjectOptions{})
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Page content not found"})
		return
	}
	defer obj.Close()

	buf := new(bytes.Buffer)
	if _, err := buf.ReadFrom(obj); err != nil {
		utils.InternalServerError(c, "Failed to read page content")
		return
	}

	// Sanitize HTML content before serving
	sanitizedHTML := utils.SanitizePageHTML(buf.String())

	// Return JSON response with page metadata and sanitized HTML content
	c.JSON(http.StatusOK, gin.H{
		"page": gin.H{
			"id":         page.ID,
			"slug":       page.Slug,
			"title":      page.Title,
			"minio_key":  page.MinioKey,
			"created_at": page.CreatedAt,
			"updated_at": page.UpdatedAt,
			"html":       sanitizedHTML,
		},
	})
}

// broadcastSidebarPagesUpdate sends a WebSocket event to all clients
// to notify them that sidebar pages have changed
func broadcastSidebarPagesUpdate() {
	event := map[string]string{
		"event": "sidebar_pages_update",
	}
	payload, err := json.Marshal(event)
	if err != nil {
		return
	}
	utils.UpdatesHub.SendToAll(payload)
}
