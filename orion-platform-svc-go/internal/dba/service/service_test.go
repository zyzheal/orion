package service

import (
	"context"
	"strings"
	"testing"
	"time"

	"orion/platform-svc-go/internal/dba/models"
)

func TestService_NilRepo(t *testing.T) {
	s := NewService(nil)
	if s == nil {
		t.Fatal("expected non-nil service")
	}
}

func TestIsReadOnlySQL_Select(t *testing.T) {
	if !isReadOnlySQL("select 1") {
		t.Fatal("expected SELECT to be read-only")
	}
	if isReadOnlySQL("INSERT INTO t VALUES (1)") {
		t.Fatal("expected INSERT to be write-only")
	}
}

// ---- normalizeDBType ----

func TestNormalizeDBType(t *testing.T) {
	cases := []struct {
		in   string
		want string
	}{
		{"postgres", "postgres"},
		{"postgresql", "postgres"},
		{"PostgreSQL", "postgres"},
		{"postgres ", "postgres"},
		{"pg", "postgres"},
		{"postgre", "postgres"},
		{"mysql", "mysql"},
		{"MySQL", "mysql"},
		{"mysql8", "mysql"},
		{"mariadb", "mysql"},
		{"", ""},
		{"sqlite", ""},
		{"mongodb", ""},
	}
	for _, c := range cases {
		got := normalizeDBType(c.in)
		if got != c.want {
			t.Errorf("normalizeDBType(%q) = %q, want %q", c.in, got, c.want)
		}
	}
}

// ---- buildMySQLDSN ----

func TestBuildMySQLDSN_Defaults(t *testing.T) {
	user := "root"
	pass := "secret"
	ds := &models.DataSource{
		Name:     "test",
		Type:     "mysql",
		Host:     "127.0.0.1",
		Port:     3306,
		Database: "orion",
		Username: &user,
		Password: &pass,
	}
	got := buildMySQLDSN(ds)
	if !strings.Contains(got, "root:secret@tcp(127.0.0.1:3306)/orion") {
		t.Errorf("DSN missing user/host/db: %s", got)
	}
	if !strings.Contains(got, "charset=utf8mb4") {
		t.Errorf("DSN missing charset: %s", got)
	}
	if !strings.Contains(got, "parseTime=True") {
		t.Errorf("DSN missing parseTime: %s", got)
	}
}

func TestBuildMySQLDSN_EmptyUserAndHost(t *testing.T) {
	ds := &models.DataSource{
		Name: "empty",
		Type: "mysql",
		Port: 0, // will default
	}
	got := buildMySQLDSN(ds)
	if !strings.Contains(got, "@tcp(localhost:3306)/mysql") {
		t.Errorf("expected localhost:3306 default, got: %s", got)
	}
}

// ---- dispatch by type ----

func TestExecuteSQLByType_UnsupportedType(t *testing.T) {
	ds := &models.DataSource{Name: "x"}
	_, err := executeSQLByType(ds, "", context.Background(), "SELECT 1", "select 1")
	if err == nil {
		t.Fatal("expected error for unknown type")
	}
	if !strings.Contains(err.Error(), "unsupported db type") {
		t.Errorf("expected unsupported error, got: %v", err)
	}
}

func TestExecuteSQLQueryByType_UnsupportedType(t *testing.T) {
	ds := &models.DataSource{Name: "x"}
	_, err := executeSQLQueryByType(ds, "unknown", context.Background(), "SELECT 1")
	if err == nil {
		t.Fatal("expected error for unknown type")
	}
	if !strings.Contains(err.Error(), "unsupported db type") {
		t.Errorf("expected unsupported error, got: %v", err)
	}
}

// executeSQLByType on mysql routes to the mysql path (no live server).

func TestExecuteSQLByType_MySQLAttemptsConnection(t *testing.T) {
	ds := &models.DataSource{
		Name: "missing-mysql",
		Type: "mysql",
		// deliberately unreachable
		Host: "127.0.0.1",
		Port: 65535,
	}
	_, err := executeSQLByType(ds, "mysql", context.Background(), "SELECT 1", "select 1")
	if err == nil {
		t.Fatal("expected error connecting to unreachable MySQL")
	}
	if strings.Contains(err.Error(), "unsupported db type") {
		t.Errorf("should not report unsupported, got: %v", err)
	}
	// The MySQL driver succeeds on sql.Open (lazy) and only fails when
	// it actually dials, so the error surfaces as a connect failure.
	if !strings.Contains(err.Error(), "connection refused") &&
		!strings.Contains(err.Error(), "failed to open connection") &&
		!strings.Contains(err.Error(), "dial tcp") {
		t.Errorf("expected mysql connection failure, got: %v", err)
	}
}

// testConnectionByType on unknown type falls back to PG without panicking.

func TestTestConnectionByType_UnsupportedFallsBackToPG(t *testing.T) {
	ds := &models.DataSource{Name: "pg-only", Type: "sqlite", Host: "127.0.0.1", Port: 1}
	ok, message, _, _ := testConnectionByType(ds, "", 100*time.Millisecond)
	if ok {
		t.Logf("unexpectedly connected; ok=true message=%s", message)
	}
	if message == "" {
		t.Errorf("expected non-empty message, got empty")
	}
}

// testConnectionByType on mysql routes to the MySQL path.

func TestTestConnectionByType_MySQLRoutesToMySQL(t *testing.T) {
	ds := &models.DataSource{Name: "nope", Type: "mysql", Host: "127.0.0.1", Port: 65535}
	ok, message, _, _ := testConnectionByType(ds, "mysql", 100*time.Millisecond)
	if ok {
		t.Errorf("expected connection to fail, got ok=true: %s", message)
	}
	// Message must be non-empty and reference a mysql/pg style error.
	if !strings.Contains(message, "failed to") {
		t.Errorf("expected failure message, got: %s", message)
	}
}
