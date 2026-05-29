package database

import (
	"os"
	"path/filepath"
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
