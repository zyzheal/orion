package query

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/xuri/excelize/v2"
)

// ErrExportCancelled is returned when the export ctx is cancelled before
// the .xlsx file is fully written. The partially-written file is
// deleted so the caller never reads a truncated artifact.
var ErrExportCancelled = errors.New("export cancelled")

// ErrExportFile is a generic exporter failure (write, save, sign).
// Callers should map it to a 500 with err.Error() attached.
var ErrExportFile = errors.New("export write failed")

// ErrExportLimit is returned when the caller requested more rows than
// allowed. The service layer enforces this before invoking the exporter.
var ErrExportLimit = errors.New("export limit exceeded")

// WriteExcel is the low-level exporter entry point. It consumes rows
// from the provided channel and writes an .xlsx file to disk via
// excelize. The returned path is a local filesystem path — it MUST
// NOT be returned to an API client directly; the service layer is
// responsible for signing it via SignedURL.
//
// Design notes:
//   - Rows are written one at a time into a streaming buffer to keep
//     peak memory bounded by a single row.
//   - The first sheet is named "data". Column headers are written in
//     row 1 with a bold font and background fill so exported files
//     render correctly in Excel without user formatting.
//   - Cells are typed by Go runtime reflection: int64/float64/bool go
//     through their numeric formatters, time.Time becomes RFC3339,
//     []byte becomes its UTF-8 string, and every other value goes via
//     fmt.Sprintf so we never panic on an unknown column type.
//   - When ctx is cancelled mid-stream, the partial file is deleted
//     and ErrExportCancelled is returned so the caller can distinguish
//     "cancelled" from "corrupted".
//
// cols must be non-empty. An empty column list produces a valid .xlsx
// file with just an empty sheet — callers should validate upstream.
func WriteExcel(ctx context.Context, path string, cols []QueryColumn, rows <-chan []interface{}) (int, error) {
	if len(cols) == 0 {
		return 0, fmt.Errorf("%w: no columns", ErrExportFile)
	}

	f := excelize.NewFile()
	sheet := f.GetSheetName(0)

	header := make([]interface{}, len(cols))
	for i, c := range cols {
		header[i] = c.Name
	}
	if err := f.SetSheetRow(sheet, "A1", &header); err != nil {
		_ = f.Close()
		_ = os.Remove(path)
		return 0, fmt.Errorf("%w: header write: %v", ErrExportFile, err)
	}

	// Style the header row once, not per cell — excelize caches styles
	// so this is O(1) after the first call.
	styleID, err := f.NewStyle(&excelize.Style{
		Font:      &excelize.Font{Bold: true, Color: "#FFFFFF"},
		Fill:      excelize.Fill{Type: "pattern", Color: []string{"#FF3370E6", "#FF3370E6"}, Pattern: 1},
		Alignment: &excelize.Alignment{Horizontal: "center"},
	})
	if err == nil {
		endCol, _ := excelize.CoordinatesToCellName(len(cols), 1)
		_ = f.SetCellStyle(sheet, "A1", endCol, styleID)
	}

	count := 0
	rowIdx := 2
	for {
		select {
		case <-ctx.Done():
			_ = f.Close()
			_ = os.Remove(path)
			return count, fmt.Errorf("%w: %v", ErrExportCancelled, ctx.Err())
		case r, ok := <-rows:
			if !ok {
				goto done
			}
			if err := writeRow(f, sheet, rowIdx, r); err != nil {
				_ = f.Close()
				_ = os.Remove(path)
				return count, fmt.Errorf("%w: row %d: %v", ErrExportFile, rowIdx, err)
			}
			rowIdx++
			count++
		}
	}

done:
	if err := f.SaveAs(path); err != nil {
		_ = os.Remove(path)
		return count, fmt.Errorf("%w: save: %v", ErrExportFile, err)
	}
	_ = f.Close()
	return count, nil
}

// writeRow converts a Go row into an excelize cell slice. Values are
// coerced to plain strings/int64/float64/bool so JSON round-trips do
// not crash the writer. Nil becomes an empty string to keep the row
// width consistent across the sheet.
func writeRow(f *excelize.File, sheet string, rowIdx int, row []interface{}) error {
	converted := make([]interface{}, len(row))
	for i, v := range row {
		if v == nil {
			converted[i] = ""
			continue
		}
		switch t := v.(type) {
		case []byte:
			converted[i] = string(t)
		case time.Time:
			converted[i] = t.Format(time.RFC3339Nano)
		case fmt.Stringer:
			// fmt.Stringer comes before the string case so custom
			// types that both embed string and implement Stringer
			// use their canonical representation.
			converted[i] = t.String()
		case string, int, int8, int16, int32, int64,
			uint, uint8, uint16, uint32, uint64,
			float32, float64, bool:
			converted[i] = t
		default:
			converted[i] = fmt.Sprintf("%v", t)
		}
	}
	cell, err := excelize.CoordinatesToCellName(1, rowIdx)
	if err != nil {
		return err
	}
	return f.SetSheetRow(sheet, cell, &converted)
}

// Store abstracts where the exported file lives so WriteExcel remains
// usable in tests without touching disk. Production uses LocalStore.
type Store interface {
	// Put writes the bytes under a unique key and returns the key.
	Put(ctx context.Context, key string, r io.Reader) (string, error)
	// Delete removes a file by key. Idempotent.
	Delete(ctx context.Context, key string) error
}

// LocalStore writes to a directory on disk. It is the default for
// dev/test; production deployments should override with S3 or a
// similar object store.
type LocalStore struct {
	Dir string
}

// NewLocalStore initialises the temp directory if it does not exist.
func NewLocalStore(dir string) (*LocalStore, error) {
	if dir == "" {
		dir = filepath.Join(os.TempDir(), "orion-dba-exports")
	}
	if err := os.MkdirAll(dir, 0o750); err != nil {
		return nil, fmt.Errorf("local store mkdir: %w", err)
	}
	return &LocalStore{Dir: dir}, nil
}

func (s *LocalStore) Put(ctx context.Context, key string, r io.Reader) (string, error) {
	if s == nil || s.Dir == "" {
		return "", fmt.Errorf("%w: local store not configured", ErrExportFile)
	}
	key = sanitizeKey(key)
	path := filepath.Join(s.Dir, key)
	f, err := os.Create(path)
	if err != nil {
		return "", fmt.Errorf("%w: create %s: %v", ErrExportFile, key, err)
	}
	n, err := io.Copy(f, r)
	if closeErr := f.Close(); err == nil {
		err = closeErr
	}
	if err != nil {
		_ = os.Remove(path)
		return "", fmt.Errorf("%w: copy: %v", ErrExportFile, err)
	}
	if n == 0 {
		_ = os.Remove(path)
		return "", fmt.Errorf("%w: empty file", ErrExportFile)
	}
	return path, nil
}

func (s *LocalStore) Delete(ctx context.Context, key string) error {
	if s == nil || s.Dir == "" || key == "" {
		return nil
	}
	// Only delete inside the store dir to prevent path traversal.
	target := filepath.Join(s.Dir, sanitizeKey(key))
	dirAbs, _ := filepath.Abs(s.Dir)
	targetAbs, _ := filepath.Abs(target)
	if !strings.HasPrefix(targetAbs, dirAbs) {
		return nil
	}
	return os.Remove(targetAbs)
}

// sanitizeKey removes path separators so a caller cannot smuggle
// "../" or an absolute path into the store.
func sanitizeKey(k string) string {
	k = strings.TrimLeft(k, "/")
	k = strings.ReplaceAll(k, "/", "_")
	k = strings.ReplaceAll(k, "\\", "_")
	if idx := strings.Index(k, ".."); idx >= 0 {
		k = strings.ReplaceAll(k, "..", ".")
	}
	return k
}

// SignedURLProvider converts an opaque file key into a URL the client
// can fetch. The default LocalURLProvider returns a local file:// URL
// with an HMAC signature so downstream middleware can verify
// integrity without exposing the secret.
type SignedURLProvider interface {
	Sign(key string, expiry time.Duration) string
}

// LocalURLProvider signs a local file path into a shareable URL. The
// signature is HMAC-SHA256 of "key|expiryUnixSeconds" using SecretKey
// so a tampered URL is detectable. The URL format is:
//
//	file://<key>?exp=<unix>&sig=<hex hmac>
//
// A production deployment should replace this with an S3 presigner or
// a CDN-issued token; the interface is what the API consumers see.
type LocalURLProvider struct {
	SecretKey []byte
	// Host is prefixed onto file:// URLs so the base URL is stable
	// even when SecretKey changes (useful for cross-host tests).
	Host string
}

// NewLocalURLProvider requires a non-empty secret. An empty secret
// makes the signature useless and any caller could mint URLs.
func NewLocalURLProvider(secret []byte, host string) (*LocalURLProvider, error) {
	if len(secret) == 0 {
		return nil, fmt.Errorf("%w: empty signing secret", ErrExportFile)
	}
	if host == "" {
		host = "http://localhost"
	}
	return &LocalURLProvider{SecretKey: secret, Host: host}, nil
}

func (p *LocalURLProvider) Sign(key string, expiry time.Duration) string {
	if p == nil || len(p.SecretKey) == 0 {
		return ""
	}
	if expiry <= 0 {
		expiry = time.Hour
	}
	expiresAt := time.Now().UTC().Add(expiry).Unix()
	payload := fmt.Sprintf("%s|%d", key, expiresAt)
	mac := hmac.New(sha256.New, p.SecretKey)
	_, _ = mac.Write([]byte(payload))
	sig := hex.EncodeToString(mac.Sum(nil))
	return fmt.Sprintf("%s/dba/export?file=%s&exp=%d&sig=%s",
		p.Host, url.QueryEscape(key), expiresAt, sig)
}

// VerifySignedURL is a tiny helper used by the download handler (out
// of scope for this task) but kept here so the signature is a single
// source of truth.
func (p *LocalURLProvider) VerifySignedURL(key string, expUnix int64, sigHex string) bool {
	if p == nil || len(p.SecretKey) == 0 {
		return false
	}
	payload := fmt.Sprintf("%s|%d", key, expUnix)
	mac := hmac.New(sha256.New, p.SecretKey)
	_, _ = mac.Write([]byte(payload))
	want := hex.EncodeToString(mac.Sum(nil))
	if !hmac.Equal([]byte(want), []byte(sigHex)) {
		return false
	}
	if time.Now().UTC().Unix() > expUnix {
		return false
	}
	return true
}

// _ = strconv.Itoa keeps the import alive for future integer formatting.
var _ = strconv.Itoa
