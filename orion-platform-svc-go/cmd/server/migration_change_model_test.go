package main

import (
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"testing"
)

// ADR-015 (docs/adr/ADR-015-Change-建模决策.md §4.1)
// 方案 A: ProcessTask + StepHandler 三层 SOP 模型:
//   - change_templates (755) - 模板层
//   - change_sops (756)      - 作业指导书层
//   - change_sop_steps (757) - 步骤层
//   - tickets (758 ALTER)    - 变更请求 (ChangeRequest) 引用其模板 + SOP
//
// 参考: reports/expert-reviews/neatlogic-change-event-firsthand-2026-10-03.md
// 本测试锁定 ADR-015 §4.1 的完整 schema 契约 (4 tables + 1 ALTER)。

func readMigrationChangeModel(t *testing.T, name string) string {
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

func TestMigration755_CreatesChangeTemplatesTable(t *testing.T) {
	body := readMigrationChangeModel(t, "755_create_change_templates.sql")

	re := regexp.MustCompile(`(?is)CREATE TABLE IF NOT EXISTS change_templates\s*\(([\s\S]*?)\);`)
	m := re.FindStringSubmatch(body)
	if m == nil {
		t.Fatal("755 does not CREATE TABLE change_templates")
	}
	bodyDef := m[1]

	// ADR-015 §4.1 ChangeTemplateVo 字段映射 (id/tenant_id/name/description/
	// is_active/authority/template_type/team_uuid/created_by/created_at/updated_at)
	for _, col := range []string{
		"id",
		"tenant_id",
		"name",
		"description",
		"is_active",
		"authority",
		"template_type",
		"team_uuid",
		"created_by",
		"created_at",
		"updated_at",
	} {
		if !regexp.MustCompile(`(?im)^\s*`+regexp.QuoteMeta(col)+`\s+\w+`).MatchString(bodyDef) {
			t.Errorf("change_templates missing column %q", col)
		}
	}

	invariants := []struct {
		name    string
		pattern string
	}{
		{"id UUID PK", `(?i)\bid\s+UUID\s+PRIMARY KEY`},
		{"tenant_id UUID NOT NULL", `(?i)\btenant_id\s+UUID\s+NOT NULL`},
		{"name VARCHAR(255) NOT NULL", `(?i)\bname\s+VARCHAR\(255\)\s+NOT NULL`},
		{"is_active BOOLEAN NOT NULL DEFAULT TRUE", `(?i)\bis_active\s+BOOLEAN\s+NOT NULL\s+DEFAULT\s+TRUE`},
		{"authority VARCHAR(50) NOT NULL", `(?i)\bauthority\s+VARCHAR\(50\)\s+NOT NULL`},
		{"template_type VARCHAR(50) NOT NULL", `(?i)\btemplate_type\s+VARCHAR\(50\)\s+NOT NULL`},
		{"created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()", `(?i)\bcreated_at\s+TIMESTAMPTZ\s+NOT NULL\s+DEFAULT\s+NOW\(\)`},
		{"updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()", `(?i)\bupdated_at\s+TIMESTAMPTZ\s+NOT NULL\s+DEFAULT\s+NOW\(\)`},
	}
	for _, tc := range invariants {
		if !regexp.MustCompile(tc.pattern).MatchString(bodyDef) {
			t.Errorf("755 %s missing", tc.name)
		}
	}

	// 表级 UNIQUE (tenant_id, name)
	if !regexp.MustCompile(`(?i)UNIQUE\s*\(tenant_id,\s*name\)`).MatchString(bodyDef) {
		t.Error("755 missing UNIQUE (tenant_id, name)")
	}

	// 3 indexes
	for _, idx := range []string{
		"idx_change_templates_tenant",
		"idx_change_templates_active",
		"idx_change_templates_team",
	} {
		if !regexp.MustCompile(`(?is)CREATE INDEX IF NOT EXISTS\s+`+idx).MatchString(body) {
			t.Errorf("755 missing index %s (IF NOT EXISTS)", idx)
		}
	}

	// 原子性
	if !regexp.MustCompile(`(?im)^BEGIN;`).MatchString(body) {
		t.Error("755 missing BEGIN;")
	}
	if !regexp.MustCompile(`(?i)COMMIT;`).MatchString(body) {
		t.Error("755 missing COMMIT;")
	}
}

func TestMigration756_CreatesChangeSopsTable(t *testing.T) {
	body := readMigrationChangeModel(t, "756_create_change_sops.sql")

	re := regexp.MustCompile(`(?is)CREATE TABLE IF NOT EXISTS change_sops\s*\(([\s\S]*?)\);`)
	m := re.FindStringSubmatch(body)
	if m == nil {
		t.Fatal("756 does not CREATE TABLE change_sops")
	}
	bodyDef := m[1]

	for _, col := range []string{
		"id",
		"tenant_id",
		"template_id",
		"name",
		"description",
		"is_active",
		"authority",
		"sop_type",
		"team_uuid",
		"version",
		"created_by",
		"created_at",
		"updated_at",
	} {
		if !regexp.MustCompile(`(?im)^\s*`+regexp.QuoteMeta(col)+`\s+\w+`).MatchString(bodyDef) {
			t.Errorf("change_sops missing column %q", col)
		}
	}

	invariants := []struct {
		name    string
		pattern string
	}{
		{"id UUID PK", `(?i)\bid\s+UUID\s+PRIMARY KEY`},
		{"template_id UUID NOT NULL REFERENCES", `(?i)\btemplate_id\s+UUID\s+NOT NULL\s+REFERENCES\s+change_templates\(id\) ON DELETE CASCADE`},
		{"sop_type VARCHAR(50) NOT NULL", `(?i)\bsop_type\s+VARCHAR\(50\)\s+NOT NULL`},
		{"version INT NOT NULL DEFAULT 1", `(?i)\bversion\s+INTEGER\s+NOT NULL\s+DEFAULT\s+1`},
	}
	for _, tc := range invariants {
		if !regexp.MustCompile(tc.pattern).MatchString(bodyDef) {
			t.Errorf("756 %s missing", tc.name)
		}
	}

	// 表级 UNIQUE (tenant_id, template_id, name)
	if !regexp.MustCompile(`(?i)UNIQUE\s*\(tenant_id,\s*template_id,\s*name\)`).MatchString(bodyDef) {
		t.Error("756 missing UNIQUE (tenant_id, template_id, name)")
	}

	// 3 indexes
	for _, idx := range []string{
		"idx_change_sops_tenant",
		"idx_change_sops_template",
		"idx_change_sops_active",
	} {
		if !regexp.MustCompile(`(?is)CREATE INDEX IF NOT EXISTS\s+`+idx).MatchString(body) {
			t.Errorf("756 missing index %s", idx)
		}
	}

	// 原子性
	if !regexp.MustCompile(`(?im)^BEGIN;`).MatchString(body) {
		t.Error("756 missing BEGIN;")
	}
	if !regexp.MustCompile(`(?i)COMMIT;`).MatchString(body) {
		t.Error("756 missing COMMIT;")
	}
}

func TestMigration757_CreatesChangeSopStepsTable(t *testing.T) {
	body := readMigrationChangeModel(t, "757_create_change_sop_steps.sql")

	re := regexp.MustCompile(`(?is)CREATE TABLE IF NOT EXISTS change_sop_steps\s*\(([\s\S]*?)\);`)
	m := re.FindStringSubmatch(body)
	if m == nil {
		t.Fatal("757 does not CREATE TABLE change_sop_steps")
	}
	bodyDef := m[1]

	for _, col := range []string{
		"id",
		"tenant_id",
		"sop_id",
		"code",
		"name",
		"content",
		"plan_start_date",
		"start_time_window",
		"end_time_window",
		"worker",
		"file_ids",
		"sort_order",
		"version",
		"created_by",
		"created_at",
		"updated_at",
	} {
		if !regexp.MustCompile(`(?im)^\s*`+regexp.QuoteMeta(col)+`\s+\w+`).MatchString(bodyDef) {
			t.Errorf("change_sop_steps missing column %q", col)
		}
	}

	invariants := []struct {
		name    string
		pattern string
	}{
		{"sop_id UUID NOT NULL REFERENCES", `(?i)\bsop_id\s+UUID\s+NOT NULL\s+REFERENCES\s+change_sops\(id\) ON DELETE CASCADE`},
		{"code VARCHAR(255) NOT NULL", `(?i)\bcode\s+VARCHAR\(255\)\s+NOT NULL`},
		{"plan_start_date DATE nullable", `(?i)\bplan_start_date\s+DATE\s*(,|$)`},
		{"start_time_window VARCHAR(100)", `(?i)\bstart_time_window\s+VARCHAR\(100\)`},
		{"end_time_window VARCHAR(100)", `(?i)\bend_time_window\s+VARCHAR\(100\)`},
		{"file_ids JSONB NOT NULL DEFAULT []", `(?i)\bfile_ids\s+JSONB\s+NOT NULL\s+DEFAULT\s+'?\[\]`},
		{"sort_order INT NOT NULL DEFAULT 0", `(?i)\bsort_order\s+INTEGER\s+NOT NULL\s+DEFAULT\s+0`},
		{"version INT NOT NULL DEFAULT 1", `(?i)\bversion\s+INTEGER\s+NOT NULL\s+DEFAULT\s+1`},
	}
	for _, tc := range invariants {
		if !regexp.MustCompile(tc.pattern).MatchString(bodyDef) {
			t.Errorf("757 %s missing", tc.name)
		}
	}

	// 表级 UNIQUE (tenant_id, sop_id, code)
	if !regexp.MustCompile(`(?i)UNIQUE\s*\(tenant_id,\s*sop_id,\s*code\)`).MatchString(bodyDef) {
		t.Error("757 missing UNIQUE (tenant_id, sop_id, code)")
	}

	// 3 indexes
	for _, idx := range []string{
		"idx_change_sop_steps_sop",
		"idx_change_sop_steps_tenant_code",
		"idx_change_sop_steps_sort",
	} {
		if !regexp.MustCompile(`(?is)CREATE INDEX IF NOT EXISTS\s+`+idx).MatchString(body) {
			t.Errorf("757 missing index %s", idx)
		}
	}

	// 原子性
	if !regexp.MustCompile(`(?im)^BEGIN;`).MatchString(body) {
		t.Error("757 missing BEGIN;")
	}
	if !regexp.MustCompile(`(?i)COMMIT;`).MatchString(body) {
		t.Error("757 missing COMMIT;")
	}
}

func TestMigration758_AlterTicketsAddChangeColumns(t *testing.T) {
	body := readMigrationChangeModel(t, "758_tickets_add_change_template.sql")

	// ALTER TABLE ADD COLUMN IF NOT EXISTS change_template_id UUID
	if !regexp.MustCompile(`(?i)ALTER\s+TABLE\s+tickets\s+ADD\s+COLUMN\s+IF\s+NOT EXISTS\s+change_template_id\s+UUID`).MatchString(body) {
		t.Error("758 missing ALTER TABLE tickets ADD COLUMN change_template_id UUID")
	}
	if !regexp.MustCompile(`(?i)ALTER\s+TABLE\s+tickets\s+ADD\s+COLUMN\s+IF\s+NOT EXISTS\s+change_sop_id\s+UUID`).MatchString(body) {
		t.Error("758 missing ALTER TABLE tickets ADD COLUMN change_sop_id UUID")
	}

	// 3 indexes with partial WHERE ... IS NOT NULL predicates
	for _, idx := range []string{
		"idx_tickets_change_template",
		"idx_tickets_change_sop",
		"idx_tickets_tenant_change",
	} {
		if !regexp.MustCompile(`(?is)CREATE INDEX IF NOT EXISTS\s+`+idx).MatchString(body) {
			t.Errorf("758 missing index %s", idx)
		}
	}
	// Partial index predicates (only rows where the change columns are populated)
	if !regexp.MustCompile(`(?is)idx_tickets_change_template\s+ON\s+tickets\s*\(change_template_id\)\s+WHERE\s+change_template_id\s+IS\s+NOT\s+NULL`).MatchString(body) {
		t.Error("758 change_template index should be partial (WHERE change_template_id IS NOT NULL)")
	}
	if !regexp.MustCompile(`(?is)idx_tickets_change_sop\s+ON\s+tickets\s*\(change_sop_id\)\s+WHERE\s+change_sop_id\s+IS\s+NOT\s+NULL`).MatchString(body) {
		t.Error("758 change_sop index should be partial (WHERE change_sop_id IS NOT NULL)")
	}

	// 原子性
	if !regexp.MustCompile(`(?im)^BEGIN;`).MatchString(body) {
		t.Error("758 missing BEGIN;")
	}
	if !regexp.MustCompile(`(?i)COMMIT;`).MatchString(body) {
		t.Error("758 missing COMMIT;")
	}
}

func TestMigration758_Down_RemovesColumnsInReverseOrder(t *testing.T) {
	d758 := readMigrationChangeModel(t, "758_tickets_add_change_template_down.sql")

	// Reverse order: drop indexes first, then columns
	// Order of appearance in the down file:
	idx1 := strings.Index(d758, "DROP INDEX IF EXISTS idx_tickets_tenant_change")
	idx2 := strings.Index(d758, "DROP INDEX IF EXISTS idx_tickets_change_sop")
	idx3 := strings.Index(d758, "DROP INDEX IF EXISTS idx_tickets_change_template")
	col1 := strings.Index(d758, "DROP COLUMN IF EXISTS change_sop_id")
	col2 := strings.Index(d758, "DROP COLUMN IF EXISTS change_template_id")

	if idx1 == -1 || idx2 == -1 || idx3 == -1 {
		t.Error("758 down missing one or more DROP INDEX statements")
	}
	if col1 == -1 || col2 == -1 {
		t.Error("758 down missing DROP COLUMN statements")
	}
	// Indexes must precede columns
	if !(idx3 < col1) || !(idx2 < col1) || !(idx1 < col1) {
		t.Error("758 down: all DROP INDEX must appear before DROP COLUMN")
	}
	// Column drop order: sop first, then template
	if !(col1 < col2) {
		t.Error("758 down: change_sop_id should drop before change_template_id")
	}
}

// TestMigration_ChangeModel_NumberSequence asserts that the 4 ADR-015
// migrations use contiguous, non-overlapping sequence numbers 755-758
// (per ADR-015 §4.1) and that no earlier migration occupies those numbers.
func TestMigration_ChangeModel_NumberSequence(t *testing.T) {
	dir, err := filepath.Abs("../../migrations")
	if err != nil {
		t.Fatalf("abs path: %v", err)
	}
	entries, err := os.ReadDir(dir)
	if err != nil {
		t.Fatalf("readdir: %v", err)
	}

	adr015 := map[string]bool{}
	for _, e := range entries {
		name := e.Name()
		if !strings.HasSuffix(name, ".sql") || strings.HasSuffix(name, "_down.sql") {
			continue
		}
		m := regexp.MustCompile(`^(\d+)_`).FindStringSubmatch(name)
		if m == nil {
			continue
		}
		n, err := strconv.Atoi(m[1])
		if err != nil {
			continue
		}
		if n >= 755 && n <= 758 {
			adr015[shortName(n, name)] = true
		}
	}

	expected := []string{
		"755_create_change_templates.sql",
		"756_create_change_sops.sql",
		"757_create_change_sop_steps.sql",
		"758_tickets_add_change_template.sql",
	}
	for _, name := range expected {
		if !adr015[name] {
			t.Errorf("expected migration %s to exist", name)
		}
	}
	if len(adr015) != len(expected) {
		t.Errorf("unexpected migration count in 755-758: got %d, want %d", len(adr015), len(expected))
	}

	// Assert all 4 are distinct (already guaranteed by map keys) and
	// print in sorted order for the log.
	names := make([]string, 0, len(adr015))
	for k := range adr015 {
		names = append(names, k)
	}
	sort.Strings(names)
	t.Logf("ADR-015 migrations found in 755-758: %v", names)
}

// shortName returns the migration file name, or (if not found) a synthetic
// label like "NNN_unknown.sql" so the missing-name error is visible.
func shortName(n int, name string) string {
	if name != "" {
		return name
	}
	return strconv.Itoa(n) + "_unknown.sql"
}
