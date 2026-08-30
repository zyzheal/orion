// Package storage abstracts the destination for backup artifacts. Phase 1a
// ships Local and S3-compatible (MinIO/AWS) backends; the interface is the
// stable contract — executors write to a local file first, then the caller
// uploads via Storage.Put. This keeps the Verifier able to reopen the exact
// bytes that were stored.
package storage

import (
	"context"
	"errors"
	"fmt"
	"io"
)

// ErrUnsupportedBackend is returned by New when the caller requests a storage
// type this package has not implemented.
var ErrUnsupportedBackend = errors.New("unsupported storage backend")

// StorageBackend is the interface a backup/restore pipeline uses to move
// artifacts to and from persistent storage. Implementations must be safe for
// concurrent use from multiple goroutines.
type StorageBackend interface {
	// Put streams reader to the given path. Overwrite is implicit.
	Put(ctx context.Context, path string, reader io.Reader) error
	// Get returns a ReadCloser for the given path. Callers must close.
	Get(ctx context.Context, path string) (io.ReadCloser, error)
	// Delete removes the object. Idempotent — missing objects are not an
	// error so cleanup paths can loop safely.
	Delete(ctx context.Context, path string) error
	// Exists reports whether the object is present.
	Exists(ctx context.Context, path string) (bool, error)
	// Size returns the byte size of the object, or 0 when missing.
	Size(ctx context.Context, path string) (int64, error)
	// Type returns a stable identifier ("local", "s3") for logging.
	Type() string
}

// Config holds backend-specific settings parsed from application config.
type Config struct {
	Type string // "local" | "s3"

	// Local
	//   BasePath: absolute directory that holds all artifacts.
	BasePath string

	// S3 / MinIO
	Endpoint  string // e.g. "s3.amazonaws.com" or "minio.internal:9000"
	Region    string
	Bucket    string
	AccessKey string
	SecretKey string
	UseSSL    bool
}

// New constructs the StorageBackend described by cfg. Callers should pass
// through values from config.Config; New normalizes defaults so tests and
// production share one code path.
func New(cfg Config) (StorageBackend, error) {
	if cfg.Type == "" {
		cfg.Type = "local"
	}
	switch cfg.Type {
	case "local":
		if cfg.BasePath == "" {
			return nil, fmt.Errorf("%w: local base_path required", ErrUnsupportedBackend)
		}
		return &Local{BasePath: cfg.BasePath}, nil
	case "s3", "minio":
		if cfg.Bucket == "" || cfg.AccessKey == "" || cfg.SecretKey == "" {
			return nil, fmt.Errorf("%w: s3 bucket/access_key/secret_key required", ErrUnsupportedBackend)
		}
		return NewS3(S3Config{
			Endpoint:  cfg.Endpoint,
			Region:    cfg.Region,
			Bucket:    cfg.Bucket,
			AccessKey: cfg.AccessKey,
			SecretKey: cfg.SecretKey,
			UseSSL:    cfg.UseSSL,
		})
	}
	return nil, fmt.Errorf("%w: %s", ErrUnsupportedBackend, cfg.Type)
}
