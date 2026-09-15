package main

import (
	"regexp"
	"strings"
	"testing"
)

// 591 修的是一个很具体的缺陷：160 在 CREATE TABLE 之后用 ADD COLUMN ... NOT NULL
// 追加了列，既没有 DEFAULT 也没有给存量行填值，导致
// internal/pipeline-template 与 internal/pipeline-templates 两个模块的
// INSERT 都因为缺列而失败。下面三个测试把「591 给这些列补了默认值」和
// 「591_down 把它们抹回去」分别钉死，避免后续有人只改一头。
//
// 两个迁移文件里列名后面都有对齐用的多余空格（ALTER COLUMN tags          DROP
// DEFAULT），所以全部用正则取列名集合比较，不用字符串字面 Contains。

var (
	re591SetDefault  = regexp.MustCompile(`ALTER COLUMN\s+(\w+)\s+SET DEFAULT`)
	re591DropDefault = regexp.MustCompile(`ALTER COLUMN\s+(\w+)\s+DROP DEFAULT`)
	// 160 的单条 ALTER 里用逗号串了多个 ADD COLUMN IF NOT EXISTS 子句，
	// 每个子句形如 "ADD COLUMN IF NOT EXISTS <col> <type> NOT NULL"。
	re160AddNotNull = regexp.MustCompile(`ADD COLUMN IF NOT EXISTS (\w+)\s+[^,]*NOT NULL`)
)

// stripSQLComments removes "--" line comments so structural checks only see
// executable statements. 591's own doc block describes the defect in words
// (it quotes "ADD COLUMN ... NOT NULL" and "DROP NOT NULL"), and matching that
// prose instead of the real statements would turn every check here into a
// vacuous pass.
func stripSQLComments(body string) string {
	var out []string
	for _, line := range strings.Split(body, "\n") {
		if idx := strings.Index(line, "--"); idx >= 0 {
			line = line[:idx]
		}
		out = append(out, line)
	}
	return strings.Join(out, "\n")
}

func columns(regex *regexp.Regexp, body string) map[string]bool {
	cols := map[string]bool{}
	for _, m := range regex.FindAllStringSubmatch(body, -1) {
		cols[m[1]] = true
	}
	return cols
}

// TestMigration591SetsADefaultForEveryNotNullColumnThat160Added 确认 591 的
// 覆盖面没有缺口：160 用 ADD COLUMN ... NOT NULL 引入的每一列，591 都必须
// 给它 SET DEFAULT。漏掉任意一列，对应模块的 INSERT 就会继续因为缺列而失败。
func TestMigration591SetsADefaultForEveryNotNullColumnThat160Added(t *testing.T) {
	mig160 := stripSQLComments(migrationBody(t, "160_create_pipeline-template_tables.sql"))
	mig591 := stripSQLComments(migrationBody(t, "591_pipeline_templates_defaults.sql"))

	addedCols := columns(re160AddNotNull, mig160)
	if len(addedCols) != 8 {
		t.Fatalf("160 adds %d NOT NULL columns, want 8", len(addedCols))
	}

	defaults := columns(re591SetDefault, mig591)
	for col := range addedCols {
		if !defaults[col] {
			t.Errorf("591 sets defaults for %d columns but not for %s (added by 160 as NOT NULL without a default)", len(defaults), col)
		}
	}
}

// TestMigration591DownDropsEveryDefaultItsForwardSets 是 586/587/588 down 反转
// 测试的同款：确认 down 没有遗漏，也不会误删列或解除 NOT NULL。
func TestMigration591DownDropsEveryDefaultItsForwardSets(t *testing.T) {
	up := stripSQLComments(migrationBody(t, "591_pipeline_templates_defaults.sql"))
	dn := stripSQLComments(migrationBody(t, "591_pipeline_templates_defaults_down.sql"))

	setCols := columns(re591SetDefault, up)
	dropCols := columns(re591DropDefault, dn)

	if len(setCols) != 10 {
		t.Errorf("591 sets %d defaults, want 10", len(setCols))
	}
	if len(dropCols) != 10 {
		t.Errorf("591 down drops %d defaults, want 10", len(dropCols))
	}

	for col := range setCols {
		if !dropCols[col] {
			t.Errorf("591 sets a default for %s but the down migration never drops it", col)
		}
	}
	for col := range dropCols {
		if !setCols[col] {
			t.Errorf("591 down drops a default for %s but 591 never set one", col)
		}
	}

	// 回滚只抹默认值，不碰列本身、不碰 NOT NULL 约束。
	if strings.Contains(strings.ToLower(dn), "drop column") {
		t.Error("591 down must not drop any column — the table needs them")
	}
	if strings.Contains(strings.ToLower(dn), "drop not null") {
		t.Error("591 down must not relax NOT NULL — 160 introduced these columns as NOT NULL")
	}
}

// TestMigration591OnlyChangesColumnDefaults 兜底：591 除了 SET DEFAULT 之外
// 什么结构性的改动都没有做，这样它可以在任意时机重放而不破坏已有数据或约束。
func TestMigration591OnlyChangesColumnDefaults(t *testing.T) {
	up := strings.ToLower(stripSQLComments(migrationBody(t, "591_pipeline_templates_defaults.sql")))
	if strings.Contains(up, "add column") {
		t.Error("591 must not add columns")
	}
	if strings.Contains(up, "drop column") {
		t.Error("591 must not drop columns")
	}
	if strings.Contains(up, "drop table") {
		t.Error("591 must not drop tables")
	}
	if strings.Contains(up, "drop not null") {
		t.Error("591 must not relax NOT NULL constraints")
	}
	if strings.Contains(up, "drop index") {
		t.Error("591 must not drop indexes")
	}
}
