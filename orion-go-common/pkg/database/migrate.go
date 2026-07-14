package database

import (
	"fmt"
	"os"
	"path/filepath"
	"regexp"
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
// _down.sql files (rollback files) are excluded.
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

		// Skip _down.sql files (rollback files)
		if strings.Contains(entry.Name(), "_down.") {
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

// ---------------------------------------------------------------------------
// Rollback support
// ---------------------------------------------------------------------------

// RunMigrationsDown rolls back the last N applied migrations.
// For each rollback step, it:
//   1. Looks up the applied migration by version (descending order).
//   2. Backs up tables referenced in that migration to a rollback_backup_<version> schema.
//   3. Finds the matching <base>_down.sql file and executes it.
//   4. Removes the migration record from schema_migrations.
//
// If no _down.sql file is found, an error is returned (no automatic rollback).
func RunMigrationsDown(db *DB, dir string, steps int) error {
	if steps < 1 {
		return fmt.Errorf("steps must be >= 1, got %d", steps)
	}

	// Ensure the migration tracking table exists.
	_, err := db.Exec(`
		CREATE TABLE IF NOT EXISTS schema_migrations (
			version     INT PRIMARY KEY,
			name        VARCHAR(255) NOT NULL,
			applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
		)
	`)
	if err != nil {
		return fmt.Errorf("failed to create schema_migrations table: %w", err)
	}

	// Load forward migrations to map version -> filename.
	migrations, err := LoadMigrations(dir)
	if err != nil {
		return err
	}
	versionToName := make(map[int]string, len(migrations))
	for _, m := range migrations {
		versionToName[m.Version] = m.Name
	}

	// Query applied migrations in reverse order.
	var appliedRows []struct {
		Version int
		Name    string
	}
	if err := db.Select(&appliedRows,
		"SELECT version, name FROM schema_migrations ORDER BY version DESC LIMIT $1", steps); err != nil {
		return fmt.Errorf("failed to query applied migrations for rollback: %w", err)
	}

	if len(appliedRows) == 0 {
		return nil
	}

	// Extract table names from SQL for backup.
	tableExtractor := regexp.MustCompile(`(?i)\b(?:CREATE\s+TABLE|ALTER\s+TABLE|DROP\s+TABLE|INSERT\s+INTO|UPDATE\s+|DELETE\s+FROM)\s+([A-Za-z_][A-Za-z0-9_]*)`)

	for _, row := range appliedRows {
		version := row.Version
		forwardName := versionToName[version]
		if forwardName == "" {
			forwardName = row.Name // fallback to recorded name
		}

		// Derive the _down.sql filename: 001_create_users.sql -> 001_create_users_down.sql
		base := strings.TrimSuffix(forwardName, ".sql")
		downName := base + "_down.sql"
		downPath := filepath.Join(dir, downName)

		// --- Layer 1: Backup schema ---
		backupSchema := fmt.Sprintf("rollback_backup_%d", version)
		_, err = db.Exec(fmt.Sprintf("CREATE SCHEMA IF NOT EXISTS %s", backupSchema))
		if err != nil {
			return fmt.Errorf("failed to create backup schema %s for version %d: %w", backupSchema, version, err)
		}

		// Extract table names from the forward migration SQL.
		forwardSQLPath := filepath.Join(dir, forwardName)
		var tablesToBackup []string
		if sqlBytes, readErr := os.ReadFile(forwardSQLPath); readErr == nil {
			matches := tableExtractor.FindAllStringSubmatch(string(sqlBytes), -1)
			for _, m := range matches {
				tbl := strings.ToLower(m[1])
				if tbl == "schema_migrations" {
					continue
				}
				tablesToBackup = append(tablesToBackup, tbl)
			}
		}

		// Deduplicate
		tableSet := make(map[string]bool)
		for _, t := range tablesToBackup {
			tableSet[t] = true
		}

		// Backup each table to the backup schema.
		for tbl := range tableSet {
			backupStmt := fmt.Sprintf(
				`CREATE TABLE IF NOT EXISTS %s."%s" AS SELECT * FROM "%s"`,
				backupSchema, tbl, tbl,
			)
			if _, err := db.Exec(backupStmt); err != nil {
				fmt.Printf("[rollback] warning: failed to backup table %s for version %d: %v\n", tbl, version, err)
			}
		}

		// --- Layer 2: Execute _down.sql ---
		downSQL, err := os.ReadFile(downPath)
		if err != nil {
			return fmt.Errorf(
                "no _down.sql file found for version %d: expected %s (cannot auto-rollback)",
                version, downName)
		}

		tx, err := db.Beginx()
		if err != nil {
			return fmt.Errorf("failed to begin transaction for rollback %d: %w", version, err)
		}

		if _, err := tx.Exec(string(downSQL)); err != nil {
			tx.Rollback()
			return fmt.Errorf("failed to execute rollback for version %d (%s): %w", version, downName, err)
		}

		// Remove migration record.
		if _, err := tx.Exec("DELETE FROM schema_migrations WHERE version = $1", version); err != nil {
			tx.Rollback()
			return fmt.Errorf("failed to remove migration record for version %d: %w", version, err)
		}

		if err := tx.Commit(); err != nil {
			return fmt.Errorf("failed to commit rollback for version %d: %w", version, err)
		}

		fmt.Printf("[rollback] rolled back version %d (%s), backup in schema %s\n", version, downName, backupSchema)
	}

	return nil
}

// RunMigrationsDownTo rolls back all migrations until the target version is reached.
// The target version remains applied. Pass 0 to roll back everything.
func RunMigrationsDownTo(db *DB, dir string, targetVersion int) error {
	if targetVersion < 0 {
		return fmt.Errorf("targetVersion must be >= 0, got %d", targetVersion)
	}

	migrations, err := LoadMigrations(dir)
	if err != nil {
		return err
	}
	versionToName := make(map[int]string, len(migrations))
	for _, m := range migrations {
		versionToName[m.Version] = m.Name
	}

	// Query applied migrations above target version.
	var appliedRows []struct {
		Version int
	}
	if err := db.Select(&appliedRows,
		"SELECT version FROM schema_migrations WHERE version > $1 ORDER BY version DESC", targetVersion); err != nil {
		return fmt.Errorf("failed to query applied migrations for rollback-to: %w", err)
	}

	if len(appliedRows) == 0 {
		return nil
	}

	tableExtractor := regexp.MustCompile(`(?i)\b(?:CREATE\s+TABLE|ALTER\s+TABLE|DROP\s+TABLE|INSERT\s+INTO|UPDATE\s+|DELETE\s+FROM)\s+([A-Za-z_][A-Za-z0-9_]*)`)

	for _, row := range appliedRows {
		version := row.Version
		forwardName := versionToName[version]
		if forwardName == "" {
			var name string
			_ = db.Get(&name, "SELECT name FROM schema_migrations WHERE version = $1", version)
			forwardName = name
		}
		if forwardName == "" {
			return fmt.Errorf("cannot find forward migration name for version %d", version)
		}

		base := strings.TrimSuffix(forwardName, ".sql")
		downName := base + "_down.sql"
		downPath := filepath.Join(dir, downName)

		if _, err := os.Stat(downPath); os.IsNotExist(err) {
			return fmt.Errorf("no _down.sql file found for version %d: expected %s", version, downName)
		}

		downSQL, err := os.ReadFile(downPath)
		if err != nil {
			return err
		}

		// Backup schema
		backupSchema := fmt.Sprintf("rollback_backup_%d", version)
		_, err = db.Exec(fmt.Sprintf("CREATE SCHEMA IF NOT EXISTS %s", backupSchema))
		if err != nil {
			return err
		}

		forwardSQLPath := filepath.Join(dir, forwardName)
		if sqlBytes, readErr := os.ReadFile(forwardSQLPath); readErr == nil {
			matches := tableExtractor.FindAllStringSubmatch(string(sqlBytes), -1)
			tableSet := make(map[string]bool)
			for _, m := range matches {
				tbl := strings.ToLower(m[1])
				if tbl != "schema_migrations" {
					tableSet[tbl] = true
				}
			}
			for tbl := range tableSet {
				backupStmt := fmt.Sprintf(
                    `CREATE TABLE IF NOT EXISTS %s."%s" AS SELECT * FROM "%s"`,
                    backupSchema, tbl, tbl,
                )
                if _, err := db.Exec(backupStmt); err != nil {
                    fmt.Printf("[rollback] warning: failed to backup table %s for version %d: %v\n", tbl, version, err)
                }
			}
		}

		tx, err := db.Beginx()
		if err != nil {
			return err
		}

		if _, err := tx.Exec(string(downSQL)); err != nil {
			tx.Rollback()
			return fmt.Errorf("failed to execute rollback for version %d: %w", version, err)
		}

		if _, err := tx.Exec("DELETE FROM schema_migrations WHERE version = $1", version); err != nil {
			_ = tx.Rollback()
			return err
		}

		if err := tx.Commit(); err != nil {
			return err
		}

		fmt.Printf("[rollback] rolled back version %d, backup in schema %s\n", version, backupSchema)
	}

	return nil
}

// RestoreFromBackup restores tables from a rollback backup schema.
// backupSchema is named rollback_backup_<version>.
// Pass tableName="" to restore all tables in that backup schema.
func RestoreFromBackup(db *DB, version int, tableName string) error {
	backupSchema := fmt.Sprintf("rollback_backup_%d", version)

	var rows []struct {
		TableName string `db:"tablename"`
	}
	if err := db.Select(&rows,
		"SELECT tablename FROM pg_tables WHERE schemaname = $1", backupSchema); err != nil {
		return fmt.Errorf("failed to list tables in backup schema %s: %w", backupSchema, err)
	}

	if len(rows) == 0 {
		return fmt.Errorf("backup schema %s is empty (no data to restore)", backupSchema)
	}

	for _, r := range rows {
		tbl := r.TableName
		if tableName != "" && tbl != tableName {
			continue
		}

		dropStmt := fmt.Sprintf(`DROP TABLE IF EXISTS "%s"`, tbl)
		_, err := db.Exec(dropStmt)
		if err != nil {
			return fmt.Errorf("failed to drop table %s before restore: %w", tbl, err)
		}

		restoreStmt := fmt.Sprintf(
            `CREATE TABLE "%s" AS SELECT * FROM %s."%s"`,
            tbl, backupSchema, tbl,
        )
		if _, err := db.Exec(restoreStmt); err != nil {
			return fmt.Errorf("failed to restore table %s from %s: %w", tbl, backupSchema, err)
		}

		fmt.Printf("[restore] restored table %s from %s\n", tbl, backupSchema)
	}

	return nil
}

// DropBackupSchema drops the rollback backup schema for a given version.
func DropBackupSchema(db *DB, version int) error {
	backupSchema := fmt.Sprintf("rollback_backup_%d", version)
	_, err := db.Exec(fmt.Sprintf("DROP SCHEMA IF EXISTS %s CASCADE", backupSchema))
	return err
}

// ---------------------------------------------------------------------------
// Down-migration generator
// ---------------------------------------------------------------------------

// GenerateDownMigrations scans the migrations directory and generates _down.sql
// files for every forward migration that does not already have one.
//
// It extracts:
//   - CREATE TABLE ... -> DROP TABLE IF EXISTS ... CASCADE
//   - ALTER TABLE ... ADD COLUMN ... -> ALTER TABLE ... DROP COLUMN IF EXISTS ...
//   - CREATE INDEX ... -> DROP INDEX IF EXISTS ...
//   - CREATE SEQUENCE ... -> DROP SEQUENCE IF EXISTS ...
//
// Unknown statements are included as a commented warning for manual review.
func GenerateDownMigrations(dir string) error {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return fmt.Errorf("failed to read migrations directory %s: %w", dir, err)
	}

	var generated []string

	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".sql") {
			continue
		}
		name := entry.Name()

		// Skip _down.sql files
		if strings.Contains(name, "_down.") {
			continue
		}

		var version int
		if _, err := fmt.Sscanf(name, "%03d_", &version); err != nil {
			continue
		}

		base := strings.TrimSuffix(name, ".sql")
		downName := base + "_down.sql"
		downPath := filepath.Join(dir, downName)

		// Skip if _down.sql already exists
		if _, err := os.Stat(downPath); err == nil {
			continue
		}

		content, err := os.ReadFile(filepath.Join(dir, name))
		if err != nil {
			return fmt.Errorf("failed to read %s: %w", name, err)
		}

		downSQL := generateDownSQL(version, string(content))
		if downSQL == "" {
			continue
		}

		if err := os.WriteFile(downPath, []byte(downSQL), 0644); err != nil {
			return fmt.Errorf("failed to write %s: %w", downName, err)
		}

		generated = append(generated, downName)
	}

	if len(generated) == 0 {
		fmt.Println("[generate-down] no new _down.sql files needed")
		return nil
	}

	fmt.Printf("[generate-down] generated %d _down.sql file(s):\n", len(generated))
	for _, g := range generated {
		fmt.Printf("  %s\n", g)
	}

	return nil
}

// generateDownSQL parses forward SQL and produces a _down.sql file.
func generateDownSQL(version int, forwardSQL string) string {
	var lines []string
	lines = append(lines, fmt.Sprintf("-- Auto-generated rollback for version %03d. Review before use.\n", version))
	lines = append(lines, "-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.")

	// Split SQL into statements by semicolon.
	statements := splitStatements(forwardSQL)

	for _, stmt := range statements {
		down := parseStatement(stmt)
		lines = append(lines, down)
	}

	if len(lines) <= 3 {
		lines = append(lines, "\n-- No auto-reversible statements found. Please review forward SQL and add rollback manually.")
		lines = append(lines, "-- Example: DROP TABLE IF EXISTS <table> CASCADE;")
	}

	return strings.Join(lines, "\n") + "\n"
}

// splitStatements splits SQL text into individual statements (by semicolon).
func splitStatements(sql string) []string {
	var statements []string
	parts := strings.Split(sql, ";")
	for _, part := range parts {
		// Join continuation lines
		stmt := strings.TrimSpace(part)
		// Remove inline comments
		if idx := strings.Index(stmt, "--"); idx >= 0 {
			stmt = stmt[:idx]
		}
		stmt = strings.TrimSpace(stmt)
		if stmt != "" {
			statements = append(statements, stmt)
		}
	}
	return statements
}

// parseStatement converts a single forward SQL statement into a rollback statement.
// Identifiers are extracted preserving original case (SQL is case-insensitive).
func parseStatement(stmt string) string {
	stmt = strings.TrimSpace(stmt)
	upper := strings.ToUpper(stmt)

	// CREATE TABLE — extract identifier preserving original case
	createTableRe := regexp.MustCompile(`(?i)^CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([A-Za-z_][A-Za-z0-9_]*)`)
	if m := createTableRe.FindStringSubmatch(stmt); m != nil {
		return fmt.Sprintf("DROP TABLE IF EXISTS %s CASCADE;", m[1])
	}

	// CREATE INDEX — extract index name preserving case
	createIndexRe := regexp.MustCompile(`(?i)^CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:CONCURRENTLY\s+)?(?:IF\s+NOT\s+EXISTS\s+)?([A-Za-z_][A-Za-z0-9_]*)`)
	if m := createIndexRe.FindStringSubmatch(stmt); m != nil {
		return fmt.Sprintf("DROP INDEX IF EXISTS %s;", m[1])
	}

	// CREATE SEQUENCE — extract sequence name preserving case
	createSeqRe := regexp.MustCompile(`(?i)^CREATE\s+(?:TEMPORARY\s+|TEMP\s+)?SEQUENCE\s+(?:IF\s+NOT\s+EXISTS\s+)?([A-Za-z_][A-Za-z0-9_]*)`)
	if m := createSeqRe.FindStringSubmatch(stmt); m != nil {
		return fmt.Sprintf("DROP SEQUENCE IF EXISTS %s;", m[1])
	}

	// ALTER TABLE ... ADD CONSTRAINT (named) — check BEFORE ADD COLUMN
	alterAddConstraintRe := regexp.MustCompile(`(?i)^ALTER\s+TABLE\s+([A-Za-z_][A-Za-z0-9_]*)\s+ADD\s+CONSTRAINT\s+([A-Za-z_][A-Za-z0-9_]*)`)
	if m := alterAddConstraintRe.FindStringSubmatch(stmt); m != nil {
		return fmt.Sprintf("ALTER TABLE %s DROP CONSTRAINT IF EXISTS %s;", m[1], m[2])
	}

	// ALTER TABLE ... ADD COLUMN (also matches ADD without COLUMN keyword)
	alterAddColRe := regexp.MustCompile(`(?i)^ALTER\s+TABLE\s+([A-Za-z_][A-Za-z0-9_]*)\s+ADD\s+(?:COLUMN\s+)?([A-Za-z_][A-Za-z0-9_]*)`)
	if m := alterAddColRe.FindStringSubmatch(stmt); m != nil {
		// Verify it's actually ADD COLUMN and not ADD CONSTRAINT (already handled above)
		rest := strings.ToUpper(m[0])
		if strings.Contains(rest, "ADD CONSTRAINT") {
			return fmt.Sprintf("-- REVIEW: ADD CONSTRAINT not matched, check manually:\n--   %s", stmt)
		}
		return fmt.Sprintf("ALTER TABLE %s DROP COLUMN IF EXISTS %s;", m[1], m[2])
	}

	// ALTER TABLE (other forms) - warn
	if strings.HasPrefix(upper, "ALTER TABLE") {
		return fmt.Sprintf("-- REVIEW: ALTER TABLE statement may need manual rollback:\n--   %s", stmt)
	}

	// Data mutations - cannot auto-reverse
	if strings.HasPrefix(upper, "INSERT") || strings.HasPrefix(upper, "UPDATE") ||
		strings.HasPrefix(upper, "DELETE") || strings.HasPrefix(upper, "TRUNCATE") {
		return fmt.Sprintf("-- REVIEW: data mutation cannot be auto-reversed:\n--   %s", stmt)
	}

	// Unknown statement
	return fmt.Sprintf("-- REVIEW: unknown statement:\n--   %s", stmt)
}

// ---------------------------------------------------------------------------
// Forward-compatibility checker
// ---------------------------------------------------------------------------

// IsForwardCompatible checks whether a forward migration SQL follows the
// forward-compatibility convention (only ADD COLUMN / CREATE TABLE, no DROP).
// Returns a list of violation descriptions.
func IsForwardCompatible(sql string) []string {
	var violations []string
	statements := splitStatements(sql)
	for _, stmt := range statements {
		v := checkStatement(stmt)
		violations = append(violations, v...)
	}
	return violations
}

func checkStatement(stmt string) []string {
	upper := strings.ToUpper(stmt)
	var violations []string

	if strings.HasPrefix(upper, "DROP") {
		violations = append(violations, fmt.Sprintf("DROP statement not allowed in forward migration: %s", stmt))
	}

	if strings.Contains(upper, "ALTER COLUMN") &&
		!strings.Contains(upper, "SET DEFAULT") &&
		!strings.Contains(upper, "DROP DEFAULT") {
		violations = append(violations, fmt.Sprintf("ALTER COLUMN (type change) not allowed in forward migration: %s", stmt))
	}

	if strings.HasPrefix(upper, "RENAME") {
		violations = append(violations, fmt.Sprintf("RENAME statement not allowed in forward migration: %s", stmt))
	}

	return violations
}

// ---------------------------------------------------------------------------
// Down-migration loader
// ---------------------------------------------------------------------------

// DownMigration represents a rollback SQL file.
type DownMigration struct {
	Version int
	Name    string
	SQL     string
}

// LoadDownMigrations reads _down.sql rollback files from a directory.
// Results are sorted by version descending (for rollback order).
func LoadDownMigrations(dir string) ([]DownMigration, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, fmt.Errorf("failed to read migrations directory %s: %w", dir, err)
	}

	var migrations []DownMigration
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".sql") {
			continue
		}
		name := entry.Name()

		if !strings.Contains(name, "_down.") {
			continue
		}

		var version int
		if _, err := fmt.Sscanf(name, "%03d_", &version); err != nil {
			continue
		}

		content, err := os.ReadFile(filepath.Join(dir, name))
		if err != nil {
			return nil, fmt.Errorf("failed to read down migration %s: %w", name, err)
		}

		migrations = append(migrations, DownMigration{
			Version: version,
			Name:    name,
			SQL:     string(content),
		})
	}

	sort.Slice(migrations, func(i, j int) bool {
		return migrations[i].Version > migrations[j].Version // descending
	})

	return migrations, nil
}

// ---------------------------------------------------------------------------
// Dry run and stats
// ---------------------------------------------------------------------------

// MigrateDryRun returns the list of migrations that would be applied or rolled back.
// direction: "up" or "down"
func MigrateDryRun(db *DB, dir string, direction string, steps int) ([]string, error) {
	direction = strings.ToLower(direction)
	if direction != "up" && direction != "down" {
		return nil, fmt.Errorf("direction must be 'up' or 'down', got %q", direction)
	}

	_, err := db.Exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
		version     INT PRIMARY KEY,
		name        VARCHAR(255) NOT NULL,
		applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
	)`)
	if err != nil {
		return nil, err
	}

	if direction == "up" {
		migrations, err := LoadMigrations(dir)
		if err != nil {
			return nil, err
		}
		var applied []int
		db.Select(&applied, "SELECT version FROM schema_migrations")
		appliedSet := make(map[int]bool)
		for _, v := range applied {
			_ = appliedSet[v]
		}
		var result []string
		count := 0
		for _, m := range migrations {
			if appliedSet[m.Version] {
				continue
			}
			result = append(result, fmt.Sprintf("[%d] %s", m.Version, m.Name))
			count++
			if steps > 0 && count >= steps {
				break
			}
		}
		return result, nil
	}

	// Down
	var appliedRows []struct {
		Version int
		Name    string
	}
	if steps > 0 {
		db.Select(&appliedRows, "SELECT version, name FROM schema_migrations ORDER BY version DESC LIMIT $1", steps)
	} else {
		db.Select(&appliedRows, "SELECT version, name FROM schema_migrations ORDER BY version DESC")
	}

	var result []string
	for _, r := range appliedRows {
		base := strings.TrimSuffix(r.Name, ".sql")
		downName := base + "_down.sql"
		exists := false
		if _, err := os.Stat(filepath.Join(dir, downName)); err == nil {
			exists = true
		}
		status := "OK"
		if !exists {
			status = "MISSING _down.sql"
		}
		result = append(result, fmt.Sprintf("[%d] %s (%s)", r.Version, r.Name, status))
	}
	return result, nil
}

// MigrationStats returns summary statistics about the migration state.
type MigrationStats struct {
	TotalForward     int   `json:"total_forward"`
	Applied          int   `json:"applied"`
	Pending          int   `json:"pending"`
	HasRollback      int   `json:"has_rollback_sql"`
	MissingRollback  []int `json:"missing_rollback_sql"`
}

// GetMigrationStats queries the database and migrations directory for a summary.
func GetMigrationStats(db *DB, dir string) (*MigrationStats, error) {
	migrations, err := LoadMigrations(dir)
	if err != nil {
		return nil, err
	}

	var applied []int
	_ = db.Select(&applied, "SELECT version FROM schema_migrations ORDER BY version")

	stats := &MigrationStats{
		TotalForward: len(migrations),
		Applied:      len(applied),
		Pending:      len(migrations) - len(applied),
	}

	appliedSet := make(map[int]bool, len(applied))
	for _, v := range applied {
		appliedSet[v] = true
	}

	for _, m := range migrations {
		if !appliedSet[m.Version] {
			continue
		}
		base := strings.TrimSuffix(m.Name, ".sql")
		downPath := filepath.Join(dir, base+"_down.sql")
		if _, err := os.Stat(downPath); os.IsNotExist(err) {
			stats.MissingRollback = append(stats.MissingRollback, m.Version)
		} else {
			stats.HasRollback++
		}
	}

	return stats, nil
}
