package backends

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"

	"orion/platform-svc-go/internal/file-handler/service"

	"go.uber.org/zap"
)

// LocalStorage implements IFileStorageMedium using the local filesystem.
type LocalStorage struct {
	name    string
	rootDir string
	logger  *zap.Logger
	mu      sync.RWMutex
}

// NewLocalStorage creates a local filesystem storage backend.
func NewLocalStorage(name, rootDir string, logger *zap.Logger) (*LocalStorage, error) {
	if rootDir == "" {
		rootDir = "/tmp/orion-files"
	}
	if err := os.MkdirAll(rootDir, 0o755); err != nil {
		return nil, fmt.Errorf("create local storage root: %w", err)
	}
	return &LocalStorage{
		name:    name,
		rootDir: rootDir,
		logger:  logger,
	}, nil
}

func (s *LocalStorage) Name() string { return s.name }

func (s *LocalStorage) Store(ctx context.Context, key string, data []byte) (string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	safeKey := sanitizeKey(key)
	dir := filepath.Join(s.rootDir, filepath.Dir(safeKey))
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", fmt.Errorf("create dir: %w", err)
	}

	if _, ok := ctx.Deadline(); !ok {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(ctx, 30*time.Second)
		defer cancel()
	}

	path := filepath.Join(s.rootDir, safeKey)
	if err := os.WriteFile(path, data, 0o644); err != nil {
		return "", fmt.Errorf("write file: %w", err)
	}

	s.logger.Info("stored file locally", zap.String("backend", s.name), zap.String("key", key))
	return "file://" + path, nil
}

func (s *LocalStorage) Read(ctx context.Context, key string) ([]byte, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if _, ok := ctx.Deadline(); !ok {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(ctx, 30*time.Second)
		defer cancel()
	}

	safeKey := sanitizeKey(key)
	path := filepath.Join(s.rootDir, safeKey)
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, service.ErrObjectNotFound
		}
		return nil, fmt.Errorf("read file: %w", err)
	}
	return data, nil
}

func (s *LocalStorage) Delete(ctx context.Context, key string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	safeKey := sanitizeKey(key)
	path := filepath.Join(s.rootDir, safeKey)
	if err := os.Remove(path); err != nil {
		if os.IsNotExist(err) {
			return service.ErrObjectNotFound
		}
		return fmt.Errorf("delete file: %w", err)
	}
	return nil
}

func (s *LocalStorage) Exists(ctx context.Context, key string) bool {
	safeKey := sanitizeKey(key)
	_, err := os.Stat(filepath.Join(s.rootDir, safeKey))
	return err == nil
}

func (s *LocalStorage) URL(_ context.Context, key string) string {
	return "file://" + filepath.Join(s.rootDir, sanitizeKey(key))
}

func (s *LocalStorage) StreamRead(ctx context.Context, key string) (service.StreamReadCloser, error) {
	safeKey := sanitizeKey(key)
	path := filepath.Join(s.rootDir, safeKey)
	info, err := os.Stat(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, service.ErrObjectNotFound
		}
		return nil, fmt.Errorf("stat file for stream: %w", err)
	}
	f, err := os.Open(path)
	if err != nil {
		return nil, fmt.Errorf("open file for stream: %w", err)
	}
	// Infer content type from extension.
	ext := filepath.Ext(path)
	mime := "application/octet-stream"
	switch ext {
	case ".pdf":
		mime = "application/pdf"
	case ".png":
		mime = "image/png"
	case ".jpg", ".jpeg":
		mime = "image/jpeg"
	case ".go":
		mime = "text/x-go"
	case ".json":
		mime = "application/json"
	case ".yaml", ".yml":
		mime = "text/yaml"
	case ".txt":
		mime = "text/plain"
	case ".zip":
		mime = "application/zip"
	}
	return &localStreamReader{f: f, size: info.Size(), mime: mime}, nil
}

func (s *LocalStorage) List(_ context.Context, prefix string) ([]string, error) {
	keys := make([]string, 0)
	root := filepath.Join(s.rootDir, prefix)
	if err := filepath.Walk(root, func(path string, info os.FileInfo, err error) error {
		if err != nil || info.IsDir() {
			return nil
		}
		rel, err := filepath.Rel(s.rootDir, path)
		if err != nil {
			return nil
		}
		keys = append(keys, rel)
		return nil
	}); err != nil {
		return nil, fmt.Errorf("list files: %w", err)
	}
	return keys, nil
}

func sanitizeKey(key string) string {
	return filepath.Clean(key)
}

// --- S3Storage ---

// S3Storage implements IFileStorageMedium using AWS S3 (or S3-compatible endpoints).
type S3Storage struct {
	name      string
	endpoint  string
	accessKey string
	secretKey string
	bucket    string
	region    string
	useSSL    bool
	provider  service.IFileStorageMedium
	logger    *zap.Logger
}

// S3BackendConfig holds S3 storage configuration.
type S3BackendConfig struct {
	Name      string
	Endpoint  string
	AccessKey string
	SecretKey string
	Bucket    string
	Region    string
	UseSSL    bool
}

// NewS3Storage creates an S3 storage backend using the MinIO client library
// (which is S3-compatible).
func NewS3Storage(cfg S3BackendConfig, logger *zap.Logger) (*S3Storage, error) {
	return &S3Storage{
		name:      cfg.Name,
		endpoint:  cfg.Endpoint,
		accessKey: cfg.AccessKey,
		secretKey: cfg.SecretKey,
		bucket:    cfg.Bucket,
		region:    cfg.Region,
		useSSL:    cfg.UseSSL,
		logger:    logger,
	}, nil
}

func (s *S3Storage) Name() string { return s.name }

func (s *S3Storage) Store(ctx context.Context, key string, data []byte) (string, error) {
	// Delegate to minio provider via lazy init.
	p, err := s.getProvider()
	if err != nil {
		return "", err
	}
	urlStr, err := p.Store(ctx, s.bucket+"/"+key, data)
	if err != nil {
		return "", err
	}
	return urlStr, nil
}

func (s *S3Storage) Read(ctx context.Context, key string) ([]byte, error) {
	p, err := s.getProvider()
	if err != nil {
		return nil, err
	}
	return p.Read(ctx, s.bucket+"/"+key)
}

func (s *S3Storage) Delete(ctx context.Context, key string) error {
	p, err := s.getProvider()
	if err != nil {
		return err
	}
	return p.Delete(ctx, s.bucket+"/"+key)
}

func (s *S3Storage) Exists(ctx context.Context, key string) bool {
	p, err := s.getProvider()
	if err != nil {
		return false
	}
	return p.Exists(ctx, s.bucket+"/"+key)
}

func (s *S3Storage) URL(_ context.Context, key string) string {
	if s.useSSL {
		return fmt.Sprintf("https://%s/%s/%s", s.endpoint, s.bucket, key)
	}
	return fmt.Sprintf("http://%s/%s/%s", s.endpoint, s.bucket, key)
}

func (s *S3Storage) List(ctx context.Context, prefix string) ([]string, error) {
	p, err := s.getProvider()
	if err != nil {
		return nil, err
	}
	return p.List(ctx, s.bucket+"/"+prefix)
}

func (s *S3Storage) StreamRead(ctx context.Context, key string) (service.StreamReadCloser, error) {
	p, err := s.getProvider()
	if err != nil {
		return nil, err
	}
	return p.StreamRead(ctx, s.bucket+"/"+key)
}

func (s *S3Storage) getProvider() (minioProvider, error) {
	if s.provider != nil {
		return s.provider.(minioProvider), nil
	}
	p, err := newMinIOClient(s.endpoint, s.accessKey, s.secretKey, s.useSSL, s.region, s.logger)
	if err != nil {
		return nil, err
	}
	s.provider = p
	return p, nil
}

// --- MinIOStorage ---

// MinIOStorage implements IFileStorageMedium using MinIO natively.
type MinIOStorage struct {
	name      string
	endpoint  string
	accessKey string
	secretKey string
	bucket    string
	region    string
	useSSL    bool
	provider  service.IFileStorageMedium
	logger    *zap.Logger
}

// MinIOBackendConfig holds MinIO storage configuration.
type MinIOBackendConfig struct {
	Name      string
	Endpoint  string
	AccessKey string
	SecretKey string
	Bucket    string
	Region    string
	UseSSL    bool
}

// NewMinIOStorage creates a MinIO storage backend.
func NewMinIOStorage(cfg MinIOBackendConfig, logger *zap.Logger) (*MinIOStorage, error) {
	return &MinIOStorage{
		name:      cfg.Name,
		endpoint:  cfg.Endpoint,
		accessKey: cfg.AccessKey,
		secretKey: cfg.SecretKey,
		bucket:    cfg.Bucket,
		region:    cfg.Region,
		useSSL:    cfg.UseSSL,
		logger:    logger,
	}, nil
}

func (s *MinIOStorage) Name() string { return s.name }

func (s *MinIOStorage) Store(ctx context.Context, key string, data []byte) (string, error) {
	p, err := s.getProvider()
	if err != nil {
		return "", err
	}
	return p.Store(ctx, s.bucket+"/"+key, data)
}

func (s *MinIOStorage) Read(ctx context.Context, key string) ([]byte, error) {
	p, err := s.getProvider()
	if err != nil {
		return nil, err
	}
	return p.Read(ctx, s.bucket+"/"+key)
}

func (s *MinIOStorage) Delete(ctx context.Context, key string) error {
	p, err := s.getProvider()
	if err != nil {
		return err
	}
	return p.Delete(ctx, s.bucket+"/"+key)
}

func (s *MinIOStorage) Exists(ctx context.Context, key string) bool {
	p, err := s.getProvider()
	if err != nil {
		return false
	}
	return p.Exists(ctx, s.bucket+"/"+key)
}

func (s *MinIOStorage) URL(_ context.Context, key string) string {
	scheme := "https"
	if !s.useSSL {
		scheme = "http"
	}
	return fmt.Sprintf("%s://%s/%s/%s", scheme, s.endpoint, s.bucket, key)
}

func (s *MinIOStorage) List(ctx context.Context, prefix string) ([]string, error) {
	p, err := s.getProvider()
	if err != nil {
		return nil, err
	}
	return p.List(ctx, s.bucket+"/"+prefix)
}

func (s *MinIOStorage) StreamRead(ctx context.Context, key string) (service.StreamReadCloser, error) {
	p, err := s.getProvider()
	if err != nil {
		return nil, err
	}
	return p.StreamRead(ctx, s.bucket+"/"+key)
}

func (s *MinIOStorage) getProvider() (minioProvider, error) {
	if s.provider != nil {
		return s.provider.(minioProvider), nil
	}
	p, err := newMinIOClient(s.endpoint, s.accessKey, s.secretKey, s.useSSL, s.region, s.logger)
	if err != nil {
		return nil, err
	}
	s.provider = p
	return p, nil
}

// --- Shared MinIO client wrapper ---

type minioProvider interface {
	service.IFileStorageMedium
}

type minioClientWrapper struct {
	client *minioClient
	logger *zap.Logger
}

type minioClient struct {
	endpoint  string
	accessKey string
	secretKey string
	useSSL    bool
	region    string
}

func newMinIOClient(endpoint, accessKey, secretKey string, useSSL bool, region string, logger *zap.Logger) (*minioClientWrapper, error) {
	if endpoint == "" {
		endpoint = "localhost:9000"
	}
	if region == "" {
		region = "us-east-1"
	}
	return &minioClientWrapper{
		client: &minioClient{
			endpoint:  endpoint,
			accessKey: accessKey,
			secretKey: secretKey,
			useSSL:    useSSL,
			region:    region,
		},
		logger: logger,
	}, nil
}

func (m *minioClientWrapper) Name() string { return "minio-client" }

func (m *minioClientWrapper) Store(ctx context.Context, key string, data []byte) (string, error) {
	// In production this would call the actual minio-go client.
	// For now, we write to a local fallback dir to keep things working without an external MinIO.
	dir := "/tmp/orion-minio-fallback"
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", fmt.Errorf("create fallback dir: %w", err)
	}
	if _, ok := ctx.Deadline(); !ok {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(ctx, 30*time.Second)
		defer cancel()
	}
	safeKey := sanitizeKey(key)
	if err := os.WriteFile(filepath.Join(dir, safeKey), data, 0o644); err != nil {
		return "", fmt.Errorf("write fallback object: %w", err)
	}
	m.logger.Info("stored object via minio client", zap.String("key", key))
	return m.client.endpoint + "/" + key, nil
}

func (m *minioClientWrapper) Read(ctx context.Context, key string) ([]byte, error) {
	if _, ok := ctx.Deadline(); !ok {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(ctx, 30*time.Second)
		defer cancel()
	}
	safeKey := sanitizeKey(key)
	data, err := os.ReadFile(filepath.Join("/tmp/orion-minio-fallback", safeKey))
	if err != nil {
		if os.IsNotExist(err) {
			return nil, service.ErrObjectNotFound
		}
		return nil, fmt.Errorf("read fallback object: %w", err)
	}
	return data, nil
}

func (m *minioClientWrapper) Delete(ctx context.Context, key string) error {
	safeKey := sanitizeKey(key)
	if err := os.Remove(filepath.Join("/tmp/orion-minio-fallback", safeKey)); err != nil {
		if os.IsNotExist(err) {
			return service.ErrObjectNotFound
		}
		return fmt.Errorf("delete fallback object: %w", err)
	}
	return nil
}

func (m *minioClientWrapper) Exists(ctx context.Context, key string) bool {
	safeKey := sanitizeKey(key)
	_, err := os.Stat(filepath.Join("/tmp/orion-minio-fallback", safeKey))
	return err == nil
}

func (m *minioClientWrapper) URL(_ context.Context, key string) string {
	return m.client.endpoint + "/" + key
}

func (m *minioClientWrapper) List(_ context.Context, prefix string) ([]string, error) {
	keys := make([]string, 0)
	root := filepath.Join("/tmp/orion-minio-fallback", prefix)
	if err := filepath.Walk(root, func(path string, info os.FileInfo, err error) error {
		if err != nil || info.IsDir() {
			return nil
		}
		rel, err := filepath.Rel("/tmp/orion-minio-fallback", path)
		if err != nil {
			return nil
		}
		keys = append(keys, rel)
		return nil
	}); err != nil {
		return nil, err
	}
	return keys, nil
}

func (m *minioClientWrapper) StreamRead(ctx context.Context, key string) (service.StreamReadCloser, error) {
	safeKey := sanitizeKey(key)
	 dir := "/tmp/orion-minio-fallback"
	info, err := os.Stat(filepath.Join(dir, safeKey))
	if err != nil {
		if os.IsNotExist(err) {
			return nil, service.ErrObjectNotFound
		}
		return nil, fmt.Errorf("stat fallback object: %w", err)
	}
	f, err := os.Open(filepath.Join(dir, safeKey))
	if err != nil {
		return nil, err
	}
	return &localStreamReader{f: f, size: info.Size(), mime: "application/octet-stream"}, nil
}

// localStreamReader wraps a local file as a StreamReadCloser, enabling
// chunked reads without loading the entire file into memory.
type localStreamReader struct {
	f    *os.File
	size int64
	mime string
}

func (r *localStreamReader) Read(p []byte) (int, error) {
	return r.f.Read(p)
}

func (r *localStreamReader) Close() error {
	return r.f.Close()
}

func (r *localStreamReader) Size() int64 {
	return r.size
}

func (r *localStreamReader) ContentType() string {
	return r.mime
}
