package database

import (
	"testing"
)

func TestBaseRepository_ImplementsInterface(t *testing.T) {
	// Verify BaseRepository can be embedded
	type TestRepo struct {
		BaseRepository
		extra string
	}

	// Just verify the struct compiles and has expected methods
	repo := TestRepo{
		extra: "test",
	}
	_ = repo
}

func TestMigration_Struct(t *testing.T) {
	m := Migration{
		Version: 1,
		Name:    "001_init.sql",
		SQL:     "CREATE TABLE test (id INT);",
	}

	if m.Version != 1 {
		t.Errorf("expected Version 1, got %d", m.Version)
	}
	if m.Name != "001_init.sql" {
		t.Errorf("expected Name 001_init.sql, got %s", m.Name)
	}
}

func TestConfig_Defaults(t *testing.T) {
	cfg := DefaultConfig("postgres://localhost/test")

	if cfg.DSN != "postgres://localhost/test" {
		t.Errorf("expected DSN postgres://localhost/test, got %s", cfg.DSN)
	}
	if cfg.MaxOpenConns != 25 {
		t.Errorf("expected MaxOpenConns 25, got %d", cfg.MaxOpenConns)
	}
	if cfg.MaxIdleConns != 5 {
		t.Errorf("expected MaxIdleConns 5, got %d", cfg.MaxIdleConns)
	}
	if cfg.ConnMaxLifetime == 0 {
		t.Error("expected non-zero ConnMaxLifetime")
	}
	if cfg.ConnMaxIdleTime == 0 {
		t.Error("expected non-zero ConnMaxIdleTime")
	}
}

func TestValidateIdentifier(t *testing.T) {
	tests := []struct {
		name    string
		input   string
		wantErr bool
	}{
		{"simple table", "users", false},
		{"underscore table", "token_blacklist", false},
		{"schema dotted", "public.users", false},
		{"numeric start", "1users", true},
		{"space", "users DROP", true},
		{"semicolon", "users;DROP", true},
		{"quotes", "users\"", true},
		{"empty", "", true},
		{"hyphen", "user-table", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateIdentifier(tt.input)
			if (err != nil) != tt.wantErr {
				t.Errorf("validateIdentifier(%q) error = %v, wantErr %v", tt.input, err, tt.wantErr)
			}
		})
	}
}
