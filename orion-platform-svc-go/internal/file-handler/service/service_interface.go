package service

import "context"

// IFileStorageMedium defines the capabilities required of any file storage backend.
// Implementations can target local filesystem, S3-compatible object stores (AWS S3,
// MinIO, etc.), Azure Blob Storage, and Google Cloud Storage (GCS).
type IFileStorageMedium interface {
	// Name returns the backend name used for routing.
	Name() string

	// Store writes data for the given key and returns a retrievable URL string.
	Store(ctx context.Context, key string, data []byte) (string, error)

	// Read retrieves the full data for the given key.
	Read(ctx context.Context, key string) ([]byte, error)

	// StreamRead returns a streaming reader for the given key, enabling
	// chunked downloads without loading the entire object into memory.
	// Returns ErrObjectNotFound when the object does not exist.
	StreamRead(ctx context.Context, key string) (StreamReadCloser, error)

	// Delete removes the object identified by key.
	Delete(ctx context.Context, key string) error

	// Exists checks whether an object exists for the given key.
	Exists(ctx context.Context, key string) bool

	// URL returns a presigned or direct-access URL for the object.
	URL(ctx context.Context, key string) string

	// List returns the keys matching the given prefix.
	List(ctx context.Context, prefix string) ([]string, error)
}

// StreamReadCloser abstracts streaming reads from a storage backend,
// enabling chunked download without loading the entire object into memory.
type StreamReadCloser interface {
	// Read fills the provided buffer and returns the number of bytes read.
	Read([]byte) (int, error)
	// Close releases any underlying resources.
	Close() error
	// Size returns the total size of the object, or -1 if unknown.
	Size() int64
	// ContentType returns the MIME type of the object, or "application/octet-stream".
	ContentType() string
}
