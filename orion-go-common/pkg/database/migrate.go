package database

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

// Migration represents a single SQL migration file.
type Migration struct {
	Version int
	Name    string
	SQL     string
}

// LoadMigrations reads SQL migration files from a directory.
// Files must be named like: 001_description.sql, 002_description.sql
func LoadMigrations(dir string) ([]Migration, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, fmt.Errorf("failed to read migrations directory %s: %w", dir, err)
	}

	var migrations []Migration
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".sql") {
			continue
		}

		// Parse version from filename: 001_description.sql -> 1
		var version int
		if _, err := fmt.Sscanf(entry.Name(), "%03d_", &version); err != nil {
			continue
		}

		content, err := os.ReadFile(filepath.Join(dir, entry.Name()))
		if err != nil {
			return nil, fmt.Errorf("failed to read migration %s: %w", entry.Name(), err)
		}

		migrations = append(migrations, Migration{
			Version: version,
			Name:    entry.Name(),
			SQL:     string(content),
		})
	}

	sort.Slice(migrations, func(i, j int) bool {
		return migrations[i].Version < migrations[j].Version
	})

	return migrations, nil
}

// RunMigrations executes all migration files from a directory against the database.
// It creates a schema_migrations table to track applied migrations.
func RunMigrations(db *DB, dir string) error {
	migrations, err := LoadMigrations(dir)
	if err != nil {
		return err
	}

	// Create migration tracking table
	_, err = db.Exec(`
		CREATE TABLE IF NOT EXISTS schema_migrations (
			version     INT PRIMARY KEY,
			name        VARCHAR(255) NOT NULL,
			applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
		)
	`)
	if err != nil {
		return fmt.Errorf("failed to create schema_migrations table: %w", err)
	}

	// Get applied versions
	var applied []int
	if err := db.Select(&applied, "SELECT version FROM schema_migrations ORDER BY version"); err != nil {
		return fmt.Errorf("failed to query applied migrations: %w", err)
	}
	appliedSet := make(map[int]bool, len(applied))
	for _, v := range applied {
		appliedSet[v] = true
	}

	// Apply pending migrations
	for _, m := range migrations {
		if appliedSet[m.Version] {
			continue
		}

		tx, err := db.Beginx()
		if err != nil {
			return fmt.Errorf("failed to begin transaction for migration %d: %w", m.Version, err)
		}

		if _, err := tx.Exec(m.SQL); err != nil {
			tx.Rollback()
			return fmt.Errorf("failed to execute migration %s: %w", m.Name, err)
		}

		if _, err := tx.Exec(
			"INSERT INTO schema_migrations (version, name) VALUES ($1, $2)",
			m.Version, m.Name,
		); err != nil {
			tx.Rollback()
			return fmt.Errorf("failed to record migration %d: %w", m.Version, err)
		}

		if err := tx.Commit(); err != nil {
			return fmt.Errorf("failed to commit migration %d: %w", m.Version, err)
		}
	}

	return nil
}
