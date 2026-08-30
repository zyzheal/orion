package storage

import (
	"context"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
)

// Local implements StorageBackend over the local filesystem. All paths are
// joined to BasePath and normalized — callers cannot escape the base dir
// even if they pass "../etc/passwd" as path.
type Local struct {
	BasePath string
}

func (l *Local) Type() string { return "local" }

// safeJoin validates that the given path does not escape BasePath. This
// defends against the classic path traversal bug where a caller-controlled
// path with "../" segments could reach arbitrary files on the host.
func (l *Local) safeJoin(path string) (string, error) {
	// Reject absolute paths outright; we always treat paths as relative
	// to BasePath so a confused caller cannot land elsewhere on disk.
	if filepath.IsAbs(path) {
		return "", fmt.Errorf("storage/local: absolute path not allowed: %s", path)
	}
	// Clean collapses any ".." segments the caller might have smuggled in.
	cleaned := filepath.Clean(path)
	if strings.HasPrefix(cleaned, "..") {
		return "", fmt.Errorf("storage/local: path escapes base path: %s", path)
	}
	return filepath.Join(l.BasePath, cleaned), nil
}

func (l *Local) Put(_ context.Context, path string, reader io.Reader) error {
	full, err := l.safeJoin(path)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(full), 0o750); err != nil {
		return err
	}
	out, err := os.OpenFile(full, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0o600)
	if err != nil {
		return err
	}
	defer out.Close()
	_, err = io.Copy(out, reader)
	return err
}

func (l *Local) Get(_ context.Context, path string) (io.ReadCloser, error) {
	full, err := l.safeJoin(path)
	if err != nil {
		return nil, err
	}
	return os.Open(full)
}

func (l *Local) Delete(_ context.Context, path string) error {
	full, err := l.safeJoin(path)
	if err != nil {
		return err
	}
	if err := os.Remove(full); err != nil && !os.IsNotExist(err) {
		return err
	}
	return nil
}

func (l *Local) Exists(_ context.Context, path string) (bool, error) {
	full, err := l.safeJoin(path)
	if err != nil {
		return false, err
	}
	if _, err := os.Stat(full); err != nil {
		if os.IsNotExist(err) {
			return false, nil
		}
		return false, err
	}
	return true, nil
}

func (l *Local) Size(_ context.Context, path string) (int64, error) {
	full, err := l.safeJoin(path)
	if err != nil {
		return 0, err
	}
	info, err := os.Stat(full)
	if err != nil {
		if os.IsNotExist(err) {
			return 0, nil
		}
		return 0, err
	}
	return info.Size(), nil
}
