package config

import (
	"os"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
	"github.com/pwnthemall/pwnthemall/backend/debug"
)

var FS *minio.Client
var MinioClient *minio.Client

func ConnectMinio() *minio.Client {
	endpoint := "minio:9000"
	useSSL := false

	minioClient, err := minio.New(endpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(os.Getenv("MINIO_ROOT_USER"), os.Getenv("MINIO_ROOT_PASSWORD"), ""),
		Secure: useSSL,
	})
	if err != nil {
		debug.Log("Failed to connect to MinIO: %v", err)
		os.Exit(1)
	}
	FS = minioClient
	MinioClient = minioClient
	
	return minioClient
}
