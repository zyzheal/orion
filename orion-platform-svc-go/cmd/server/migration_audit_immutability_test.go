package main

import (
	"regexp"
	"testing"
)

// GATE-AUDIT-IMMUTABLE (BLOCK) 门控:
//   审计表 audit_logs 必须具备 append-only 语义, 通过 PostgreSQL 触发器
//   强制阻止 UPDATE / DELETE, 与 prev_hash + hash 哈希链形成双层防篡改。
//
// 来源: baseline v5.24 GATE-AUDIT-IMMUTABLE + 阿里云/ AWS WA SEC01-BP02
// 落地: Migration 777 (add_audit_immutability_trigger)
// 回滚: Migration 777_down (drop 触发器 + 函数)

func TestMigration777_AddsImmutabilityGuardFunction(t *testing.T) {
	body := readMigrationArtifactBus(t, "777_add_audit_immutability_trigger.sql")

	// CREATE OR REPLACE FUNCTION audit_logs_immutability_guard()
	if !regexp.MustCompile(`(?is)CREATE\s+OR\s+REPLACE\s+FUNCTION\s+audit_logs_immutability_guard\s*\(\)`).MatchString(body) {
		t.Error("777 missing CREATE FUNCTION audit_logs_immutability_guard()")
	}
	// RETURNS TRIGGER
	if !regexp.MustCompile(`(?is)RETURNS\s+TRIGGER`).MatchString(body) {
		t.Error("777 missing RETURNS TRIGGER")
	}
	// LANGUAGE plpgsql
	if !regexp.MustCompile(`(?is)LANGUAGE\s+plpgsql`).MatchString(body) {
		t.Error("777 missing LANGUAGE plpgsql")
	}
	// RAISE EXCEPTION with immutable message
	if !regexp.MustCompile(`(?i)RAISE\s+EXCEPTION`).MatchString(body) {
		t.Error("777 missing RAISE EXCEPTION")
	}
	if !regexp.MustCompile(`(?i)immutable|append-only`).MatchString(body) {
		t.Error("777 exception message should mention immutable or append-only")
	}
	// TG_OP reference (dynamic per operation)
	if !regexp.MustCompile(`(?i)TG_OP`).MatchString(body) {
		t.Error("777 should reference TG_OP for dynamic message")
	}
	// Atomicity
	if !regexp.MustCompile(`(?im)^BEGIN;`).MatchString(body) {
		t.Error("777 missing BEGIN;")
	}
	if !regexp.MustCompile(`(?i)COMMIT;`).MatchString(body) {
		t.Error("777 missing COMMIT;")
	}
}

func TestMigration777_CreatesBothUpdateAndDeleteTriggers(t *testing.T) {
	body := readMigrationArtifactBus(t, "777_add_audit_immutability_trigger.sql")

	// BEFORE UPDATE trigger
	if !regexp.MustCompile(`(?is)CREATE\s+TRIGGER\s+trg_audit_logs_no_update\s+BEFORE\s+UPDATE\s+ON\s+audit_logs\s+FOR\s+EACH\s+ROW\s+EXECUTE\s+FUNCTION\s+audit_logs_immutability_guard\s*\(\)`).MatchString(body) {
		t.Error("777 missing trg_audit_logs_no_update BEFORE UPDATE trigger")
	}
	// BEFORE DELETE trigger
	if !regexp.MustCompile(`(?is)CREATE\s+TRIGGER\s+trg_audit_logs_no_delete\s+BEFORE\s+DELETE\s+ON\s+audit_logs\s+FOR\s+EACH\s+ROW\s+EXECUTE\s+FUNCTION\s+audit_logs_immutability_guard\s*\(\)`).MatchString(body) {
		t.Error("777 missing trg_audit_logs_no_delete BEFORE DELETE trigger")
	}
	// Both are FOR EACH ROW (not STATEMENT) — critical for per-row enforcement.
	if !regexp.MustCompile(`(?is)trg_audit_logs_no_update\s+.*FOR\s+EACH\s+ROW`).MatchString(body) {
		t.Error("trg_audit_logs_no_update must be FOR EACH ROW")
	}
	if !regexp.MustCompile(`(?is)trg_audit_logs_no_delete\s+.*FOR\s+EACH\s+ROW`).MatchString(body) {
		t.Error("trg_audit_logs_no_delete must be FOR EACH ROW")
	}
}

func TestMigration777_Down_DropsTriggersAndFunction(t *testing.T) {
	d := readMigrationArtifactBus(t, "777_add_audit_immutability_trigger_down.sql")

	// DROP TRIGGER for both
	if !regexp.MustCompile(`(?i)DROP\s+TRIGGER\s+IF\s+EXISTS\s+trg_audit_logs_no_update`).MatchString(d) {
		t.Error("777 down missing DROP TRIGGER trg_audit_logs_no_update")
	}
	if !regexp.MustCompile(`(?i)DROP\s+TRIGGER\s+IF\s+EXISTS\s+trg_audit_logs_no_delete`).MatchString(d) {
		t.Error("777 down missing DROP TRIGGER trg_audit_logs_no_delete")
	}
	// DROP FUNCTION
	if !regexp.MustCompile(`(?i)DROP\s+FUNCTION\s+IF\s+EXISTS\s+audit_logs_immutability_guard\s*\(\)`).MatchString(d) {
		t.Error("777 down missing DROP FUNCTION audit_logs_immutability_guard")
	}
	// Drop triggers before dropping function (dependency order)
	trgIdx := -1
	fnIdx := -1
	for i := 0; i <= len(d)-len("DROP TRIGGER"); i++ {
		if d[i:i+len("DROP TRIGGER")] == "DROP TRIGGER" {
			trgIdx = i
			break
		}
	}
	for i := 0; i <= len(d)-len("DROP FUNCTION"); i++ {
		if d[i:i+len("DROP FUNCTION")] == "DROP FUNCTION" {
			fnIdx = i
			break
		}
	}
	if trgIdx < 0 || fnIdx < 0 || trgIdx > fnIdx {
		t.Errorf("777 down should DROP TRIGGER before DROP FUNCTION (trigger@%d, function@%d)", trgIdx, fnIdx)
	}
	// Atomicity
	if !regexp.MustCompile(`(?im)^BEGIN;`).MatchString(d) {
		t.Error("777 down missing BEGIN;")
	}
	if !regexp.MustCompile(`(?i)COMMIT;`).MatchString(d) {
		t.Error("777 down missing COMMIT;")
	}
}

func TestMigration777_PreservesHashChainSemantics(t *testing.T) {
	// The audit_logs table already has prev_hash + hash columns (from 013_create_audit_tables).
	// Migration 777 does NOT modify the table schema; it only adds triggers.
	body := readMigrationArtifactBus(t, "777_add_audit_immutability_trigger.sql")

	// No ALTER TABLE (schema preserved)
	if regexp.MustCompile(`(?i)ALTER\s+TABLE`).MatchString(body) {
		t.Error("777 should not ALTER TABLE audit_logs (schema preserved)")
	}
	// No DROP TRIGGER / DROP FUNCTION / DROP TABLE as a top-level statement.
	// COMMENT strings may reference "DROP" in rollback instructions (allowed);
	// only the leading DROP verb in a statement matters.
	if regexp.MustCompile(`(?im)^\s*DROP\s+(TRIGGER|FUNCTION|TABLE)\s`).MatchString(body) {
		t.Error("777 should not contain any top-level DROP statement")
	}
}
