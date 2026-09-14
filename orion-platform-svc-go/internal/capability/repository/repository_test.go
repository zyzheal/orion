package repository

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"

	"orion/go-common/pkg/sentinel"
	"orion/platform-svc-go/internal/capability/models"
)

// --- pinned column contracts ---

const sourceFile = "repository.go"

const wantCapabilityColumns = "id, tenant_id, name, parent_capability_id, created_at, updated_at"

const wantTemporaryPermissionColumns = "id, tenant_id, user_id, capability_id, environment_suffix, reason, granted_by, granted_at, expires_at, revoked_at, created_at"

const wantPermissionRequestColumns = "id, tenant_id, user_id, capability_id, status, reason, approver_id, rejected_by, rejected_reason, duration_hours, environment_suffix, created_at, updated_at"

const wantCapabilityAuditLogColumns = "id, tenant_id, action, user_id, target_type, target_id, details, created_at"

func TestColumnConstantsMatchThePinnedExpectation(t *testing.T) {
	cases := []struct {
		name, got, want string
	}{
		{"capabilityColumns", capabilityColumns, wantCapabilityColumns},
		{"temporaryPermissionColumns", temporaryPermissionColumns, wantTemporaryPermissionColumns},
		{"permissionRequestColumns", permissionRequestColumns, wantPermissionRequestColumns},
		{"capabilityAuditLogColumns", capabilityAuditLogColumns, wantCapabilityAuditLogColumns},
	}
	for _, c := range cases {
		if c.got != c.want {
			t.Errorf("%s drifted from the pinned expectation\n  got:      %s\n  expected: %s", c.name, c.got, c.want)
		}
		if strings.Contains(c.got, "*") {
			t.Errorf("%s must name every column; a wildcard is a 500 in sqlx safe mode", c.name)
		}
		if !strings.Contains(c.got, "tenant_id") {
			t.Errorf("%s does not project tenant_id", c.name)
		}
	}
}

// TestColumnConstantsHaveNoDuplicates guards a column that is listed twice:
// sqlx would then scan it into two destinations and the second one silently
// wins, and the extra placeholder shifts every later argument.
func TestColumnConstantsHaveNoDuplicates(t *testing.T) {
	for name, cols := range map[string]string{
		"capabilityColumns":          capabilityColumns,
		"temporaryPermissionColumns": temporaryPermissionColumns,
		"permissionRequestColumns":   permissionRequestColumns,
		"capabilityAuditLogColumns":  capabilityAuditLogColumns,
	} {
		parts := strings.Split(cols, ",")
		seen := map[string]bool{}
		for _, p := range parts {
			p = strings.TrimSpace(p)
			if p == "" {
				continue
			}
			if seen[p] {
				t.Errorf("%s lists %q twice", name, p)
			}
			seen[p] = true
		}
	}
}

// --- source-level guards ---

func stripComments(src string) string {
	var out strings.Builder
	for i := 0; i < len(src); {
		if i+1 < len(src) && src[i] == '/' && src[i+1] == '/' {
			for i < len(src) && src[i] != '\n' {
				i++
			}
			continue
		}
		out.WriteByte(src[i])
		i++
	}
	return out.String()
}

func TestCapabilityIsNotWildcarded(t *testing.T) {
	src, err := os.ReadFile(sourceFile)
	if err != nil {
		t.Fatalf("read %s: %v", sourceFile, err)
	}
	body := stripComments(string(src))
	for _, tbl := range []string{"capabilities", "temporary_permissions", "permission_requests", "capability_audit_logs"} {
		if strings.Contains(body, "SELECT * FROM "+tbl) {
			t.Error(tbl + " is still selected with * instead of a named column list")
		}
	}
}

// --- schema drift guard ---

func norm(s string) string {
	// Normalise paren and comma spacing so an expectation written as "($1, $2)"
	// matches the driver output "$1, $2" or "$1,$2". Whitespace collapsing alone
	// would not do it, because "( x" and "(x" are different strings.
	s = strings.ReplaceAll(s, "(", "( ")
	s = strings.ReplaceAll(s, ")", " )")
	s = strings.ReplaceAll(s, ",", ", ")
	return strings.TrimSpace(regexp.MustCompile(`\s+`).ReplaceAllString(s, " "))
}

// schemaFromMigrations parses every non-down migration in the repository root
// and returns table -> set of column names. CREATE TABLE bodies are scanned for
// a leading identifier on each line; ALTER TABLE ... ADD COLUMN is scanned too,
// because capability columns have been added in four separate migrations
// (571, 572, 573 and 582).
func schemaFromMigrations(t *testing.T) map[string]map[string]bool {
	t.Helper()
	root, err := filepath.Abs("../../..")
	if err != nil {
		t.Fatal(err)
	}
	pattern := filepath.Join(root, "migrations", "*.sql")
	files, err := filepath.Glob(pattern)
	if err != nil {
		t.Fatal(err)
	}
	if len(files) == 0 {
		t.Fatal("no migration files found -- the drift guard is matching nothing")
	}
	schema := map[string]map[string]bool{}
	addColumn := func(tbl, col string) {
		if _, ok := schema[tbl]; !ok {
			schema[tbl] = map[string]bool{}
		}
		schema[tbl][strings.Trim(col, `"`)] = true
	}

	createRe := regexp.MustCompile(`(?is)CREATE TABLE (?:IF NOT EXISTS )?(?:"?)(\w+)(?:"?)\s*\((.*?)\);`)
	addColRe := regexp.MustCompile(`(?is)ALTER TABLE\s+(?:IF EXISTS\s+)?"?(\w+)"?\s+ADD\s+COLUMN\s+(?:IF NOT EXISTS\s+)?"?(\w+)"?`)

	for _, f := range files {
		base := filepath.Base(f)
		if strings.HasSuffix(base, "_down.sql") {
			continue
		}
		src, err := os.ReadFile(f)
		if err != nil {
			t.Fatal(err)
		}
		body := stripComments(string(src))
		for _, loc := range createRe.FindAllStringSubmatchIndex(body, -1) {
			tbl := body[loc[2]:loc[3]]
			rest := body[loc[4]:loc[5]]
			for _, line := range strings.Split(rest, "\n") {
				line = strings.TrimSpace(line)
				if line == "" || line[0] == ',' {
					continue
				}
				if m := regexp.MustCompile(`^"?(\w+)"?`).FindStringSubmatch(line); m != nil {
					col := m[1]
					if isConstraintName(col) {
						continue
					}
					addColumn(tbl, col)
				}
			}
		}
		for _, m := range addColRe.FindAllStringSubmatch(body, -1) {
			addColumn(m[1], m[2])
		}
	}
	return schema
}

func sortedKeys(m map[string]bool) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	return keys
}

func isConstraintName(s string) bool {
	return strings.HasPrefix(s, "constraint") || strings.HasPrefix(s, "primary") ||
		strings.HasPrefix(s, "foreign") || strings.HasPrefix(s, "unique") ||
		strings.HasPrefix(s, "check") || strings.HasPrefix(s, "exclude")
}

// sqlStatements extracts every SQL fragment the repository emits.
//
// The column constants are spliced into a statement as bare identifiers
// (SELECT `+capabilityColumns+` FROM ...), so each identifier is first replaced
// with a NUL-delimited token that cannot be a Go identifier and is then expanded
// again inside every string literal. That is what makes a statement spliced
// across three literals analysable as one statement.
func sqlStatements(t *testing.T) []string {
	t.Helper()
	src, err := os.ReadFile(sourceFile)
	if err != nil {
		t.Fatal(err)
	}
	body := stripComments(string(src))
	repl := map[string]string{
		"capabilityColumns":          wantCapabilityColumns,
		"temporaryPermissionColumns": wantTemporaryPermissionColumns,
		"permissionRequestColumns":   wantPermissionRequestColumns,
		"capabilityAuditLogColumns":  wantCapabilityAuditLogColumns,
	}
	// A column constant is spliced into a statement as a bare identifier between
	// two adjacent string literals: SELECT <columns> FROM ... is written as three
	// pieces glued with +. Those two literals are merged into one with the column
	// list inserted, so the statement is analysed whole rather than as two
	// meaningless halves. (Backticks cannot appear in this comment: the previous
	// line opens a raw string literal.)
	for k, v := range repl {
		re := regexp.MustCompile("`([^`]*)`\\+" + regexp.QuoteMeta(k) + `\+` + "`([^`]*)`")
		body = re.ReplaceAllString(body, "`$1"+v+" $2`")
	}
	var out []string
	for _, m := range regexp.MustCompile("`[^`]*`|\"[^\"]*\"").FindAllString(body, -1) {
		frag := m[1 : len(m)-1]
		if !regexp.MustCompile(`\b(SELECT|INSERT|UPDATE|DELETE)\b`).MatchString(frag) {
			continue
		}
		out = append(out, norm(frag))
	}
	sort.Strings(out)
	return out
}

// predicateIDs returns the column identifiers of a WHERE clause, in order.
func predicateIDs(pred string) []string {
	pred = strings.TrimSuffix(norm(pred), ".")
	clauseRe := regexp.MustCompile(`(?i)([a-z_][a-z0-9_]*)\s*(?:=\s*\$?\w*|!=|<>|>=|<=|>|\s+<|IS\s+NOT\s+NULL|IS\s+NULL|ILIKE\s+\$\d|LIKE\s+\$\d|IN\b)`)
	var ids []string
	for _, m := range clauseRe.FindAllStringSubmatch(norm(pred), -1) {
		ids = append(ids, m[1])
	}
	return ids
}

// TestRepositoryTablesExistInMigrations is the general remedy for the defect
// that took this module down: three mapping tables the code referred to had
// never been created by any migration, so InsertCommandMapping,
// GrantCapabilityToRole and GrantCapabilityToUser failed at plan time with
// "relation ... does not exist" and the endpoint answered 500.
func TestRepositoryTablesExistInMigrations(t *testing.T) {
	schema := schemaFromMigrations(t)
	seen := map[string]bool{}
	for _, sql := range sqlStatements(t) {
		for _, m := range regexp.MustCompile(`(?i)\b(?:FROM|INTO|UPDATE)\s+"?(\w+)"?`).FindAllStringSubmatch(sql, -1) {
			seen[m[1]] = true
		}
	}
	if len(seen) == 0 {
		t.Fatal("no tables found in " + sourceFile + " -- the guard is matching nothing")
	}
	if !seen["capabilities"] || !seen["temporary_permissions"] ||
		!seen["permission_requests"] || !seen["capability_audit_logs"] {
		t.Fatalf("the four primary tables were not recognised; found: %v", sortedKeys(seen))
	}
	for tbl := range seen {
		if _, ok := schema[tbl]; !ok {
			t.Errorf("repository references table %q, which no migration creates", tbl)
		}
	}
}

// TestRepositoryColumnsExistInMigrations catches a repository that reads or
// writes a column no migration ever adds. In this module that was seven
// separate phantoms: parent_capability_id, revoked, duration_hours,
// environment_suffix, approver_id, rejected_by, rejected_reason, plus
// capability_id on capabilities and three audit columns on the wrong table.
func TestRepositoryColumnsExistInMigrations(t *testing.T) {
	schema := schemaFromMigrations(t)
	checked := 0
	for _, sql := range sqlStatements(t) {
		tbl, list, setClause, pred := parseStatement(sql)
		cols := schema[tbl]
		if cols == nil {
			t.Errorf("table %q of %q is unknown to the schema scan", tbl, sql)
			continue
		}
		if strings.Contains(list, "(") {
			list = ""
		}
		for _, c := range splitList(list) {
			if c == "*" {
				t.Errorf("%q uses a wildcard select", sql)
				continue
			}
			if c == "" {
				continue
			}
			checked++
			if !cols[c] {
				t.Errorf("%s.%s is referenced by %q but no migration creates it", tbl, c, sql)
			}
		}
		for _, c := range setIDs(setClause) {
			checked++
			if !cols[c] {
				t.Errorf("%s.%s is set by %q but no migration creates it", tbl, c, sql)
			}
		}
		for _, c := range predicateIDs(pred) {
			checked++
			if !cols[c] {
				t.Errorf("%s.%s is used in the predicate of %q but no migration creates it", tbl, c, sql)
			}
		}
	}
	if checked == 0 {
		t.Fatal("no column references analysed -- the guard is matching nothing")
	}
	if checked < 60 {
		t.Fatalf("only %d column references analysed; the statement extraction has regressed", checked)
	}
}

// parseStatement splits a normalised statement into its table, select list,
// set clause and predicate.
func parseStatement(sql string) (tbl, list, setClause, pred string) {
	if strings.HasPrefix(sql, "INSERT INTO ") {
		m := regexp.MustCompile(`(?i)^INSERT INTO "?(\w+)"? \(([^)]*)\)`).FindStringSubmatch(sql)
		if m != nil {
			return m[1], m[2], "", ""
		}
		return "", "", "", ""
	}
	if strings.HasPrefix(sql, "UPDATE ") {
		m := regexp.MustCompile(`(?i)^UPDATE "?(\w+)"? SET (.+?) WHERE (.*)$`).FindStringSubmatch(sql)
		if m != nil {
			return m[1], "", m[2], m[3]
		}
		return "", "", "", ""
	}
	if strings.HasPrefix(sql, "DELETE FROM ") {
		m := regexp.MustCompile(`(?i)^DELETE FROM "?(\w+)"? WHERE (.*)$`).FindStringSubmatch(sql)
		if m != nil {
			return m[1], "", "", m[2]
		}
		return "", "", "", ""
	}
	m := regexp.MustCompile(`(?i)^SELECT (.*?) FROM "?(\w+)"? (?:WHERE (.*))?$`).FindStringSubmatch(sql)
	if m == nil {
		m = regexp.MustCompile(`(?i)^\S+ (.*?) FROM "?(\w+)"? WHERE (.*?)( ORDER BY .*?|$)`).FindStringSubmatch(sql)
		if m != nil {
			return m[2], m[1], "", m[3]
		}
		return "", "", "", ""
	}
	return m[2], m[1], "", m[3]
}

func splitList(s string) []string {
	parts := strings.Split(s, ",")
	for i := range parts {
		parts[i] = strings.Trim(strings.TrimSpace(parts[i]), `"`)
	}
	return parts
}

// setIDs returns the target columns of a SET clause.
func setIDs(setClause string) []string {
	var ids []string
	for _, part := range strings.Split(setClause, ",") {
		part = strings.TrimSpace(part)
		if part == "" {
			continue
		}
		eq := strings.Index(part, "=")
		if eq < 0 {
			continue
		}
		target := strings.TrimSpace(part[:eq])
		if regexp.MustCompile(`(?i)`+regexp.QuoteMeta(target)+`\s*(?:=\s*\$?\w*|>=|<=|>)`).MatchString(part) ||
			strings.HasPrefix(target, "status") || strings.Contains(target, "at") || strings.Contains(target, "by") || strings.Contains(target, "id") {
			ids = append(ids, strings.Trim(target, `"`))
		}
	}
	return ids
}

// TestWriteStatementsAreTenantBound is the general remedy for the cross-tenant
// defect: ApprovePermissionRequest, both RejectPermissionRequest branches and
// RevokeTemporaryPermissionByID used to key their UPDATE on id alone, so one
// tenant could approve, reject or revoke another tenant's record.
func TestWriteStatementsAreTenantBound(t *testing.T) {
	var n int
	for _, sql := range sqlStatements(t) {
		if !strings.HasPrefix(sql, "UPDATE ") && !strings.HasPrefix(sql, "DELETE FROM ") {
			continue
		}
		n++
		if !strings.Contains(sql, "tenant_id") {
			t.Errorf("write statement is not scoped to a tenant:\n  %s", sql)
		}
	}
	if n == 0 {
		t.Fatal("no UPDATE/DELETE statements found -- the guard is matching nothing")
	}
}

// TestAuditUsesTheTableThatHasTheColumns pins the table-name fix.
//
// The audit INSERT used to target permission_audit_logs, which has no
// target_type, target_id or details column, so every audit write in this module
// failed at parse time and the audit trail was written nowhere at all.
func TestAuditUsesTheTableThatHasTheColumns(t *testing.T) {
	src, err := os.ReadFile(sourceFile)
	if err != nil {
		t.Fatalf("read %s: %v", sourceFile, err)
	}
	body := stripComments(string(src))
	if strings.Contains(body, "permission_audit_logs") {
		t.Error("permission_audit_logs still referenced; audit writes must go to capability_audit_logs")
	}
	if strings.Count(body, "capability_audit_logs") < 2 {
		t.Error("capability_audit_logs must appear for both the INSERT and the SELECT")
	}
}

// TestListRootDoesNotCompareUUIDWithEmptyString pins the ListRoot predicate.
//
// parent_capability_id is a UUID column, and a UUID cannot be compared with an
// empty string: "parent_capability_id = ”" does not parse. A root is only
// "parent_capability_id IS NULL".
func TestListRootDoesNotCompareUUIDWithEmptyString(t *testing.T) {
	src, err := os.ReadFile(sourceFile)
	if err != nil {
		t.Fatalf("read %s: %v", sourceFile, err)
	}
	body := stripComments(string(src))
	if m := regexp.MustCompile(`(?i)parent_capability_id\s*=\s*''`).FindStringIndex(body); m != nil {
		t.Error("parent_capability_id is compared with an empty string, which does not parse for a UUID column")
	}
}

// --- behaviour ---

func newMock(t *testing.T) (*Repository, sqlmock.Sqlmock) {
	t.Helper()
	// go-sqlmock's default QueryMatcherRegexp treats a $ in the expected text as
	// an end-of-string anchor, so an expectation containing $1 could never
	// match and a test would pass vacuously. Exact whitespace-normalised
	// matching is required for the placeholder pins below to mean anything.
	raw, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherFunc(func(expected, actual string) error {
		if norm(expected) == norm(actual) {
			return nil
		}
		return fmt.Errorf("sql mismatch:\n  expected: %s\n     actual: %s", norm(expected), norm(actual))
	})))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = raw.Close() })
	return NewRepository(sqlx.NewDb(raw, "postgres")), mock
}

func capCols() []string {
	return []string{"id", "tenant_id", "name", "parent_capability_id", "created_at", "updated_at"}
}

func tmpCols() []string {
	return []string{"id", "tenant_id", "user_id", "capability_id", "environment_suffix", "reason",
		"granted_by", "granted_at", "expires_at", "revoked_at", "created_at"}
}

func reqCols() []string {
	return []string{"id", "tenant_id", "user_id", "capability_id", "status", "reason", "approver_id",
		"rejected_by", "rejected_reason", "duration_hours", "environment_suffix", "created_at", "updated_at"}
}

func auditCols() []string {
	return []string{"id", "tenant_id", "action", "user_id", "target_type", "target_id", "details", "created_at"}
}

func anyID() interface{} { return sqlmock.AnyArg() }

func capRow() *sqlmock.Rows {
	now := time.Now().UTC()
	return sqlmock.NewRows(capCols()).AddRow("cap-1", "tenant-alpha", "deploy:create", nil, now, now)
}

func TestCreateInsertsEveryColumn(t *testing.T) {
	r, mock := newMock(t)

	mock.ExpectExec("INSERT INTO capabilities ( id, tenant_id, name, parent_capability_id, created_at, updated_at ) VALUES ($1,$2,$3,$4,$5,$6)").
		WithArgs(anyID(), "tenant-alpha", "deploy:create", nil, anyID(), anyID()).
		WillReturnResult(sqlmock.NewResult(0, 1))

	err := r.Create(context.Background(), &models.Capability{TenantID: "tenant-alpha", Name: "deploy:create"})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestCreateStoresTheParent(t *testing.T) {
	r, mock := newMock(t)
	parent := "22222222-2222-2222-2222-222222222222"

	mock.ExpectExec("INSERT INTO capabilities ( id, tenant_id, name, parent_capability_id, created_at, updated_at ) VALUES ($1,$2,$3,$4,$5,$6)").
		WithArgs(anyID(), "tenant-alpha", "deploy:read", parent, anyID(), anyID()).
		WillReturnResult(sqlmock.NewResult(0, 1))

	err := r.Create(context.Background(), &models.Capability{
		TenantID: "tenant-alpha", Name: "deploy:read", ParentCapabilityID: &parent,
	})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestGetByIDSelectsTheMappedColumnsOnly(t *testing.T) {
	r, mock := newMock(t)

	mock.ExpectQuery("SELECT "+wantCapabilityColumns+" FROM capabilities WHERE id=$1 AND tenant_id=$2").
		WithArgs("cap-1", "tenant-alpha").
		WillReturnRows(capRow())

	m, err := r.GetByID(context.Background(), "tenant-alpha", "cap-1")
	if err != nil {
		t.Fatalf("GetByID: %v", err)
	}
	if m.Name != "deploy:create" || m.TenantID != "tenant-alpha" {
		t.Errorf("unexpected row: %+v", m)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestGetByIDMissingCapabilityIsNotFound(t *testing.T) {
	r, mock := newMock(t)

	mock.ExpectQuery("SELECT "+wantCapabilityColumns+" FROM capabilities WHERE id=$1 AND tenant_id=$2").
		WithArgs("missing", "tenant-alpha").
		WillReturnRows(sqlmock.NewRows(capCols()))

	_, err := r.GetByID(context.Background(), "tenant-alpha", "missing")
	if !errors.Is(err, sentinel.NotFound) {
		t.Fatalf("want sentinel.NotFound, got %v", err)
	}
}

func TestListBindsTenantAndPaginates(t *testing.T) {
	r, mock := newMock(t)

	mock.ExpectQuery("SELECT "+wantCapabilityColumns+" FROM capabilities WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3").
		WithArgs("tenant-alpha", 20, 10).
		WillReturnRows(capRow())

	items, err := r.List(context.Background(), "tenant-alpha", 20, 10)
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if len(items) != 1 {
		t.Fatalf("len=%d, want 1", len(items))
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestListDefaultLimitApplies(t *testing.T) {
	r, mock := newMock(t)

	mock.ExpectQuery("SELECT "+wantCapabilityColumns+" FROM capabilities WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3").
		WithArgs("tenant-alpha", 50, 0).
		WillReturnRows(sqlmock.NewRows(capCols()))

	if _, err := r.List(context.Background(), "tenant-alpha", 0, 0); err != nil {
		t.Fatalf("List: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestListByCategoryFiltersByName(t *testing.T) {
	r, mock := newMock(t)

	mock.ExpectQuery("SELECT "+wantCapabilityColumns+" FROM capabilities WHERE tenant_id=$1 AND name ILIKE $2 ORDER BY created_at DESC LIMIT $3 OFFSET $4").
		WithArgs("tenant-alpha", "%deploy%", 50, 0).
		WillReturnRows(capRow())

	items, err := r.ListByCategory(context.Background(), "tenant-alpha", "deploy", 0, 0)
	if err != nil {
		t.Fatalf("ListByCategory: %v", err)
	}
	if len(items) != 1 {
		t.Fatalf("len=%d, want 1", len(items))
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestListByCategoryEmptyFallsBackToList(t *testing.T) {
	r, mock := newMock(t)

	mock.ExpectQuery("SELECT "+wantCapabilityColumns+" FROM capabilities WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3").
		WithArgs("tenant-alpha", 50, 0).
		WillReturnRows(sqlmock.NewRows(capCols()))

	if _, err := r.ListByCategory(context.Background(), "tenant-alpha", "", 0, 0); err != nil {
		t.Fatalf("ListByCategory: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestListRootSelectsUnparentedOnly(t *testing.T) {
	r, mock := newMock(t)

	mock.ExpectQuery("SELECT " + wantCapabilityColumns + " FROM capabilities WHERE tenant_id=$1 AND parent_capability_id IS NULL ORDER BY created_at").
		WithArgs("tenant-alpha").
		WillReturnRows(capRow())

	items, err := r.ListRoot(context.Background(), "tenant-alpha")
	if err != nil {
		t.Fatalf("ListRoot: %v", err)
	}
	if len(items) != 1 {
		t.Fatalf("len=%d, want 1", len(items))
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestListByParentBindsTenant(t *testing.T) {
	r, mock := newMock(t)

	mock.ExpectQuery("SELECT "+wantCapabilityColumns+" FROM capabilities WHERE tenant_id=$1 AND parent_capability_id=$2").
		WithArgs("tenant-alpha", "cap-1").
		WillReturnRows(capRow())

	items, err := r.ListByParent(context.Background(), "tenant-alpha", "cap-1")
	if err != nil {
		t.Fatalf("ListByParent: %v", err)
	}
	if len(items) != 1 {
		t.Fatalf("len=%d, want 1", len(items))
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestHasChildrenCountsChildren(t *testing.T) {
	r, mock := newMock(t)

	mock.ExpectQuery("SELECT COUNT(*) FROM capabilities WHERE tenant_id=$1 AND parent_capability_id=$2").
		WithArgs("tenant-alpha", "cap-1").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(2))

	has, err := r.HasChildren(context.Background(), "tenant-alpha", "cap-1")
	if err != nil {
		t.Fatalf("HasChildren: %v", err)
	}
	if !has {
		t.Error("want has children")
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestGetParentMissingIsNotFound(t *testing.T) {
	r, mock := newMock(t)

	mock.ExpectQuery("SELECT "+wantCapabilityColumns+" FROM capabilities WHERE id=$1 AND tenant_id=$2").
		WithArgs("missing", "tenant-alpha").
		WillReturnRows(sqlmock.NewRows(capCols()))

	_, err := r.GetParent(context.Background(), "tenant-alpha", "missing")
	if !errors.Is(err, sentinel.NotFound) {
		t.Fatalf("want sentinel.NotFound, got %v", err)
	}
}

// TestUpdateRendersDistinctPlaceholdersAndBindsTenant proves the whitelisted
// SET clause renders a fresh placeholder per column and keys the row on
// tenant_id. Both halves mattered: the old body ignored the map entirely and
// answered nil for a rename that never happened.
func TestUpdateRendersDistinctPlaceholdersAndBindsTenant(t *testing.T) {
	r, mock := newMock(t)

	mock.ExpectExec("UPDATE capabilities SET name=$1, parent_capability_id=$2, updated_at=NOW() WHERE id=$3 AND tenant_id=$4").
		WithArgs("renamed", "cap-9", "cap-1", "tenant-alpha").
		WillReturnResult(sqlmock.NewResult(0, 1))

	err := r.Update(context.Background(), "tenant-alpha", "cap-1", map[string]interface{}{
		"name":                 "renamed",
		"parent_capability_id": "cap-9",
	})
	if err != nil {
		t.Fatalf("Update: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestUpdateEmptyMapIsAnError(t *testing.T) {
	r, _ := newMock(t)
	err := r.Update(context.Background(), "tenant-alpha", "cap-1", map[string]interface{}{})
	if !errors.Is(err, ErrNoUpdatableFields) {
		t.Fatalf("want ErrNoUpdatableFields, got %v", err)
	}
}

func TestUpdateUnknownColumnIsRejected(t *testing.T) {
	r, mock := newMock(t)
	// No expectation: the method must refuse before touching the driver.
	err := r.Update(context.Background(), "tenant-alpha", "cap-1", map[string]interface{}{"tenant_id": "other"})
	if err == nil || !strings.Contains(err.Error(), `unknown column "tenant_id"`) {
		t.Fatalf("want unknown column error, got %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestDeleteBindsTenant(t *testing.T) {
	r, mock := newMock(t)

	mock.ExpectExec("DELETE FROM capabilities WHERE id=$1 AND tenant_id=$2").
		WithArgs("cap-1", "tenant-alpha").
		WillReturnResult(sqlmock.NewResult(0, 1))

	if err := r.Delete(context.Background(), "tenant-alpha", "cap-1"); err != nil {
		t.Fatalf("Delete: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestInsertCommandMappingNormalisesNilEnv(t *testing.T) {
	r, mock := newMock(t)

	mock.ExpectExec("INSERT INTO command_capability_mappings ( id, tenant_id, capability_id, command_name, command_action, environment_suffix ) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (tenant_id, command_name, command_action, environment_suffix) DO NOTHING").
		WithArgs(anyID(), "tenant-alpha", "cap-1", "deploy", "create", "").
		WillReturnResult(sqlmock.NewResult(0, 1))

	err := r.InsertCommandMapping(context.Background(), "tenant-alpha", "cap-1", "deploy", "create", nil)
	if err != nil {
		t.Fatalf("InsertCommandMapping: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestInsertCommandMappingPassesTheEnvSuffix(t *testing.T) {
	r, mock := newMock(t)
	env := "prod"

	mock.ExpectExec("INSERT INTO command_capability_mappings ( id, tenant_id, capability_id, command_name, command_action, environment_suffix ) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (tenant_id, command_name, command_action, environment_suffix) DO NOTHING").
		WithArgs(anyID(), "tenant-alpha", "cap-1", "deploy", "create", "prod").
		WillReturnResult(sqlmock.NewResult(0, 1))

	if err := r.InsertCommandMapping(context.Background(), "tenant-alpha", "cap-1", "deploy", "create", &env); err != nil {
		t.Fatalf("InsertCommandMapping: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestGetCapabilityIDForCommandMatchesEnv(t *testing.T) {
	r, mock := newMock(t)

	mock.ExpectQuery("SELECT capability_id FROM command_capability_mappings WHERE tenant_id=$1 AND command_name=$2 AND command_action=$3 AND environment_suffix=$4").
		WithArgs("tenant-alpha", "deploy", "create", "prod").
		WillReturnRows(sqlmock.NewRows([]string{"capability_id"}).AddRow("cap-7"))

	id, err := r.GetCapabilityIDForCommand(context.Background(), "tenant-alpha", "deploy", "create", "prod")
	if err != nil {
		t.Fatalf("GetCapabilityIDForCommand: %v", err)
	}
	if id != "cap-7" {
		t.Fatalf("id=%q, want cap-7", id)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestGetCapabilityIDForCommandNoMappingIsEmpty(t *testing.T) {
	r, mock := newMock(t)

	mock.ExpectQuery("SELECT capability_id FROM command_capability_mappings WHERE tenant_id=$1 AND command_name=$2 AND command_action=$3 AND environment_suffix=$4").
		WithArgs("tenant-alpha", "deploy", "create", "").
		WillReturnRows(sqlmock.NewRows([]string{"capability_id"}))

	id, err := r.GetCapabilityIDForCommand(context.Background(), "tenant-alpha", "deploy", "create", "")
	if err != nil {
		t.Fatalf("GetCapabilityIDForCommand: %v", err)
	}
	if id != "" {
		t.Fatalf("id=%q, want empty", id)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestGrantCapabilityToRoleUsesUpsert(t *testing.T) {
	r, mock := newMock(t)

	mock.ExpectExec("INSERT INTO capability_role_mappings ( id, tenant_id, capability_id, role_name ) VALUES ($1,$2,$3,$4) ON CONFLICT (tenant_id, capability_id, role_name) DO NOTHING").
		WithArgs(anyID(), "tenant-alpha", "cap-1", "admin").
		WillReturnResult(sqlmock.NewResult(0, 1))

	if err := r.GrantCapabilityToRole(context.Background(), "tenant-alpha", "cap-1", "admin"); err != nil {
		t.Fatalf("GrantCapabilityToRole: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestRevokeCapabilityFromRoleBindsTenant(t *testing.T) {
	r, mock := newMock(t)

	mock.ExpectExec("DELETE FROM capability_role_mappings WHERE tenant_id=$1 AND capability_id=$2 AND role_name=$3").
		WithArgs("tenant-alpha", "cap-1", "admin").
		WillReturnResult(sqlmock.NewResult(0, 1))

	if err := r.RevokeCapabilityFromRole(context.Background(), "tenant-alpha", "cap-1", "admin"); err != nil {
		t.Fatalf("RevokeCapabilityFromRole: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestGrantCapabilityToUserComputesExpiry(t *testing.T) {
	r, mock := newMock(t)

	mock.ExpectExec("INSERT INTO capability_user_mappings ( id, tenant_id, capability_id, user_id, granted_by, expires_at ) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (tenant_id, capability_id, user_id) DO NOTHING").
		WithArgs(anyID(), "tenant-alpha", "cap-1", "user-1", "grantor-1", anyID()).
		WillReturnResult(sqlmock.NewResult(0, 1))

	if err := r.GrantCapabilityToUser(context.Background(), "tenant-alpha", "cap-1", "user-1", "grantor-1", nil); err != nil {
		t.Fatalf("GrantCapabilityToUser: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestRevokeCapabilityFromUserBindsTenant(t *testing.T) {
	r, mock := newMock(t)

	mock.ExpectExec("DELETE FROM capability_user_mappings WHERE tenant_id=$1 AND capability_id=$2 AND user_id=$3").
		WithArgs("tenant-alpha", "cap-1", "user-1").
		WillReturnResult(sqlmock.NewResult(0, 1))

	if err := r.RevokeCapabilityFromUser(context.Background(), "tenant-alpha", "cap-1", "user-1"); err != nil {
		t.Fatalf("RevokeCapabilityFromUser: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestListCapabilityIDsByRole(t *testing.T) {
	r, mock := newMock(t)

	mock.ExpectQuery("SELECT capability_id FROM capability_role_mappings WHERE tenant_id=$1 AND role_name=$2").
		WithArgs("tenant-alpha", "admin").
		WillReturnRows(sqlmock.NewRows([]string{"capability_id"}).AddRow("cap-1").AddRow("cap-2"))

	ids, err := r.ListCapabilityIDsByRole(context.Background(), "tenant-alpha", "admin")
	if err != nil {
		t.Fatalf("ListCapabilityIDsByRole: %v", err)
	}
	if len(ids) != 2 || ids[0] != "cap-1" {
		t.Fatalf("ids=%v", ids)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestListCapabilityIDsByUserIgnoresExpired(t *testing.T) {
	r, mock := newMock(t)

	mock.ExpectQuery("SELECT capability_id FROM capability_user_mappings WHERE tenant_id=$1 AND user_id=$2 AND (expires_at IS NULL OR expires_at > NOW())").
		WithArgs("tenant-alpha", "user-1").
		WillReturnRows(sqlmock.NewRows([]string{"capability_id"}).AddRow("cap-3"))

	ids, err := r.ListCapabilityIDsByUser(context.Background(), "tenant-alpha", "user-1")
	if err != nil {
		t.Fatalf("ListCapabilityIDsByUser: %v", err)
	}
	if len(ids) != 1 || ids[0] != "cap-3" {
		t.Fatalf("ids=%v", ids)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestGetUserGrantExpiry(t *testing.T) {
	r, mock := newMock(t)
	exp := time.Now().UTC().Add(2 * time.Hour)

	mock.ExpectQuery("SELECT COALESCE(expires_at, NULL) FROM capability_user_mappings WHERE tenant_id=$1 AND capability_id=$2 AND user_id=$3 AND (expires_at IS NULL OR expires_at > NOW())").
		WithArgs("tenant-alpha", "cap-1", "user-1").
		WillReturnRows(sqlmock.NewRows([]string{"expires_at"}).AddRow(exp))

	got, err := r.GetUserGrantExpiry(context.Background(), "tenant-alpha", "cap-1", "user-1")
	if err != nil {
		t.Fatalf("GetUserGrantExpiry: %v", err)
	}
	if got == nil || !got.Equal(exp) {
		t.Fatalf("got=%v", got)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestGetUserGrantExpiryNoGrantIsNil(t *testing.T) {
	r, mock := newMock(t)

	mock.ExpectQuery("SELECT COALESCE(expires_at, NULL) FROM capability_user_mappings WHERE tenant_id=$1 AND capability_id=$2 AND user_id=$3 AND (expires_at IS NULL OR expires_at > NOW())").
		WithArgs("tenant-alpha", "cap-1", "user-1").
		WillReturnRows(sqlmock.NewRows([]string{"expires_at"}))

	got, err := r.GetUserGrantExpiry(context.Background(), "tenant-alpha", "cap-1", "user-1")
	if err != nil {
		t.Fatalf("GetUserGrantExpiry: %v", err)
	}
	if got != nil {
		t.Fatalf("got=%v, want nil", got)
	}
}

// TestGrantTemporaryPermissionPersistsReasonAndGrantedAt pins the two NOT
// NULL columns the old INSERT omitted. Both are NOT NULL with no default, so
// dropping either makes the INSERT fail server-side and the endpoint answers 500.
func TestGrantTemporaryPermissionPersistsReasonAndGrantedAt(t *testing.T) {
	r, mock := newMock(t)

	mock.ExpectExec("INSERT INTO temporary_permissions ( user_id, tenant_id, capability_id, environment_suffix, reason, granted_by, granted_at, expires_at, created_at ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)").
		WithArgs("user-1", "tenant-alpha", "cap-1", "", "need to deploy", "grantor-1", anyID(), anyID(), anyID()).
		WillReturnResult(sqlmock.NewResult(0, 1))

	err := r.GrantTemporaryPermission(context.Background(), "tenant-alpha", "user-1", "cap-1", "grantor-1", "need to deploy", nil, 8)
	if err != nil {
		t.Fatalf("GrantTemporaryPermission: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestGrantTemporaryPermissionNormalisesNilEnv(t *testing.T) {
	r, mock := newMock(t)

	mock.ExpectExec("INSERT INTO temporary_permissions ( user_id, tenant_id, capability_id, environment_suffix, reason, granted_by, granted_at, expires_at, created_at ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)").
		WithArgs("user-1", "tenant-alpha", "cap-1", "staging", "need to deploy", "grantor-1", anyID(), anyID(), anyID()).
		WillReturnResult(sqlmock.NewResult(0, 1))

	env := "staging"
	err := r.GrantTemporaryPermission(context.Background(), "tenant-alpha", "user-1", "cap-1", "grantor-1", "need to deploy", &env, 8)
	if err != nil {
		t.Fatalf("GrantTemporaryPermission: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestGetActiveTemporaryPermissionsExcludesRevoked(t *testing.T) {
	r, mock := newMock(t)
	now := time.Now().UTC()

	mock.ExpectQuery("SELECT "+wantTemporaryPermissionColumns+" FROM temporary_permissions WHERE user_id=$1 AND tenant_id=$2 AND expires_at > NOW() AND revoked_at IS NULL").
		WithArgs("user-1", "tenant-alpha").
		WillReturnRows(sqlmock.NewRows(tmpCols()).AddRow(
			"tp-1", "tenant-alpha", "user-1", "cap-1", "", "need to deploy", "grantor-1", now, now, nil, now))

	items, err := r.GetActiveTemporaryPermissions(context.Background(), "tenant-alpha", "user-1")
	if err != nil {
		t.Fatalf("GetActiveTemporaryPermissions: %v", err)
	}
	if len(items) != 1 || items[0].ID != "tp-1" {
		t.Fatalf("items=%v", items)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

// TestRevokeTemporaryPermissionByIDBindsTenant pins both the tenant predicate
// and the idempotent revocation marker.
func TestRevokeTemporaryPermissionByIDBindsTenant(t *testing.T) {
	r, mock := newMock(t)

	mock.ExpectExec("UPDATE temporary_permissions SET revoked_at=NOW() WHERE id=$1 AND tenant_id=$2 AND revoked_at IS NULL").
		WithArgs("tp-1", "tenant-alpha").
		WillReturnResult(sqlmock.NewResult(0, 1))

	if err := r.RevokeTemporaryPermissionByID(context.Background(), "tenant-alpha", "tp-1"); err != nil {
		t.Fatalf("RevokeTemporaryPermissionByID: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestGetTemporaryPermissionByID(t *testing.T) {
	r, mock := newMock(t)
	now := time.Now().UTC()

	mock.ExpectQuery("SELECT "+wantTemporaryPermissionColumns+" FROM temporary_permissions WHERE id=$1 AND tenant_id=$2").
		WithArgs("tp-1", "tenant-alpha").
		WillReturnRows(sqlmock.NewRows(tmpCols()).AddRow(
			"tp-1", "tenant-alpha", "user-1", "cap-1", "", "need to deploy", "grantor-1", now, now, nil, now))

	perm, err := r.GetTemporaryPermissionByID(context.Background(), "tenant-alpha", "tp-1")
	if err != nil {
		t.Fatalf("GetTemporaryPermissionByID: %v", err)
	}
	if perm.UserID != "user-1" {
		t.Errorf("unexpected row: %+v", perm)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestGetTemporaryPermissionByIDMissingIsNotFound(t *testing.T) {
	r, mock := newMock(t)

	mock.ExpectQuery("SELECT "+wantTemporaryPermissionColumns+" FROM temporary_permissions WHERE id=$1 AND tenant_id=$2").
		WithArgs("missing", "tenant-alpha").
		WillReturnRows(sqlmock.NewRows(tmpCols()))

	_, err := r.GetTemporaryPermissionByID(context.Background(), "tenant-alpha", "missing")
	if !errors.Is(err, sentinel.NotFound) {
		t.Fatalf("want sentinel.NotFound, got %v", err)
	}
}

func TestGetActiveTempExpiryExcludesRevoked(t *testing.T) {
	r, mock := newMock(t)
	exp := time.Now().UTC().Add(3 * time.Hour)

	mock.ExpectQuery("SELECT MIN(expires_at) FROM temporary_permissions WHERE tenant_id=$1 AND capability_id=$2 AND user_id=$3 AND expires_at > NOW() AND revoked_at IS NULL").
		WithArgs("tenant-alpha", "cap-1", "user-1").
		WillReturnRows(sqlmock.NewRows([]string{"min"}).AddRow(exp))

	got, err := r.GetActiveTempExpiry(context.Background(), "tenant-alpha", "cap-1", "user-1")
	if err != nil {
		t.Fatalf("GetActiveTempExpiry: %v", err)
	}
	if got == nil || !got.Equal(exp) {
		t.Fatalf("got=%v", got)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestGetActiveTempExpiryNoneIsNil(t *testing.T) {
	r, mock := newMock(t)

	mock.ExpectQuery("SELECT MIN(expires_at) FROM temporary_permissions WHERE tenant_id=$1 AND capability_id=$2 AND user_id=$3 AND expires_at > NOW() AND revoked_at IS NULL").
		WithArgs("tenant-alpha", "cap-1", "user-1").
		WillReturnRows(sqlmock.NewRows([]string{"min"}).AddRow(nil))

	got, err := r.GetActiveTempExpiry(context.Background(), "tenant-alpha", "cap-1", "user-1")
	if err != nil {
		t.Fatalf("GetActiveTempExpiry: %v", err)
	}
	if got != nil {
		t.Fatalf("got=%v, want nil", got)
	}
}

func TestCleanupExpiredTemporaryPermissions(t *testing.T) {
	r, mock := newMock(t)

	mock.ExpectExec("UPDATE temporary_permissions SET revoked_at=NOW() WHERE tenant_id=$1 AND expires_at < NOW() AND revoked_at IS NULL").
		WithArgs("tenant-alpha").
		WillReturnResult(sqlmock.NewResult(0, 3))

	n, err := r.CleanupExpiredTemporaryPermissions(context.Background(), "tenant-alpha")
	if err != nil {
		t.Fatalf("Cleanup: %v", err)
	}
	if n != 3 {
		t.Fatalf("n=%d, want 3", n)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestCreatePermissionRequestPersistsDurationAndEnv(t *testing.T) {
	r, mock := newMock(t)
	d := 12

	mock.ExpectExec("INSERT INTO permission_requests ( tenant_id, user_id, capability_id, reason, status, duration_hours, environment_suffix, created_at, updated_at ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)").
		WithArgs("tenant-alpha", "user-1", "cap-1", "need deploy", "pending", 12, "", anyID(), anyID()).
		WillReturnResult(sqlmock.NewResult(0, 1))

	err := r.CreatePermissionRequest(context.Background(), "tenant-alpha", "user-1", "cap-1", "need deploy", &d, nil)
	if err != nil {
		t.Fatalf("CreatePermissionRequest: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestCreatePermissionRequestAllowsNullDuration(t *testing.T) {
	r, mock := newMock(t)

	mock.ExpectExec("INSERT INTO permission_requests ( tenant_id, user_id, capability_id, reason, status, duration_hours, environment_suffix, created_at, updated_at ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)").
		WithArgs("tenant-alpha", "user-1", "cap-1", "need deploy", "pending", nil, "prod", anyID(), anyID()).
		WillReturnResult(sqlmock.NewResult(0, 1))

	env := "prod"
	err := r.CreatePermissionRequest(context.Background(), "tenant-alpha", "user-1", "cap-1", "need deploy", nil, &env)
	if err != nil {
		t.Fatalf("CreatePermissionRequest: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestGetPermissionRequestByID(t *testing.T) {
	r, mock := newMock(t)
	now := time.Now().UTC()

	mock.ExpectQuery("SELECT "+wantPermissionRequestColumns+" FROM permission_requests WHERE id=$1 AND tenant_id=$2").
		WithArgs("pr-1", "tenant-alpha").
		WillReturnRows(sqlmock.NewRows(reqCols()).AddRow(
			"pr-1", "tenant-alpha", "user-1", "cap-1", "pending", "need deploy",
			nil, nil, nil, nil, "", now, now))

	pr, err := r.GetPermissionRequestByID(context.Background(), "tenant-alpha", "pr-1")
	if err != nil {
		t.Fatalf("GetPermissionRequestByID: %v", err)
	}
	if pr.Status != "pending" {
		t.Errorf("unexpected row: %+v", pr)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestGetPermissionRequestByIDMissingIsNotFound(t *testing.T) {
	r, mock := newMock(t)

	mock.ExpectQuery("SELECT "+wantPermissionRequestColumns+" FROM permission_requests WHERE id=$1 AND tenant_id=$2").
		WithArgs("missing", "tenant-alpha").
		WillReturnRows(sqlmock.NewRows(reqCols()))

	_, err := r.GetPermissionRequestByID(context.Background(), "tenant-alpha", "missing")
	if !errors.Is(err, sentinel.NotFound) {
		t.Fatalf("want sentinel.NotFound, got %v", err)
	}
}

func TestGetUserPermissionRequestsBindsTenant(t *testing.T) {
	r, mock := newMock(t)
	now := time.Now().UTC()

	mock.ExpectQuery("SELECT "+wantPermissionRequestColumns+" FROM permission_requests WHERE tenant_id=$1 AND user_id=$2 ORDER BY created_at DESC").
		WithArgs("tenant-alpha", "user-1").
		WillReturnRows(sqlmock.NewRows(reqCols()).AddRow(
			"pr-1", "tenant-alpha", "user-1", "cap-1", "pending", "need deploy",
			nil, nil, nil, nil, "", now, now))

	items, err := r.GetUserPermissionRequests(context.Background(), "tenant-alpha", "user-1")
	if err != nil {
		t.Fatalf("GetUserPermissionRequests: %v", err)
	}
	if len(items) != 1 {
		t.Fatalf("len=%d, want 1", len(items))
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestApprovePermissionRequestBindsTenant(t *testing.T) {
	r, mock := newMock(t)

	mock.ExpectExec("UPDATE permission_requests SET status='approved', approver_id=$1, updated_at=NOW() WHERE id=$2 AND tenant_id=$3").
		WithArgs("approver-1", "pr-1", "tenant-alpha").
		WillReturnResult(sqlmock.NewResult(0, 1))

	if err := r.ApprovePermissionRequest(context.Background(), "tenant-alpha", "pr-1", "approver-1"); err != nil {
		t.Fatalf("ApprovePermissionRequest: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestRejectPermissionRequestWithReasonBindsTenant(t *testing.T) {
	r, mock := newMock(t)
	reason := "not justified"

	mock.ExpectExec("UPDATE permission_requests SET status='rejected', rejected_by=$1, rejected_reason=$2, updated_at=NOW() WHERE id=$3 AND tenant_id=$4").
		WithArgs("approver-1", "not justified", "pr-1", "tenant-alpha").
		WillReturnResult(sqlmock.NewResult(0, 1))

	err := r.RejectPermissionRequest(context.Background(), "tenant-alpha", "pr-1", "approver-1", &reason)
	if err != nil {
		t.Fatalf("RejectPermissionRequest: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestRejectPermissionRequestWithoutReasonBindsTenant(t *testing.T) {
	r, mock := newMock(t)

	mock.ExpectExec("UPDATE permission_requests SET status='rejected', rejected_by=$1, updated_at=NOW() WHERE id=$2 AND tenant_id=$3").
		WithArgs("approver-1", "pr-1", "tenant-alpha").
		WillReturnResult(sqlmock.NewResult(0, 1))

	if err := r.RejectPermissionRequest(context.Background(), "tenant-alpha", "pr-1", "approver-1", nil); err != nil {
		t.Fatalf("RejectPermissionRequest: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestCheckPermissionViaTemporaryPermission(t *testing.T) {
	r, mock := newMock(t)

	mock.ExpectQuery("SELECT COUNT(*) FROM temporary_permissions WHERE tenant_id=$1 AND user_id=$2 AND capability_id=$3 AND expires_at > NOW() AND revoked_at IS NULL").
		WithArgs("tenant-alpha", "user-1", "cap-1").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(1))

	allowed, via, err := r.CheckPermission(context.Background(), "tenant-alpha", "cap-1", "user-1", []string{"admin"})
	if err != nil {
		t.Fatalf("CheckPermission: %v", err)
	}
	if !allowed || via != "active temporary permission" {
		t.Fatalf("allowed=%v via=%q", allowed, via)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestCheckPermissionViaRoleGrant(t *testing.T) {
	r, mock := newMock(t)

	mock.ExpectQuery("SELECT COUNT(*) FROM temporary_permissions WHERE tenant_id=$1 AND user_id=$2 AND capability_id=$3 AND expires_at > NOW() AND revoked_at IS NULL").
		WithArgs("tenant-alpha", "user-1", "cap-1").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(0))
	mock.ExpectQuery("SELECT COUNT(*) FROM capability_role_mappings WHERE tenant_id=$1 AND capability_id=$2 AND role_name IN ($3, $4)").
		WithArgs("tenant-alpha", "cap-1", "admin", "ops").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(1))

	allowed, via, err := r.CheckPermission(context.Background(), "tenant-alpha", "cap-1", "user-1", []string{"admin", "ops"})
	if err != nil {
		t.Fatalf("CheckPermission: %v", err)
	}
	if !allowed || via != "role-based grant" {
		t.Fatalf("allowed=%v via=%q", allowed, via)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestCheckPermissionViaDirectUserGrant(t *testing.T) {
	r, mock := newMock(t)

	mock.ExpectQuery("SELECT COUNT(*) FROM temporary_permissions WHERE tenant_id=$1 AND user_id=$2 AND capability_id=$3 AND expires_at > NOW() AND revoked_at IS NULL").
		WithArgs("tenant-alpha", "user-1", "cap-1").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(0))
	mock.ExpectQuery("SELECT COUNT(*) FROM capability_role_mappings WHERE tenant_id=$1 AND capability_id=$2 AND role_name IN ($3)").
		WithArgs("tenant-alpha", "cap-1", "admin").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(0))
	mock.ExpectQuery("SELECT COUNT(*) FROM capability_user_mappings WHERE tenant_id=$1 AND capability_id=$2 AND user_id=$3 AND (expires_at IS NULL OR expires_at > NOW())").
		WithArgs("tenant-alpha", "cap-1", "user-1").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(1))

	allowed, via, err := r.CheckPermission(context.Background(), "tenant-alpha", "cap-1", "user-1", []string{"admin"})
	if err != nil {
		t.Fatalf("CheckPermission: %v", err)
	}
	if !allowed || via != "direct user grant" {
		t.Fatalf("allowed=%v via=%q", allowed, via)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestCheckPermissionDeniedWhenNoGrantExists(t *testing.T) {
	r, mock := newMock(t)

	mock.ExpectQuery("SELECT COUNT(*) FROM temporary_permissions WHERE tenant_id=$1 AND user_id=$2 AND capability_id=$3 AND expires_at > NOW() AND revoked_at IS NULL").
		WithArgs("tenant-alpha", "user-1", "cap-1").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(0))
	mock.ExpectQuery("SELECT COUNT(*) FROM capability_user_mappings WHERE tenant_id=$1 AND capability_id=$2 AND user_id=$3 AND (expires_at IS NULL OR expires_at > NOW())").
		WithArgs("tenant-alpha", "cap-1", "user-1").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(0))

	allowed, via, err := r.CheckPermission(context.Background(), "tenant-alpha", "cap-1", "user-1", nil)
	if err != nil {
		t.Fatalf("CheckPermission: %v", err)
	}
	if allowed || via != "no permission found" {
		t.Fatalf("allowed=%v via=%q", allowed, via)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

// TestListAuditLogsReturnsTypedRows pins the fix for the method that could
// never return a row: SelectContext into []map[string]interface{} answers
// "non-struct dest type map with >1 columns", so every audit read claimed
// success with an empty list.
func TestListAuditLogsReturnsTypedRows(t *testing.T) {
	r, mock := newMock(t)
	now := time.Now().UTC()

	mock.ExpectQuery("SELECT "+wantCapabilityAuditLogColumns+" FROM capability_audit_logs WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3").
		WithArgs("tenant-alpha", 50, 0).
		WillReturnRows(sqlmock.NewRows(auditCols()).AddRow(
			"log-1", "tenant-alpha", "grant", "grantor-1", "capability", "cap-1", "{}", now))

	items, err := r.ListAuditLogs(context.Background(), "tenant-alpha", &models.AuditLogQuery{})
	if err != nil {
		t.Fatalf("ListAuditLogs: %v", err)
	}
	if len(items) != 1 || items[0].Action != "grant" {
		t.Fatalf("items=%+v", items)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

// TestListAuditLogsFiltersBindAsParameters pins that the capability filter maps
// onto target_id and that limit/offset are bound rather than interpolated.
func TestListAuditLogsFiltersBindAsParameters(t *testing.T) {
	r, mock := newMock(t)
	limit, offset := 5, 10

	mock.ExpectQuery("SELECT "+wantCapabilityAuditLogColumns+" FROM capability_audit_logs WHERE tenant_id=$1 AND target_id=$2 AND target_id=$3 AND action=$4 ORDER BY created_at DESC LIMIT $5 OFFSET $6").
		WithArgs("tenant-alpha", "cap-1", "cap-1", "grant", 5, 10).
		WillReturnRows(sqlmock.NewRows(auditCols()))

	items, err := r.ListAuditLogs(context.Background(), "tenant-alpha", &models.AuditLogQuery{
		CapabilityID: strPtr("cap-1"),
		TargetID:     "cap-1",
		Action:       strPtr("grant"),
		Limit:        &limit,
		Offset:       &offset,
	})
	if err != nil {
		t.Fatalf("ListAuditLogs: %v", err)
	}
	if len(items) != 0 {
		t.Fatalf("len=%d, want 0", len(items))
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestInsertAuditLogTargetsTheCapabilityAuditTable(t *testing.T) {
	r, mock := newMock(t)

	mock.ExpectExec("INSERT INTO capability_audit_logs ( tenant_id, action, user_id, target_type, target_id, details, created_at ) VALUES ($1,$2,$3,$4,$5,$6,$7)").
		WithArgs("tenant-alpha", "grant", "grantor-1", "capability", "cap-1", "{}", anyID()).
		WillReturnResult(sqlmock.NewResult(0, 1))

	err := r.InsertAuditLog(context.Background(), "tenant-alpha", "grant", "grantor-1", "capability", "cap-1", "{}")
	if err != nil {
		t.Fatalf("InsertAuditLog: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func strPtr(s string) *string { return &s }
