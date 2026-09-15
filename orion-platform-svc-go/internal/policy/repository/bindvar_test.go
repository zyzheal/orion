package repository

import (
	"context"
	"fmt"
	"os"
	"regexp"
	"sort"
	"strings"
	"testing"
	"time"

	"orion/platform-svc-go/internal/policy/models"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"
)

// A NamedExecContext call compiles its named arguments to $1..$N in the order
// they appear in the query. A literal $N left next to them is not renumbered,
// so this shape
//
//	UPDATE policy_definitions SET name=:name WHERE id=$1 AND tenant_id=$2
//
// arrives at the driver as
//
//	UPDATE policy_definitions SET name=$1 WHERE id=$1 AND tenant_id=$2
//
// id and tenant_id are bound to the *new column value* instead of to the row
// the caller named, the map or struct entries for them are ignored, and the
// WHERE clause matches nothing. Unlike chatops, this repository returns only
// err from a write and never reads sql.Result, so the zero-row update came
// back as nil: PUT /policies/:id updated nothing, re-read the untouched row,
// and answered HTTP 200 with the old values. The expectations below are the
// compiled statements sqlx actually sends, and they assert that id and
// tenant_id occupy their own placeholder slots at the end of the argument
// list.

func mockDB(t *testing.T) (*sqlx.DB, sqlmock.Sqlmock) {
	t.Helper()
	// The repository writes its UPDATE statements across two source lines with
	// tab indentation. Comparing raw text would make every expectation depend on
	// gofmt output rather than on the statement, so compare field-collapsed SQL.
	raw, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherFunc(func(expected, actual string) error {
		if normSQL(expected) != normSQL(actual) {
			return fmt.Errorf("sql mismatch: want %q got %q", expected, actual)
		}
		return nil
	})))
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	t.Cleanup(func() { _ = raw.Close() })
	return sqlx.NewDb(raw, "postgres"), mock
}

func normSQL(s string) string {
	return strings.Join(strings.Fields(s), " ")
}

func TestUpdatePolicy_BindsIdentityInItsOwnSlots(t *testing.T) {
	db, mock := mockDB(t)
	mock.ExpectExec(`UPDATE policy_definitions SET name=$1, description=$2, rego=$3, enabled=$4, updated_at=$5
			WHERE id=$6 AND tenant_id=$7`).
		WithArgs("no prod deploys", "denies prod deploys", `package p`, false, sqlmock.AnyArg(), "pol-1", "t-1").
		WillReturnResult(sqlmock.NewResult(0, 1))

	name := "no prod deploys"
	desc := "denies prod deploys"
	rego := "package p"
	err := NewRepository(db).UpdatePolicy(context.Background(), "t-1", "pol-1", &models.Policy{
		ID: "pol-1", TenantID: "t-1", Name: name, Description: desc, Rego: rego,
	})
	if err != nil {
		t.Fatalf("UpdatePolicy: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations not met: %v", err)
	}
}

// TogglePolicy reads the row first, so a missing id surfaces there rather than
// as a silent no-op. The UPDATE still has to bind the identity in its own
// slots: the SELECT argument order proves the id is the first positional
// parameter, and the UPDATE's $3/$4 must be the same values.
func TestTogglePolicy_BindsIdentityInItsOwnSlots(t *testing.T) {
	db, mock := mockDB(t)
	now := time.Now().UTC()
	mock.ExpectQuery(`SELECT * FROM policy_definitions WHERE id=$1 AND tenant_id=$2`).
		WithArgs("pol-1", "t-1").
		WillReturnRows(sqlmock.NewRows(policyColumns).
			AddRow("pol-1", "t-1", "no prod deploys", "denies prod deploys", `package p`, true, now, now))
	mock.ExpectExec(`UPDATE policy_definitions SET enabled=$1, updated_at=$2 WHERE id=$3 AND tenant_id=$4`).
		WithArgs(false, sqlmock.AnyArg(), "pol-1", "t-1").
		WillReturnResult(sqlmock.NewResult(0, 1))

	m, err := NewRepository(db).TogglePolicy(context.Background(), "t-1", "pol-1", false)
	if err != nil {
		t.Fatalf("TogglePolicy: %v", err)
	}
	if m == nil || m.ID != "pol-1" || m.Enabled {
		t.Fatalf("got %+v", m)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations not met: %v", err)
	}
}

// The repository used to accept only status and policy_id. The handler binds
// status, policy_id, requested_by and category from the query string and the
// service forwards all four, so every one of them must reach the WHERE clause.
// Before the fix ?requestedBy= and ?category= were read into the request struct
// and then dropped, and GET /policies/exemptions returned the tenant's whole
// exemption list to a caller who had asked for a slice of it.

func TestListExemptions_WithNoFilterScopesOnlyByTenant(t *testing.T) {
	db, mock := mockDB(t)
	mock.ExpectQuery(`SELECT * FROM policy_exemptions WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`).
		WithArgs("t-1", 50, 0).
		WillReturnRows(sqlmock.NewRows(exemptionColumns))

	items, err := NewRepository(db).ListExemptions(context.Background(), "t-1",
		"", "", "", "", 0, 0)
	if err != nil {
		t.Fatalf("ListExemptions: %v", err)
	}
	if len(items) != 0 {
		t.Fatalf("no exemptions expected, got %+v", items)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations not met: %v", err)
	}
}

func TestListExemptions_AllFourFiltersEachOwnAPlaceholder(t *testing.T) {
	db, mock := mockDB(t)
	now := time.Now().UTC()
	mock.ExpectQuery(`SELECT * FROM policy_exemptions WHERE tenant_id=$1 AND policy_id=$2 AND status=$3 AND requested_by=$4 AND category=$5 ORDER BY created_at DESC LIMIT $6 OFFSET $7`).
		WithArgs("t-1", "pol-9", "approved", "u-7", "technical", 5, 10).
		WillReturnRows(sqlmock.NewRows(exemptionColumns).
			AddRow("ex-1", "t-1", "v-1", "pol-9", "run-1", "vendor lock-in",
				"technical", "approved", "u-7", "u-8", "accepted", nil, now, now))

	items, err := NewRepository(db).ListExemptions(context.Background(), "t-1",
		"approved", "pol-9", "u-7", "technical", 5, 10)
	if err != nil {
		t.Fatalf("ListExemptions: %v", err)
	}
	if len(items) != 1 || items[0].ID != "ex-1" || items[0].RequestedBy != "u-7" || items[0].Category != "technical" {
		t.Fatalf("got %+v", items)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations not met: %v", err)
	}
}

func TestListExemptions_CategoryAloneStillFilters(t *testing.T) {
	db, mock := mockDB(t)
	mock.ExpectQuery(`SELECT * FROM policy_exemptions WHERE tenant_id=$1 AND category=$2 ORDER BY created_at DESC LIMIT $3 OFFSET $4`).
		WithArgs("t-1", "business", 50, 0).
		WillReturnRows(sqlmock.NewRows(exemptionColumns))

	items, err := NewRepository(db).ListExemptions(context.Background(), "t-1",
		"", "", "", "business", 50, 0)
	if err != nil {
		t.Fatalf("ListExemptions: %v", err)
	}
	if len(items) != 0 {
		t.Fatalf("no exemptions expected, got %+v", items)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations not met: %v", err)
	}
}

func TestListExemptions_RequestedByAloneStillFilters(t *testing.T) {
	db, mock := mockDB(t)
	mock.ExpectQuery(`SELECT * FROM policy_exemptions WHERE tenant_id=$1 AND requested_by=$2 ORDER BY created_at DESC LIMIT $3 OFFSET $4`).
		WithArgs("t-1", "u-7", 50, 0).
		WillReturnRows(sqlmock.NewRows(exemptionColumns))

	items, err := NewRepository(db).ListExemptions(context.Background(), "t-1",
		"", "", "u-7", "", 50, 0)
	if err != nil {
		t.Fatalf("ListExemptions: %v", err)
	}
	if len(items) != 0 {
		t.Fatalf("no exemptions expected, got %+v", items)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations not met: %v", err)
	}
}

// A filter value is data, never an identifier: the placeholder numbering must
// come from the branch literals, so a hostile value cannot change which column
// is filtered.
func TestListExemptions_AFilterValueCannotInjectAColumn(t *testing.T) {
	db, mock := mockDB(t)
	mock.ExpectQuery(`SELECT * FROM policy_exemptions WHERE tenant_id=$1 AND category=$2 ORDER BY created_at DESC LIMIT $3 OFFSET $4`).
		WithArgs("t-1", "category=$99; DROP TABLE policy_exemptions", 50, 0).
		WillReturnRows(sqlmock.NewRows(exemptionColumns))

	_, err := NewRepository(db).ListExemptions(context.Background(), "t-1",
		"", "", "", "category=$99; DROP TABLE policy_exemptions", 50, 0)
	if err != nil {
		t.Fatalf("ListExemptions: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations not met: %v", err)
	}
}

// --- source-level guard: the mixed-placeholder shape must not come back ---

// TestSource_NoStatementMixesNamedAndPositionalPlaceholders scans every raw
// string literal in the repository. A statement that carries both a :name and
// a $N is exactly the shape that bound the WHERE clause to the SET values.
func TestSource_NoStatementMixesNamedAndPositionalPlaceholders(t *testing.T) {
	src, err := os.ReadFile("repository.go")
	if err != nil {
		t.Fatal(err)
	}
	reRaw := regexp.MustCompile("`([^`]+)`")
	reNamed := regexp.MustCompile(`:[a-z][a-z0-9_]*`)
	rePos := regexp.MustCompile(`\$\d+`)

	mixed := []string{}
	scanned := 0
	for _, m := range reRaw.FindAllStringSubmatch(string(src), -1) {
		if !rePos.MatchString(m[1]) && !reNamed.MatchString(m[1]) {
			continue // not a parameterised statement
		}
		scanned++
		if reNamed.MatchString(m[1]) && rePos.MatchString(m[1]) {
			mixed = append(mixed, m[1])
		}
	}
	if len(mixed) > 0 {
		t.Fatalf("%d statement(s) mix named and positional placeholders:\n%s", len(mixed), mixed[0])
	}
	if scanned < 20 {
		t.Fatalf("detector saw only %d parameterised statements; the pattern is too narrow", scanned)
	}

	// positive control: the detector must flag the shape it guards against.
	fixture := "UPDATE policy_definitions SET name=:name WHERE id=$1 AND tenant_id=$2"
	if !reNamed.MatchString(fixture) || !rePos.MatchString(fixture) {
		t.Fatalf("detector missed the mixed fixture")
	}
}

// TestSource_ListExemptionsThreadsEveryBoundFilter pins the four filter
// columns inside the method that builds the WHERE clause. The previous
// implementation had two of them in the request struct and nowhere in the
// repository, which is why the filters silently did nothing.
func TestSource_ListExemptionsThreadsEveryBoundFilter(t *testing.T) {
	src, err := os.ReadFile("repository.go")
	if err != nil {
		t.Fatal(err)
	}
	body := functionBody(string(src), "func (r *Repository) ListExemptions(")
	if body == "" {
		t.Fatal("ListExemptions not found")
	}
	if !strings.Contains(body, "tenant_id=$1") {
		t.Fatalf("ListExemptions does not scope by tenant: %s", body)
	}
	for _, col := range []string{"policy_id", "status", "requested_by", "category"} {
		if !strings.Contains(body, col+"=$%d") {
			t.Fatalf("ListExemptions does not filter on %s", col)
		}
	}
	// The placeholder is not enough: the column must also be paired with a
	// bound value in the matching position. Each branch adds one column, one
	// argument and one step of the counter, so a branch that forgets next++
	// leaves the next filter pointing at the wrong slot.
	if strings.Count(body, "args = append(args,") != 5 {
		t.Fatalf("expected tenant plus four filter arguments, got %d appends", strings.Count(body, "args = append(args,"))
	}
	if strings.Count(body, "next++") != 4 {
		t.Fatalf("expected one next++ per filter branch, got %d", strings.Count(body, "next++"))
	}
	for _, arg := range []string{"tenantID", "policyID", "status", "requestedBy", "category"} {
		if !strings.Contains(body, "args = append(args, "+arg+")") &&
			!strings.Contains(body, "args := []interface{}{"+arg+"}") {
			t.Fatalf("ListExemptions builds a clause for a column but never binds %s", arg)
		}
	}
}

// TestSource_UncheckedWritesAreTheDocumentedSet pins the record-only
// decision from the round notes. Every id-scoped write in this repository
// returns err and never reads RowsAffected, so a statement that matches zero
// rows reports success. None of them is fixed here: the caller reads the row
// back, so a concurrent delete still surfaces. The assertion is that the set
// is exactly the six methods below, so adding a seventh id-scoped write -- or
// fixing one of these -- has to be a deliberate decision rather than a silent
// drift.
func TestSource_UncheckedWritesAreTheDocumentedSet(t *testing.T) {
	src, err := os.ReadFile("repository.go")
	if err != nil {
		t.Fatal(err)
	}
	documented := map[string]bool{
		"UpdatePolicy": true, "TogglePolicy": true, "DeletePolicy": true,
		"UpdateViolationStatus": true, "UpdateBundle": true, "UpdateExemption": true,
	}
	// The match must cross newlines: UpdatePolicy writes its WHERE clause on the
	// second source line, and a same-line pattern missed that method entirely --
	// the method the bindvar bug was in.
	reFunc := regexp.MustCompile(`(?m)^func \(r \*Repository\) (\w+)\(`)
	reIDScoped := regexp.MustCompile(`(?s)(?:UPDATE|DELETE FROM) policy_[a-z_]+.*?\bid=(\$|:)`)
	// A write is "checked" if it reads sql.Result directly or hands it to a
	// helper that does. One-line fixtures that only call oneRow(res, err) would
	// otherwise count as unchecked, which is how chatops's shape slipped past a
	// first draft of this detector.
	reChecked := regexp.MustCompile(`RowsAffected|oneRow\(`)
	found := map[string]bool{}
	for _, m := range reFunc.FindAllStringSubmatchIndex(string(src), -1) {
		name := string(src)[m[2]:m[3]]
		body := functionBody(string(src), "func (r *Repository) "+name+"(")
		if body == "" || reIDScoped.FindString(body) == "" {
			continue
		}
		if reChecked.MatchString(body) {
			continue
		}
		found[name] = true
	}

	// positive control: the detector must still see the two-line UPDATE shape it
	// missed, and must not count a write that does check RowsAffected.
	fixtureUnchecked := "func (r *Repository) UpdateX(ctx context.Context, tenantID, id string, m *M) error {\n" +
		"_, err := r.db.NamedExecContext(ctx, `UPDATE policy_definitions SET name=:name\n" +
		"\t\t\t WHERE id=:id AND tenant_id=:tenant_id`, m)\n" +
		"return err\n}"
	fixtureChecked := "func (r *Repository) UpdateY(ctx context.Context, tenantID, id string) error {\n" +
		"res, err := r.db.ExecContext(ctx, `UPDATE policy_definitions SET enabled=$1 WHERE id=$2 AND tenant_id=$3`, true, id, tenantID)\n" +
		"return oneRow(res, err)\n}"
	for _, tc := range []struct {
		name, body string
		want       bool
	}{
		{"two-line UPDATE without RowsAffected", functionBody(fixtureUnchecked, "func (r *Repository) UpdateX("), true},
		{"one-line UPDATE with RowsAffected", functionBody(fixtureChecked, "func (r *Repository) UpdateY("), false},
	} {
		got := reIDScoped.FindString(tc.body) != "" && !reChecked.MatchString(tc.body)
		if got != tc.want {
			t.Fatalf("%s: detector said %v, want %v", tc.name, got, tc.want)
		}
	}
	if len(found) != len(documented) {
		t.Fatalf("id-scoped writes without RowsAffected: got %v, the round notes document %v",
			keys(found), keys(documented))
	}
	for name := range found {
		if !documented[name] {
			t.Fatalf("%s is an unchecked id-scoped write that the round notes do not record", name)
		}
	}
}

func keys(set map[string]bool) []string {
	out := []string{}
	for k := range set {
		out = append(out, k)
	}
	sort.Strings(out)
	return out
}

func functionBody(src, start string) string {
	at := strings.Index(src, start)
	if at < 0 {
		return ""
	}
	rest := src[at+len(start):]
	if nl := strings.Index(rest, "\nfunc "); nl >= 0 {
		return rest[:nl]
	}
	return rest
}

var policyColumns = []string{
	"id", "tenant_id", "name", "description", "rego", "enabled", "created_at", "updated_at",
}

var exemptionColumns = []string{
	"id", "tenant_id", "violation_id", "policy_id", "run_id", "reason", "category", "status",
	"requested_by", "reviewed_by", "review_note", "expires_at", "created_at", "updated_at",
}
