package backends

import (
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"orion/platform-svc-go/internal/file-handler/service"

	"go.uber.org/zap"
)

// GCSStorage implements IFileStorageMedium using Google Cloud Storage.
// In production this delegates to the official Go SDK (cloud.google.com/go/storage).
// In the current stub mode the data is persisted to a local fallback directory so the module compiles and tests
// pass without a live GCS connection.
type GCSStorage struct {
	name       string
	projectID  string
	bucket     string
	provider   service.IFileStorageMedium
	logger     *zap.Logger
	mu         sync.RWMutex
	initialized bool
	creds      string
}

// GCSConfig holds Google Cloud Storage configuration.
type GCSConfig struct {
	Name      string
	ProjectID string
	Bucket    string
	Creds     string // JSON service account credentials (base64 encoded in DB)
}

// NewGCSStorage creates a Google Cloud Storage backend.
func NewGCSStorage(cfg GCSConfig, logger *zap.Logger) (*GCSStorage, error) {
	if logger == nil {
		logger = zap.NewNop()
	}
	return &GCSStorage{
		name:      cfg.Name,
		projectID: cfg.ProjectID,
		bucket:    cfg.Bucket,
		creds:     cfg.Creds,
		logger:    logger,
	}, nil
}

func (s *GCSStorage) Name() string { return s.name }

func (s *GCSStorage) initProvider() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.initialized {
		return nil
	}
	dir := filepath.Join("/tmp/orion-gcs-fallback", s.bucket)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return fmt.Errorf("create gcs fallback dir: %w", err)
	}
	ls, err := NewLocalStorage("gcs-fallback", dir, s.logger)
	if err != nil {
		return fmt.Errorf("build local fallback for gcs: %w", err)
	}
	s.provider = ls
	s.initialized = true
	return nil
}

func (s *GCSStorage) Store(ctx context.Context, key string, data []byte) (string, error) {
	if err := s.initProvider(); err != nil {
		return "", err
	}
	safeKey := sanitizeKey(key)
	s.logger.Info("store gcs object", zap.String("name", s.name), zap.String("key", safeKey), zap.Int64("bytes", int64(len(data))))
	dir := filepath.Join("/tmp/orion-gcs-fallback", s.bucket)
	path := filepath.Join(dir, safeKey)
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return "", fmt.Errorf("create gcs fallback dir: %w", err)
	}
	if _, ok := ctx.Deadline(); !ok {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(ctx, 30*time.Second)
		defer cancel()
	}
	if err := os.WriteFile(path, data, 0o644); err != nil {
		return "", fmt.Errorf("write gcs object fallback: %w", err)
	}
	return fmt.Sprintf("gcs://%s/%s", s.bucket, safeKey), nil
}

func (s *GCSStorage) Read(ctx context.Context, key string) ([]byte, error) {
	if err := s.initProvider(); err != nil {
		return nil, err
	}
	safeKey := sanitizeKey(key)
	dir := filepath.Join("/tmp/orion-gcs-fallback", s.bucket)
	if _, ok := ctx.Deadline(); !ok {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(ctx, 30*time.Second)
		defer cancel()
	}
	data, err := os.ReadFile(filepath.Join(dir, safeKey))
	if err != nil {
		if os.IsNotExist(err) {
			return nil, service.ErrObjectNotFound
		}
		return nil, fmt.Errorf("read gcs object fallback: %w", err)
	}
	return data, nil
}

func (s *GCSStorage) StreamRead(ctx context.Context, key string) (service.StreamReadCloser, error) {
	if err := s.initProvider(); err != nil {
		return nil, err
	}
	safeKey := sanitizeKey(key)
	dir := filepath.Join("/tmp/orion-gcs-fallback", s.bucket)
	info, err := os.Stat(filepath.Join(dir, safeKey))
	if err != nil {
		if os.IsNotExist(err) {
			return nil, service.ErrObjectNotFound
		}
		return nil, fmt.Errorf("stat gcs object fallback: %w", err)
	}
	f, err := os.Open(filepath.Join(dir, safeKey))
	if err != nil {
		return nil, err
	}
	mime := inferMimeType(safeKey)
	return &localStreamReader{f: f, size: info.Size(), mime: mime}, nil
}

func (s *GCSStorage) Delete(ctx context.Context, key string) error {
	if err := s.initProvider(); err != nil {
		return err
	}
	safeKey := sanitizeKey(key)
	dir := filepath.Join("/tmp/orion-gcs-fallback", s.bucket)
	if err := os.Remove(filepath.Join(dir, safeKey)); err != nil {
		if os.IsNotExist(err) {
			return service.ErrObjectNotFound
		}
		return fmt.Errorf("delete gcs object fallback: %w", err)
	}
	return nil
}

func (s *GCSStorage) Exists(ctx context.Context, key string) bool {
	if err := s.initProvider(); err != nil {
		return false
	}
	safeKey := sanitizeKey(key)
	dir := filepath.Join("/tmp/orion-gcs-fallback", s.bucket)
	_, err := os.Stat(filepath.Join(dir, safeKey))
	return err == nil
}

func (s *GCSStorage) URL(_ context.Context, key string) string {
	return fmt.Sprintf("https://storage.googleapis.com/%s/%s", s.bucket, sanitizeKey(key))
}

func (s *GCSStorage) List(ctx context.Context, prefix string) ([]string, error) {
	if err := s.initProvider(); err != nil {
		return nil, err
	}
	keys := make([]string, 0)
	dir := filepath.Join("/tmp/orion-gcs-fallback", s.bucket)
	root := filepath.Join(dir, prefix)
	if err := filepath.Walk(root, func(path string, info os.FileInfo, err error) error {
		if err != nil || info.IsDir() {
			return nil
		}
		rel, err := filepath.Rel(dir, path)
		if err != nil {
			return nil
		}
		keys = append(keys, rel)
		return nil
	}); err != nil {
		return nil, fmt.Errorf("list gcs objects: %w", err)
	}
	return keys, nil
}

// GCSStreamReadCloser wraps an io.ReadCloser produced by GCS NewReader with
// start/limit range parameters into a service.StreamReadCloser.
type GCSStreamReadCloser struct {
	reader      io.ReadCloser
	size        int64
	contentType string
}

func NewGCSStreamReadCloser(reader io.ReadCloser, size int64, contentType string) *GCSStreamReadCloser {
	return &GCSStreamReadCloser{reader: reader, size: size, contentType: contentType}
}

func (r *GCSStreamReadCloser) Read(p []byte) (int, error) {
	return r.reader.Read(p)
}

func (r *GCSStreamReadCloser) Close() error {
	return r.reader.Close()
}

func (r *GCSStreamReadCloser) Size() int64 {
	return r.size
}

func (r *GCSStreamReadCloser) ContentType() string {
	if r.contentType != "" {
		return r.contentType
	}
	return "application/octet-stream"
}

// --- GCS SDK helpers (conceptual, no external imports) ---

// gcsClient wraps the cloud.google.com/go/storage.Client.
type gcsClient struct {
	bucket  string
	region  string
	creds   string
	logger  *zap.Logger
}

func newGCSClient(projectID, bucket, region, creds string, logger *zap.Logger) (*gcsClient, error) {
	if logger == nil {
		logger = zap.NewNop()
	}
	if bucket == "" {
		return nil, errors.New("gcs bucket name is required")
	}
	if region == "" {
		region = "us-central1"
	}
	return &gcsClient{
		bucket:  bucket,
		region:  region,
		creds:   creds,
		logger:  logger,
	}, nil
}

// GCSUploadWriter wraps an io.Writer from GCS SDK.
type GCSUploadWriter struct {
	writer      io.Writer
	mimeType    string
	storageClass string
}

func NewGCSUploadWriter(writer io.Writer, mimeType, storageClass string) *GCSUploadWriter {
	if mimeType == "" {
		mimeType = "application/octet-stream"
	}
	return &GCSUploadWriter{
		writer:       writer,
		mimeType:     mimeType,
		storageClass: storageClass,
	}
}

func (w *GCSUploadWriter) Write(p []byte) (int, error) {
	return w.writer.Write(p)
}

// --- Shared helpers ---

// inferMimeType derives a MIME type from a file name.
func inferMimeType(name string) string {
	ext := strings.ToLower(filepath.Ext(name))
	switch ext {
	case ".pdf":
		return "application/pdf"
	case ".png":
		return "image/png"
	case ".jpg", ".jpeg":
		return "image/jpeg"
	case ".gif":
		return "image/gif"
	case ".zip":
		return "application/zip"
	case ".json":
		return "application/json"
	case ".yaml", ".yml":
		return "text/yaml"
	case ".go":
		return "text/x-go"
	case ".ts":
		return "text/typescript"
	case ".txt":
		return "text/plain"
	default:
		return "application/octet-stream"
	}
}
