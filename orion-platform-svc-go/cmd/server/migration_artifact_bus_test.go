package main

import (
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
)

// ADR-014 (docs/adr/ADR-014-Pipeline-ArtifactBus-方案.md §3.2.1)
// specifies Pipeline ArtifactBus 落地：730 创建 pipeline_artifacts 表，
// 731 给 pipeline_runs 加 artifact_count 列。
//
// 与 ADR-013 CMDB 二阶模型 (706-708) 平行，两个 ADR 都走迁移 → 测试 →
// 服务 的渐进式落地路径。此文件锁定 730/731 契约，防止后续误改。

func readMigrationArtifactBus(t *testing.T, name string) string {
	t.Helper()
	path, err := filepath.Abs("../../migrations/" + name)
	if err != nil {
		t.Fatalf("abs path: %v", err)
	}
	b, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read %s: %v", name, err)
	}
	return string(b)
}

func TestMigration730_CreatesPipelineArtifactsTable(t *testing.T) {
	body := readMigrationArtifactBus(t, "730_create_pipeline_artifacts.sql")

	re := regexp.MustCompile(`(?is)CREATE TABLE IF NOT EXISTS pipeline_artifacts\s*\(([\s\S]*?)\);`)
	m := re.FindStringSubmatch(body)
	if m == nil {
		t.Fatal("730 does not CREATE TABLE pipeline_artifacts")
	}
	bodyDef := m[1]

	// 11 columns ADR-014 §3.2.1 定义 (顺序无关)。
	for _, col := range []string{
		"id",
		"tenant_id",
		"pipeline_run_id",
		"stage_id",
		"name",
		"content_type",
		"size_bytes",
		"content",
		"checksum",
		"metadata",
		"created_at",
		"expires_at",
	} {
		if !regexp.MustCompile(`(?im)^\s*`+regexp.QuoteMeta(col)+`\s+\w+`).MatchString(bodyDef) {
			t.Errorf("pipeline_artifacts missing column %q", col)
		}
	}

	// 关键类型契约：content 是 BYTEA (二进制) 而非 TEXT (ADR-014 §3.2.2 明确)。
	invariants := []struct {
		name    string
		pattern string
	}{
		{"id UUID PK", `(?i)\bid\s+UUID\s+PRIMARY KEY`},
		{"tenant_id TEXT NOT NULL", `(?i)\btenant_id\s+TEXT\s+NOT NULL`},
		{"pipeline_run_id UUID NOT NULL", `(?i)\bpipeline_run_id\s+UUID\s+NOT NULL`},
		{"stage_id UUID NOT NULL", `(?i)\bstage_id\s+UUID\s+NOT NULL`},
		{"name TEXT NOT NULL", `(?i)\bname\s+TEXT\s+NOT NULL`},
		{"content_type TEXT NOT NULL", `(?i)\bcontent_type\s+TEXT\s+NOT NULL`},
		{"size_bytes BIGINT NOT NULL", `(?i)\bsize_bytes\s+BIGINT\s+NOT NULL`},
		{"content BYTEA NOT NULL", `(?i)\bcontent\s+BYTEA\s+NOT NULL`},
		{"metadata JSONB NOT NULL DEFAULT '{}'", `(?i)\bmetadata\s+JSONB\s+NOT NULL\s+DEFAULT\s+'\{\}'`},
		{"expires_at + 7 days", `(?i)\bexpires_at\s+TIMESTAMPTZ\s+NOT NULL\s+DEFAULT\s*\(NOW\(\)\s*\+\s*INTERVAL\s*'7 days'\)`},
	}
	for _, tc := range invariants {
		if !regexp.MustCompile(tc.pattern).MatchString(bodyDef) {
			t.Errorf("730 %s missing", tc.name)
		}
	}

	// 表级唯一约束：同一 run/stage 内 artifact 名唯一。
	if !regexp.MustCompile(`(?i)UNIQUE\s*\(pipeline_run_id,\s*stage_id,\s*name\)`).MatchString(bodyDef) {
		t.Error("730 missing UNIQUE (pipeline_run_id, stage_id, name)")
	}

	// 4 indexes，ADR-014 §3.2.1 明确。
	for _, idx := range []string{
		"idx_pipeline_artifacts_run",
		"idx_pipeline_artifacts_stage",
		"idx_pipeline_artifacts_expires",
		"idx_pipeline_artifacts_tenant",
	} {
		if !strings.Contains(body, idx) {
			t.Errorf("730 missing index %s", idx)
		}
	}

	// 所有 index 必须 IF NOT EXISTS（幂等重跑安全）。
	mustCount := func(pat string, body string) int {
		return len(regexp.MustCompile(pat).FindAllString(body, -1))
	}
	if n := mustCount(`(?i)CREATE INDEX IF NOT EXISTS\s+idx_pipeline_artifacts_`, body); n != 4 {
		t.Errorf("730 should have 4 IF NOT EXISTS indexes, got %d", n)
	}

	// 原子性。
	if !regexp.MustCompile(`(?im)^BEGIN;`).MatchString(body) {
		t.Error("730 missing BEGIN;")
	}
	if !regexp.MustCompile(`(?i)COMMIT;`).MatchString(body) {
		t.Error("730 missing COMMIT;")
	}
}

func TestMigration730_Down_DropsInReverseOrder(t *testing.T) {
	d730 := readMigrationArtifactBus(t, "730_create_pipeline_artifacts_down.sql")
	if !regexp.MustCompile(`(?i)DROP\s+INDEX\s+IF\s+EXISTS\s+idx_pipeline_artifacts_tenant`).MatchString(d730) ||
		!regexp.MustCompile(`(?i)DROP\s+INDEX\s+IF\s+EXISTS\s+idx_pipeline_artifacts_expires`).MatchString(d730) ||
		!regexp.MustCompile(`(?i)DROP\s+INDEX\s+IF\s+EXISTS\s+idx_pipeline_artifacts_stage`).MatchString(d730) ||
		!regexp.MustCompile(`(?i)DROP\s+INDEX\s+IF\s+EXISTS\s+idx_pipeline_artifacts_run`).MatchString(d730) {
		t.Error("730 down missing 4 DROP INDEX statements")
	}
	if !regexp.MustCompile(`(?i)DROP\s+TABLE\s+IF\s+EXISTS\s+pipeline_artifacts`).MatchString(d730) {
		t.Error("730 down missing DROP TABLE pipeline_artifacts")
	}
	// DROP TABLE 必须出现在所有 DROP INDEX 之后 (先删依赖, 再删表)。
	idxIdx := strings.Index(d730, "idx_pipeline_artifacts_run")
	idxTbl := strings.Index(d730, "DROP TABLE")
	if idxTbl < idxIdx {
		t.Errorf("730 down should DROP TABLE after DROP INDEX (got table@%d, index@%d)", idxTbl, idxIdx)
	}
}

func TestMigration731_AddsArtifactCountToPipelineRuns(t *testing.T) {
	body := readMigrationArtifactBus(t, "731_pipeline_runs_add_artifact_count.sql")

	// ALTER TABLE pipeline_runs ADD COLUMN IF NOT EXISTS artifact_count INTEGER NOT NULL DEFAULT 0
	if !regexp.MustCompile(`(?is)ALTER TABLE\s+pipeline_runs\s+ADD COLUMN IF NOT EXISTS\s+artifact_count\s+INTEGER\s+NOT NULL\s+DEFAULT\s+0`).MatchString(body) {
		t.Error("731 missing ALTER TABLE pipeline_runs ADD COLUMN artifact_count")
	}
	if !regexp.MustCompile(`(?im)^BEGIN;`).MatchString(body) {
		t.Error("731 missing BEGIN;")
	}
	if !regexp.MustCompile(`(?i)COMMIT;`).MatchString(body) {
		t.Error("731 missing COMMIT;")
	}
}

func TestMigration731_Down_DropsColumn(t *testing.T) {
	d731 := readMigrationArtifactBus(t, "731_pipeline_runs_add_artifact_count_down.sql")
	if !regexp.MustCompile(`(?is)ALTER TABLE\s+pipeline_runs\s+DROP\s+COLUMN\s+IF\s+EXISTS\s+artifact_count`).MatchString(d731) {
		t.Error("731 down must DROP COLUMN IF EXISTS artifact_count")
	}
	if !regexp.MustCompile(`(?im)^BEGIN;`).MatchString(d731) {
		t.Error("731 down missing BEGIN;")
	}
	if !regexp.MustCompile(`(?i)COMMIT;`).MatchString(d731) {
		t.Error("731 down missing COMMIT;")
	}
}

func TestMigration730731_NoNumberConflict(t *testing.T) {
	// 730/731 号段必须独立，不能与其他迁移冲突。
	entries, err := os.ReadDir("../../migrations")
	if err != nil {
		t.Fatalf("read migrations: %v", err)
	}
	seen := map[string]int{} // 文件名前缀 → 出现次数
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		name := e.Name()
		re := regexp.MustCompile(`^(\d{3})_`)
		if m := re.FindStringSubmatch(name); m != nil {
			seen[m[1]]++
		}
	}
	// 730 应有 2 个文件 (up + down)；731 同样。
	for _, n := range []string{"730", "731"} {
		if seen[n] != 2 {
			t.Errorf("migration %s should have exactly 2 files (up + down), got %d", n, seen[n])
		}
	}
}
