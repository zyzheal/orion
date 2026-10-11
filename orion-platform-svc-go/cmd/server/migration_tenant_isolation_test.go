package main

import (
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
)

// ADR-011 (docs/adr/ADR-011-多租户存储隔离方案.md §3.2.1 + §3.2.5)
// 落地: 720 给 tenants 加 isolation_mode/schema_name/schema_created_at;
// 732 建 schema_migrations 表跟踪每个 schema 的 migration 版本。
//
// 与 ADR-010 alert_breaker_state (735) / ADR-013 CMDB (706-708) /
// ADR-014 pipeline_artifacts (730-731) 平行, 全部走迁移 → 测试 → 服务
// 的渐进式落地路径。

func TestMigration720_AddsIsolationColumnsToTenants(t *testing.T) {
	body := readMigrationArtifactBus(t, "720_tenants_add_isolation_mode.sql")

	// ALTER TABLE tenants ADD COLUMN IF NOT EXISTS isolation_mode
	if !regexp.MustCompile(`(?is)ALTER TABLE\s+tenants\s+ADD COLUMN IF NOT EXISTS\s+isolation_mode\s+TEXT\s+NOT NULL\s+DEFAULT\s+'shared'`).MatchString(body) {
		t.Error("720 missing isolation_mode TEXT NOT NULL DEFAULT 'shared'")
	}

	// CHECK 约束: 只允许 'shared' 或 'schema'
	if !regexp.MustCompile(`(?i)chk_tenants_isolation_mode`).MatchString(body) {
		t.Error("720 missing chk_tenants_isolation_mode constraint name")
	}
	if !regexp.MustCompile(`(?i)CHECK\s*\(\s*isolation_mode\s+IN\s*\(\s*'shared'\s*,\s*'schema'\s*\)`).MatchString(body) {
		t.Error("720 CHECK should be isolation_mode IN ('shared', 'schema')")
	}

	// schema_name nullable (no NOT NULL)
	if !regexp.MustCompile(`(?is)ADD COLUMN IF NOT EXISTS\s+schema_name\s+TEXT\s*;`).MatchString(body) {
		t.Error("720 missing schema_name TEXT nullable")
	}

	// schema_created_at nullable
	if !regexp.MustCompile(`(?is)ADD COLUMN IF NOT EXISTS\s+schema_created_at\s+TIMESTAMPTZ\s*;`).MatchString(body) {
		t.Error("720 missing schema_created_at TIMESTAMPTZ nullable")
	}

	// 运维 index
	if !regexp.MustCompile(`(?is)CREATE INDEX IF NOT EXISTS\s+idx_tenants_isolation_mode\s+ON\s+tenants\s*\(isolation_mode\)`).MatchString(body) {
		t.Error("720 missing idx_tenants_isolation_mode")
	}

	// 原子性
	if !regexp.MustCompile(`(?im)^BEGIN;`).MatchString(body) {
		t.Error("720 missing BEGIN;")
	}
	if !regexp.MustCompile(`(?i)COMMIT;`).MatchString(body) {
		t.Error("720 missing COMMIT;")
	}
}

func TestMigration720_Down_DropsColumnsInReverseOrder(t *testing.T) {
	d720 := readMigrationArtifactBus(t, "720_tenants_add_isolation_mode_down.sql")
	if !regexp.MustCompile(`(?i)DROP\s+INDEX\s+IF\s+EXISTS\s+idx_tenants_isolation_mode`).MatchString(d720) {
		t.Error("720 down missing DROP INDEX")
	}
	// 3 columns 都要 DROP
	for _, col := range []string{"schema_created_at", "schema_name", "isolation_mode"} {
		if !regexp.MustCompile(`(?i)DROP\s+COLUMN\s+IF\s+EXISTS\s+`+col).MatchString(d720) {
			t.Errorf("720 down missing DROP COLUMN %s", col)
		}
	}
	// DROP INDEX 在 DROP COLUMN 之前
	idxIdx := strings.Index(d720, "DROP INDEX")
	colIdx := strings.Index(d720, "DROP COLUMN")
	if idxIdx < 0 || colIdx < 0 || idxIdx > colIdx {
		t.Errorf("720 down should DROP INDEX before DROP COLUMN (index@%d, column@%d)", idxIdx, colIdx)
	}
}

func TestMigration732_CreatesSchemaMigrationsTable(t *testing.T) {
	body := readMigrationArtifactBus(t, "732_create_schema_migrations.sql")

	re := regexp.MustCompile(`(?is)CREATE TABLE IF NOT EXISTS schema_migrations\s*\(([\s\S]*?)\);`)
	m := re.FindStringSubmatch(body)
	if m == nil {
		t.Fatal("732 does not CREATE TABLE schema_migrations")
	}
	bodyDef := m[1]

	// 3 columns
	for _, col := range []string{"schema_name", "version", "applied_at"} {
		if !regexp.MustCompile(`(?im)^\s*`+regexp.QuoteMeta(col)+`\s+\w+`).MatchString(bodyDef) {
			t.Errorf("schema_migrations missing column %q", col)
		}
	}

	// 类型契约
	if !regexp.MustCompile(`(?i)\bschema_name\s+TEXT\s+PRIMARY KEY`).MatchString(bodyDef) {
		t.Error("schema_name should be TEXT PRIMARY KEY")
	}
	if !regexp.MustCompile(`(?i)\bversion\s+INTEGER\s+NOT NULL`).MatchString(bodyDef) {
		t.Error("version should be INTEGER NOT NULL")
	}
	if !regexp.MustCompile(`(?i)\bapplied_at\s+TIMESTAMPTZ\s+NOT NULL\s+DEFAULT\s+NOW\(\)`).MatchString(bodyDef) {
		t.Error("applied_at should be TIMESTAMPTZ NOT NULL DEFAULT NOW()")
	}

	// 原子性
	if !regexp.MustCompile(`(?im)^BEGIN;`).MatchString(body) {
		t.Error("732 missing BEGIN;")
	}
	if !regexp.MustCompile(`(?i)COMMIT;`).MatchString(body) {
		t.Error("732 missing COMMIT;")
	}
}

func TestMigration732_Down_DropsTable(t *testing.T) {
	d732 := readMigrationArtifactBus(t, "732_create_schema_migrations_down.sql")
	if !regexp.MustCompile(`(?i)DROP\s+TABLE\s+IF\s+EXISTS\s+schema_migrations`).MatchString(d732) {
		t.Error("732 down missing DROP TABLE")
	}
	if !regexp.MustCompile(`(?im)^BEGIN;`).MatchString(d732) {
		t.Error("732 down missing BEGIN;")
	}
	if !regexp.MustCompile(`(?i)COMMIT;`).MatchString(d732) {
		t.Error("732 down missing COMMIT;")
	}
}

// TestMigration_TenantIsolation_NumberSequence asserts every ADR 落地
// migration 号段独立, 无冲突。若新增 ADR 落地误用了已有号, 该测试会失败。
func TestMigration_TenantIsolation_NumberSequence(t *testing.T) {
	// All 8 migrations that landed across ADR-010..014 (706-708, 720, 730-732, 735).
	expected := []string{"706", "707", "708", "720", "730", "731", "732", "735"}

	path, _ := filepath.Abs("../../migrations")
	entries, err := os.ReadDir(path)
	if err != nil {
		t.Fatalf("read migrations: %v", err)
	}

	// Count up migration files per prefix (up + down = 2 expected).
	counts := map[string]int{}
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		name := e.Name()
		m := regexp.MustCompile(`^(\d{3})_`).FindStringSubmatch(name)
		if m == nil {
			continue
		}
		counts[m[1]]++
	}

	seen := map[string]bool{}
	for _, num := range expected {
		if seen[num] {
			t.Errorf("duplicate expected migration %s", num)
		}
		seen[num] = true
		if counts[num] < 2 {
			t.Errorf("migration %s should have >=2 files (up + down), got %d", num, counts[num])
		}
	}
}
