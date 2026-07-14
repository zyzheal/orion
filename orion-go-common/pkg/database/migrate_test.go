package database

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestLoadMigrations(t *testing.T) {
	// Create temp dir with test migration files
	dir := t.TempDir()
	os.WriteFile(filepath.Join(dir, "001_init.sql"), []byte("CREATE TABLE test (id INT);"), 0644)
	os.WriteFile(filepath.Join(dir, "002_add_column.sql"), []byte("ALTER TABLE test ADD name VARCHAR(100);"), 0644)
	os.WriteFile(filepath.Join(dir, "not_a_migration.txt"), []byte("ignore me"), 0644)

	migrations, err := LoadMigrations(dir)
	if err != nil {
		t.Fatalf("LoadMigrations failed: %v", err)
	}

	if len(migrations) != 2 {
		t.Fatalf("expected 2 migrations, got %d", len(migrations))
	}

	if migrations[0].Version != 1 {
		t.Errorf("expected first migration version 1, got %d", migrations[0].Version)
	}
	if migrations[0].Name != "001_init.sql" {
		t.Errorf("expected name 001_init.sql, got %s", migrations[0].Name)
	}
	if migrations[1].Version != 2 {
		t.Errorf("expected second migration version 2, got %d", migrations[1].Version)
	}
}

func TestLoadMigrations_Sorted(t *testing.T) {
	dir := t.TempDir()
	os.WriteFile(filepath.Join(dir, "003_third.sql"), []byte("SELECT 3;"), 0644)
	os.WriteFile(filepath.Join(dir, "001_first.sql"), []byte("SELECT 1;"), 0644)
	os.WriteFile(filepath.Join(dir, "002_second.sql"), []byte("SELECT 2;"), 0644)

	migrations, err := LoadMigrations(dir)
	if err != nil {
		t.Fatalf("LoadMigrations failed: %v", err)
	}

	for i, m := range migrations {
		expected := i + 1
		if m.Version != expected {
			t.Errorf("migration[%d]: expected version %d, got %d", i, expected, m.Version)
		}
	}
}

func TestLoadMigrations_EmptyDir(t *testing.T) {
	dir := t.TempDir()
	migrations, err := LoadMigrations(dir)
	if err != nil {
		t.Fatalf("LoadMigrations failed: %v", err)
	}
	if len(migrations) != 0 {
		t.Errorf("expected 0 migrations, got %d", len(migrations))
	}
}

func TestLoadMigrations_NonExistentDir(t *testing.T) {
	_, err := LoadMigrations("/nonexistent/path")
	if err == nil {
		t.Error("expected error for non-existent directory")
	}
}

func TestLoadMigrations_SQLContent(t *testing.T) {
	dir := t.TempDir()
	sql := "CREATE TABLE users (\n  id UUID PRIMARY KEY,\n  name VARCHAR(100)\n);"
	os.WriteFile(filepath.Join(dir, "001_create_users.sql"), []byte(sql), 0644)

	migrations, err := LoadMigrations(dir)
	if err != nil {
		t.Fatalf("LoadMigrations failed: %v", err)
	}

	if migrations[0].SQL != sql {
		t.Errorf("SQL content mismatch:\nexpected: %s\ngot: %s", sql, migrations[0].SQL)
	}
}

// ---------------------------------------------------------------------------
// Rollback tests
// ---------------------------------------------------------------------------

func TestGenerateDownSQL_CreateTable(t *testing.T) {
	forward := "CREATE TABLE users (id UUID PRIMARY KEY, name VARCHAR(100));"
	down := generateDownSQL(1, forward)

	if !containsLine(down, "DROP TABLE IF EXISTS users CASCADE;") {
		t.Errorf("expected DROP TABLE IF EXISTS users CASCADE; in:\n%s", down)
	}
}

func TestGenerateDownSQL_AlterTableAddColumn(t *testing.T) {
	forward := "ALTER TABLE users ADD COLUMN email VARCHAR(255);"
	down := generateDownSQL(2, forward)

	if !containsLine(down, "ALTER TABLE users DROP COLUMN IF EXISTS email;") {
		t.Errorf("expected ALTER TABLE users DROP COLUMN IF EXISTS email; in:\n%s", down)
	}
}

func TestGenerateDownSQL_CreateIndex(t *testing.T) {
	forward := "CREATE INDEX idx_users_name ON users (name);"
	down := generateDownSQL(3, forward)

	if !containsLine(down, "DROP INDEX IF EXISTS idx_users_name;") {
		t.Errorf("expected DROP INDEX IF EXISTS idx_users_name; in:\n%s", down)
	}
}

func TestGenerateDownSQL_CreateSequence(t *testing.T) {
	forward := "CREATE SEQUENCE order_seq;"
	down := generateDownSQL(4, forward)

	if !containsLine(down, "DROP SEQUENCE IF EXISTS order_seq;") {
		t.Errorf("expected DROP SEQUENCE IF EXISTS order_seq; in:\n%s", down)
	}
}

func TestGenerateDownSQL_DataMutation(t *testing.T) {
	forward := "INSERT INTO config (key, val) VALUES ('k1', 'v1');"
	down := generateDownSQL(5, forward)

	if !strings.Contains(down, "-- REVIEW: data mutation cannot be auto-reversed") {
		t.Errorf("expected REVIEW comment for data mutation in:\n%s", down)
	}
}

func TestGenerateDownSQL_MultipleStatements(t *testing.T) {
	forward := "CREATE TABLE orders (id INT PRIMARY KEY);\nCREATE INDEX idx_orders_user ON orders (user_id);"
	down := generateDownSQL(6, forward)

	if !containsLine(down, "DROP TABLE IF EXISTS orders CASCADE;") {
		t.Errorf("expected DROP TABLE in:\n%s", down)
	}
	if !containsLine(down, "DROP INDEX IF EXISTS idx_orders_user;") {
		t.Errorf("expected DROP INDEX in:\n%s", down)
	}
}

func TestGenerateDownMigrations(t *testing.T) {
	dir := t.TempDir()
	os.WriteFile(filepath.Join(dir, "001_create_users.sql"), []byte("CREATE TABLE users (id INT);"), 0644)
	os.WriteFile(filepath.Join(dir, "002_add_column.sql"), []byte("ALTER TABLE users ADD COLUMN email VARCHAR(100);"), 0644)

	err := GenerateDownMigrations(dir)
	if err != nil {
		t.Fatalf("GenerateDownMigrations failed: %v", err)
	}

	// Check generated files exist
	_, err = os.Stat(filepath.Join(dir, "001_create_users_down.sql"))
	if err != nil {
		t.Errorf("expected 001_create_users_down.sql to be generated")
	}
	_, err = os.Stat(filepath.Join(dir, "002_add_column_down.sql"))
	if err != nil {
		t.Errorf("expected 002_add_column_down.sql to be generated")
	}
}

func TestGenerateDownMigrations_Idempotent(t *testing.T) {
	dir := t.TempDir()
	os.WriteFile(filepath.Join(dir, "001_create_users.sql"), []byte("CREATE TABLE users (id INT);"), 0644)
	os.WriteFile(filepath.Join(dir, "001_create_users_down.sql"), []byte("DROP TABLE IF EXISTS users CASCADE;"), 0644)

	err := GenerateDownMigrations(dir)
	if err != nil {
		t.Fatalf("GenerateDownMigrations failed: %v", err)
	}

	// Should not have overwritten existing _down.sql
	content, _ := os.ReadFile(filepath.Join(dir, "001_create_users_down.sql"))
	if string(content) != "DROP TABLE IF EXISTS users CASCADE;" {
		t.Errorf("existing _down.sql should not be overwritten")
	}
}

func TestGenerateDownMigrations_NonExistentDir(t *testing.T) {
	err := GenerateDownMigrations("/nonexistent/path")
	if err == nil {
		t.Error("expected error for non-existent directory")
	}
}

// ---------------------------------------------------------------------------
// Down-migration loader tests
// ---------------------------------------------------------------------------

func TestLoadDownMigrations(t *testing.T) {
	dir := t.TempDir()
	os.WriteFile(filepath.Join(dir, "002_create_orders_down.sql"), []byte("DROP TABLE IF EXISTS orders CASCADE;"), 0644)
	os.WriteFile(filepath.Join(dir, "001_create_users_down.sql"), []byte("DROP TABLE IF EXISTS users CASCADE;"), 0644)

	downs, err := LoadDownMigrations(dir)
	if err != nil {
		t.Fatalf("LoadDownMigrations failed: %v", err)
	}

	if len(downs) != 2 {
		t.Fatalf("expected 2 down migrations, got %d", len(downs))
	}

	// Sorted descending
	if downs[0].Version != 2 {
		t.Errorf("expected first version 2, got %d", downs[0].Version)
	}
	if downs[1].Version != 1 {
		t.Errorf("expected second version 1, got %d", downs[1].Version)
	}
}

func TestLoadDownMigrations_SkipsForward(t *testing.T) {
	dir := t.TempDir()
	os.WriteFile(filepath.Join(dir, "001_create_users.sql"), []byte("CREATE TABLE users (id INT);"), 0644)
	os.WriteFile(filepath.Join(dir, "001_create_users_down.sql"), []byte("DROP TABLE IF EXISTS users CASCADE;"), 0644)

	downs, err := LoadDownMigrations(dir)
	if err != nil {
		t.Fatalf("LoadDownMigrations failed: %v", err)
	}

	if len(downs) != 1 {
		t.Fatalf("expected 1 down migration (forward should be skipped), got %d", len(downs))
	}
	if downs[0].Name != "001_create_users_down.sql" {
		t.Errorf("expected 001_create_users_down.sql, got %s", downs[0].Name)
	}
}

// ---------------------------------------------------------------------------
// Forward-compatibility tests
// ---------------------------------------------------------------------------

func TestIsForwardCompatible_Pass(t *testing.T) {
	sql := "CREATE TABLE users (id UUID PRIMARY KEY, name VARCHAR(100));"
	violations := IsForwardCompatible(sql)
	if len(violations) != 0 {
		t.Errorf("expected no violations, got: %v", violations)
	}
}

func TestIsForwardCompatible_DropViolation(t *testing.T) {
	sql := "DROP TABLE IF EXISTS old_table;"
	violations := IsForwardCompatible(sql)
	if len(violations) == 0 {
		t.Error("expected DROP violation")
	}
	if !strings.Contains(violations[0], "DROP") {
		t.Errorf("expected DROP violation, got: %s", violations[0])
	}
}

func TestIsForwardCompatible_AlterColumnViolation(t *testing.T) {
	sql := "ALTER TABLE users ALTER COLUMN id TYPE BIGINT;"
	violations := IsForwardCompatible(sql)
	if len(violations) == 0 {
		t.Error("expected ALTER COLUMN violation")
	}
}

func TestIsForwardCompatible_RenameViolation(t *testing.T) {
	sql := "RENAME TABLE users TO old_users;"
	violations := IsForwardCompatible(sql)
	if len(violations) == 0 {
		t.Error("expected RENAME violation")
	}
}

func TestIsForwardCompatible_AddColumnOk(t *testing.T) {
	sql := "ALTER TABLE users ADD COLUMN email VARCHAR(255);"
	violations := IsForwardCompatible(sql)
	if len(violations) != 0 {
		t.Errorf("expected no violations for ADD COLUMN, got: %v", violations)
	}
}

func TestIsForwardCompatible_MultipleStatements(t *testing.T) {
	sql := "CREATE TABLE users (id INT); DROP TABLE IF EXISTS temp;"
	violations := IsForwardCompatible(sql)
	if len(violations) == 0 {
		t.Error("expected DROP violation in multi-statement SQL")
	}
}

// ---------------------------------------------------------------------------
// RunMigrationsDown input validation
// ---------------------------------------------------------------------------

func TestRunMigrationsDown_ZeroSteps(t *testing.T) {
	db := &DB{}
	err := RunMigrationsDown(db, "/tmp", 0)
	if err == nil {
		t.Error("expected error for steps=0")
	}
}

func TestRunMigrationsDown_NegativeSteps(t *testing.T) {
	db := &DB{}
	err := RunMigrationsDown(db, "/tmp", -1)
	if err == nil {
		t.Error("expected error for negative steps")
	}
}

func TestRunMigrationsDownTo_NegativeVersion(t *testing.T) {
	db := &DB{}
	err := RunMigrationsDownTo(db, "/tmp", -1)
	if err == nil {
		t.Error("expected error for negative targetVersion")
	}
}

// ---------------------------------------------------------------------------
// Parse statement tests
// ---------------------------------------------------------------------------

func TestParseStatement_CreateTable(t *testing.T) {
	down := parseStatement("CREATE TABLE users (id UUID PRIMARY KEY, name VARCHAR(100));")
	expected := "DROP TABLE IF EXISTS users CASCADE;"
	if !strings.Contains(down, expected) {
		t.Errorf("expected %q in %q", expected, down)
	}
}

func TestParseStatement_AlterAddColumn(t *testing.T) {
	down := parseStatement("ALTER TABLE users ADD COLUMN email VARCHAR(255);")
	if !strings.Contains(down, "ALTER TABLE users DROP COLUMN IF EXISTS email;") {
		t.Errorf("expected ALTER TABLE DROP COLUMN in %q", down)
	}
}

func TestParseStatement_AlterAddConstraint(t *testing.T) {
	down := parseStatement("ALTER TABLE orders ADD CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id);")
	if !strings.Contains(down, "ALTER TABLE orders DROP CONSTRAINT IF EXISTS fk_user;") {
		t.Errorf("expected ALTER TABLE DROP CONSTRAINT in %q", down)
	}
}

// ---------------------------------------------------------------------------
// MigrateDryRun input validation
// ---------------------------------------------------------------------------

func TestMigrateDryRun_InvalidDirection(t *testing.T) {
	db := &DB{}
	_, err := MigrateDryRun(db, "/tmp", "invalid", 0)
	if err == nil {
		t.Error("expected error for invalid direction")
	}
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

func containsLine(sql, needle string) bool {
	for _, line := range strings.Split(sql, "\n") {
		if strings.TrimSpace(line) == needle {
			return true
		}
	}
	return false
}
