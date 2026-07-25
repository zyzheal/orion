package service

import (
	"context"
	"errors"
	"fmt"
	"io"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"orion/platform-svc-go/internal/file-handler/file-types"
	"orion/platform-svc-go/internal/file-handler/models"
	"orion/platform-svc-go/internal/file-handler/repository"
	"orion/go-common/pkg/sentinel"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"go.uber.org/zap"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	CreateFile(ctx context.Context, f *models.FileRecord) error
	GetFileByID(ctx context.Context, id, tenantID string) (*models.FileRecord, error)
	GetFileByStoragePath(ctx context.Context, tenantID, storagePath string) (*models.FileRecord, error)
	ListFiles(ctx context.Context, tenantID, category string, limit, offset int) ([]models.FileRecord, error)
	UpdateFile(ctx context.Context, id, tenantID string, attrs map[string]interface{}) (*models.FileRecord, error)
	DeleteFile(ctx context.Context, id, tenantID string) (bool, error)

	CreateBackend(ctx context.Context, b *models.StorageBackend) error
	GetBackendByID(ctx context.Context, id, tenantID string) (*models.StorageBackend, error)
	GetBackendByName(ctx context.Context, name, tenantID string) (*models.StorageBackend, error)
	ListBackends(ctx context.Context, tenantID string) ([]models.StorageBackend, error)
	UpdateBackend(ctx context.Context, id, tenantID string, attrs map[string]interface{}) (*models.StorageBackend, error)
	DeleteBackend(ctx context.Context, id, tenantID string) (bool, error)
}

// ErrFileTypeUnknown is returned for an unregistered file extension.
var ErrFileTypeUnknown = errors.New("file type not registered")

// ErrFileTooLarge is returned when the file exceeds the maximum size.
var ErrFileTooLarge = errors.New("file exceeds maximum allowed size")

// ErrFileInvalid is returned when content validation fails.
var ErrFileInvalid = errors.New("file content is invalid")

// ErrObjectNotFound is returned when a storage backend cannot locate the
// requested object by key.
var ErrObjectNotFound = errors.New("object not found in storage")

// MoveRequest moves/renames a file record.
type MoveRequest struct {
	Name     *string `json:"name"`
	Bucket   *string `json:"bucket"`
	Category *string `json:"category"`
}

// FileStorageManager coordinates file type validation and storage backends.
type FileStorageManager struct {
	typeRegistry    *filetypes.Registry
	storageBackends map[string]IFileStorageMedium
	repo            RepositoryInterface
	logger          *zap.Logger
	mu              sync.RWMutex
}

// NewFileStorageManager creates a new manager with the given dependencies.
func NewFileStorageManager(db *sqlx.DB, logger *zap.Logger) *FileStorageManager {
	return &FileStorageManager{
		typeRegistry:    filetypes.NewRegistry(),
		storageBackends: make(map[string]IFileStorageMedium),
		repo:            repository.NewRepository(db),
		logger:          logger,
	}
}

// RegisterTypeHandler registers a type handler for a file extension.
func (m *FileStorageManager) RegisterTypeHandler(h filetypes.Handler) {
	m.typeRegistry.Register(h)
}

// RegisterStorageBackend registers a storage backend by name.
func (m *FileStorageManager) RegisterStorageBackend(s IFileStorageMedium) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.storageBackends[s.Name()] = s
	m.logger.Info("registered storage backend", zap.String("name", s.Name()))
}

// StoreFile uploads a file, validates it, stores it, and returns the record.
func (m *FileStorageManager) StoreFile(ctx context.Context, tenantID, owner, bucket, storageType, category, visibility, tags, originalName string, reader io.Reader, size int64) (*models.FileRecord, error) {
	ext := strings.ToLower(filepath.Ext(originalName))
	if ext == "" {
		return nil, errors.New("file extension is required")
	}

	handler, ok := m.typeRegistry.Get(ext)
	if !ok {
		handler = filetypes.NewGenericHandler(ext, "application/octet-stream", category)
	}

	// Validate max size.
	if size > handler.MaxSize() {
		return nil, fmt.Errorf("%w (%d > %d)", ErrFileTooLarge, size, handler.MaxSize())
	}

	// Read content for validation.
	data, err := io.ReadAll(reader)
	if err != nil {
		return nil, fmt.Errorf("read file: %w", err)
	}

	if err := handler.Validate(data); err != nil {
		return nil, fmt.Errorf("%w: %s", ErrFileInvalid, err.Error())
	}

	// Generate a unique storage key.
	key := tenantID + "/" + uuid.New().String() + ext

	// Resolve backend.
	backend, err := m.resolveBackend(ctx, tenantID, storageType)
	if err != nil {
		return nil, err
	}

	storageURL, err := backend.Store(ctx, key, data)
	if err != nil {
		return nil, fmt.Errorf("store: %w", err)
	}

	record := &models.FileRecord{
		TenantID:     tenantID,
		Name:         originalName,
		OriginalName: originalName,
		Type:         handler.MIMEType(),
		Extension:    ext,
		Size:         size,
		StorageType:  storageType,
		StoragePath:  key,
		Bucket:       bucket,
		Category:     category,
		Owner:        owner,
		Visibility:   visibility,
		Tags:         tags,
	}

	if err := m.repo.CreateFile(ctx, record); err != nil {
		return nil, fmt.Errorf("persist record: %w", err)
	}

	m.logger.Info("file stored", zap.String("id", record.ID), zap.String("name", originalName),
		zap.String("storage", storageURL), zap.Int64("size", size))
	return record, nil
}

// GetFile retrieves a file record by ID.
func (m *FileStorageManager) GetFile(ctx context.Context, tenantID, id string) (*models.FileRecord, error) {
	return m.repo.GetFileByID(ctx, id, tenantID)
}

// DownloadFile reads file content from storage and returns it with the record.
func (m *FileStorageManager) DownloadFile(ctx context.Context, tenantID, id string) ([]byte, *models.FileRecord, error) {
	record, err := m.repo.GetFileByID(ctx, id, tenantID)
	if err != nil {
		return nil, nil, err
	}

	backend, err := m.resolveBackend(ctx, tenantID, record.StorageType)
	if err != nil {
		return nil, nil, err
	}

	data, err := backend.Read(ctx, record.StoragePath)
	if err != nil {
		return nil, nil, err
	}
	return data, record, nil
}

// DeleteFile removes a file from storage and the DB.
func (m *FileStorageManager) DeleteFile(ctx context.Context, tenantID, id string) error {
	record, err := m.repo.GetFileByID(ctx, id, tenantID)
	if err != nil {
		return err
	}

	backend, bErr := m.resolveBackend(ctx, tenantID, record.StorageType)
	if bErr == nil {
		_ = backend.Delete(ctx, record.StoragePath)
	}

	deleted, err := m.repo.DeleteFile(ctx, id, tenantID)
	if err != nil {
		return err
	}
	if !deleted {
		return sentinel.NotFound
	}
	m.logger.Info("file deleted", zap.String("id", id))
	return nil
}

// ListFiles lists files for a tenant with optional category filter.
func (m *FileStorageManager) ListFiles(ctx context.Context, tenantID, category string, limit, offset int) ([]models.FileRecord, error) {
	if limit <= 0 {
		limit = 50
	}
	if offset < 0 {
		offset = 0
	}
	return m.repo.ListFiles(ctx, tenantID, category, limit, offset)
}

// MoveFile moves/renames a file record.
func (m *FileStorageManager) MoveFile(ctx context.Context, tenantID, id string, req *MoveRequest) (*models.FileRecord, error) {
	attrs := make(map[string]interface{})
	if req.Name != nil {
		attrs["name"] = *req.Name
		attrs["original_name"] = *req.Name
	}
	if req.Bucket != nil {
		attrs["bucket"] = *req.Bucket
	}
	if req.Category != nil {
		attrs["category"] = *req.Category
	}
	attrs["updated_at"] = time.Now().UTC()
	return m.repo.UpdateFile(ctx, id, tenantID, attrs)
}

// FileURL returns the download URL for a file.
func (m *FileStorageManager) FileURL(ctx context.Context, tenantID, id string) (string, error) {
	record, err := m.repo.GetFileByID(ctx, id, tenantID)
	if err != nil {
		return "", err
	}
	backend, bErr := m.resolveBackend(ctx, tenantID, record.StorageType)
	if bErr != nil {
		return "", bErr
	}
	return backend.URL(ctx, record.StoragePath), nil
}

// ValidateFileType checks whether a file extension + content is allowed.
func (m *FileStorageManager) ValidateFileType(ctx context.Context, extension string, data []byte) error {
	ext := strings.ToLower(extension)
	if ext != "" && ext[0] != '.' {
		ext = "." + ext
	}
	handler, ok := m.typeRegistry.Get(ext)
	if !ok {
		return fmt.Errorf("%w: %s", ErrFileTypeUnknown, ext)
	}
	if data != nil {
		if int64(len(data)) > handler.MaxSize() {
			return ErrFileTooLarge
		}
		return handler.Validate(data)
	}
	return nil
}

// CreateBackend persists a new storage backend.
func (m *FileStorageManager) CreateBackend(ctx context.Context, tenantID, name, typ, config string, enabled bool) (*models.StorageBackend, error) {
	b := &models.StorageBackend{
		TenantID: tenantID,
		Name:     name,
		Type:     typ,
		Config:   config,
		Enabled:  enabled,
	}
	if err := m.repo.CreateBackend(ctx, b); err != nil {
		return nil, err
	}
	m.logger.Info("storage backend created", zap.String("name", name), zap.String("type", typ))
	return b, nil
}

// ListBackends lists storage backends for a tenant.
func (m *FileStorageManager) ListBackends(ctx context.Context, tenantID string) ([]models.StorageBackend, error) {
	return m.repo.ListBackends(ctx, tenantID)
}

// resolveBackend resolves the storage backend for a given type.
func (m *FileStorageManager) resolveBackend(_ context.Context, tenantID, storageType string) (IFileStorageMedium, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	for _, b := range m.storageBackends {
		// Match by name (storageType) for routing.
		if b.Name() == storageType {
			return b, nil
		}
	}
	// Fallback: try default/local backend.
	if b, ok := m.storageBackends["local"]; ok {
		return b, nil
	}
	return nil, fmt.Errorf("no storage backend available for type: %s", storageType)
}
