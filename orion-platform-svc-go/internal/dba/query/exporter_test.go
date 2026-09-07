package query

import (
	"context"
	"io"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/xuri/excelize/v2"
)

func TestWriteExcel_RoundTrip(t *testing.T) {
	ctx := context.Background()
	path := filepath.Join(t.TempDir(), "test.xlsx")

	cols := []QueryColumn{
		{Name: "id", DataType: "int64"},
		{Name: "name", DataType: "string"},
		{Name: "created_at", DataType: "time"},
	}
	rows := make(chan []interface{}, 10)
	go func() {
		defer close(rows)
		rows <- []interface{}{1, "alice", time.Date(2024, 1, 2, 3, 4, 5, 0, time.UTC)}
		rows <- []interface{}{2, "bob", time.Date(2024, 2, 3, 4, 5, 6, 0, time.UTC)}
		rows <- []interface{}{3, nil, time.Date(2024, 3, 4, 5, 6, 7, 0, time.UTC)}
	}()

	count, err := WriteExcel(ctx, path, cols, rows)
	if err != nil {
		t.Fatalf("WriteExcel: %v", err)
	}
	if count != 3 {
		t.Errorf("count = %d, want 3", count)
	}
	if _, err := os.Stat(path); err != nil {
		t.Fatalf("output file missing: %v", err)
	}

	// Round-trip read.
	f, err := excelize.OpenFile(path)
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	defer f.Close()
	sheet := f.GetSheetName(0)
	rowsOut, err := f.GetRows(sheet)
	if err != nil {
		t.Fatalf("get rows: %v", err)
	}
	if len(rowsOut) != 4 { // header + 3 data rows
		t.Errorf("row count = %d, want 4: %v", len(rowsOut), rowsOut)
	}
	// Header.
	if rowsOut[0][0] != "id" || rowsOut[0][1] != "name" || rowsOut[0][2] != "created_at" {
		t.Errorf("header mismatch: %v", rowsOut[0])
	}
	// Data row 1: id=1.
	if rowsOut[1][0] != "1" && rowsOut[1][0] != "1.0" {
		t.Errorf("id cell unexpected: %q", rowsOut[1][0])
	}
	if rowsOut[1][1] != "alice" {
		t.Errorf("name cell unexpected: %q", rowsOut[1][1])
	}
	// Nil in row 3 becomes empty string.
	if rowsOut[3][1] != "" {
		t.Errorf("nil should be empty string: %q", rowsOut[3][1])
	}
}

func TestWriteExcel_EmptyColumnsFails(t *testing.T) {
	ctx := context.Background()
	path := filepath.Join(t.TempDir(), "empty.xlsx")
	rows := make(chan []interface{}, 1)
	close(rows)
	_, err := WriteExcel(ctx, path, nil, rows)
	if err == nil {
		t.Fatal("expected error for empty columns")
	}
}

func TestWriteExcel_ContextCancelRemovesPartial(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel() // pre-cancel
	path := filepath.Join(t.TempDir(), "cancel.xlsx")
	cols := []QueryColumn{{Name: "x", DataType: "int64"}}
	rows := make(chan []interface{}, 1)
	go func() {
		defer close(rows)
		rows <- []interface{}{1}
		rows <- []interface{}{2}
	}()
	_, err := WriteExcel(ctx, path, cols, rows)
	if err == nil {
		t.Fatal("expected cancel error")
	}
	if _, statErr := os.Stat(path); statErr == nil {
		t.Errorf("partial file should have been removed")
	}
}

func TestWriteExcel_LargeRowDoesNotCorrupt(t *testing.T) {
	ctx := context.Background()
	path := filepath.Join(t.TempDir(), "large.xlsx")
	cols := []QueryColumn{{Name: "x", DataType: "string"}}
	n := 5000
	rows := make(chan []interface{}, 100)
	go func() {
		defer close(rows)
		for i := 0; i < n; i++ {
			rows <- []interface{}{i}
		}
	}()
	count, err := WriteExcel(ctx, path, cols, rows)
	if err != nil {
		t.Fatalf("WriteExcel: %v", err)
	}
	if count != n {
		t.Errorf("count = %d, want %d", count, n)
	}
	// Verify the file is a valid xlsx (can be opened).
	f, err := excelize.OpenFile(path)
	if err != nil {
		t.Fatalf("reopen: %v", err)
	}
	defer f.Close()
	out, err := f.GetRows(f.GetSheetName(0))
	if err != nil {
		t.Fatalf("get rows: %v", err)
	}
	if len(out) != n+1 {
		t.Errorf("rows = %d, want %d+1", len(out), n)
	}
}

func TestSanitizeKey_BlocksTraversal(t *testing.T) {
	bad := "../etc/passwd"
	got := sanitizeKey(bad)
	if filepath.IsAbs(got) {
		t.Errorf("absolute path slipped through: %q", got)
	}
	// Trivial: absolute paths become relative.
	if got == bad {
		t.Errorf("key unchanged: %q", got)
	}
}

func TestLocalStore_PutRoundTrip(t *testing.T) {
	ctx := context.Background()
	dir := t.TempDir()
	store, err := NewLocalStore(dir)
	if err != nil {
		t.Fatalf("new store: %v", err)
	}
	payload := []byte("hello world")
	// Put wraps io.Reader, so use bytes.NewReader.
	reader := &testReader{data: payload}
	key, err := store.Put(ctx, "test/file.xlsx", reader)
	if err != nil {
		t.Fatalf("put: %v", err)
	}
	if key != filepath.Join(dir, "test_file.xlsx") {
		// Paths on different OSes use different separators; the key
		// must contain the sanitized filename.
		if !contains(key, "test_file.xlsx") {
			t.Errorf("key = %q", key)
		}
	}
	// Read back.
	b, err := os.ReadFile(key)
	if err != nil {
		t.Fatalf("read back: %v", err)
	}
	if string(b) != "hello world" {
		t.Errorf("content mismatch: %q", b)
	}
}

func TestLocalURLProvider_SignAndVerify(t *testing.T) {
	secret := []byte("test-secret-please-change")
	p, err := NewLocalURLProvider(secret, "http://host.local")
	if err != nil {
		t.Fatalf("new provider: %v", err)
	}
	url := p.Sign("exports/job1.xlsx", time.Hour)
	if url == "" {
		t.Fatal("empty url")
	}
	// Manual verification: parse the URL and re-verify the sig.
	// The signed URL format is: http://host.local/dba/export?file=...&exp=...&sig=...
	parts := splitOnEqual(url, "sig=")
	if parts == "" {
		t.Fatalf("url missing sig: %q", url)
	}
	parts2 := splitOnEqual(url, "exp=")
	if parts2 == "" {
		t.Fatalf("url missing exp: %q", url)
	}
	// Extract just the numeric exp.
	var exp int64
	_, _ = fmtSscan(parts2, &exp)
	key := "exports/job1.xlsx"
	if !p.VerifySignedURL(key, exp, parts) {
		t.Errorf("verify failed for valid URL: %q", url)
	}
	// Tampering breaks the check.
	if p.VerifySignedURL(key, exp, "deadbeef") {
		t.Errorf("verify should fail for bad signature")
	}
	if p.VerifySignedURL("other/file.xlsx", exp, parts) {
		t.Errorf("verify should fail for wrong key")
	}
}

func TestNewLocalURLProvider_EmptySecretRejected(t *testing.T) {
	if _, err := NewLocalURLProvider(nil, "http://x"); err == nil {
		t.Error("expected error for empty secret")
	}
}

// ---- tiny helpers ----

type testReader struct {
	data []byte
	pos  int
}

func (r *testReader) Read(p []byte) (int, error) {
	if r.pos >= len(r.data) {
		return 0, io.EOF
	}
	n := copy(p, r.data[r.pos:])
	r.pos += n
	return n, nil
}

func contains(s, sub string) bool {
	return len(s) >= len(sub) && (func() bool {
		for i := 0; i+len(sub) <= len(s); i++ {
			if s[i:i+len(sub)] == sub {
				return true
			}
		}
		return false
	})()
}

func splitOnEqual(s, key string) string {
	idx := indexOf(s, key)
	if idx < 0 {
		return ""
	}
	rest := s[idx+len(key):]
	// Trim up to the next '&'.
	n := indexOf(rest, "&")
	if n < 0 {
		return rest
	}
	return rest[:n]
}

func indexOf(s, sub string) int {
	for i := 0; i+len(sub) <= len(s); i++ {
		if s[i:i+len(sub)] == sub {
			return i
		}
	}
	return -1
}

func fmtSscan(s string, dest *int64) (int, error) {
	var chars int
	for i := 0; i < len(s); i++ {
		c := s[i]
		if c < '0' || c > '9' {
			break
		}
		*dest = *dest*10 + int64(c-'0')
		chars++
	}
	return chars, nil
}
