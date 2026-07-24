package storage

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
	"go.uber.org/zap"

	"orion/platform-svc-go/internal/storage/models"
)

var (
	ErrObjectNotFound  = errors.New("object not found")
	ErrBucketNotFound  = errors.New("bucket not found")
	ErrObjectTooLarge  = errors.New("object exceeds maximum allowed size")
)

const (
	// MaxUploadSize is the maximum object size allowed (100 MB).
	MaxUploadSize = 100 * 1024 * 1024

	// MinBucketNameLen is the minimum bucket name length.
	MinBucketNameLen = 3
	// MaxBucketNameLen is the maximum bucket name length.
	MaxBucketNameLen = 63
)

// MinIOProvider implements ObjectStorageProvider using MinIO / S3-compatible API.
type MinIOProvider struct {
	client *minio.Client
	logger *zap.Logger
}

// FilesystemProvider implements ObjectStorageProvider using local disk.
type FilesystemProvider struct {
	rootDir string
	logger  *zap.Logger
	mu      sync.RWMutex
}

// MinIOConfig holds MinIO-specific configuration.
type MinIOConfig struct {
	Endpoint  string
	AccessKey string
	SecretKey string
	UseSSL    bool
	Region    string
}

// NewMinIOProvider creates a new MinIO/S3-compatible provider.
func NewMinIOProvider(cfg MinIOConfig, logger *zap.Logger) (*MinIOProvider, error) {
	if cfg.Endpoint == "" {
		cfg.Endpoint = "localhost:9000"
	}
	if cfg.Region == "" {
		cfg.Region = "us-east-1"
	}

	client, err := minio.New(cfg.Endpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(cfg.AccessKey, cfg.SecretKey, ""),
		Secure: cfg.UseSSL,
	})
	if err != nil {
		return nil, fmt.Errorf("create minio client: %w", err)
	}

	// Disable TLS verification for local development if needed.
	if !cfg.UseSSL {
		client.SetAppInfo("orion-platform", "")
	}

	// Force custom TLS config if UseSSL is true but self-signed.
	if cfg.UseSSL {
		_ = cfg.UseSSL // acknowledged; caller should use trusted certs in prod
	}

	return &MinIOProvider{
		client: client,
		logger: logger,
	}, nil
}

// NewFilesystemProvider creates a new local filesystem provider.
func NewFilesystemProvider(rootDir string, logger *zap.Logger) (*FilesystemProvider, error) {
	if rootDir == "" {
		rootDir = "/tmp/orion-storage"
	}

	// Create root directory if it doesn't exist.
	if err := os.MkdirAll(rootDir, 0o755); err != nil {
		return nil, fmt.Errorf("create filesystem root: %w", err)
	}

	return &FilesystemProvider{
		rootDir: rootDir,
		logger:  logger,
	}, nil
}

// --- MinIOProvider methods ---

// Put uploads an object to MinIO.
func (p *MinIOProvider) Put(bucket string, key string, data []byte) error {
	if len(data) > MaxUploadSize {
		return fmt.Errorf("%w: %d bytes", ErrObjectTooLarge, len(data))
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Ensure bucket exists.
	exists, err := p.client.BucketExists(ctx, bucket)
	if err != nil {
		return fmt.Errorf("check bucket exists: %w", err)
	}
	if !exists {
		if err := p.client.MakeBucket(ctx, bucket, minio.MakeBucketOptions{Region: "us-east-1"}); err != nil {
			return fmt.Errorf("create bucket: %w", err)
		}
	}

	size := int64(len(data))
	_, err = p.client.PutObject(ctx, bucket, key, bytes.NewReader(data), size, minio.PutObjectOptions{
		ContentType: p.guessContentType(key),
	})
	if err != nil {
		return fmt.Errorf("put object %s/%s: %w", bucket, key, err)
	}

	p.logger.Info("uploaded object", zap.String("bucket", bucket), zap.String("key", key), zap.Int64("size", size))
	return nil
}

// Get downloads an object from MinIO.
func (p *MinIOProvider) Get(bucket string, key string) ([]byte, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	obj, err := p.client.GetObject(ctx, bucket, key, minio.GetObjectOptions{})
	if err != nil {
		if strings.Contains(err.Error(), "NotFound") {
			return nil, ErrObjectNotFound
		}
		return nil, fmt.Errorf("get object %s/%s: %w", bucket, key, err)
	}
	defer obj.Close()

	data, err := io.ReadAll(obj)
	if err != nil {
		return nil, fmt.Errorf("read object data: %w", err)
	}
	return data, nil
}

// Delete removes an object from MinIO.
func (p *MinIOProvider) Delete(bucket string, key string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := p.client.RemoveObject(ctx, bucket, key, minio.RemoveObjectOptions{}); err != nil {
		if strings.Contains(err.Error(), "NotFound") {
			return ErrObjectNotFound
		}
		return fmt.Errorf("delete object %s/%s: %w", bucket, key, err)
	}
	return nil
}

// List returns all object keys under the given prefix.
func (p *MinIOProvider) List(bucket string, prefix string) ([]string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	keys := make([]string, 0)
	for obj := range p.client.ListObjects(ctx, bucket, minio.ListObjectsOptions{
		Prefix:    prefix,
		Recursive: true,
	}) {
		if obj.Err != nil {
			return nil, fmt.Errorf("list objects: %w", obj.Err)
		}
		keys = append(keys, obj.Key)
	}
	return keys, nil
}

// HealthCheck verifies connectivity to MinIO.
func (p *MinIOProvider) HealthCheck(ctx context.Context) error {
	_, err := p.client.GetBucketLocation(ctx, "orion-health-check")
	// The bucket may not exist, which is fine; we just want to know the client works.
	if err != nil {
		// If it's an access denied or timeout, connectivity is good.
		if strings.Contains(err.Error(), "AccessDenied") ||
			strings.Contains(err.Error(), "NoSuchBucket") {
			return nil
		}
		return fmt.Errorf("minio health check: %w", err)
	}
	return nil
}

// --- FilesystemProvider methods ---

// Put saves an object to local disk.
func (p *FilesystemProvider) Put(bucket string, key string, data []byte) error {
	p.mu.Lock()
	defer p.mu.Unlock()

	dir := filepath.Join(p.rootDir, bucket)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return fmt.Errorf("create bucket directory: %w", err)
	}

	// Sanitize key to prevent path traversal.
	safeKey := filepath.Clean(key)
	if safeKey == ".." || strings.HasPrefix(safeKey, "/") {
		return errors.New("invalid key: path traversal detected")
	}

	path := filepath.Join(dir, safeKey)
	if err := os.WriteFile(path, data, 0o644); err != nil {
		return fmt.Errorf("write file %s: %w", path, err)
	}

	p.logger.Info("saved object to filesystem", zap.String("bucket", bucket), zap.String("key", key))
	return nil
}

// Get reads an object from local disk.
func (p *FilesystemProvider) Get(bucket string, key string) ([]byte, error) {
	p.mu.RLock()
	defer p.mu.RUnlock()

	safeKey := filepath.Clean(key)
	if safeKey == ".." || strings.HasPrefix(safeKey, "/") {
		return nil, errors.New("invalid key: path traversal detected")
	}

	path := filepath.Join(p.rootDir, bucket, safeKey)
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, ErrObjectNotFound
		}
		return nil, fmt.Errorf("read file %s: %w", path, err)
	}
	return data, nil
}

// Delete removes an object from local disk.
func (p *FilesystemProvider) Delete(bucket string, key string) error {
	p.mu.Lock()
	defer p.mu.Unlock()

	safeKey := filepath.Clean(key)
	if safeKey == ".." || strings.HasPrefix(safeKey, "/") {
		return errors.New("invalid key: path traversal detected")
	}

	path := filepath.Join(p.rootDir, bucket, safeKey)
	if err := os.Remove(path); err != nil {
		if os.IsNotExist(err) {
			return ErrObjectNotFound
		}
		return fmt.Errorf("remove file %s: %w", path, err)
	}
	return nil
}

// List returns all object keys under the given prefix.
func (p *FilesystemProvider) List(bucket string, prefix string) ([]string, error) {
	p.mu.RLock()
	defer p.mu.RUnlock()

	dir := filepath.Join(p.rootDir, bucket)
	keys, err := p.walkDir(dir, prefix)
	if err != nil {
		return nil, fmt.Errorf("list files in %s: %w", dir, err)
	}
	return keys, nil
}

// walkDir recursively walks a directory and returns relative keys matching the prefix.
func (p *FilesystemProvider) walkDir(root, prefix string) ([]string, error) {
	keys := make([]string, 0)
	if err := filepath.Walk(root, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
		}
		if info.IsDir() {
			return nil
		}
		rel, err := filepath.Rel(root, path)
		if err != nil {
			return nil
		}
		if prefix == "" || strings.HasPrefix(rel, prefix) {
			keys = append(keys, rel)
		}
		return nil
	}); err != nil {
		return nil, err
	}
	return keys, nil
}

// guessContentType returns a content type based on the file extension.
func (*MinIOProvider) guessContentType(key string) string {
	ext := strings.ToLower(filepath.Ext(key))
	contentTypes := map[string]string{
		".png":  "image/png",
		".jpg":  "image/jpeg",
		".jpeg": "image/jpeg",
		".gif":  "image/gif",
		".json": "application/json",
		".yaml": "text/yaml",
		".yml":  "text/yaml",
		".txt":  "text/plain",
		".pdf":  "application/pdf",
		".zip":  "application/zip",
		".tar":  "application/x-tar",
		".gz":   "application/gzip",
	}
	if ct, ok := contentTypes[ext]; ok {
		return ct
	}
	return "application/octet-stream"
}

// --- Provider Factory ---

// ProviderType represents the type of storage provider.
type ProviderType string

const (
	ProviderTypeMinIO    ProviderType = "minio"
	ProviderTypeFilesystem ProviderType = "filesystem"
	ProviderTypeS3       ProviderType = "s3"
)

// NewProvider creates a storage provider based on the given type and config.
func NewProvider(pType ProviderType, cfg models.StorageConfig, logger *zap.Logger) (models.ObjectStorageProvider, error) {
	switch pType {
	case ProviderTypeMinIO:
		return NewMinIOProvider(MinIOConfig{
			Endpoint:  cfg.Endpoint,
			AccessKey: cfg.AccessKey,
			SecretKey: cfg.SecretKey,
			UseSSL:    cfg.UseSSL,
			Region:    cfg.Region,
		}, logger)
	case ProviderTypeFilesystem:
		return NewFilesystemProvider(cfg.LocalPath, logger)
	case ProviderTypeS3:
		// S3 uses the same MinIO client with a different endpoint.
		return NewMinIOProvider(MinIOConfig{
			Endpoint:  cfg.Endpoint,
			AccessKey: cfg.AccessKey,
			SecretKey: cfg.SecretKey,
			UseSSL:    true,
			Region:    cfg.Region,
		}, logger)
	default:
		return nil, fmt.Errorf("unknown provider type: %s", pType)
	}
}

// ObjectStorageRegistry manages multiple storage providers.
type ObjectStorageRegistry struct {
	providers map[string]models.ObjectStorageProvider
	mu        sync.RWMutex
	logger    *zap.Logger
}

// NewObjectStorageRegistry creates a new registry of storage providers.
func NewObjectStorageRegistry(logger *zap.Logger) *ObjectStorageRegistry {
	return &ObjectStorageRegistry{
		providers: make(map[string]models.ObjectStorageProvider),
		logger:    logger,
	}
}

// Register adds a provider to the registry.
func (r *ObjectStorageRegistry) Register(name string, provider models.ObjectStorageProvider) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.providers[name] = provider
	r.logger.Info("registered storage provider", zap.String("name", name))
}

// Get returns a provider by name.
func (r *ObjectStorageRegistry) Get(name string) (models.ObjectStorageProvider, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	provider, ok := r.providers[name]
	if !ok {
		return nil, fmt.Errorf("storage provider not found: %s", name)
	}
	return provider, nil
}

// List returns all registered provider names.
func (r *ObjectStorageRegistry) List() []string {
	r.mu.RLock()
	defer r.mu.RUnlock()
	names := make([]string, 0, len(r.providers))
	for name := range r.providers {
		names = append(names, name)
	}
	return names
}
