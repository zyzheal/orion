package repository

import (
	"context"
	"database/sql"
	"database/sql/driver"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
	"time"

	"orion/platform-svc-go/internal/security/models"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"
)

var (
	ws           = regexp.MustCompile(`\s+`)
	blockComment = regexp.MustCompile("(?s)/\\*.*?\\*/")
)

func normSQL(s string) string {
	return strings.TrimSpace(ws.ReplaceAllString(s, " "))
}

// mockDB returns a sqlx.DB backed by sqlmock that compares statements after
// collapsing whitespace. An expectation written against an explicit column list
// therefore cannot be satisfied by a call that sends SELECT *, and sqlx.NewDb
// never calls Unsafe - matching go-common's ConnectContext, which is why the
// column lists below have to name the model fields exactly.
func mockDB(t *testing.T) (*sqlx.DB, sqlmock.Sqlmock) {
	t.Helper()
	raw, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherFunc(func(expected, actual string) error {
		if normSQL(expected) != normSQL(actual) {
			return fmt.Errorf("sql mismatch: want %q got %q", expected, actual)
		}
		return nil
	})))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = raw.Close() })
	return sqlx.NewDb(raw, "postgres"), mock
}

// TestSelectStarIntoTypedModelFailsOnSoftDeleteColumn pins the mechanism the
// column lists above exist to avoid. 571 added deleted_at to audit_plans (and
// to the other three tables 066 created for internal/security-compliance) and
// 572 added created_by and updated_by; no model in this module declares them.
// Scanning SELECT * into a typed model fails on the very first row, and the
// error is not sql.ErrNoRows, so it walked out of the repository, out of the
// service, and every read endpoint in this module answered 500 instead of data.
//
// The second case uses the whole 066 + 571 + 572 + 580 column set. sqlx reports
// the column at index len(matched fields), so which name it names depends on the
// column order rather than on the set - only the error class is stable there.
func TestSelectStarIntoTypedModelFailsOnSoftDeleteColumn(t *testing.T) {
	modelColumns := []string{
		"id", "tenant_id", "name", "description", "status", "created_at", "updated_at",
	}
	base := []driver.Value{"ap-1", "t-1", "quarterly", "controls review", "active", time.Now().UTC(), time.Now().UTC()}

	cases := []struct {
		name  string
		cols  []string
		extra []driver.Value
		want  string
	}{
		{
			"571 soft-delete column",
			append(append([]string{}, modelColumns...), "deleted_at"),
			[]driver.Value{nil},
			"missing destination name deleted_at",
		},
		{
			"066 + 571 + 572 + 580 column set",
			[]string{
				"id", "tenant_id", "name", "description", "schedule", "status",
				"created_at", "updated_at", "deleted_at", "created_by", "updated_by",
				"scope", "audit_type", "schedule_type", "cron_expression", "reviewers",
			},
			[]driver.Value{
				"monthly", nil, "u-1", nil,
				`{"services":["svc-a"]}`, "vulnerability", "monthly", nil, `["u-1"]`,
			},
			"missing destination name",
		},
	}

	const query = `SELECT * FROM audit_plans WHERE id=$1 AND tenant_id=$2`
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			db, mock := mockDB(t)
			mock.ExpectQuery(query).WithArgs("ap-1", "t-1").
				WillReturnRows(sqlmock.NewRows(tc.cols).AddRow(append(append([]driver.Value{}, base...), tc.extra...)...))

			// Scan the driver's SELECT * output straight into the model, bypassing
			// the repository, so this cannot drift with it and keep failing for the
			// wrong reason.
			var m models.AuditPlan
			err := db.GetContext(context.Background(), &m, query, "ap-1", "t-1")
			if err == nil {
				t.Fatalf("SELECT * scanned cleanly into models.AuditPlan")
			}
			if !strings.Contains(err.Error(), tc.want) {
				t.Fatalf("want an error containing %q, got %v", tc.want, err)
			}
			if errors.Is(err, sql.ErrNoRows) {
				t.Fatalf("the driver error is not sql.ErrNoRows, so getOne cannot map it: %v", err)
			}
		})
	}
}

// --- regression: every read below selects the model's columns and still
// --- returns the row. Before the fix these same calls returned an error instead
// --- of data.

func TestGetScanByID_SelectsTheModelColumns(t *testing.T) {
	db, mock := mockDB(t)
	now := time.Now().UTC()
	mock.ExpectQuery(`SELECT `+scanColumns+` FROM security_scans WHERE id=$1 AND tenant_id=$2`).
		WithArgs("s-1", "t-1").WillReturnRows(sqlmock.NewRows([]string{
		"id", "tenant_id", "scan_type", "target", "scanner", "status",
		"critical_count", "high_count", "medium_count", "low_count", "total_count",
		"passed", "gate_failed", "scan_start_time", "scan_end_time", "duration_ms",
		"result", "created_at",
	}).AddRow("s-1", "t-1", "sast", "svc-a", "trivy", "completed",
		2, 5, 9, 3, 19, true, false,
		now.Add(-time.Minute), now.Add(-30*time.Second), 4200, `{"engine":"trivy"}`, now))

	got, err := NewRepository(db).GetScanByID(context.Background(), "t-1", "s-1")
	if err != nil {
		t.Fatalf("GetScanByID: %v", err)
	}
	if got.Status != "completed" || got.TotalCount != 19 || got.CriticalCount != 2 ||
		got.DurationMs != 4200 || !got.Passed || got.GateFailed ||
		got.ScanStartTime == nil || got.ScanEndTime == nil {
		t.Errorf("unexpected row: %+v", got)
	}
	if got.Result["engine"] != "trivy" {
		t.Errorf("result JSONB not decoded: %v", got.Result)
	}
}

func TestGetFindingByID_SelectsTheModelColumns(t *testing.T) {
	db, mock := mockDB(t)
	now := time.Now().UTC()
	mock.ExpectQuery(`SELECT `+findingColumns+` FROM security_findings WHERE id=$1 AND tenant_id=$2`).
		WithArgs("f-1", "t-1").WillReturnRows(sqlmock.NewRows([]string{
		"id", "tenant_id", "scan_id", "rule_id", "severity", "category", "title",
		"description", "file_path", "line_start", "line_end", "code_snippet",
		"match_text", "confidence", "remediation", "status", "assigned_to",
		"closed_at", "created_at",
	}).AddRow("f-1", "t-1", "s-1", "RULE-1", "critical", "secret", "hardcoded key",
		"key committed to source", "src/a.go", int64(42), int64(50),
		"key := \"shh\"", "shh", float64(0.95), "rotate the key", "open", nil, nil, now))

	got, err := NewRepository(db).GetFindingByID(context.Background(), "t-1", "f-1")
	if err != nil {
		t.Fatalf("GetFindingByID: %v", err)
	}
	if got.Severity != "critical" || got.RuleID != "RULE-1" || got.Confidence != 0.95 ||
		got.LineStart == nil || *got.LineStart != 42 || got.LineEnd == nil || *got.LineEnd != 50 {
		t.Errorf("unexpected row: %+v", got)
	}
}

func TestListFindings_NoFilterBranch(t *testing.T) {
	db, mock := mockDB(t)
	now := time.Now().UTC()
	mock.ExpectQuery(`SELECT `+findingColumns+` FROM security_findings WHERE tenant_id=$1 ORDER BY created_at DESC OFFSET $2 LIMIT $3`).
		WithArgs("t-1", 0, 20).WillReturnRows(sqlmock.NewRows([]string{
		"id", "tenant_id", "scan_id", "rule_id", "severity", "category", "title",
		"description", "file_path", "line_start", "line_end", "code_snippet",
		"match_text", "confidence", "remediation", "status", "assigned_to",
		"closed_at", "created_at",
	}).AddRow("f-1", "t-1", nil, "RULE-1", "low", "config", "weak cipher",
		"", "src/a.go", nil, nil, "", "", float64(0.6), "upgrade", "open", nil, nil, now))

	got, err := NewRepository(db).ListFindings(context.Background(), "t-1", 0, 20, "")
	if err != nil {
		t.Fatalf("ListFindings: %v", err)
	}
	if len(got) != 1 || got[0].Severity != "low" {
		t.Errorf("unexpected rows: %+v", got)
	}
}

func TestFindingsByScanID_ScopesOnTenant(t *testing.T) {
	db, mock := mockDB(t)
	now := time.Now().UTC()
	mock.ExpectQuery(`SELECT `+findingColumns+` FROM security_findings WHERE tenant_id=$1 AND scan_id=$2 ORDER BY severity, created_at`).
		WithArgs("t-1", "s-1").WillReturnRows(sqlmock.NewRows([]string{
		"id", "tenant_id", "scan_id", "rule_id", "severity", "category", "title",
		"description", "file_path", "line_start", "line_end", "code_snippet",
		"match_text", "confidence", "remediation", "status", "assigned_to",
		"closed_at", "created_at",
	}).AddRow("f-1", "t-1", "s-1", "RULE-1", "critical", "secret", "hardcoded key",
		"", "", nil, nil, "", "", float64(1), "rotate", "open", nil, nil, now))

	got, err := NewRepository(db).FindingsByScanID(context.Background(), "t-1", "s-1")
	if err != nil {
		t.Fatalf("FindingsByScanID: %v", err)
	}
	if len(got) != 1 || got[0].ScanID == nil || *got[0].ScanID != "s-1" {
		t.Errorf("unexpected rows: %+v", got)
	}
}

func TestGetAuditPlanByID_SelectsTheModelColumns(t *testing.T) {
	db, mock := mockDB(t)
	now := time.Now().UTC()
	mock.ExpectQuery(`SELECT `+auditPlanColumns+` FROM audit_plans WHERE id=$1 AND tenant_id=$2`).
		WithArgs("ap-1", "t-1").WillReturnRows(sqlmock.NewRows([]string{
		"id", "tenant_id", "name", "description", "scope", "audit_type", "schedule_type",
		"cron_expression", "reviewers", "status", "created_by", "created_at", "updated_at",
	}).AddRow("ap-1", "t-1", "quarterly", "controls review", `{"services":["svc-a"]}`,
		"vulnerability", "monthly", nil, `["u-1"]`, "active", "u-1", now, now))

	got, err := NewRepository(db).GetAuditPlanByID(context.Background(), "t-1", "ap-1")
	if err != nil {
		t.Fatalf("GetAuditPlanByID: %v", err)
	}
	if got.AuditType != "vulnerability" || got.ScheduleType != "monthly" ||
		got.CreatedBy == nil || *got.CreatedBy != "u-1" ||
		got.Scope["services"] == nil || len(got.Reviewers) != 1 {
		t.Errorf("unexpected row: %+v", got)
	}
}

func TestGetAuditExecutionByID_SelectsTheModelColumns(t *testing.T) {
	db, mock := mockDB(t)
	now := time.Now().UTC()
	mock.ExpectQuery(`SELECT `+auditExecutionColumns+` FROM audit_executions WHERE id=$1 AND tenant_id=$2`).
		WithArgs("ae-1", "t-1").WillReturnRows(sqlmock.NewRows([]string{
		"id", "plan_id", "tenant_id", "status", "started_at", "completed_at",
		"findings_count", "created_at",
	}).AddRow("ae-1", "ap-1", "t-1", "completed", now, now, 7, now))

	got, err := NewRepository(db).GetAuditExecutionByID(context.Background(), "t-1", "ae-1")
	if err != nil {
		t.Fatalf("GetAuditExecutionByID: %v", err)
	}
	if got.PlanID != "ap-1" || got.Status != "completed" || got.FindingsCount != 7 || got.CompletedAt == nil {
		t.Errorf("unexpected row: %+v", got)
	}
}

func TestGetAuditFindingByID_SelectsTheModelColumns(t *testing.T) {
	db, mock := mockDB(t)
	now := time.Now().UTC()
	mock.ExpectQuery(`SELECT `+auditFindingColumns+` FROM audit_findings WHERE id=$1 AND tenant_id=$2`).
		WithArgs("af-1", "t-1").WillReturnRows(sqlmock.NewRows([]string{
		"id", "execution_id", "tenant_id", "title", "description", "severity", "category",
		"evidence", "recommendation", "status", "assigned_to", "closed_at", "created_at",
	}).AddRow("af-1", "ae-1", "t-1", "no rotation", "credentials never rotated", "high",
		"access", `{"path":"/etc/passwd"}`, "add rotation", "open", nil, nil, now))

	got, err := NewRepository(db).GetAuditFindingByID(context.Background(), "t-1", "af-1")
	if err != nil {
		t.Fatalf("GetAuditFindingByID: %v", err)
	}
	if got.ExecutionID != "ae-1" || got.Category != "access" || got.Recommendation != "add rotation" ||
		got.Evidence["path"] != "/etc/passwd" {
		t.Errorf("unexpected row: %+v", got)
	}
}

func TestGetCompliancePolicyByID_SelectsTheModelColumns(t *testing.T) {
	db, mock := mockDB(t)
	now := time.Now().UTC()
	mock.ExpectQuery(`SELECT `+compliancePolicyColumns+` FROM compliance_policies WHERE id=$1 AND tenant_id=$2`).
		WithArgs("pol-1", "t-1").WillReturnRows(sqlmock.NewRows([]string{
		"id", "tenant_id", "name", "description", "framework_type", "requirements",
		"rules", "severity_threshold", "enabled", "created_by", "created_at", "updated_at",
	}).AddRow("pol-1", "t-1", "security baseline", "controls", "security",
		`{"controls":["c-1"]}`, `["r-1","r-2"]`, "high", true, "u-1", now, now))

	got, err := NewRepository(db).GetCompliancePolicyByID(context.Background(), "t-1", "pol-1")
	if err != nil {
		t.Fatalf("GetCompliancePolicyByID: %v", err)
	}
	if got.FrameworkType != "security" || !got.Enabled || got.SeverityThreshold != "high" ||
		got.CreatedBy == nil || *got.CreatedBy != "u-1" || len(got.Rules) != 2 {
		t.Errorf("unexpected row: %+v", got)
	}
}

func TestFindLatestEvaluationByPolicy_SelectsTheModelColumns(t *testing.T) {
	db, mock := mockDB(t)
	now := time.Now().UTC()
	mock.ExpectQuery(`SELECT `+evaluationColumns+` FROM compliance_evaluations WHERE tenant_id=$1 AND policy_id=$2 ORDER BY created_at DESC LIMIT 1`).
		WithArgs("t-1", "pol-1").WillReturnRows(sqlmock.NewRows([]string{
		"id", "tenant_id", "policy_id", "status", "score", "total_checks", "passed_checks",
		"failed_checks", "gaps", "started_at", "completed_at", "created_at",
	}).AddRow("ev-1", "t-1", "pol-1", "completed", float64(80), 10, 8, 2,
		`[{"severity":"critical","rule":"r-1"},{"severity":"high","rule":"r-2"}]`, now, now, now))

	got, err := NewRepository(db).FindLatestEvaluationByPolicy(context.Background(), "t-1", "pol-1")
	if err != nil {
		t.Fatalf("FindLatestEvaluationByPolicy: %v", err)
	}
	if got.Score != 80 || got.FailedChecks != 2 || got.CompletedAt == nil || len(got.Gaps) != 2 {
		t.Errorf("unexpected row: %+v", got)
	}
}

func TestListComplianceEvaluationsByTenant_SelectsTheModelColumns(t *testing.T) {
	db, mock := mockDB(t)
	now := time.Now().UTC()
	mock.ExpectQuery(`SELECT ` + evaluationColumns + ` FROM compliance_evaluations WHERE tenant_id=$1 ORDER BY created_at DESC`).
		WithArgs("t-1").WillReturnRows(sqlmock.NewRows([]string{
		"id", "tenant_id", "policy_id", "status", "score", "total_checks", "passed_checks",
		"failed_checks", "gaps", "started_at", "completed_at", "created_at",
	}).AddRow("ev-1", "t-1", "pol-1", "completed", float64(90), 10, 9, 1,
		`[{"severity":"medium"}]`, now, now, now))

	got, err := NewRepository(db).ListComplianceEvaluationsByTenant(context.Background(), "t-1")
	if err != nil {
		t.Fatalf("ListComplianceEvaluationsByTenant: %v", err)
	}
	if len(got) != 1 || got[0].Score != 90 || len(got[0].Gaps) != 1 {
		t.Errorf("unexpected rows: %+v", got)
	}
}

func TestGetSBOMByID_SelectsTheModelColumns(t *testing.T) {
	db, mock := mockDB(t)
	now := time.Now().UTC()
	mock.ExpectQuery(`SELECT `+sbomColumns+` FROM supply_chain_sboms WHERE id=$1 AND tenant_id=$2`).
		WithArgs("sb-1", "t-1").WillReturnRows(sqlmock.NewRows([]string{
		"id", "tenant_id", "artifact_id", "pipeline_id", "sbom_format", "sbom_version",
		"components", "dependencies", "vulnerabilities", "metadata", "created_at",
	}).AddRow("sb-1", "t-1", "art-1", nil, "spdx", "2.3",
		`[{"name":"x"}]`, `[]`, `[]`, `{"tool":"syft"}`, now))

	got, err := NewRepository(db).GetSBOMByID(context.Background(), "t-1", "sb-1")
	if err != nil {
		t.Fatalf("GetSBOMByID: %v", err)
	}
	if got.SBOMFormat != "spdx" || got.SBOMVersion != "2.3" ||
		len(got.Components) != 1 || got.PipelineID != nil || got.Metadata["tool"] != "syft" {
		t.Errorf("unexpected row: %+v", got)
	}
}

func TestFindDependencyGraph_SelectsTheModelColumns(t *testing.T) {
	db, mock := mockDB(t)
	now := time.Now().UTC()
	mock.ExpectQuery(`SELECT `+dependencyGraphColumns+` FROM dependency_graphs WHERE tenant_id=$1 AND package_name=$2 AND package_version=$3`).
		WithArgs("t-1", "golang.org/x/crypto", "v0.17.0").WillReturnRows(sqlmock.NewRows([]string{
		"id", "tenant_id", "package_name", "package_version", "direct_deps",
		"transitive_deps", "vulnerable_paths", "depth", "analyzed_at",
	}).AddRow("dg-1", "t-1", "golang.org/x/crypto", "v0.17.0",
		`["a"]`, `["b"]`, `[]`, 3, now))

	got, err := NewRepository(db).FindDependencyGraph(context.Background(), "t-1", "golang.org/x/crypto", "v0.17.0")
	if err != nil {
		t.Fatalf("FindDependencyGraph: %v", err)
	}
	if got.PackageVersion != "v0.17.0" || got.Depth != 3 || len(got.DirectDeps) != 1 || len(got.TransitiveDeps) != 1 {
		t.Errorf("unexpected row: %+v", got)
	}
}

func TestListDependencyPoisoningScans_SelectsTheModelColumns(t *testing.T) {
	db, mock := mockDB(t)
	now := time.Now().UTC()
	mock.ExpectQuery(`SELECT `+poisoningScanColumns+` FROM dependency_poisoning_scans WHERE tenant_id=$1 ORDER BY created_at DESC OFFSET $2 LIMIT $3`).
		WithArgs("t-1", 0, 20).WillReturnRows(sqlmock.NewRows([]string{
		"id", "tenant_id", "packages_scanned", "malicious_found", "typosquatting_found",
		"risk_score", "risk_level", "scan_data", "created_at",
	}).AddRow("dp-1", "t-1", 120, 1, 0, 35, "medium", `{"flagged":["x"]}`, now))

	got, err := NewRepository(db).ListDependencyPoisoningScans(context.Background(), "t-1", 0, 20)
	if err != nil {
		t.Fatalf("ListDependencyPoisoningScans: %v", err)
	}
	if len(got) != 1 || got[0].PackagesScanned != 120 || got[0].MaliciousFound != 1 ||
		got[0].RiskLevel != "medium" || got[0].ScanData["flagged"] == nil {
		t.Errorf("unexpected rows: %+v", got)
	}
}

// --- source-level pins -------------------------------------------------------

// stripComments removes /* */ blocks and // line tails without touching
// backtick string literals, so a mention in prose cannot satisfy the pins below.
func stripComments(src string) string {
	src = blockComment.ReplaceAllString(src, "")
	var out []string
	for _, line := range strings.Split(src, "\n") {
		if strings.HasPrefix(strings.TrimLeft(line, " \t"), "//") {
			continue
		}
		out = append(out, line)
	}
	return strings.Join(out, "\n")
}

func loadSQL(t *testing.T) string {
	t.Helper()
	b, err := os.ReadFile("security_repository.go")
	if err != nil {
		t.Fatalf("read source: %v", err)
	}
	return stripComments(string(b))
}

// TestSource_NoStarSelectForTypedModel refuses a return to SELECT * for the
// tables whose rows are scanned into a struct.
func TestSource_NoStarSelectForTypedModel(t *testing.T) {
	src := loadSQL(t)
	var offenders []string
	for _, m := range regexp.MustCompile("(?s)`([^`]*SELECT\\s+\\*[^`]*)`").FindAllStringSubmatch(src, -1) {
		offenders = append(offenders, strings.TrimSpace(m[1]))
	}
	if len(offenders) > 0 {
		t.Fatalf("%d SELECT * statement(s) scan into a typed model: %v", len(offenders), offenders)
	}
}

// TestSource_EveryStatementIsTenantScoped refuses a statement that reads or
// writes one of the module's ten relations without a tenant_id predicate. Every
// id in this module is a URL-supplied string, so a missing predicate is the
// cross-tenant read. The two ORDER BY fragments appended to ListFindings are not
// statements and are skipped.
func TestSource_EveryStatementIsTenantScoped(t *testing.T) {
	src := loadSQL(t)
	reVerb := regexp.MustCompile(`\b(SELECT|INSERT|UPDATE|DELETE)\b`)
	var unscoped []string
	for _, m := range regexp.MustCompile("(?s)`([^`]*)`").FindAllStringSubmatch(src, -1) {
		stmt := strings.TrimSpace(m[1])
		if !reVerb.MatchString(stmt) {
			continue
		}
		if !strings.Contains(stmt, "tenant_id") {
			unscoped = append(unscoped, stmt)
		}
	}
	if len(unscoped) > 0 {
		t.Fatalf("%d statement(s) touch a security relation without tenant_id: %v", len(unscoped), unscoped)
	}
}

// loadableDDL mirrors what database.LoadMigrations actually loads: the top level
// of migrations/, three-digit versions only, no subdirectories, no _down files.
// It returns every column the migrations create or add, keyed by table.
func loadableDDL(t *testing.T) map[string]map[string]bool {
	t.Helper()
	entries, err := os.ReadDir("../../../migrations")
	if err != nil {
		t.Fatalf("read migrations dir: %v", err)
	}
	reCreate := regexp.MustCompile(`(?i)^\s*CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["']?([A-Za-z_][A-Za-z0-9_]*)["']?`)
	reAlter := regexp.MustCompile(`(?i)^\s*ALTER\s+TABLE\s+["']?([A-Za-z_][A-Za-z0-9_]*)["']?\s+ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?([A-Za-z_][A-Za-z0-9_]*)["']?`)
	reCol := regexp.MustCompile(`^\s*([A-Za-z_][A-Za-z0-9_]*)\s+[A-Za-z(]`)
	skip := map[string]bool{
		"constraint": true, "primary": true, "foreign": true, "unique": true, "check": true,
		"index": true, "create": true, "insert": true, "drop": true, "alter": true,
		"update": true, "delete": true, "execute": true, "select": true, "from": true,
		"begin": true, "end": true, "if": true, "then": true, "else": true, "when": true,
		"raise": true, "notice": true, "where": true, "and": true, "or": true, "do": true,
		"return": true, "in": true, "for": true, "loop": true, "while": true, "column": true,
		"exists": true, "by": true, "order": true, "table": true, "on": true, "to": true,
		"using": true, "with": true, "include": true, "references": true, "set": true,
		"null": true, "not": true, "default": true,
	}

	defined := map[string]map[string]bool{}
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".sql") || strings.Contains(e.Name(), "_down.") {
			continue
		}
		if _, err := fmt.Sscanf(e.Name(), "%03d_", new(int)); err != nil {
			continue
		}
		b, err := os.ReadFile(filepath.Join("../../../migrations", e.Name()))
		if err != nil {
			t.Fatalf("read %s: %v", e.Name(), err)
		}
		cur := ""
		for _, line := range strings.Split(string(b), "\n") {
			trimmed := strings.TrimSpace(line)
			if m := reCreate.FindStringSubmatch(trimmed); m != nil {
				cur = strings.ToLower(m[1])
				continue
			}
			if m := reAlter.FindStringSubmatch(trimmed); m != nil {
				if defined[m[1]] == nil {
					defined[strings.ToLower(m[1])] = map[string]bool{}
				}
				defined[strings.ToLower(m[1])][strings.ToLower(m[2])] = true
				continue
			}
			if cur == "" {
				continue
			}
			if strings.HasPrefix(trimmed, ")") {
				cur = ""
				continue
			}
			if m := reCol.FindStringSubmatch(trimmed); m != nil {
				name := strings.ToLower(m[1])
				if !skip[name] {
					if defined[cur] == nil {
						defined[cur] = map[string]bool{}
					}
					defined[cur][name] = true
				}
			}
		}
	}
	return defined
}

// selectedColumns is the exact list every reader hands to the scanner, keyed by
// the relation it names.
func selectedColumns() map[string][]string {
	return map[string][]string{
		"security_scans":             strings.Split(scanColumns, ","),
		"security_findings":          strings.Split(findingColumns, ","),
		"audit_plans":                strings.Split(auditPlanColumns, ","),
		"audit_executions":           strings.Split(auditExecutionColumns, ","),
		"audit_findings":             strings.Split(auditFindingColumns, ","),
		"compliance_policies":        strings.Split(compliancePolicyColumns, ","),
		"compliance_evaluations":     strings.Split(evaluationColumns, ","),
		"supply_chain_sboms":         strings.Split(sbomColumns, ","),
		"dependency_graphs":          strings.Split(dependencyGraphColumns, ","),
		"dependency_poisoning_scans": strings.Split(poisoningScanColumns, ","),
	}
}

// TestMigration_CreatesEveryTableTheRepositoryReads is the check that would have
// caught the six relations that only existed in migrations/security/, a
// subdirectory the runner never opens.
func TestMigration_CreatesEveryTableTheRepositoryReads(t *testing.T) {
	defined := loadableDDL(t)
	var missing []string
	for table := range selectedColumns() {
		if defined[table] == nil {
			missing = append(missing, table)
		}
	}
	if len(missing) > 0 {
		t.Fatalf("%d relation(s) that a loadable migration never creates: %v", len(missing), missing)
	}
}

// TestMigration_DefinesEverySelectedColumn is the check that would have caught
// audit_findings.assigned_to: it was selected and written by this repository and
// defined only in the never-run migrations/security/001, so every audit finding
// read and every PUT /findings/:id answered 500 with
// 'column assigned_to does not exist'.
func TestMigration_DefinesEverySelectedColumn(t *testing.T) {
	defined := loadableDDL(t)
	var missing []string
	for table, cols := range selectedColumns() {
		for _, raw := range cols {
			col := strings.TrimSpace(raw)
			if i := strings.Index(col, "::"); i >= 0 {
				col = strings.TrimSpace(col[:i])
			}
			if i := strings.Index(col, " as "); i >= 0 {
				col = strings.TrimSpace(col[:i])
			}
			if !defined[table][strings.ToLower(col)] {
				missing = append(missing, table+"."+col)
			}
		}
	}
	if len(missing) > 0 {
		t.Fatalf("%d selected column(s) that no loadable migration defines: %v", len(missing), missing)
	}
}
