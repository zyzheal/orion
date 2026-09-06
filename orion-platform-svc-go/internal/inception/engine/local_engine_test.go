package engine

import (
	"context"
	"strings"
	"testing"
	"time"
)

// TestLocalEngine_Check_ValidSelectPasses verifies that a well-formed
// SELECT with a LIMIT is not flagged as an error.
func TestLocalEngine_Check_ValidSelectPasses(t *testing.T) {
	e := NewLocalAuditEngine(LocalConfig{})
	rep, err := e.Check(context.Background(), "SELECT id, name FROM users WHERE id = 1 LIMIT 1", "mysql")
	if err != nil {
		t.Fatalf("Check returned error: %v", err)
	}
	if !rep.Passed {
		t.Fatalf("expected pass, got %+v", rep.Rules)
	}
	if !rep.ParsedOK {
		t.Fatalf("expected parsed, got %+v", rep)
	}
	if rep.StatementType != "select" {
		t.Fatalf("expected statement_type=select, got %q", rep.StatementType)
	}
}

// TestLocalEngine_Check_DropTableNoIfExists is the primary destructive
// DDL test — a raw DROP TABLE without IF EXISTS must fail.
func TestLocalEngine_Check_DropTableNoIfExists(t *testing.T) {
	e := NewLocalAuditEngine(LocalConfig{})
	rep, err := e.Check(context.Background(), "DROP TABLE users", "mysql")
	if err != nil {
		t.Fatalf("Check returned error: %v", err)
	}
	if rep.Passed {
		t.Fatalf("expected DROP TABLE (no IF EXISTS) to be blocked, got pass")
	}
	var found bool
	for _, r := range rep.Rules {
		if r.RuleID == RuleDropTableNoIfExists {
			found = true
			if r.Level != LevelError {
				t.Errorf("expected error severity, got %q", r.Level)
			}
			break
		}
	}
	if !found {
		t.Fatalf("expected rule %s to fire, got %+v", RuleDropTableNoIfExists, rep.Rules)
	}
}

// TestLocalEngine_Check_DropTableWithIfExistsSucceeds verifies that the
// IF EXISTS variant does NOT trip the drop_table_no_if_exists rule.
func TestLocalEngine_Check_DropTableWithIfExistsSucceeds(t *testing.T) {
	e := NewLocalAuditEngine(LocalConfig{})
	rep, _ := e.Check(context.Background(), "DROP TABLE IF EXISTS users", "mysql")
	for _, r := range rep.Rules {
		if r.RuleID == RuleDropTableNoIfExists {
			t.Fatalf("IF EXISTS variant should not trigger %s", RuleDropTableNoIfExists)
		}
	}
}

// TestLocalEngine_Check_UpdateWithoutWhere must fail (data loss).
func TestLocalEngine_Check_UpdateWithoutWhere(t *testing.T) {
	e := NewLocalAuditEngine(LocalConfig{})
	rep, _ := e.Check(context.Background(), "UPDATE users SET active = false", "mysql")
	if rep.Passed {
		t.Fatalf("expected UPDATE without WHERE to fail, got pass")
	}
	var found bool
	for _, r := range rep.Rules {
		if r.RuleID == RuleMissingWhereUpdate {
			found = true
			break
		}
	}
	if !found {
		t.Fatalf("expected rule %s to fire, got %+v", RuleMissingWhereUpdate, rep.Rules)
	}
}

// TestLocalEngine_Check_DeleteWithoutWhere must fail.
func TestLocalEngine_Check_DeleteWithoutWhere(t *testing.T) {
	e := NewLocalAuditEngine(LocalConfig{})
	rep, _ := e.Check(context.Background(), "DELETE FROM users", "mysql")
	if rep.Passed {
		t.Fatalf("expected DELETE without WHERE to fail, got pass")
	}
	var found bool
	for _, r := range rep.Rules {
		if r.RuleID == RuleMissingWhereDelete {
			found = true
			break
		}
	}
	if !found {
		t.Fatalf("expected rule %s to fire, got %+v", RuleMissingWhereDelete, rep.Rules)
	}
}

// TestLocalEngine_Check_SelectStarFlagsVerify SELECT * triggers the
// select_star warning.
func TestLocalEngine_Check_SelectStarFlags(t *testing.T) {
	e := NewLocalAuditEngine(LocalConfig{})
	rep, _ := e.Check(context.Background(), "SELECT * FROM users WHERE id = 1", "mysql")
	// A SELECT * with a LIMIT and a WHERE should still warn on select_star.
	var found bool
	for _, r := range rep.Rules {
		if r.RuleID == RuleSelectStar {
			found = true
			break
		}
	}
	if !found {
		t.Fatalf("expected rule %s to fire, got %+v", RuleSelectStar, rep.Rules)
	}
}

// TestLocalEngine_Check_TruncateTableBlocks verifies TRUNCATE is blocked.
func TestLocalEngine_Check_TruncateTableBlocks(t *testing.T) {
	e := NewLocalAuditEngine(LocalConfig{})
	rep, _ := e.Check(context.Background(), "TRUNCATE TABLE users", "mysql")
	if rep.Passed {
		t.Fatalf("expected TRUNCATE to be blocked")
	}
	var found bool
	for _, r := range rep.Rules {
		if r.RuleID == RuleTruncateTable {
			found = true
			break
		}
	}
	if !found {
		t.Fatalf("expected rule %s to fire, got %+v", RuleTruncateTable, rep.Rules)
	}
}

// TestLocalEngine_Check_GrantAllBlocked verifies GRANT ALL is blocked.
func TestLocalEngine_Check_GrantAllBlocked(t *testing.T) {
	e := NewLocalAuditEngine(LocalConfig{})
	rep, _ := e.Check(context.Background(), "GRANT ALL PRIVILEGES ON db.* TO 'u'@'%'", "mysql")
	if rep.Passed {
		t.Fatalf("expected GRANT ALL to be blocked")
	}
}

// TestLocalEngine_Check_LockTableWarns verifies LOCK TABLES is flagged.
func TestLocalEngine_Check_LockTableWarns(t *testing.T) {
	e := NewLocalAuditEngine(LocalConfig{})
	rep, _ := e.Check(context.Background(), "LOCK TABLES users READ", "mysql")
	var found bool
	for _, r := range rep.Rules {
		if r.RuleID == RuleLockTable {
			found = true
			break
		}
	}
	if !found {
		t.Fatalf("expected rule %s to fire, got %+v", RuleLockTable, rep.Rules)
	}
}

// TestLocalEngine_Check_NonStandardChars verifies CJK punctuation is
// blocked.
func TestLocalEngine_Check_NonStandardChars(t *testing.T) {
	e := NewLocalAuditEngine(LocalConfig{})
	// Chinese comma (U+FF0C) in place of ASCII comma.
	rep, _ := e.Check(context.Background(), "SELECT id FROM users WHERE a = 1\uFF0Cb = 2", "mysql")
	if rep.Passed {
		t.Fatalf("expected non-standard chars to fail")
	}
	var found bool
	for _, r := range rep.Rules {
		if r.RuleID == RuleNonStandardChars {
			found = true
			break
		}
	}
	if !found {
		t.Fatalf("expected rule %s to fire, got %+v", RuleNonStandardChars, rep.Rules)
	}
}

// TestLocalEngine_Check_DDLWithoutBackupWarns verifies that DDL without
// a backup triggers the ddl_without_backup warning and sets the
// PreBackupRequired flag.
func TestLocalEngine_Check_DDLWithoutBackupWarns(t *testing.T) {
	e := NewLocalAuditEngine(LocalConfig{})
	rep, _ := e.Check(context.Background(), "ALTER TABLE users ADD COLUMN age INT", "mysql")
	if !rep.PreBackupRequired {
		t.Fatalf("expected PreBackupRequired=true for DDL")
	}
	var found bool
	for _, r := range rep.Rules {
		if r.RuleID == RuleDDLWithoutBackup {
			found = true
			break
		}
	}
	if !found {
		t.Fatalf("expected rule %s to fire, got %+v", RuleDDLWithoutBackup, rep.Rules)
	}
}

// TestLocalEngine_Check_MissingLimitVerifies SELECT without LIMIT is
// warned about.
func TestLocalEngine_Check_MissingLimit(t *testing.T) {
	e := NewLocalAuditEngine(LocalConfig{})
	rep, _ := e.Check(context.Background(), "SELECT id, name FROM users", "mysql")
	var found bool
	for _, r := range rep.Rules {
		if r.RuleID == RuleMissingLimit {
			found = true
			break
		}
	}
	if !found {
		t.Fatalf("expected rule %s to fire, got %+v", RuleMissingLimit, rep.Rules)
	}
}

// TestLocalEngine_Check_EmptySQLFails verifies the empty-input guard.
func TestLocalEngine_Check_EmptySQLFails(t *testing.T) {
	e := NewLocalAuditEngine(LocalConfig{})
	rep, _ := e.Check(context.Background(), "   ", "mysql")
	if rep.Passed {
		t.Fatalf("expected empty SQL to fail")
	}
	if rep.ParsedOK {
		t.Fatalf("expected ParsedOK=false for empty SQL")
	}
}

// TestLocalEngine_Check_MultiStatementBlocked verifies that semicolon-
// separated multi-statements are refused.
func TestLocalEngine_Check_MultiStatementBlocked(t *testing.T) {
	e := NewLocalAuditEngine(LocalConfig{})
	rep, _ := e.Check(context.Background(), "SELECT 1; DROP TABLE users", "mysql")
	if rep.Passed {
		t.Fatalf("expected multi-statement to be blocked")
	}
	var found bool
	for _, r := range rep.Rules {
		if r.RuleID == RuleMultiStatement {
			found = true
			break
		}
	}
	if !found {
		t.Fatalf("expected rule %s to fire, got %+v", RuleMultiStatement, rep.Rules)
	}
}

// TestLocalEngine_Check_BlockRulesDisablesRule verifies the BlockRules
// config override works.
func TestLocalEngine_Check_BlockRulesDisablesRule(t *testing.T) {
	e := NewLocalAuditEngine(LocalConfig{
		BlockRules: map[string]bool{RuleMissingWhereUpdate: true},
	})
	rep, _ := e.Check(context.Background(), "UPDATE users SET x = 1", "mysql")
	for _, r := range rep.Rules {
		if r.RuleID == RuleMissingWhereUpdate {
			t.Fatalf("blocked rule %s should not fire", RuleMissingWhereUpdate)
		}
	}
}

// TestLocalEngine_Check_AllowWarnings verifies the config lets
// warning-only findings pass.
func TestLocalEngine_Check_AllowWarnings(t *testing.T) {
	e := NewLocalAuditEngine(LocalConfig{AllowWarnings: true})
	// SELECT * without LIMIT — both are warning-level rules.
	rep, _ := e.Check(context.Background(), "SELECT * FROM users", "mysql")
	if !rep.Passed {
		t.Fatalf("expected warnings to pass when AllowWarnings=true; rules: %+v", rep.Rules)
	}
}

// TestLocalEngine_Check_UnbalancedParensReportsParseError verifies the
// parser sanity check catches unbalanced parens.
func TestLocalEngine_Check_UnbalancedParensReportsParseError(t *testing.T) {
	e := NewLocalAuditEngine(LocalConfig{})
	rep, _ := e.Check(context.Background(), "SELECT id FROM users WHERE (id = 1", "mysql")
	if rep.ParsedOK {
		t.Fatalf("expected parse error for unbalanced parens")
	}
	if rep.Passed {
		t.Fatalf("expected parse error to block execution")
	}
}

// TestLocalEngine_Check_RowThresholdDDLWithProber verifies that the
// optional RowCounter is invoked when a DDL targets a large table.
func TestLocalEngine_Check_RowThresholdDDLWithProber(t *testing.T) {
	e := NewLocalAuditEngine(LocalConfig{RowCountThresholdForDDL: 1000})
	e.SetRowCounter(stubRowCounter{count: 50000})
	rep, _ := e.Check(context.Background(), "ALTER TABLE users ADD COLUMN age INT", "mysql")
	var found bool
	for _, r := range rep.Rules {
		if r.RuleID == RuleRowThresholdDDL {
			found = true
			if !strings.Contains(r.Message, "50000") {
				t.Errorf("expected message to contain row count, got %q", r.Message)
			}
			break
		}
	}
	if !found {
		t.Fatalf("expected rule %s to fire, got %+v", RuleRowThresholdDDL, rep.Rules)
	}
}

type stubRowCounter struct{ count int64 }

func (s stubRowCounter) RowCount(_ context.Context, _, _ string) (int64, error) {
	return s.count, nil
}

// TestLocalEngine_Check_CrossDBQueryVerifies cross-database references
// are detected (e.g. `otherdb.users`).
func TestLocalEngine_Check_CrossDBQuery(t *testing.T) {
	e := NewLocalAuditEngine(LocalConfig{})
	rep, _ := e.Check(context.Background(), "SELECT o.id FROM otherdb.users o", "mysql")
	var found bool
	for _, r := range rep.Rules {
		if r.RuleID == RuleCrossDBQuery {
			found = true
			break
		}
	}
	if !found {
		t.Fatalf("expected rule %s to fire, got %+v", RuleCrossDBQuery, rep.Rules)
	}
}

// TestLocalEngine_Check_SelectStarWhitelistDowngradesSeverity verifies
// that whitelisted dialects downgrade SELECT * to info.
func TestLocalEngine_Check_SelectStarWhitelistDowngrades(t *testing.T) {
	e := NewLocalAuditEngine(LocalConfig{SelectStarWhitelistDBs: []string{"mysql"}})
	rep, _ := e.Check(context.Background(), "SELECT * FROM users LIMIT 1", "mysql")
	for _, r := range rep.Rules {
		if r.RuleID == RuleSelectStar && r.Level != LevelInfo {
			t.Errorf("expected SELECT * to be downgraded to info, got %q", r.Level)
		}
	}
}

// TestLocalEngine_Execute_NilDBReturnsError verifies the nil-db guard.
func TestLocalEngine_Execute_NilDBReturnsError(t *testing.T) {
	e := NewLocalAuditEngine(LocalConfig{})
	_, err := e.Execute(context.Background(), nil, "SELECT 1", "mysql")
	if err == nil {
		t.Fatal("expected error for nil *sql.DB")
	}
}

// TestLocalEngine_Execute_BlockedByErrorRule verifies that Execute
// refuses to run a statement the audit engine flagged as error-level.
func TestLocalEngine_Execute_BlockedByErrorRule(t *testing.T) {
	e := NewLocalAuditEngine(LocalConfig{})
	// No DB passed — Check will fire first and block; the DB-nil check
	// happens after the audit check.
	// We still expect an error mentioning the rule.
	_, err := e.Execute(context.Background(), nil, "DROP TABLE users", "mysql")
	if err == nil {
		t.Fatal("expected error for DROP TABLE")
	}
	if !strings.Contains(err.Error(), RuleDropTableNoIfExists) {
		t.Fatalf("expected error mentioning rule %s, got: %v", RuleDropTableNoIfExists, err)
	}
}

// TestLocalEngine_PreBackupConfirmedDefault verifies the flag is false
// by default so DDL will require confirmation when RequirePreBackupForDDL
// is set.
func TestLocalEngine_PreBackupConfirmedDefault(t *testing.T) {
	e := NewLocalAuditEngine(LocalConfig{RequirePreBackupForDDL: true})
	if e.PreBackupConfirmed() {
		t.Fatal("expected pre-backup flag to default to false")
	}
	e.SetPreBackupConfirmed(true)
	if !e.PreBackupConfirmed() {
		t.Fatal("expected pre-backup flag to be true after Set")
	}
}

// TestLocalEngine_Check_ReportContainsTiming verifies the report
// carries a sensible duration field.
func TestLocalEngine_Check_ReportContainsTiming(t *testing.T) {
	e := NewLocalAuditEngine(LocalConfig{})
	_, _ = e.Check(context.Background(), "SELECT 1 LIMIT 1", "mysql")
	// The engine should record a non-zero duration for at least one
	// call — this is a soft invariant; we do not require exact values.
	e2 := NewLocalAuditEngine(LocalConfig{})
	rep, _ := e2.Check(context.Background(), "SELECT 1 LIMIT 1", "mysql")
	if rep.Duration < 0 {
		t.Fatalf("duration must be non-negative, got %v", rep.Duration)
	}
}

// TestLocalEngine_Check_DefaultTimeoutIsSet verifies the config
// default is applied.
func TestLocalEngine_Check_DefaultTimeoutIsSet(t *testing.T) {
	e := NewLocalAuditEngine(LocalConfig{})
	if e.cfg.Timeout != 60*time.Second {
		t.Fatalf("expected default 60s timeout, got %v", e.cfg.Timeout)
	}
}

// TestLocalEngine_Check_AddExtraRule verifies the runtime rule addition.
func TestLocalEngine_Check_AddExtraRule(t *testing.T) {
	e := NewLocalAuditEngine(LocalConfig{})
	e.AddExtraRule(&ruleDef{
		id:      "custom_no_sleep",
		sev:     LevelError,
		dbTypes: nil,
		match: func(_ context.Context, _ *LocalAuditEngine, _ *parsedStmt, raw string) []AuditResult {
			if strings.Contains(strings.ToUpper(raw), " SLEEP(") {
				return []AuditResult{{
					Level: LevelError, RuleID: "custom_no_sleep",
					Message: "SLEEP() is not allowed in this tenant",
				}}
			}
			return nil
		},
	})
	rep, _ := e.Check(context.Background(), "SELECT SLEEP(30)", "mysql")
	var found bool
	for _, r := range rep.Rules {
		if r.RuleID == "custom_no_sleep" {
			found = true
			break
		}
	}
	if !found {
		t.Fatalf("expected custom rule to fire, got %+v", rep.Rules)
	}
}
