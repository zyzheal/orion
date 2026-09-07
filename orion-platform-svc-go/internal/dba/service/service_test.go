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

func TestIsReadOnlySQL_SelectWithColumns(t *testing.T) {
	if !isReadOnlySQL("SELECT id, name FROM users WHERE status = 'active'") {
		t.Error("expected simple SELECT to pass")
	}
}

func TestIsReadOnlySQL_WithClause(t *testing.T) {
	if !isReadOnlySQL("WITH cte AS (SELECT id FROM users) SELECT * FROM cte") {
		t.Error("expected WITH ... SELECT to pass")
	}
}

func TestIsReadOnlySQL_RejectsMultiStatement(t *testing.T) {
	// Semicolon-stacked statements are outright rejected — this was
	// the primary injection vector in the original implementation.
	if isReadOnlySQL("SELECT * FROM users; DROP TABLE users") {
		t.Error("expected semicolon-stacked statements to be rejected")
	}
}

func TestIsReadOnlySQL_RejectsUpdateAfterSemicolon(t *testing.T) {
	if isReadOnlySQL("SELECT 1; UPDATE users SET x = 1") {
		t.Error("expected semicolon-stacked UPDATE to be rejected")
	}
}

func TestIsReadOnlySQL_ComentedDropIsSafe(t *testing.T) {
	// "SELECT 1 -- drop table users" is actually safe — the -- makes
	// the rest a comment. The DB only executes SELECT 1.
	if !isReadOnlySQL("SELECT 1 -- drop table users") {
		t.Error("expected commented-out DROP to pass (DB ignores comments)")
	}
}

func TestIsReadOnlySQL_BlockCommentedDropIsSafe(t *testing.T) {
	if !isReadOnlySQL("SELECT 1 /* drop table users */") {
		t.Error("expected block-commented DROP to pass (DB ignores comments)")
	}
}

func TestIsReadOnlySQL_ComentedCreateIsSafe(t *testing.T) {
	if !isReadOnlySQL("SELECT 1 -- CREATE TABLE evil (x int)") {
		t.Error("expected commented-out CREATE to pass")
	}
}

func TestIsReadOnlySQL_RejectsSemicolonAfterComment(t *testing.T) {
	// The real attack: comment hides a semicolon? No — semicolons
	// are always semicolons. But the stacked statement still fails
	// because we reject any semicolon.
	if isReadOnlySQL("SELECT 1 /* -- */; DROP TABLE users") {
		t.Error("expected comment-obfuscated semicolon stack to be rejected")
	}
}

func TestIsReadOnlySQL_PreservesKeywordsInStrings(t *testing.T) {
	// String-literal contents are masked so keywords inside them do
	// not trigger the rejection.
	if !isReadOnlySQL("SELECT 1 WHERE name = 'drop table'") {
		t.Error("expected string-literal DROP to pass (literal contents are masked)")
	}
}

func TestIsReadOnlySQL_PreservesEscapedQuotesInString(t *testing.T) {
	// SQL escape: '' inside a string is a literal quote. The stripper
	// must not terminate the literal early.
	if !isReadOnlySQL(`SELECT * FROM t WHERE s = 'it''s fine drop here'`) {
		t.Error("expected escaped-quote string to pass")
	}
}

func TestIsReadOnlySQL_Empty(t *testing.T) {
	if isReadOnlySQL("") {
		t.Error("expected empty SQL to be rejected")
	}
}

func TestIsReadOnlySQL_NonSelectPrefix(t *testing.T) {
	if isReadOnlySQL("SHOW TABLES") {
		t.Error("expected non-SELECT prefix to be rejected")
	}
}

func TestIsReadOnlySQL_TrimsWhitespace(t *testing.T) {
	if !isReadOnlySQL("   SELECT 1   ") {
		t.Error("expected whitespace-padded SELECT to pass")
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
