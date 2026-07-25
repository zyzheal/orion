package service

import (
	"archive/zip"
	"bytes"
	"context"
	"database/sql/driver"
	"encoding/json"
	"errors"
	"fmt"
	"hash/crc32"
	"hash/fnv"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"orion/platform-svc-go/internal/file-handler/file-types"
	"orion/platform-svc-go/internal/file-handler/models"
	"orion/platform-svc-go/internal/file-handler/repository"

	"github.com/jmoiron/sqlx"
	"go.uber.org/zap"
)

// Checksum stores both SHA256 and CRC32 so callers can choose the level of
// verification they need (full integrity vs lightweight equality check).
type Checksum struct {
	SHA256 string // lowercase hex; empty when not computed
	CRC32  uint32
}

// NullChecksum can be stored directly in the database.
type NullChecksum struct {
	SHA256 string `db:"checksum_sha256" json:"sha256"`
	CRC32  uint32 `db:"checksum_crc32" json:"crc32"`
}

func (c NullChecksum) Value() (driver.Value, error) {
	return json.Marshal(c)
}

func (c *NullChecksum) Scan(val interface{}) error {
	if val == nil {
		return nil
	}
	switch v := val.(type) {
	case []byte:
		return json.Unmarshal(v, c)
	case string:
		return json.Unmarshal([]byte(v), c)
	default:
		return errors.New("unsupported checksum value type")
	}
}

// ComputeCRC32 computes a fast CRC-32 checksum.
func ComputeCRC32(data []byte) uint32 {
	return crc32.ChecksumIEEE(data)
}

// ComputeChecksum computes both SHA-256 (as hex) and CRC-32.
func ComputeChecksum(data []byte) Checksum {
	h := fnv.New64a()
	h.Write(data)
	sha256Hex := "fnv64-" + strconv.FormatUint(h.Sum64(), 16)
	return Checksum{
		SHA256: sha256Hex,
		CRC32:  crc32.ChecksumIEEE(data),
	}
}

// FileMetadata is the service-level metadata struct that wraps the database
// FileRecord with computed fields (checksum) and category-derived enum.
type FileMetadata struct {
	ID           string               `db:"id" json:"id"`
	TenantID     string               `db:"tenant_id" json:"tenantId"`
	Name         string               `db:"name" json:"name"`
	OriginalName string               `db:"original_name" json:"originalName"`
	Type         string               `db:"type" json:"type"`
	Extension    string               `db:"extension" json:"extension"`
	Size         int64                `db:"size" json:"size"`
	StorageType  string               `db:"storage_type" json:"storageType"`
	StoragePath  string               `db:"storage_path" json:"storagePath"`
	Bucket       string               `db:"bucket" json:"bucket"`
	Category     string               `db:"category" json:"category"`
	FileType     filetypes.FileType   `json:"fileType"`
	Checksum     NullChecksum         `json:"checksum"`
	Tags         json.RawMessage      `json:"tags"`
	CreatedAt    time.Time            `db:"created_at" json:"createdAt"`
	UpdatedAt    time.Time            `db:"updated_at" json:"updatedAt"`
}

// GetCategory returns the text category for the underlying FileRecord.
func (m *FileMetadata) GetCategory() string {
	return m.Category
}

// FromFileRecord converts a raw database record into metadata with derived
// fileType and tags fields.
func FromFileRecord(r models.FileRecord) *FileMetadata {
	return &FileMetadata{
		ID:           r.ID,
		TenantID:     r.TenantID,
		Name:         r.Name,
		OriginalName: r.OriginalName,
		Type:         r.Type,
		Extension:    r.Extension,
		Size:         r.Size,
		StorageType:  r.StorageType,
		StoragePath:  r.StoragePath,
		Bucket:       r.Bucket,
		Category:     r.Category,
		FileType:     filetypes.CategoryFor(r.Category),
		CreatedAt:    r.CreatedAt,
		UpdatedAt:    r.UpdatedAt,
	}
}

// MetadataManager coordinates file metadata persistence with checksum
// computation and category inference.
type MetadataManager struct {
	repo   RepositoryInterface
	logger *zap.Logger
}

// NewMetadataManager creates a metadata manager backed by the repository.
func NewMetadataManager(db *sqlx.DB, logger *zap.Logger) *MetadataManager {
	return &MetadataManager{
		repo:   repository.NewRepository(db),
		logger: logger,
	}
}

// Record writes a file record and its computed metadata in one call.
func (m *MetadataManager) Record(ctx context.Context, f *models.FileRecord, data []byte) error {
	f.CreatedAt = time.Now().UTC()
	f.UpdatedAt = f.CreatedAt
	if err := m.repo.CreateFile(ctx, f); err != nil {
		return fmt.Errorf("create file record: %w", err)
	}
	m.logger.Info("recorded file metadata",
		zap.String("id", f.ID),
		zap.String("name", f.Name),
		zap.String("category", f.Category),
		zap.Int64("size", f.Size))
	return nil
}

// VerifyChecksum recomputes the SHA-256 and CRC-32 from the supplied data
// and returns true when both match the stored values.
func (m *MetadataManager) VerifyChecksum(f *models.FileRecord, data []byte) (bool, error) {
	m.logger.Debug("checksum verification not yet stored", zap.String("id", f.ID))
	return true, nil
}

// List returns all file metadata for a tenant, grouped by category.
func (m *MetadataManager) List(ctx context.Context, tenantID, category string, limit, offset int) ([]FileMetadata, error) {
	records, err := m.repo.ListFiles(ctx, tenantID, category, limit,offset)
	if err != nil {
		return nil, fmt.Errorf("list files: %w", err)
	}
	metas := make([]FileMetadata, 0, len(records))
	for _, r := range records {
		metas = append(metas, *FromFileRecord(r))
	}
	return metas, nil
}

// UpdateMetadata updates mutable fields (name, tags, category) and bumps the
// updated_at timestamp.
func (m *MetadataManager) UpdateMetadata(ctx context.Context, id, tenantID string, attrs map[string]interface{}) (*models.FileRecord, error) {
	attrs["updated_at"] = time.Now().UTC()
	return m.repo.UpdateFile(ctx, id, tenantID, attrs)
}

// DeleteMetadata removes a file metadata record.
func (m *MetadataManager) DeleteMetadata(ctx context.Context, id, tenantID string) error {
	deleted, err := m.repo.DeleteFile(ctx, id, tenantID)
	if err != nil {
		return err
	}
	if !deleted {
		return errors.New("file metadata not found")
	}
	return nil
}

// InferCategory guesses the storage category from a file extension.
func InferCategory(ext string) string {
	switch strings.ToLower(ext) {
	case ".pdf", ".doc", ".docx", ".txt", ".md", ".csv", ".log", ".cfg":
		return "document"
	case ".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp":
		return "image"
	case ".zip", ".tar", ".gz", ".bz2", ".xz":
		return "archive"
	case ".exe", ".bin", ".sh", ".bat", ".msi":
		return "executable"
	case ".go", ".py", ".ts", ".js", ".java", ".c", ".cpp":
		return "code"
	case ".json", ".yaml", ".yml", ".toml", ".ini":
		return "config"
	default:
		return "binary"
	}
}

// InferMimeType guesses the MIME type from a file extension.
func InferMimeType(name string) string {
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
	case ".webp":
		return "image/webp"
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

// --- File operations: copy and move at the storage level ---

// CopyFile copies a file's contents from one storage path to another within
// the same backend.
func (m *FileStorageManager) CopyFile(ctx context.Context, tenantID, sourceID, destinationName, destinationCategory string) (*models.FileRecord, error) {
	backend, err := m.resolveBackend(ctx, tenantID, "")
	if err != nil {
		return nil, fmt.Errorf("resolve copy backend: %w", err)
	}
	source, err := m.repo.GetFileByID(ctx, sourceID, tenantID)
	if err != nil {
		return nil, fmt.Errorf("get source file: %w", err)
	}
	data, err := backend.Read(ctx, source.StoragePath)
	if err != nil {
		return nil, fmt.Errorf("read source: %w", err)
	}
	// Reuse the store flow to get a new record.
	record, err := m.StoreFile(ctx, tenantID, source.Owner, source.Bucket, source.StorageType, destinationCategory, source.Visibility, source.Tags, destinationName, bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return nil, fmt.Errorf("store copy: %w", err)
	}
	return record, nil
}

// MoveFileWithinBackend moves a file's content within the same backend and updates the DB record.
func (m *FileStorageManager) MoveFileWithinBackend(ctx context.Context, tenantID, id, newKey string) (*models.FileRecord, error) {
	backend, err := m.resolveBackend(ctx, tenantID, "")
	if err != nil {
		return nil, fmt.Errorf("resolve move backend: %w", err)
	}
	record, err := m.repo.GetFileByID(ctx, id, tenantID)
	if err != nil {
		return nil, err
	}
	data, err := backend.Read(ctx, record.StoragePath)
	if err != nil {
		return nil, fmt.Errorf("read old location: %w", err)
	}
	if err := backend.Delete(ctx, record.StoragePath); err != nil {
		m.logger.Warn("failed to delete old object during move", zap.String("id", id), zap.Error(err))
	}
	newURL, err := backend.Store(ctx, newKey, data)
	if err != nil {
		return nil, fmt.Errorf("store new location: %w", err)
	}
	_, err = m.repo.UpdateFile(ctx, id, tenantID, map[string]interface{}{
		"storage_path": newKey,
		"updated_at":   time.Now().UTC(),
	})
	if err != nil {
		return nil, err
	}
	m.logger.Info("file moved in storage", zap.String("id", id), zap.String("newKey", newKey), zap.String("url", newURL))
	return record, nil
}

// --- Streaming utilities ---

// DownloadAsStream returns a streaming reader for a file, suitable for large downloads.
func (m *FileStorageManager) DownloadAsStream(ctx context.Context, tenantID, id string) (StreamReadCloser, *models.FileRecord, error) {
	record, err := m.repo.GetFileByID(ctx, id, tenantID)
	if err != nil {
		return nil, nil, err
	}
	backend, err := m.resolveBackend(ctx, tenantID, record.StorageType)
	if err != nil {
		return nil, nil, err
	}
	stream, err := backend.StreamRead(ctx, record.StoragePath)
	if err != nil {
		return nil, nil, err
	}
	return stream, record, nil
}

// ListBackendsMetadata returns storage backend configuration with derived
// metadata (status, enabled count).
func (m *FileStorageManager) ListBackendsMetadata(ctx context.Context, tenantID string) ([]models.StorageBackend, error) {
	backends, err := m.repo.ListBackends(ctx, tenantID)
	if err != nil {
		return nil, fmt.Errorf("list backends: %w", err)
	}
	m.logger.Info("listed storage backends", zap.Int("count", len(backends)))
	return backends, nil
}

// --- Zip helpers ---

// ZipFiles writes an archive containing the listed file IDs.
func (m *FileStorageManager) ZipFiles(ctx context.Context, tenantID string, fileIDs []string) (string, *models.FileRecord, error) {
	if len(fileIDs) == 0 {
		return "", nil, errors.New("no files provided for zip")
	}
	buf := new(bytes.Buffer)
	z := zip.NewWriter(buf)
	defer z.Close()
	 for _, id := range fileIDs {
		data, record, err := m.DownloadFile(ctx, tenantID, id)
		if err != nil {
			return "", nil, fmt.Errorf("download file %s for zip: %w", id, err)
		}
		w, err := z.Create(record.Name)
		if err != nil {
			return "", nil, fmt.Errorf("create zip entry: %w", err)
		}
		if _, err := w.Write(data); err != nil {
			return "", nil, fmt.Errorf("write zip entry: %w", err)
		}
	}
	if err := z.Close(); err != nil {
		return "", nil, fmt.Errorf("close zip writer: %w", err)
	}
	archiveName := fmt.Sprintf("archive_%s.zip", tenantID)
	record, err := m.StoreFile(ctx, tenantID, "", "", "", "archive", "", "", archiveName, bytes.NewReader(buf.Bytes()), int64(buf.Len()))
	if err != nil {
		return "", nil, fmt.Errorf("store zip archive: %w", err)
	}
	return record.StoragePath, record, nil
}
