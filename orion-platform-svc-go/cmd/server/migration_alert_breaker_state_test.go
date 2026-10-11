package main

import (
	"regexp"
	"testing"
)

// ADR-010 (docs/adr/ADR-010-AlertBreaker-并发模型选型.md §3.2.4)
// 定义 alert_breaker_state 表承载运行时状态。并发模型: PG 行锁 +
// 乐观锁 version 字段 + 5s 超时。
//
// 与既有 alert_breakers 表 (规则定义) 区分: alert_breaker_state 是
// 动态状态, 按 (tenant, policy, unique_key) 唯一, 高频写入。
// 本测试锁定 ADR-010 §3.2.4 的完整契约 (11 列 + UNIQUE + 2 indexes)。

func TestMigration735_CreatesAlertBreakerStateTable(t *testing.T) {
	body := readMigrationArtifactBus(t, "735_create_alert_breaker_state.sql")

	re := regexp.MustCompile(`(?is)CREATE TABLE IF NOT EXISTS alert_breaker_state\s*\(([\s\S]*?)\);`)
	m := re.FindStringSubmatch(body)
	if m == nil {
		t.Fatal("735 does not CREATE TABLE alert_breaker_state")
	}
	bodyDef := m[1]

	// 11 columns per ADR-010 §3.2.4。
	for _, col := range []string{
		"id",
		"tenant_id",
		"policy_id",
		"unique_key",
		"count",
		"last_fingerprint",
		"window_start",
		"window_end",
		"version",
		"created_at",
		"updated_at",
	} {
		if !regexp.MustCompile(`(?im)^\s*`+regexp.QuoteMeta(col)+`\s+\w+`).MatchString(bodyDef) {
			t.Errorf("alert_breaker_state missing column %q", col)
		}
	}

	invariants := []struct {
		name    string
		pattern string
	}{
		{"id BIGSERIAL PK", `(?i)\bid\s+BIGSERIAL\s+PRIMARY KEY`},
		{"tenant_id UUID NOT NULL", `(?i)\btenant_id\s+UUID\s+NOT NULL`},
		{"policy_id BIGINT NOT NULL", `(?i)\bpolicy_id\s+BIGINT\s+NOT NULL`},
		{"unique_key TEXT NOT NULL", `(?i)\bunique_key\s+TEXT\s+NOT NULL`},
		{"count INT NOT NULL DEFAULT 0", `(?i)\bcount\s+INTEGER\s+NOT NULL\s+DEFAULT\s+0`},
		{"version INT NOT NULL DEFAULT 0", `(?i)\bversion\s+INTEGER\s+NOT NULL\s+DEFAULT\s+0`},
		// window_start/end 可为 NULL (未触发)
		// window_start/end 可为 NULL (未触发); 行尾可有逗号或换行
		{"window_start TIMESTAMPTZ nullable", `(?i)\bwindow_start\s+TIMESTAMPTZ\s*(,|$)`},
		{"window_end TIMESTAMPTZ nullable", `(?i)\bwindow_end\s+TIMESTAMPTZ\s*(,|$)`},
	}
	for _, tc := range invariants {
		if !regexp.MustCompile(tc.pattern).MatchString(bodyDef) {
			t.Errorf("735 %s missing", tc.name)
		}
	}

	// 表级 UNIQUE (tenant_id, policy_id, unique_key)
	if !regexp.MustCompile(`(?i)UNIQUE\s*\(tenant_id,\s*policy_id,\s*unique_key\)`).MatchString(bodyDef) {
		t.Error("735 missing UNIQUE (tenant_id, policy_id, unique_key)")
	}

	// 2 indexes: 主查询 + 过期清理
	for _, idx := range []string{
		"idx_alert_breaker_state_lock",
		"idx_alert_breaker_state_window",
	} {
		if !regexp.MustCompile(`(?is)CREATE INDEX IF NOT EXISTS\s+`+idx).MatchString(body) {
			t.Errorf("735 missing index %s (IF NOT EXISTS)", idx)
		}
	}
	if !regexp.MustCompile(`(?is)idx_alert_breaker_state_lock\s+ON\s+alert_breaker_state\s*\(tenant_id,\s*policy_id,\s*unique_key\)`).MatchString(body) {
		t.Error("735 lock index should be on (tenant_id, policy_id, unique_key)")
	}
	if !regexp.MustCompile(`(?is)idx_alert_breaker_state_window\s+ON\s+alert_breaker_state\s*\(window_end\)`).MatchString(body) {
		t.Error("735 window index should be on (window_end)")
	}

	// 原子性
	if !regexp.MustCompile(`(?im)^BEGIN;`).MatchString(body) {
		t.Error("735 missing BEGIN;")
	}
	if !regexp.MustCompile(`(?i)COMMIT;`).MatchString(body) {
		t.Error("735 missing COMMIT;")
	}
}

func TestMigration735_Down_DropsInReverseOrder(t *testing.T) {
	d735 := readMigrationArtifactBus(t, "735_create_alert_breaker_state_down.sql")
	if !regexp.MustCompile(`(?i)DROP\s+INDEX\s+IF\s+EXISTS\s+idx_alert_breaker_state_window`).MatchString(d735) ||
		!regexp.MustCompile(`(?i)DROP\s+INDEX\s+IF\s+EXISTS\s+idx_alert_breaker_state_lock`).MatchString(d735) {
		t.Error("735 down missing 2 DROP INDEX")
	}
	if !regexp.MustCompile(`(?i)DROP\s+TABLE\s+IF\s+EXISTS\s+alert_breaker_state`).MatchString(d735) {
		t.Error("735 down missing DROP TABLE")
	}
}
