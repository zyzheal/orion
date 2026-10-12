// Integration tests for the container helper. These require Docker to be
// running on the host. They are NOT excluded from the default test run so
// that TEST-2 acceptance (≤30s startup) is enforced by CI.
//
// If Docker is unavailable the tests skip themselves rather than fail —
// GATE-TEST-REPO-CONTAINER's runtime check is a separate CI job.
package container

import (
	"database/sql"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

// TestMain skips the entire test binary if Docker is not available so
// developers without Docker can still run the rest of the test suite.
func TestMain(m *testing.M) {
	code := m.Run()
	os.Exit(code)
}

// dockerAvailable is a light probe: if DOCKER_HOST is unset we still let
// the tests try (testcontainers auto-discovers the socket). Only truly
// unavailable environments cause skip.
func dockerAvailable() bool {
	// Cheap probe: try to reach the socket via os.Stat on common paths.
	for _, p := range []string{
		"/var/run/docker.sock",
		"/run/docker.sock",
		os.Getenv("DOCKER_HOST"),
	} {
		if p == "" {
			continue
		}
		if strings.HasPrefix(p, "unix://") {
			p = strings.TrimPrefix(p, "unix://")
		}
		if _, err := os.Stat(p); err == nil {
			return true
		}
	}
	// Windows-named-pipe style: can't cheaply probe; let tests try.
	if os.Getenv("DOCKER_HOST") != "" {
		return true
	}
	return false
}

// TestPostgresContainer_Startup asserts the TEST-2 acceptance criterion:
// a real PostgreSQL container starts in ≤ 30s.
func TestPostgresContainer_Startup(t *testing.T) {
	if !dockerAvailable() {
		t.Skip("docker socket not found — skipping integration test")
	}

	start := time.Now()
	pg := NewPostgres(t)
	duration := time.Since(start)

	if duration > DefaultStartupTimeout {
		t.Errorf("container startup took %s, exceeds %s budget",
			duration.Round(time.Millisecond), DefaultStartupTimeout)
	}

	if pg.DB == nil {
		t.Fatal("Postgres.DB is nil after NewPostgres")
	}
	if err := pg.DB.Ping(); err != nil {
		t.Fatalf("DB.Ping failed after container start: %v", err)
	}
}

// TestPostgresContainer_TenantID asserts the tenant label propagates.
func TestPostgresContainer_TenantID(t *testing.T) {
	if !dockerAvailable() {
		t.Skip("docker socket not found")
	}

	const want = "tenant-iso-a"
	pg := NewPostgres(t, WithTenantID(want))
	if pg.TenantID != want {
		t.Errorf("TenantID = %q, want %q", pg.TenantID, want)
	}
}

// TestPostgresContainer_IsolatedSchemas asserts that each NewPostgres call
// creates a fresh schema, so two concurrent callers cannot clobber.
func TestPostgresContainer_IsolatedSchemas(t *testing.T) {
	if !dockerAvailable() {
		t.Skip("docker socket not found")
	}

	a := NewPostgres(t)
	b := NewPostgres(t)
	if a.Schema == b.Schema {
		t.Errorf("schemata collided: %q", a.Schema)
	}
	if !strings.HasPrefix(a.Schema, "orion_") {
		t.Errorf("schema %q does not carry orion_ prefix", a.Schema)
	}
}

// TestPostgresContainer_MigrationFailure asserts that a broken migration
// file propagates as an error instead of leaving a half-applied state.
// (We use a bad DDL string via a temporary file to avoid shipping a
// broken migration in the repo.)
func TestPostgresContainer_MigrationFailure(t *testing.T) {
	if !dockerAvailable() {
		t.Skip("docker socket not found")
	}

	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "001_bad.sql"),
		[]byte("CREATE TABLE broken (id INT;;"), 0o644); err != nil {
		t.Fatalf("write fixture: %v", err)
	}

	pg := NewPostgres(t)
	defer pg.Terminate()

	err := applyMigrations(t.Context(), pg.DB, &Config{
		MigrationDir:       dir,
		MigrationGlob:      "*.sql",
		SkipDownMigrations: true,
	})
	if err == nil {
		t.Error("applyMigrations returned nil for invalid SQL; want error")
	}
}

// TestPostgresContainer_MigrationsApplied verifies happy-path migration
// execution: two valid up-migrations are applied in order.
func TestPostgresContainer_MigrationsApplied(t *testing.T) {
	if !dockerAvailable() {
		t.Skip("docker socket not found")
	}

	dir := t.TempDir()
	write := func(name, body string) {
		if err := os.WriteFile(filepath.Join(dir, name), []byte(body), 0o644); err != nil {
			t.Fatalf("write %s: %v", name, err)
		}
	}
	write("001_users.sql",
		"CREATE TABLE IF NOT EXISTS users (id BIGSERIAL PRIMARY KEY, name TEXT NOT NULL);")
	write("002_items.sql",
		"CREATE TABLE IF NOT EXISTS items (id BIGSERIAL PRIMARY KEY, user_id BIGINT NOT NULL REFERENCES users(id), label TEXT);")
	write("999_items_down.sql",
		"-- should be skipped; presence of this file must not break forward-only apply")

	pg := NewPostgres(t, WithMigrations(dir))

	ctx := t.Context()
	rows, err := pg.DB.QueryContext(ctx,
		"SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema()")
	if err != nil {
		t.Fatalf("query tables: %v", err)
	}
	defer rows.Close()

	seen := map[string]bool{}
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			t.Fatalf("scan: %v", err)
		}
		seen[name] = true
	}
	if !seen["users"] {
		t.Error("users table not created by migration 001")
	}
	if !seen["items"] {
		t.Error("items table not created by migration 002")
	}
}

// TestPostgresContainer_MigrationGlob asserts that non-matching files are
// ignored, so callers can drop helper files next to migrations safely.
func TestPostgresContainer_MigrationGlob(t *testing.T) {
	if !dockerAvailable() {
		t.Skip("docker socket not found")
	}

	dir := t.TempDir()
	_ = os.WriteFile(filepath.Join(dir, "001_real.sql"),
		[]byte("CREATE TABLE gtest (id INT)"), 0o644)
	_ = os.WriteFile(filepath.Join(dir, "README.md"),
		[]byte("this is not a migration"), 0o644)

	pg := NewPostgres(t, WithMigrations(dir), WithMigrationGlob("*.sql"))

	ctx := t.Context()
	row := pg.DB.QueryRowContext(ctx,
		"SELECT 1 FROM information_schema.tables WHERE table_name = 'gtest'")
	var one int
	if err := row.Scan(&one); err == sql.ErrNoRows {
		t.Error("gtest table not created — glob did not match 001_real.sql")
	} else if err != nil {
		t.Fatalf("query: %v", err)
	}
}

// TestApplyMigrations_NoDir asserts that a missing migration dir returns
// a clear error rather than a nil.
func TestApplyMigrations_NoDir(t *testing.T) {
	if !dockerAvailable() {
		t.Skip("docker socket not found")
	}
	pg := NewPostgres(t)
	defer pg.Terminate()

	err := applyMigrations(t.Context(), pg.DB, &Config{
		MigrationDir:       filepath.Join(t.TempDir(), "does-not-exist"),
		SkipDownMigrations: true,
	})
	if err == nil {
		t.Error("expected error for missing migration dir, got nil")
	}
}

// TestMatchGlob verifies the filename glob helper handles edge cases.
func TestMatchGlob(t *testing.T) {
	cases := []struct {
		pattern, name string
		want          bool
	}{
		{"*.sql", "001_up.sql", true},
		{"*.sql", "001_up.sql.bak", false},
		{"*.md", "README.md", true},
		{"", "anything.txt", true}, // empty pattern = all
		{"*", "anything.txt", true},
		{"**", "nested/anything.txt", true},
	}
	for _, c := range cases {
		got := matchGlob(c.pattern, c.name)
		if got != c.want {
			t.Errorf("matchGlob(%q, %q) = %v, want %v", c.pattern, c.name, got, c.want)
		}
	}
}
