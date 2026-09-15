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

	"orion/platform-svc-go/internal/sla/models"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"
)

// Three things were wrong in this repository, all of them on routes that are
// registered on every boot (cmd/server mounts the sla handler unconditionally):
//
//  1. The tracking statements addressed `sla_tracking`, but migration 070
//     creates `sla_trackings` -- and 570, 571 and 572 all add columns, an
//     index and a foreign key to the plural relation. Nothing ever created the
//     singular name, so all nine tracking routes plus /sla/detect and /sla/stats
//     died at the driver with `pq: relation "sla_tracking" does not exist`.
//
//  2. The definition INSERT and the type filter named `definition_type`, but
//     070 declares the column `type` and builds idx_sla_definitions_type on it.
//     No migration ever added `definition_type`, so POST /sla/definitions and
//     GET /sla/definitions?type= died with `column "definition_type" ... does
//     not exist`.
//
//  3. UpdateDefinition stamped `updated_at` onto the caller's map and then ran
//     a fixed `SET updated_at = NOW() WHERE id=$1 AND tenant_id=$2`, which has
//     no named placeholder at all -- sqlx binds zero arguments to a statement
//     with no named args, so the literal $1/$2 in the text went to the driver
//     unbound. The caller's keys were mutated into a map that was never read.
//
// The expectations below are the compiled statements sqlx actually sends. They
// assert the column and relation names verbatim, which is what a runtime test
// against sqlmock cannot catch on its own: sqlmock does not know what 070
// created. cmd/server/migration_sla_tables_test.go pins the other direction.

func mockDB(t *testing.T) (*sqlx.DB, sqlmock.Sqlmock) {
	t.Helper()
	// The repository writes multi-line statements with tab indentation. Comparing
	// raw text would make every expectation depend on gofmt output instead of on
	// the statement, so compare field-collapsed SQL.
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

var definitionColumns = []string{
	"id", "tenant_id", "name", "description", "type", "target_value", "target_unit",
	"business_hours_only", "priority", "category", "escalation_rules", "metadata",
	"status", "created_by", "created_at", "updated_at",
}

var trackingColumns = []string{
	"id", "tenant_id", "sla_definition_id", "entity_type", "entity_id", "status",
	"target_time", "actual_time", "notes", "pause_reason", "started_at",
	"created_at", "updated_at",
}

var breachColumns = []string{
	"id", "tenant_id", "tracking_id", "breach_time", "breach_details", "created_at",
}

func TestCreateDefinition_UsesTheTypeColumn(t *testing.T) {
	db, mock := mockDB(t)
	mock.ExpectExec(`INSERT INTO sla_definitions (id, tenant_id, name, description, type, target_value, target_unit,
		business_hours_only, priority, category, escalation_rules, metadata, status, created_by, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`).
		WithArgs(sqlmock.AnyArg(), "t-1", "premium availability", "gold tier", "availability",
			99.95, "percent", sqlmock.AnyArg(), "P1", "customer", "", "{}", "active", "t-1",
			sqlmock.AnyArg(), sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(1, 1))

	err := NewRepository(db).CreateDefinition(context.Background(), &models.SLADefinition{
		TenantID: "t-1", Name: "premium availability", Description: "gold tier",
		Type: "availability", TargetValue: 99.95, TargetUnit: "percent",
		Priority: "P1", Category: "customer", Metadata: "{}", CreatedBy: "t-1",
	})
	if err != nil {
		t.Fatalf("CreateDefinition: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations not met: %v", err)
	}
}

func TestListDefinitions_TypeFilterBindsTheTypeColumn(t *testing.T) {
	db, mock := mockDB(t)
	mock.ExpectQuery(`SELECT COUNT(*) FROM sla_definitions WHERE tenant_id=$1 AND type=$2`).
		WithArgs("t-1", "availability").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(1))
	mock.ExpectQuery(`SELECT * FROM sla_definitions WHERE tenant_id=$1 AND type=$2 ORDER BY created_at DESC LIMIT $3 OFFSET $4`).
		WithArgs("t-1", "availability", 20, 0).
		WillReturnRows(sqlmock.NewRows(definitionColumns).
			AddRow("def-1", "t-1", "premium availability", "gold tier", "availability",
				99.95, "percent", nil, "P1", "customer", "", "{}", "active", "t-1",
				time.Now().UTC(), time.Now().UTC()))

	items, total, err := NewRepository(db).ListDefinitions(context.Background(), "t-1",
		models.DefinitionListQuery{Type: "availability"})
	if err != nil {
		t.Fatalf("ListDefinitions: %v", err)
	}
	if total != 1 || len(items) != 1 || items[0].Type != "availability" {
		t.Fatalf("got total=%d items=%v", total, items)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations not met: %v", err)
	}
}

// Every key the caller passes must reach its own SET slot, and id/tenant_id must
// stay in the WHERE clause. sqlx renumbers named args in appearance order, so
// the compiled statement below proves the identity fields occupy $6 and $7 --
// the last two -- which is the only arrangement in which the WHERE clause can
// still find the row the caller named.
func TestUpdateDefinition_EveryCallerKeyReachesASetClause(t *testing.T) {
	db, mock := mockDB(t)
	mock.ExpectExec(`UPDATE sla_definitions SET name=$1, status=$2, target_value=$3, type=$4, updated_at=$5
		WHERE id=$6 AND tenant_id=$7`).
		WithArgs("premium availability", "active", 99.95, "availability",
			sqlmock.AnyArg(), "def-1", "t-1").
		WillReturnResult(sqlmock.NewResult(1, 1))

	err := NewRepository(db).UpdateDefinition(context.Background(), "t-1", "def-1", map[string]interface{}{
		"name":         "premium availability",
		"type":         "availability",
		"target_value": 99.95,
		"status":       "active",
	})
	if err != nil {
		t.Fatalf("UpdateDefinition: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations not met: %v", err)
	}
}

// The service builds `updates` only from pointer fields the caller sent, but a
// repository called directly can be handed anything. Only the whitelisted column
// names may reach the statement; everything else is data that was never meant to
// be an identifier.
func TestUpdateDefinition_UnlistedKeysNeverReachSQL(t *testing.T) {
	db, mock := mockDB(t)
	// No expectation is registered. sqlmock errors on an unexpected call, so a
	// nil error here proves the method did not touch the driver at all.
	err := NewRepository(db).UpdateDefinition(context.Background(), "t-1", "def-1", map[string]interface{}{
		"id":        "def-2",
		"tenant_id": "t-999",
		"password":  "hunter2",
	})
	if err != nil {
		t.Fatalf("UpdateDefinition must refuse unlisted keys without running SQL, got %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations not met: %v", err)
	}
}

func TestUpdateDefinition_EmptyMapIsANoOp(t *testing.T) {
	db, mock := mockDB(t)
	err := NewRepository(db).UpdateDefinition(context.Background(), "t-1", "def-1", map[string]interface{}{})
	if err != nil {
		t.Fatalf("UpdateDefinition: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations not met: %v", err)
	}
}

func TestUpdateDefinition_ReturnsTheDriverError(t *testing.T) {
	db, mock := mockDB(t)
	mock.ExpectExec(`UPDATE sla_definitions SET name=$1, updated_at=$2 WHERE id=$3 AND tenant_id=$4`).
		WithArgs("renamed", sqlmock.AnyArg(), "def-1", "t-1").
		WillReturnError(errors.New("constraint violation"))

	err := NewRepository(db).UpdateDefinition(context.Background(), "t-1", "def-1", map[string]interface{}{
		"name": "renamed",
	})
	if err == nil {
		t.Fatal("UpdateDefinition returned nil for a driver error")
	}
	if !strings.Contains(err.Error(), "constraint violation") {
		t.Fatalf("driver error was lost: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations not met: %v", err)
	}
}

func TestCreateTracking_WritesToSlaTrackings(t *testing.T) {
	db, mock := mockDB(t)
	mock.ExpectExec(`INSERT INTO sla_trackings (id, tenant_id, sla_definition_id, entity_type, entity_id,
		status, target_time, notes, started_at, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`).
		WithArgs(sqlmock.AnyArg(), "t-1", "def-1", "service", "svc-1", "tracking",
			sqlmock.AnyArg(), "deploy window", sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(1, 1))

	err := NewRepository(db).CreateTracking(context.Background(), &models.SLATracking{
		TenantID: "t-1", DefinitionID: "def-1", EntityType: "service", EntityID: "svc-1",
		TargetTime: ptrTime(time.Date(2026, 9, 20, 0, 0, 0, 0, time.UTC)), Notes: "deploy window",
	})
	if err != nil {
		t.Fatalf("CreateTracking: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations not met: %v", err)
	}
}

func TestGetTrackingByID_ReadsSlaTrackings(t *testing.T) {
	db, mock := mockDB(t)
	now := time.Now().UTC()
	mock.ExpectQuery(`SELECT * FROM sla_trackings WHERE id=$1 AND tenant_id=$2`).
		WithArgs("trk-1", "t-1").
		WillReturnRows(sqlmock.NewRows(trackingColumns).
			AddRow("trk-1", "t-1", "def-1", "service", "svc-1", "tracking",
				nil, nil, "", "", now, now, now))

	tr, err := NewRepository(db).GetTrackingByID(context.Background(), "t-1", "trk-1")
	if err != nil {
		t.Fatalf("GetTrackingByID: %v", err)
	}
	if tr == nil || tr.DefinitionID != "def-1" {
		t.Fatalf("got %+v", tr)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations not met: %v", err)
	}
}

func TestListTracking_UsesSlaTrackingsInBothStatements(t *testing.T) {
	db, mock := mockDB(t)
	mock.ExpectQuery(`SELECT COUNT(*) FROM sla_trackings WHERE tenant_id=$1 AND status=$2`).
		WithArgs("t-1", "tracking").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(0))
	mock.ExpectQuery(`SELECT * FROM sla_trackings WHERE tenant_id=$1 AND status=$2 ORDER BY created_at DESC LIMIT $3 OFFSET $4`).
		WithArgs("t-1", "tracking", 20, 0).
		WillReturnRows(sqlmock.NewRows(trackingColumns))

	items, total, err := NewRepository(db).ListTracking(context.Background(), "t-1",
		models.TrackingListQuery{Status: "tracking"})
	if err != nil {
		t.Fatalf("ListTracking: %v", err)
	}
	if total != 0 || len(items) != 0 {
		t.Fatalf("got total=%d items=%v", total, items)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations not met: %v", err)
	}
}

func TestUpdateTracking_WritesToSlaTrackings(t *testing.T) {
	db, mock := mockDB(t)
	mock.ExpectExec(`UPDATE sla_trackings SET notes=$1, status=$2, updated_at=$3 WHERE id=$4 AND tenant_id=$5`).
		WithArgs("marked met by hand", "met", sqlmock.AnyArg(), "trk-1", "t-1").
		WillReturnResult(sqlmock.NewResult(1, 1))

	err := NewRepository(db).UpdateTracking(context.Background(), "t-1", "trk-1", map[string]interface{}{
		"notes":  "marked met by hand",
		"status": "met",
	})
	if err != nil {
		t.Fatalf("UpdateTracking: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations not met: %v", err)
	}
}

// tracking_id is a VARCHAR(255) the caller of StartTracking chose for its own
// entity, so two tenants can hold the same value. The tenant predicate is what
// keeps one tenant from reading another tenant's breach history.
func TestGetBreachEventsByTracking_ScopesByTenant(t *testing.T) {
	db, mock := mockDB(t)
	now := time.Now().UTC()
	mock.ExpectQuery(`SELECT * FROM sla_breach_events WHERE tracking_id=$1 AND tenant_id=$2 ORDER BY created_at DESC`).
		WithArgs("svc-1", "t-1").
		WillReturnRows(sqlmock.NewRows(breachColumns).
			AddRow("ev-1", "t-1", "svc-1", now, "missed the window", now))

	events, err := NewRepository(db).GetBreachEventsByTracking(context.Background(), "t-1", "svc-1")
	if err != nil {
		t.Fatalf("GetBreachEventsByTracking: %v", err)
	}
	if len(events) != 1 || events[0].BreachDetails != "missed the window" {
		t.Fatalf("got %+v", events)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations not met: %v", err)
	}
}

func TestGetBreachEventsByTracking_ReturnsNilWithTheError(t *testing.T) {
	db, mock := mockDB(t)
	mock.ExpectQuery(`SELECT * FROM sla_breach_events WHERE tracking_id=$1 AND tenant_id=$2 ORDER BY created_at DESC`).
		WithArgs("svc-1", "t-1").
		WillReturnError(errors.New("connection refused"))

	events, err := NewRepository(db).GetBreachEventsByTracking(context.Background(), "t-1", "svc-1")
	if err == nil {
		t.Fatal("expected an error")
	}
	if events != nil {
		t.Fatalf("expected a nil slice with an error, got %v", events)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations not met: %v", err)
	}
}

func ptrTime(tm time.Time) *time.Time {
	return &tm
}

// --- Source-level detectors ---

var reNamedArg = regexp.MustCompile(`:[a-z_][a-z0-9_]*`)
var rePositionalArg = regexp.MustCompile(`\$[0-9]+`)
var reStatement = regexp.MustCompile(`(INSERT|UPDATE|SELECT|DELETE)\b`)

// mixesNamedAndPositional reports whether one statement text carries both a
// named placeholder and a literal $N. Under NamedExecContext sqlx renumbers the
// named args to $1..$N in appearance order and leaves any literal $N untouched,
// so the two styles cannot share a statement.
func mixesNamedAndPositional(query string) bool {
	return reNamedArg.MatchString(query) && rePositionalArg.MatchString(query)
}

var slaSourceFiles = []string{"repository.go", "repository_interface.go"}

func slaSource(t *testing.T, name string) string {
	t.Helper()
	b, err := os.ReadFile(filepath.Join(".", name))
	if err != nil {
		t.Fatalf("read %s: %v", name, err)
	}
	return string(b)
}

// stringLiterals returns every raw and interpreted string literal in src, in
// order. Both styles matter: ListDefinitions builds its WHERE clause inside a
// fmt.Sprintf, so its named placeholders live in an interpreted literal.
func stringLiterals(src string) []string {
	var out []string
	for i := 0; i < len(src); {
		switch src[i] {
		case '`':
			end := strings.IndexByte(src[i+1:], '`')
			if end < 0 {
				return out
			}
			out = append(out, src[i+1:i+1+end])
			i += end + 2
		case '"':
			j := i + 1
			for j < len(src) {
				if src[j] == '\\' {
					j += 2
					continue
				}
				if src[j] == '"' {
					break
				}
				j++
			}
			if j >= len(src) {
				return out
			}
			out = append(out, src[i+1:j])
			i = j + 1
		default:
			i++
		}
	}
	return out
}

func isStatement(lit string) bool {
	return reStatement.MatchString(strings.TrimSpace(lit))
}

// reFuncBody cannot be a regex: the parameter list carries its own parens, as in
// `map[string]interface{}`, and a bracketing pattern cannot span them. Split on
// the func declaration instead.
const reFuncDecl = "func (r *Repository) "

func namedExecBodies(src string) []string {
	var out []string
	rest := src
	for {
		i := strings.Index(rest, reFuncDecl)
		if i < 0 {
			return out
		}
		rest = rest[i:]
		j := strings.Index(rest[len(reFuncDecl):], "\nfunc ")
		if j < 0 {
			out = append(out, rest)
			return out
		}
		body := rest[:len(reFuncDecl)+j]
		if strings.Contains(body, "NamedExecContext") {
			out = append(out, body)
		}
		rest = rest[len(reFuncDecl)+j:]
	}
}

// A statement is only legitimate under NamedExecContext if it actually carries a
// named placeholder: sqlx's bindMapArgs returns no bound values at all for a
// statement with zero named args, so the literal $1/$2 that pre-fix
// UpdateDefinition left in its text went to the driver unbound. The check runs
// at function granularity, not per call, because several of these methods build
// the query in a variable or a fmt.Sprintf before calling NamedExecContext; the
// granularity is coarse enough that a function with one named-exec statement and
// one purely positional ExecContext statement would pass on the ExecContext one.
func TestSource_NamedExecStatementsBindNamedArgs(t *testing.T) {
	checked := 0
	for _, name := range slaSourceFiles {
		src := slaSource(t, name)
		// The interface file declares the methods but carries no statement, so it
		// must be skipped rather than fail: the guard below counts the bodies and
		// fails if nothing was checked at all.
		if !strings.Contains(src, "NamedExecContext") {
			continue
		}
		bodies := namedExecBodies(src)
		if len(bodies) == 0 {
			t.Fatalf("%s: has NamedExecContext but no body was parsed", name)
		}
		checked += len(bodies)
		for _, body := range bodies {
			bindable := false
			for _, lit := range stringLiterals(body) {
				if isStatement(lit) && reNamedArg.MatchString(lit) {
					bindable = true
					break
				}
			}
			if !bindable {
				t.Errorf("%s: a NamedExecContext call has no statement with a named "+
					"placeholder, so nothing would be bound", name)
			}
		}
	}
	if checked == 0 {
		t.Fatal("no NamedExecContext body was checked across the package")
	}
	t.Logf("checked %d NamedExecContext bodies", checked)

	// Positive control: the pre-fix UpdateDefinition body must be rejected.
	preFix := `func (r *Repository) UpdateDefinition(ctx context.Context, tenantID, id string, updates map[string]interface{}) error {
	updates["updated_at"] = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		"UPDATE sla_definitions SET updated_at = NOW() WHERE id=$1 AND tenant_id=$2",
		map[string]interface{}{"id": id, "tenant_id": tenantID})
	return err
}`
	bodies := namedExecBodies(preFix)
	if len(bodies) != 1 {
		t.Fatalf("fixture did not parse: %d bodies", len(bodies))
	}
	for _, lit := range stringLiterals(bodies[0]) {
		if isStatement(lit) && reNamedArg.MatchString(lit) {
			t.Fatal("detector accepted the pre-fix UpdateDefinition body")
		}
	}
}

// A literal $N is legitimate here: ListDefinitions and ListTracking build their
// WHERE clauses with fmt.Sprintf("col=$%d", pos) and pass plain positional args
// to GetContext/SelectContext. What is illegitimate is mixing the two styles in
// one statement -- that was the policy module's UpdatePolicy shape.
func TestSource_NoStatementMixesNamedAndPositionalPlaceholders(t *testing.T) {
	for _, name := range slaSourceFiles {
		for _, lit := range stringLiterals(slaSource(t, name)) {
			if mixesNamedAndPositional(lit) {
				t.Errorf("%s: statement mixes named and positional placeholders: %s", name, lit)
			}
		}
	}
	// Positive controls.
	if !mixesNamedAndPositional("UPDATE sla_definitions SET name=:name WHERE id=$1 AND tenant_id=$2") {
		t.Fatal("detector failed to flag a mixed statement")
	}
	if mixesNamedAndPositional("UPDATE sla_definitions SET name=:name WHERE id=:id") {
		t.Fatal("detector flagged an all-named statement")
	}
	if mixesNamedAndPositional("SELECT * FROM sla_trackings WHERE tenant_id=$1 AND status=$2") {
		t.Fatal("detector flagged an all-positional statement")
	}
}

var reTrackingWord = regexp.MustCompile(`sla_tracking\b`)

func TestSource_TrackingStatementsAddressSlaTrackings(t *testing.T) {
	for _, name := range slaSourceFiles {
		for range reTrackingWord.FindAllStringIndex(slaSource(t, name), -1) {
			t.Errorf("%s: sla_tracking is not a relation any migration created; "+
				"070 and 570/571/572 own sla_trackings", name)
		}
	}
	if !reTrackingWord.MatchString("SELECT * FROM sla_tracking WHERE id=$1") {
		t.Fatal("detector failed to match the singular relation name")
	}
	if reTrackingWord.MatchString("SELECT * FROM sla_trackings WHERE id=$1") {
		t.Fatal("detector matched the plural relation name")
	}
}

// filepath.Glob does not understand **, so the first cut of this test used
// Glob("../sla/**/*.go") and silently scanned zero files. WalkDir instead.
func TestSource_NoGoSourceNamesDefinitionType(t *testing.T) {
	var scanned int
	err := filepath.WalkDir("..", func(path string, d os.DirEntry, err error) error {
		if err != nil {
			return nil
		}
		if d.IsDir() || !strings.HasSuffix(d.Name(), ".go") {
			return nil
		}
		// Test files are excluded: this detector's own positive controls quote the
		// pre-fix column name, which would be a self-match.
		if strings.HasSuffix(d.Name(), "_test.go") {
			return nil
		}
		b, rerr := os.ReadFile(path)
		if rerr != nil {
			return nil
		}
		scanned++
		if strings.Contains(string(b), "definition_type") {
			t.Errorf("%s: 070 declares the column `type`; no migration adds definition_type", path)
		}
		return nil
	})
	if err != nil {
		t.Fatalf("WalkDir: %v", err)
	}
	if scanned == 0 {
		t.Fatal("detector scanned no files")
	}
	if !strings.Contains(`updates["definition_type"] = *req.Type`, "definition_type") {
		t.Fatal("detector failed to match the pre-fix key")
	}
}
