package repository

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"

	"orion/go-common/pkg/sentinel"
	"orion/platform-svc-go/internal/audit/models"
)

// --- source-level guards ---

const sourceFile = "repository.go"

// stripComments removes // line comments so a comment that merely mentions
// "SELECT" cannot satisfy the SQL requirement below.
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

// receiverMethods returns each "func (r *Repository) Name(...) { ... }" block.
//
// A block ends at the next top-level func, minus that next method's
// documentation comment: without the trim a comment belonging to the following
// method could leak into this one and satisfy the assertion for the wrong code.
func receiverMethods(src string) map[string]string {
	re := regexp.MustCompile(`(?m)^func \(r \*Repository\) (\w+)\(`)
	locs := re.FindAllStringSubmatchIndex(src, -1)
	out := map[string]string{}
	for i, loc := range locs {
		name := src[loc[2]:loc[3]]
		start := loc[1]
		end := len(src)
		if i+1 < len(locs) {
			end = locs[i+1][0]
		}
		lines := strings.Split(src[start:end], "\n")
		// gofmt puts the closing brace on its own line, so the first non-blank,
		// non-comment line from the end is that brace.
		for len(lines) > 0 {
			t := strings.TrimSpace(lines[len(lines)-1])
			if t == "" || strings.HasPrefix(t, "//") {
				lines = lines[:len(lines)-1]
				continue
			}
			break
		}
		out[name] = strings.Join(lines, "\n")
	}
	return out
}

// TestRepositoryMethodsAreImplemented guards against a method whose entire body
// is a zero-value return.
//
// CoverageStats used to be exactly that: it sat on RepositoryInterface and was
// never called by the service, which computes coverage from ComplianceReport,
// so it answered models.AuditCoverageStats{} for a real endpoint. A named
// method promising coverage counts that returns none is an advertisement for
// work that is not done, and a reader who trusts the interface believes the
// data exists. Every receiver method must therefore issue a real query.
func TestRepositoryMethodsAreImplemented(t *testing.T) {
	src, err := os.ReadFile(sourceFile)
	if err != nil {
		t.Fatalf("read %s: %v", sourceFile, err)
	}
	methods := receiverMethods(stripComments(string(src)))
	if len(methods) == 0 {
		t.Fatal("no (r *Repository) methods found -- the guard is matching nothing")
	}
	for name, block := range methods {
		if !regexp.MustCompile(`\b(SELECT|INSERT|UPDATE|DELETE)\b`).MatchString(block) {
			t.Errorf("%s issues no query and therefore cannot be doing real work:\n%s", name, block)
		}
	}
}

// TestRepositoryDoesNotRedeclareServiceLevelCoverage pins the CoverageStats
// deletion: the service owns coverage aggregation because it must walk every
// framework's compliance report, so a repository copy would be a second,
// diverging implementation of the same number.
func TestRepositoryDoesNotRedeclareServiceLevelCoverage(t *testing.T) {
	for _, f := range []string{sourceFile, "repository_interface.go"} {
		src, err := os.ReadFile(f)
		if err != nil {
			t.Fatalf("read %s: %v", f, err)
		}
		if strings.Contains(string(src), "CoverageStats") {
			t.Errorf("%s re-declares CoverageStats, which is service-level aggregation", f)
		}
	}
}

// TestAuditLogsIsNotWildcarded guards the old SELECT * in GetByID, List,
// Export and GetLatest.
//
// go-common opens the pool with sqlx.Open and never calls Unsafe, so sqlx scans
// in safe mode and a wildcard select dies on the first row the moment a
// migration adds a column the model does not map --
// "missing destination name <col>". That error is not sql.ErrNoRows, so it
// walks repository -> service -> handler and the endpoint answers 500 instead
// of data. Migration 013 alters audit_logs with twelve pipeline columns and
// migration 572 adds created_by/updated_by, and none of them are mapped, so
// every audit-log read was a 500.
func TestAuditLogsIsNotWildcarded(t *testing.T) {
	src, err := os.ReadFile(sourceFile)
	if err != nil {
		t.Fatalf("read %s: %v", sourceFile, err)
	}
	body := stripComments(string(src))
	if strings.Contains(body, "SELECT * FROM audit_logs") {
		t.Error("audit_logs is still selected with * instead of a named column list")
	}
}

// auditLogColumns is the contract between models.AuditLog and the audit_logs
// table; it must stay in sync with both.
var auditLogModelColumns = []string{
	"id", "tenant_id", "user_id", "action", "resource_type", "resource_id",
	"request_method", "request_path", "request_body", "response_code",
	"response_body", "ip_address", "user_agent", "prev_hash", "hash",
	"created_at",
}

func TestAuditLogColumnsExistInMigration(t *testing.T) {
	path, err := filepath.Abs("../../../migrations/013_create_audit_tables.sql")
	if err != nil {
		t.Fatal(err)
	}
	src, err := os.ReadFile(path)
	if err != nil {
		t.Skipf("migration not present: %v", err)
	}
	text := string(src)
	for _, col := range auditLogModelColumns {
		if !strings.Contains(text, col) {
			t.Errorf("migration %s does not define %s, but models.AuditLog maps it", filepath.Base(path), col)
		}
	}
}

// --- behaviour: the named column list is what reaches the driver ---

func norm(s string) string {
	return strings.TrimSpace(regexp.MustCompile(`\s+`).ReplaceAllString(s, " "))
}

// newMock matches expected SQL on exact whitespace-normalised text.
//
// go-sqlmock's default QueryMatcherRegexp treats a $ in the expected text as an
// end-of-string anchor, so an expectation containing $1 could never match and a
// test would pass vacuously. Every expectation below pins placeholder numbers,
// so exact matching is required for the tests to mean anything.
func newMock(t *testing.T) (*Repository, sqlmock.Sqlmock) {
	t.Helper()
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

// wantColumns is the pinned column contract, written independently of the
// production constant so a mutation that empties auditLogColumns cannot make
// the expectation follow it.
const wantColumns = "id, tenant_id, user_id, action, resource_type, resource_id, request_method, request_path, request_body, response_code, response_body, ip_address, user_agent, prev_hash, hash, created_at"

func TestColumnConstantsMatchThePinnedExpectation(t *testing.T) {
	if auditLogColumns != wantColumns {
		t.Errorf("auditLogColumns drifted from the pinned expectation\n  got:      %s\n  expected: %s", auditLogColumns, wantColumns)
	}
	if auditLogColumns == "*" || strings.Contains(auditLogColumns, "*") {
		t.Error("auditLogColumns must name every column; a wildcard is a 500 in safe mode")
	}
}

func logColumns() []string { return auditLogModelColumns }

func TestGetByIDSelectsTheMappedColumnsOnly(t *testing.T) {
	r, mock := newMock(t)
	now := time.Now().UTC()

	mock.ExpectQuery("SELECT "+wantColumns+" FROM audit_logs WHERE id=$1 AND tenant_id=$2").
		WithArgs("log-1", "tenant-alpha").
		WillReturnRows(sqlmock.NewRows(logColumns()).AddRow(
			"log-1", "tenant-alpha", "user-1", "login", "session", "sess-1",
			"POST", "/auth", "{}", 200, "{}", "10.0.0.1", "curl", "", "hash-1", now))

	m, err := r.GetByID(context.Background(), "tenant-alpha", "log-1")
	if err != nil {
		t.Fatalf("GetByID: %v", err)
	}
	if m.ID != "log-1" || m.Action != "login" || m.ResponseCode != 200 {
		t.Errorf("unexpected row: %+v", m)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

// TestGetByIDMissingLogIsNotFound proves the 500 -> 404 fix. The handler answers
// 404 only for errors.Is(err, sentinel.NotFound); the driver's sql.ErrNoRows
// passed straight through would have been a 500 for every missing id.
func TestGetByIDMissingLogIsNotFound(t *testing.T) {
	r, mock := newMock(t)

	mock.ExpectQuery("SELECT "+wantColumns+" FROM audit_logs WHERE id=$1 AND tenant_id=$2").
		WithArgs("missing", "tenant-alpha").
		WillReturnRows(sqlmock.NewRows(logColumns()))

	_, err := r.GetByID(context.Background(), "tenant-alpha", "missing")
	if !errors.Is(err, sentinel.NotFound) {
		t.Fatalf("want sentinel.NotFound, got %v", err)
	}
}

func TestGetLatestMissingLogIsNotFound(t *testing.T) {
	r, mock := newMock(t)

	mock.ExpectQuery("SELECT " + wantColumns + " FROM audit_logs WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT 1").
		WithArgs("tenant-empty").
		WillReturnRows(sqlmock.NewRows(logColumns()))

	_, err := r.GetLatest(context.Background(), "tenant-empty")
	if !errors.Is(err, sentinel.NotFound) {
		t.Fatalf("want sentinel.NotFound, got %v", err)
	}
}

func TestListUsesTheNamedColumnsAndBindsTenant(t *testing.T) {
	r, mock := newMock(t)
	now := time.Now().UTC()

	mock.ExpectQuery("SELECT COUNT(*) FROM audit_logs WHERE tenant_id=$1").
		WithArgs("tenant-alpha").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(1))
	mock.ExpectQuery("SELECT "+wantColumns+" FROM audit_logs WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3").
		WithArgs("tenant-alpha", 20, 0).
		WillReturnRows(sqlmock.NewRows(logColumns()).AddRow(
			"log-1", "tenant-alpha", "user-1", "login", "session", "sess-1",
			"POST", "/auth", "{}", 200, "{}", "10.0.0.1", "curl", "", "hash-1", now))

	logs, total, err := r.List(context.Background(), "tenant-alpha", models.AuditLogQuery{})
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if total != 1 || len(logs) != 1 {
		t.Fatalf("total=%d len=%d, want 1/1", total, len(logs))
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

// TestListFilterPredicateBoundsTenant pins the where-clause construction: the
// tenant clause must come first so every later $n is shifted, and a caller
// cannot add a filter without the tenant filter already being present.
func TestListFilterPredicateBoundsTenant(t *testing.T) {
	r, mock := newMock(t)
	now := time.Now().UTC()

	mock.ExpectQuery("SELECT COUNT(*) FROM audit_logs WHERE tenant_id=$1 AND user_id=$2").
		WithArgs("tenant-alpha", "user-1").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(0))
	mock.ExpectQuery("SELECT "+wantColumns+" FROM audit_logs WHERE tenant_id=$1 AND user_id=$2 ORDER BY created_at DESC LIMIT $3 OFFSET $4").
		WithArgs("tenant-alpha", "user-1", 5, 0).
		WillReturnRows(sqlmock.NewRows(logColumns()).AddRow(
			"log-1", "tenant-alpha", "user-1", "login", "session", "sess-1",
			"POST", "/auth", "{}", 200, "{}", "10.0.0.1", "curl", "", "hash-1", now))

	logs, total, err := r.List(context.Background(), "tenant-alpha", models.AuditLogQuery{
		UserID: "user-1", Limit: 5, Page: 1,
	})
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if total != 0 || len(logs) != 1 {
		t.Fatalf("total=%d len=%d", total, len(logs))
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestExportBoundsTenant(t *testing.T) {
	r, mock := newMock(t)

	mock.ExpectQuery("SELECT " + wantColumns + " FROM audit_logs WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT 10000").
		WithArgs("tenant-alpha").
		WillReturnRows(sqlmock.NewRows(logColumns()))

	logs, err := r.Export(context.Background(), "tenant-alpha", models.AuditLogQuery{})
	if err != nil {
		t.Fatalf("Export: %v", err)
	}
	if len(logs) != 0 {
		t.Fatalf("len=%d, want 0", len(logs))
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestVerifyChainReportsTheFirstBreak(t *testing.T) {
	r, mock := newMock(t)
	now := time.Now().UTC()

	mock.ExpectQuery("SELECT id, hash, prev_hash, created_at FROM audit_logs WHERE tenant_id=$1 ORDER BY created_at ASC").
		WithArgs("tenant-alpha").
		WillReturnRows(sqlmock.NewRows([]string{"id", "hash", "prev_hash", "created_at"}).
			AddRow("l1", "h1", "", now).
			AddRow("l2", "h2", "h1", now).
			AddRow("l3", "h3", "WRONG", now))

	verified, valid, err := r.VerifyChain(context.Background(), "tenant-alpha")
	if err != nil {
		t.Fatalf("VerifyChain: %v", err)
	}
	if valid || verified != 2 {
		t.Fatalf("verified=%d valid=%v, want 2/false", verified, valid)
	}
}
