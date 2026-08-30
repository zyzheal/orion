package storage

import (
	"context"
	"fmt"
	"io"
	"strings"

	minio "github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
)

// S3Config holds the S3-protocol settings needed to talk to any S3-compatible
// service (AWS S3, MinIO, Ceph RGW, Tencent COS, etc.).
type S3Config struct {
	Endpoint  string
	Region    string
	Bucket    string
	AccessKey string
	SecretKey string
	UseSSL    bool
}

// S3 implements StorageBackend over any S3-compatible service using the
// official minio-go client. It is used for both AWS S3 and MinIO since they
// speak the same protocol.
type S3 struct {
	client  *minio.Client
	bucket  string
}

// NewS3 constructs an S3 backend. The bucket must exist beforehand; NewS3
// does not create buckets to avoid accidentally provisioning infrastructure
// from backup code paths.
func NewS3(cfg S3Config) (*S3, error) {
	if cfg.Bucket == "" {
		return nil, fmt.Errorf("storage/s3: bucket required")
	}
	if cfg.AccessKey == "" || cfg.SecretKey == "" {
		return nil, fmt.Errorf("storage/s3: access_key and secret_key required")
	}
	if cfg.Region == "" {
		cfg.Region = "us-east-1"
	}
	if cfg.Endpoint == "" {
		return nil, fmt.Errorf("storage/s3: endpoint required")
	}
	client, err := minio.New(cfg.Endpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(cfg.AccessKey, cfg.SecretKey, ""),
		Secure: cfg.UseSSL,
		Region: cfg.Region,
	})
	if err != nil {
		return nil, fmt.Errorf("storage/s3: new client: %w", err)
	}
	return &S3{client: client, bucket: cfg.Bucket}, nil
}

func (s *S3) Type() string { return "s3" }

func (s *S3) Put(ctx context.Context, path string, reader io.Reader) error {
	_, err := s.client.PutObject(ctx, s.bucket, s.normalizePath(path), reader, -1, minio.PutObjectOptions{ContentType: "application/octet-stream"})
	return err
}

func (s *S3) Get(ctx context.Context, path string) (io.ReadCloser, error) {
	obj, err := s.client.GetObject(ctx, s.bucket, s.normalizePath(path), minio.GetObjectOptions{})
	if err != nil {
		return nil, err
	}
	return obj, nil
}

func (s *S3) Delete(ctx context.Context, path string) error {
	return s.client.RemoveObject(ctx, s.bucket, s.normalizePath(path), minio.RemoveObjectOptions{})
}

func (s *S3) Exists(ctx context.Context, path string) (bool, error) {
	_, err := s.client.StatObject(ctx, s.bucket, s.normalizePath(path), minio.StatObjectOptions{})
	if err != nil {
		var errNotFound *minio.ErrorResponse
		if strings.Contains(err.Error(), "NoSuchKey") {
			return false, nil
		}
		_ = errNotFound
		return false, err
	}
	return true, nil
}

func (s *S3) Size(ctx context.Context, path string) (int64, error) {
	info, err := s.client.StatObject(ctx, s.bucket, s.normalizePath(path), minio.StatObjectOptions{})
	if err != nil {
		if strings.Contains(err.Error(), "NoSuchKey") {
			return 0, nil
		}
		return 0, err
	}
	return info.Size, nil
}

// normalizePath strips a leading slash and trims surrounding whitespace so
// callers can pass "/2026/08/backup.dump" or "2026/08/backup.dump"
// interchangeably. S3 keys are opaque but must not start with "/".
func (s *S3) normalizePath(path string) string {
	return strings.TrimPrefix(strings.TrimSpace(path), "/")
}
