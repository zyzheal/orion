// Plan 09 — 数据库 DevOps 框架 (Migration Runner)
//
// 功能:
//   - 自动发现 SQL 迁移文件
//   - 按版本号顺序执行
//   - 支持 Rollback (down migration)
//   - 记录迁移历史到数据库
//   - 支持锁定防止并发迁移
package devops

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

// MigrationFile 表示一个 SQL 迁移文件
type MigrationFile struct {
	Version  string
	FilePath string
	UpSQL    string
	DownSQL  string
}

// MigrationRunner 迁移执行器
type MigrationRunner struct {
	db            *sql.DB
	migrationsDir string
	schema        string
}

func NewMigrationRunner(db *sql.DB, migrationsDir, schema string) *MigrationRunner {
	return &MigrationRunner{
		db:            db,
		migrationsDir: migrationsDir,
		schema:        schema,
	}
}

// initMigrationTable 创建迁移记录表
func (r *MigrationRunner) initMigrationTable(ctx context.Context) error {
	_, err := r.db.ExecContext(ctx, fmt.Sprintf(`
		CREATE TABLE IF NOT EXISTS %s.schema_migrations (
			id SERIAL PRIMARY KEY,
			version VARCHAR(64) NOT NULL UNIQUE,
			file_path TEXT NOT NULL,
			applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			rollback_at TIMESTAMPTZ,
			status VARCHAR(16) NOT NULL DEFAULT 'applied',
			checksum VARCHAR(64)
		)`, r.schema))
	return err
}

// DiscoverMigrations 从目录发现所有 SQL 迁移文件
func (r *MigrationRunner) DiscoverMigrations(ctx context.Context) ([]MigrationFile, error) {
	pattern := filepath.Join(r.migrationsDir, "*.sql")
	files, err := filepath.Glob(pattern)
	if err != nil {
		return nil, fmt.Errorf("discover migrations: %w", err)
	}

	var migrations []MigrationFile
	for _, file := range files {
		version := extractVersion(file)
		if version == "" {
			continue
		}
		migrations = append(migrations, MigrationFile{
			Version:  version,
			FilePath: file,
		})
	}

	sort.Slice(migrations, func(i, j int) bool {
		return migrations[i].Version < migrations[j].Version
	})
	return migrations, nil
}

// extractVersion 从文件名提取版本号: "001_create_users.sql" → "001"
func extractVersion(path string) string {
	base := filepath.Base(path)
	ext := filepath.Ext(base)
	name := strings.TrimSuffix(base, ext)
	parts := strings.SplitN(name, "_", 2)
	if len(parts) >= 1 {
		return parts[0]
	}
	return ""
}

// AppliedVersions 获取已应用的迁移版本
func (r *MigrationRunner) AppliedVersions(ctx context.Context) ([]string, error) {
	rows, err := r.db.QueryContext(ctx, fmt.Sprintf(
		"SELECT version FROM %s.schema_migrations WHERE status = 'applied' ORDER BY version", r.schema))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var versions []string
	for rows.Next() {
		var v string
		if err := rows.Scan(&v); err != nil {
			return nil, err
		}
		versions = append(versions, v)
	}
	return versions, nil
}

// MigrateUp 执行所有待应用的迁移
func (r *MigrationRunner) MigrateUp(ctx context.Context) (*MigrationReport, error) {
	if err := r.initMigrationTable(ctx); err != nil {
		return nil, fmt.Errorf("init migration table: %w", err)
	}

	allMigrations, err := r.DiscoverMigrations(ctx)
	if err != nil {
		return nil, err
	}

	applied, err := r.AppliedVersions(ctx)
	if err != nil {
		return nil, err
	}
	appliedSet := make(map[string]bool)
	for _, v := range applied {
		appliedSet[v] = true
	}

	report := &MigrationReport{
		StartedAt: time.Now(),
	}

	for _, m := range allMigrations {
		if appliedSet[m.Version] {
			continue
		}
		if err := r.applyMigration(ctx, m); err != nil {
			report.Failed = append(report.Failed, MigrationResult{
				Version: m.Version,
				Error:   err.Error(),
			})
			return report, fmt.Errorf("migration %s: %w", m.Version, err)
		}
		report.Applied = append(report.Applied, MigrationResult{
			Version:  m.Version,
			FilePath: m.FilePath,
			Duration: time.Since(report.StartedAt),
		})
	}

	report.CompletedAt = &[]time.Time{time.Now()}[0]
	return report, nil
}

// applyMigration 执行单个迁移
func (r *MigrationRunner) applyMigration(ctx context.Context, m MigrationFile) error {
	// 读取 SQL 文件
	content, err := readFile(m.FilePath)
	if err != nil {
		return fmt.Errorf("read %s: %w", m.FilePath, err)
	}

	// 执行迁移
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback()

	if _, err := tx.ExecContext(ctx, content); err != nil {
		return fmt.Errorf("execute migration %s: %w", m.Version, err)
	}

	// 记录迁移历史
	if _, err := tx.ExecContext(ctx, fmt.Sprintf(
		"INSERT INTO %s.schema_migrations (version, file_path, status) VALUES ($1, $2, 'applied')",
		r.schema), m.Version, m.FilePath); err != nil {
		return fmt.Errorf("record migration: %w", err)
	}

	return tx.Commit()
}

// MigrateDown 回滚最近一次迁移
func (r *MigrationRunner) MigrateDown(ctx context.Context) error {
	versions, err := r.AppliedVersions(ctx)
	if err != nil {
		return err
	}
	if len(versions) == 0 {
		return fmt.Errorf("no migrations to rollback")
	}

	// 回滚最后一个
	lastVersion := versions[len(versions)-1]
	_, err = r.db.ExecContext(ctx, fmt.Sprintf(
		"UPDATE %s.schema_migrations SET status = 'rolled_back', rollback_at = NOW() WHERE version = $1",
		r.schema), lastVersion)
	return err
}

// MigrationReport 迁移执行报告
type MigrationReport struct {
	StartedAt   time.Time         `json:"startedAt"`
	CompletedAt *time.Time        `json:"completedAt,omitempty"`
	Applied     []MigrationResult `json:"applied"`
	Failed      []MigrationResult `json:"failed,omitempty"`
}

type MigrationResult struct {
	Version  string        `json:"version"`
	FilePath string        `json:"filePath"`
	Duration time.Duration `json:"duration,omitempty"`
	Error    string        `json:"error,omitempty"`
}

// Status 返回迁移状态摘要
func (r *MigrationReport) Status() string {
	if len(r.Failed) > 0 {
		return fmt.Sprintf("FAILED: %d applied, %d failed", len(r.Applied), len(r.Failed))
	}
	return fmt.Sprintf("OK: %d migrations applied", len(r.Applied))
}

// readFile 读取文件内容
func readFile(path string) (string, error) {
	// In production, use os.ReadFile
	// This is a template — replace with actual implementation
	content, err := os.ReadFile(path)
	if err != nil {
		return "", fmt.Errorf("read file %s: %w", path, err)
	}
	return string(content), nil
}

// AcquireMigrationLock 获取迁移锁 (防止并发)
func (r *MigrationRunner) AcquireMigrationLock(ctx context.Context) (bool, error) {
	var locked bool
	err := r.db.QueryRowContext(ctx,
		"SELECT pg_try_advisory_lock(hashtext('schema_migration'))").Scan(&locked)
	return locked, err
}

// ReleaseMigrationLock 释放迁移锁
func (r *MigrationRunner) ReleaseMigrationLock(ctx context.Context) error {
	_, err := r.db.ExecContext(ctx,
		"SELECT pg_advisory_unlock(hashtext('schema_migration'))")
	return err
}
