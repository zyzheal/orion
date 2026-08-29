package service

import (
	"context"
	"testing"
	"time"

	"go.uber.org/zap/zaptest"

	dsm "orion/platform-svc-go/internal/datasource/models"
)

type fakeRepo struct {
	data map[string]*dsm.DataSource
}

func newFakeRepo() *fakeRepo {
	return &fakeRepo{data: make(map[string]*dsm.DataSource)}
}

func (r *fakeRepo) Create(_ context.Context, ds *dsm.DataSource) error {
	r.data[ds.ID] = ds
	return nil
}
func (r *fakeRepo) GetByID(_ context.Context, id string) (*dsm.DataSource, error) {
	ds, ok := r.data[id]
	if !ok {
		return nil, nil
	}
	return ds, nil
}
func (r *fakeRepo) List(_ context.Context, _ string) ([]*dsm.DataSource, error) {
	out := make([]*dsm.DataSource, 0, len(r.data))
	for _, ds := range r.data {
		out = append(out, ds)
	}
	return out, nil
}
func (r *fakeRepo) Update(_ context.Context, ds *dsm.DataSource) error {
	r.data[ds.ID] = ds
	return nil
}
func (r *fakeRepo) Delete(_ context.Context, id string) error { delete(r.data, id); return nil }

func TestCryptoRoundTrip(t *testing.T) {
	key := cryptoKey("test-secret-key-1234567890abcdef")
	if len(key) != 32 {
		t.Fatalf("expected 32-byte key, got %d", len(key))
	}
	cipher, err := encrypt(key, "my-password")
	if err != nil {
		t.Fatalf("encrypt failed: %v", err)
	}
	if cipher == "" {
		t.Fatal("empty ciphertext")
	}
	plain, err := decrypt(key, cipher)
	if err != nil {
		t.Fatalf("decrypt failed: %v", err)
	}
	if plain != "my-password" {
		t.Fatalf("expected 'my-password', got %q", plain)
	}
}

func TestCryptoKeyDerivation(t *testing.T) {
	k1 := cryptoKey("arbitrary-string")
	if len(k1) != 32 {
		t.Fatalf("expected 32-byte key, got %d", len(k1))
	}
	hexKey := "0000000000000000000000000000000000000000000000000000000000000001"
	k2 := cryptoKey(hexKey)
	if len(k2) != 32 {
		t.Fatalf("expected 32-byte hex key, got %d", len(k2))
	}
	if k2[31] != 0x01 {
		t.Fatalf("expected last byte 0x01, got %02x", k2[31])
	}
	k3 := cryptoKey("different-string")
	if string(k1) == string(k3) {
		t.Error("different inputs produced same key")
	}
}

func TestBuildDSN_Postgres(t *testing.T) {
	ds := &dsm.DataSource{Type: dsm.DSCPostgres, Host: "localhost", Port: 5432, Username: "user", Database: "mydb"}
	dsn := buildDSN(ds, "pass")
	expected := "host=localhost port=5432 user=user password=pass dbname=mydb sslmode=disable"
	if dsn != expected {
		t.Errorf("postgres DSN = %q, want %q", dsn, expected)
	}
}

func TestBuildDSN_MySQL(t *testing.T) {
	ds := &dsm.DataSource{Type: dsm.DSCMySQL, Host: "localhost", Port: 3306, Username: "root", Database: "test"}
	dsn := buildDSN(ds, "pass123")
	expected := "root:pass123@tcp(localhost:3306)/test?parseTime=true"
	if dsn != expected {
		t.Errorf("mysql DSN = %q, want %q", dsn, expected)
	}
}

func TestBuildDSN_DefaultSSLMode(t *testing.T) {
	ds := &dsm.DataSource{Type: dsm.DSCPostgres, Host: "h", Port: 5432, Username: "u", Database: "d", SSLMode: "require"}
	dsn := buildDSN(ds, "p")
	if dsn == "" {
		t.Fatal("empty DSN")
	}
}

func TestService_New(t *testing.T) {
	logger := zaptest.NewLogger(t)
	svc := New(newFakeRepo(), "test-key", logger)
	if svc == nil {
		t.Fatal("expected non-nil service")
	}
	if len(svc.key) != 32 {
		t.Errorf("expected 32-byte key, got %d", len(svc.key))
	}
}

func TestService_NewDefaultLogger(t *testing.T) {
	svc := New(newFakeRepo(), "test-key", nil)
	if svc == nil {
		t.Fatal("expected non-nil service")
	}
	if svc.logger == nil {
		t.Fatal("expected non-nil logger")
	}
}

func TestService_RegisterUnsupportedType(t *testing.T) {
	ctx := context.Background()
	logger := zaptest.NewLogger(t)
	svc := New(newFakeRepo(), "test-key", logger)
	ds := &dsm.DataSource{ID: "ds-1", Name: "bad", Type: dsm.DSCMongoDB, Host: "localhost", Port: 27017, Database: "test"}
	err := svc.Register(ctx, ds)
	if err == nil {
		t.Error("expected error for unsupported type")
	}
}

func TestService_RegisterPostgresConnectFail(t *testing.T) {
	ctx := context.Background()
	repo := newFakeRepo()
	logger := zaptest.NewLogger(t)
	svc := New(repo, "test-key", logger)
	ds := &dsm.DataSource{ID: "ds-1", Name: "test", Type: dsm.DSCPostgres, Host: "localhost", Port: 1, Database: "mydb"}
	err := svc.Register(ctx, ds)
	if err == nil {
		t.Error("expected connection error for unreachable host")
	}
}

func TestService_HealthCheckNotFound(t *testing.T) {
	ctx := context.Background()
	svc := New(newFakeRepo(), "key", zaptest.NewLogger(t))
	status, err := svc.HealthCheck(ctx, "nonexistent")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if status.Status != dsm.DSStatusError {
		t.Errorf("expected error status, got %s", status.Status)
	}
	if status.Error != "datasource not found" {
		t.Errorf("unexpected error msg: %s", status.Error)
	}
}

func TestService_QueryNotFound(t *testing.T) {
	ctx := context.Background()
	svc := New(newFakeRepo(), "key", zaptest.NewLogger(t))
	_, err := svc.Query(ctx, "nonexistent", "SELECT 1")
	if err == nil {
		t.Error("expected error for non-existent datasource")
	}
}

func TestService_ExecuteNotFound(t *testing.T) {
	ctx := context.Background()
	svc := New(newFakeRepo(), "key", zaptest.NewLogger(t))
	_, err := svc.Execute(ctx, "nonexistent", "INSERT INTO t VALUES (1)")
	if err == nil {
		t.Error("expected error")
	}
}

func TestService_CloseAll(t *testing.T) {
	svc := New(newFakeRepo(), "key", zaptest.NewLogger(t))
	if err := svc.CloseAll(); err != nil {
		t.Fatalf("CloseAll failed: %v", err)
	}
}

func TestService_Unregister(t *testing.T) {
	ctx := context.Background()
	repo := newFakeRepo()
	svc := New(repo, "key", zaptest.NewLogger(t))
	if err := svc.Unregister(ctx, "nonexistent"); err != nil {
		t.Fatalf("Unregister failed: %v", err)
	}
}

func TestService_HealthCheckAll(t *testing.T) {
	ctx := context.Background()
	svc := New(newFakeRepo(), "key", zaptest.NewLogger(t))
	results := svc.HealthCheckAll(ctx)
	if len(results) != 0 {
		t.Errorf("expected 0 results, got %d", len(results))
	}
}

func TestStartHealthCheckLoop_ContextCancel(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
	defer cancel()
	svc := New(newFakeRepo(), "key", zaptest.NewLogger(t))
	done := make(chan struct{})
	go func() { svc.StartHealthCheckLoop(ctx, 50*time.Millisecond); close(done) }()
	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal("StartHealthCheckLoop did not exit")
	}
}

func TestService_RegisterClickHouse(t *testing.T) {
	ctx := context.Background()
	svc := New(newFakeRepo(), "key", zaptest.NewLogger(t))
	ds := &dsm.DataSource{ID: "ch-1", Name: "ch", Type: dsm.DSCClickHouse, Host: "localhost", Port: 9000, Database: "default"}
	err := svc.Register(ctx, ds)
	if err == nil {
		t.Error("expected error for clickhouse (driver not loaded)")
	}
}

func TestService_RegisterElasticsearch(t *testing.T) {
	ctx := context.Background()
	svc := New(newFakeRepo(), "key", zaptest.NewLogger(t))
	ds := &dsm.DataSource{ID: "es-1", Name: "es", Type: dsm.DSCElasticsearch, Host: "localhost", Port: 9200}
	err := svc.Register(ctx, ds)
	if err == nil {
		t.Error("expected error for elasticsearch")
	}
}
