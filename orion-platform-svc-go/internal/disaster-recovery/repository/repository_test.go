package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"os"
	"regexp"
	"strings"
	"testing"
	"time"

	"orion/go-common/pkg/sentinel"
	"orion/platform-svc-go/internal/disaster-recovery/models"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"
)

// Four things were wrong in this repository, all of them on the six routes
// cmd/server mounts unconditionally:
//
//  1. Every statement addressed `disaster_plan` (singular). Migration 124
//     creates `disaster_plans`, and 239, 570 and 572 all alter the plural
//     relation: the tenant_id cast, fk_disaster_plans_tenant and the
//     created_by/updated_by audit columns. Nothing ever created the singular
//     name, so every /disaster-recovery route died at the driver with
//     `pq: relation "disaster_plan" does not exist`.
//
//  2. UpdatePlan mixed named placeholders in the SET clause with literal
//     $1/$2 in the WHERE clause. sqlx renumbers the named args to $1..$5 in
//     appearance order and leaves a literal $N untouched, so id=$1 received
//     the name value and tenant_id=$2 received the description value: the
//     WHERE clause never named the row and never scoped the tenant.
//
//  3. UpdatePlan set all four columns unconditionally. The service only puts
//     a key in the map when the caller sent it, and UpdateDisasterPlanRequest
//     has no status field at all, so an omitted key was a missing map lookup
//     that bound as nil: every partial update wrote NULL into name,
//     description, steps and status, all of them NOT NULL in 124.
//
//  4. GetPlan and GetRun returned sql.ErrNoRows straight to the service,
//     which tests the result with errors.Is(err, sentinel.NotFound). Those are
//     different errors, so every such check was dead and a no-row read looked
//     like a driver error. UpdateRun is the new statement that closes the
//     fifth gap: CreateRun assigned a fresh id on every call, so the
//     completion path's second "insert" appended a duplicate row and left the
//     original one at status='running' forever.
//
// The expectations below are the compiled statements sqlx actually sends. They
// assert the relation and column names verbatim, which sqlmock cannot check on
// its own: it does not know what 124 and 666 created.
// cmd/server/migration_disaster_recovery_test.go pins the other direction.

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

var planColumns = []string{
	"id", "tenant_id", "name", "description", "steps", "status",
	"last_run", "created_at", "updated_at",
}

var runColumns = []string{
	"id", "plan_id", "status", "started_at", "ended_at", "error_message", "created_at",
}

func TestCreatePlan_WritesToDisasterPlans(t *testing.T) {
	db, mock := mockDB(t)
	mock.ExpectExec(`INSERT INTO disaster_plans (id, tenant_id, name, description, steps, status, last_run, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`).
		// $7 is last_run and must be NULL: a plan that has never run has no last
		// run, and models.DisasterPlan.LastRun is nil at creation. 673 dropped
		// the NOT NULL 124 put on the column for that reason; a hardcoded
		// sentinel timestamp would silently undo it.
		WithArgs(sqlmock.AnyArg(), "t-1", "n", "d", `["echo hi"]`, "active",
			nil, sqlmock.AnyArg(), sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(1, 1))

	err := NewRepository(db).CreatePlan(context.Background(), &models.DisasterPlan{
		TenantID: "t-1", Name: "n", Description: "d",
		Steps: `["echo hi"]`, Status: "active",
	})
	if err != nil {
		t.Fatalf("CreatePlan: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations not met: %v", err)
	}
}

// The service decides missing-vs-broken by testing the error against
// sentinel.NotFound, so the repository must produce that sentinel. A nil
// response with a non-nil error is required, not a zero-value record.
func TestGetPlan_NoRowsReturnsSentinelNotFound(t *testing.T) {
	db, mock := mockDB(t)
	mock.ExpectQuery(`SELECT * FROM disaster_plans WHERE id=$1 AND tenant_id=$2`).
		WithArgs("plan-1", "t-1").
		WillReturnError(sql.ErrNoRows)

	p, err := NewRepository(db).GetPlan(context.Background(), "t-1", "plan-1")
	if err == nil {
		t.Fatal("expected an error for a missing row")
	}
	if p != nil {
		t.Fatalf("expected a nil record with an error, got %+v", p)
	}
	if !errors.Is(err, sentinel.NotFound) {
		t.Fatalf("repository must surface sentinel.NotFound, got %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations not met: %v", err)
	}
}

func TestGetPlan_DriverErrorIsNotMaskedAsNotFound(t *testing.T) {
	db, mock := mockDB(t)
	mock.ExpectQuery(`SELECT * FROM disaster_plans WHERE id=$1 AND tenant_id=$2`).
		WithArgs("plan-1", "t-1").
		WillReturnError(errors.New("connection refused"))

	p, err := NewRepository(db).GetPlan(context.Background(), "t-1", "plan-1")
	if err == nil {
		t.Fatal("expected an error")
	}
	if p != nil {
		t.Fatalf("expected a nil record with an error, got %+v", p)
	}
	if errors.Is(err, sentinel.NotFound) {
		t.Fatal("a driver error must not look like a missing row")
	}
	if !strings.Contains(err.Error(), "connection refused") {
		t.Fatalf("driver error was lost: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations not met: %v", err)
	}
}

func TestListPlans_ReadsDisasterPlans(t *testing.T) {
	db, mock := mockDB(t)
	now := time.Now().UTC()
	mock.ExpectQuery(`SELECT * FROM disaster_plans WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`).
		WithArgs("t-1", 50, 0).
		WillReturnRows(sqlmock.NewRows(planColumns).
			AddRow("plan-1", "t-1", "n", "d", `["echo hi"]`, "active", now, now, now))

	items, err := NewRepository(db).ListPlans(context.Background(), "t-1", 50, 0)
	if err != nil {
		t.Fatalf("ListPlans: %v", err)
	}
	if len(items) != 1 || items[0].Status != "active" {
		t.Fatalf("got %+v", items)
	}
	if items[0].LastRun == nil || !items[0].LastRun.Equal(now) {
		t.Fatalf("last_run did not scan: %+v", items[0].LastRun)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations not met: %v", err)
	}
}

func TestCountPlans_ReadsDisasterPlans(t *testing.T) {
	db, mock := mockDB(t)
	mock.ExpectQuery(`SELECT COUNT(*) FROM disaster_plans WHERE tenant_id=$1`).
		WithArgs("t-1").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(3))

	count, err := NewRepository(db).CountPlans(context.Background(), "t-1")
	if err != nil {
		t.Fatalf("CountPlans: %v", err)
	}
	if count != 3 {
		t.Fatalf("got %d", count)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations not met: %v", err)
	}
}

// The service UpdatePlan sends name plus steps: that is the exact shape the
// live route PUT /disaster-recovery/plans/:id can produce. description and
// status must have no SET slot, because 124 declares them NOT NULL and a
// missing map key binds as nil.
func TestUpdatePlan_NameAndStepsOmitsTheOtherColumns(t *testing.T) {
	db, mock := mockDB(t)
	mock.ExpectExec(`UPDATE disaster_plans SET name=$1, steps=$2, updated_at=$3 WHERE id=$4 AND tenant_id=$5`).
		WithArgs("renamed", `["a","b"]`, sqlmock.AnyArg(), "plan-1", "t-1").
		WillReturnResult(sqlmock.NewResult(1, 1))

	err := NewRepository(db).UpdatePlan(context.Background(), "t-1", "plan-1",
		map[string]interface{}{"name": "renamed", "steps": `["a","b"]`})
	if err != nil {
		t.Fatalf("UpdatePlan: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations not met: %v", err)
	}
}

// Both whitelisted data columns reach their own SET slot, updated_at is added
// when the caller did not send it, and id/tenant_id stay in the WHERE clause.
// sqlx renumbers named args in appearance order, so the identity fields occupy
// $6 and $7 -- the last two -- which is the only arrangement in which the WHERE
// clause can still find the row the caller named.
func TestUpdatePlan_AllWhitelistedColumnsReachTheirOwnSetSlot(t *testing.T) {
	db, mock := mockDB(t)
	mock.ExpectExec(`UPDATE disaster_plans SET description=$1, name=$2, status=$3, steps=$4, updated_at=$5 WHERE id=$6 AND tenant_id=$7`).
		WithArgs("d", "n", "active", `["a"]`, sqlmock.AnyArg(), "plan-1", "t-1").
		WillReturnResult(sqlmock.NewResult(1, 1))

	err := NewRepository(db).UpdatePlan(context.Background(), "t-1", "plan-1",
		map[string]interface{}{
			"name": "n", "description": "d", "steps": `["a"]`, "status": "active",
		})
	if err != nil {
		t.Fatalf("UpdatePlan: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations not met: %v", err)
	}
}

// updated_at appears exactly once in the SET clause even when the caller also
// sends it. The repository stamps the column itself, because a caller choosing
// its own updated_at is a write-poisoning path; the whitelist still lists the
// column so a caller that only sends updated_at is not silently dropped.
func TestUpdatePlan_UpdatedAtIsSetOnce(t *testing.T) {
	db, mock := mockDB(t)
	mock.ExpectExec(`UPDATE disaster_plans SET name=$1, updated_at=$2 WHERE id=$3 AND tenant_id=$4`).
		WithArgs("renamed", sqlmock.AnyArg(), "plan-1", "t-1").
		WillReturnResult(sqlmock.NewResult(1, 1))

	err := NewRepository(db).UpdatePlan(context.Background(), "t-1", "plan-1",
		map[string]interface{}{"name": "renamed", "updated_at": time.Unix(0, 0)})
	if err != nil {
		t.Fatalf("UpdatePlan: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations not met: %v", err)
	}
}

func TestUpdatePlan_UnlistedKeysNeverReachSQL(t *testing.T) {
	db, mock := mockDB(t)
	err := NewRepository(db).UpdatePlan(context.Background(), "t-1", "plan-1",
		map[string]interface{}{"id": "plan-2", "tenant_id": "t-999", "password": "hunter2"})
	if err != nil {
		t.Fatalf("UpdatePlan must refuse unlisted keys without running SQL, got %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations not met: %v", err)
	}
}

// A nil value in the updates map means "the caller did not send this field".
// Binding it would put NULL into a column 124 declares NOT NULL and reject the
// whole update, so a nil must not reach SQL at all: the statement must be
// byte-identical to the one produced by sending the key without the nil.
func TestUpdatePlan_NilValueDoesNotReachSQL(t *testing.T) {
	db, mock := mockDB(t)
	mock.ExpectExec(`UPDATE disaster_plans SET name=$1, updated_at=$2 WHERE id=$3 AND tenant_id=$4`).
		WithArgs("renamed", sqlmock.AnyArg(), "plan-1", "t-1").
		WillReturnResult(sqlmock.NewResult(1, 1))

	err := NewRepository(db).UpdatePlan(context.Background(), "t-1", "plan-1",
		map[string]interface{}{"name": "renamed", "status": nil})
	if err != nil {
		t.Fatalf("UpdatePlan must ignore a nil value instead of writing NULL, got %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations not met: %v", err)
	}
}

// Every value nil means nothing was sent, so no SQL runs at all: the map
// collapses to empty, which is the same no-op as sending an empty map.
func TestUpdatePlan_AllNilValuesAreANoOp(t *testing.T) {
	db, mock := mockDB(t)
	if err := NewRepository(db).UpdatePlan(context.Background(), "t-1", "plan-1",
		map[string]interface{}{"name": nil, "status": nil, "steps": nil}); err != nil {
		t.Fatalf("UpdatePlan: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations not met: %v", err)
	}
}

func TestUpdatePlan_EmptyMapIsANoOp(t *testing.T) {
	db, mock := mockDB(t)
	if err := NewRepository(db).UpdatePlan(context.Background(), "t-1", "plan-1",
		map[string]interface{}{}); err != nil {
		t.Fatalf("UpdatePlan: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations not met: %v", err)
	}
}

func TestUpdatePlan_ReturnsTheDriverError(t *testing.T) {
	db, mock := mockDB(t)
	mock.ExpectExec(`UPDATE disaster_plans SET name=$1, steps=$2, updated_at=$3 WHERE id=$4 AND tenant_id=$5`).
		WithArgs("renamed", `["a","b"]`, sqlmock.AnyArg(), "plan-1", "t-1").
		WillReturnError(errors.New("null value in column name"))

	err := NewRepository(db).UpdatePlan(context.Background(), "t-1", "plan-1",
		map[string]interface{}{"name": "renamed", "steps": `["a","b"]`})
	if err == nil {
		t.Fatal("UpdatePlan returned nil for a driver error")
	}
	if !strings.Contains(err.Error(), "name") {
		t.Fatalf("driver error was lost: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations not met: %v", err)
	}
}

func TestUpdatePlanLastRun_WritesToDisasterPlans(t *testing.T) {
	db, mock := mockDB(t)
	mock.ExpectExec(`UPDATE disaster_plans SET last_run=$1, updated_at=$2 WHERE id=$3 AND tenant_id=$4`).
		WithArgs(sqlmock.AnyArg(), sqlmock.AnyArg(), "plan-1", "t-1").
		WillReturnResult(sqlmock.NewResult(1, 1))

	if err := NewRepository(db).UpdatePlanLastRun(context.Background(), "t-1", "plan-1",
		time.Now().UTC()); err != nil {
		t.Fatalf("UpdatePlanLastRun: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations not met: %v", err)
	}
}

func TestCreateRun_InsertsIntoRecoveryRun(t *testing.T) {
	db, mock := mockDB(t)
	mock.ExpectExec(`INSERT INTO recovery_run (id, plan_id, status, started_at, created_at)
		VALUES ($1, $2, $3, $4, $5)`).
		WithArgs(sqlmock.AnyArg(), "plan-1", "running", sqlmock.AnyArg(), sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(1, 1))

	run := &models.RecoveryRun{PlanID: "plan-1", Status: "running", StartedAt: time.Now().UTC()}
	if err := NewRepository(db).CreateRun(context.Background(), run); err != nil {
		t.Fatalf("CreateRun: %v", err)
	}
	if run.ID == "" {
		t.Fatal("CreateRun did not assign an id")
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations not met: %v", err)
	}
}

// UpdateRun is the statement that replaces the pre-fix second INSERT. The run's
// own columns come from the run, the tenant comes from the plan the run points
// at, and recovery_run itself has no tenant_id column (666): tenancy reaches
// it through the JOIN on disaster_plans.
func TestUpdateRun_WritesTheOutcomeAndScopesTheTenant(t *testing.T) {
	db, mock := mockDB(t)
	end := time.Now().UTC()
	mock.ExpectExec(`UPDATE recovery_run r SET status=$1, ended_at=$2, error_message=$3
		FROM disaster_plans p
		WHERE r.id=$4 AND r.plan_id=$5 AND p.id=r.plan_id AND p.tenant_id=$6`).
		WithArgs("success", sqlmock.AnyArg(), "", "run-1", "plan-1", "t-1").
		WillReturnResult(sqlmock.NewResult(1, 1))

	err := NewRepository(db).UpdateRun(context.Background(), "t-1",
		&models.RecoveryRun{
			ID: "run-1", PlanID: "plan-1", Status: "success",
			StartedAt: time.Now().UTC(), EndedAt: &end,
		})
	if err != nil {
		t.Fatalf("UpdateRun: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations not met: %v", err)
	}
}

func TestUpdateRun_CarriesTheFailureReason(t *testing.T) {
	db, mock := mockDB(t)
	end := time.Now().UTC()
	mock.ExpectExec(`UPDATE recovery_run r SET status=$1, ended_at=$2, error_message=$3
		FROM disaster_plans p
		WHERE r.id=$4 AND r.plan_id=$5 AND p.id=r.plan_id AND p.tenant_id=$6`).
		WithArgs("rolled-back", sqlmock.AnyArg(), "step 1 failed: step failed", "run-1", "plan-1", "t-1").
		WillReturnResult(sqlmock.NewResult(1, 1))

	err := NewRepository(db).UpdateRun(context.Background(), "t-1",
		&models.RecoveryRun{
			ID: "run-1", PlanID: "plan-1", Status: "rolled-back",
			StartedAt: time.Now().UTC(), EndedAt: &end,
			ErrorMessage: "step 1 failed: step failed",
		})
	if err != nil {
		t.Fatalf("UpdateRun: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations not met: %v", err)
	}
}

func TestListRuns_ReadsThroughThePlanJoin(t *testing.T) {
	db, mock := mockDB(t)
	started := time.Now().UTC()
	mock.ExpectQuery(`SELECT r.* FROM recovery_run r
		JOIN disaster_plans p ON r.plan_id = p.id
		WHERE r.plan_id=$1 AND p.tenant_id=$2 ORDER BY r.started_at DESC`).
		WithArgs("plan-1", "t-1").
		WillReturnRows(sqlmock.NewRows(runColumns).
			AddRow("run-1", "plan-1", "success", started, started, "", started))

	items, err := NewRepository(db).ListRuns(context.Background(), "t-1", "plan-1")
	if err != nil {
		t.Fatalf("ListRuns: %v", err)
	}
	if len(items) != 1 || items[0].Status != "success" {
		t.Fatalf("got %+v", items)
	}
	if items[0].EndedAt == nil {
		t.Error("ended_at did not scan")
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations not met: %v", err)
	}
}

func TestGetRun_NoRowsReturnsSentinelNotFound(t *testing.T) {
	db, mock := mockDB(t)
	mock.ExpectQuery(`SELECT r.* FROM recovery_run r
		JOIN disaster_plans p ON r.plan_id = p.id
		WHERE r.id=$1 AND r.plan_id=$2 AND p.tenant_id=$3`).
		WithArgs("run-1", "plan-1", "t-1").
		WillReturnError(sql.ErrNoRows)

	run, err := NewRepository(db).GetRun(context.Background(), "t-1", "plan-1", "run-1")
	if err == nil {
		t.Fatal("expected an error for a missing row")
	}
	if run != nil {
		t.Fatalf("expected a nil record with an error, got %+v", run)
	}
	if !errors.Is(err, sentinel.NotFound) {
		t.Fatalf("repository must surface sentinel.NotFound, got %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations not met: %v", err)
	}
}

func TestGetRun_DriverErrorIsNotMaskedAsNotFound(t *testing.T) {
	db, mock := mockDB(t)
	mock.ExpectQuery(`SELECT r.* FROM recovery_run r
		JOIN disaster_plans p ON r.plan_id = p.id
		WHERE r.id=$1 AND r.plan_id=$2 AND p.tenant_id=$3`).
		WithArgs("run-1", "plan-1", "t-1").
		WillReturnError(errors.New("connection refused"))

	run, err := NewRepository(db).GetRun(context.Background(), "t-1", "plan-1", "run-1")
	if err == nil {
		t.Fatal("expected an error")
	}
	if run != nil {
		t.Fatalf("expected a nil record with an error, got %+v", run)
	}
	if errors.Is(err, sentinel.NotFound) {
		t.Fatal("a driver error must not look like a missing row")
	}
	if !strings.Contains(err.Error(), "connection refused") {
		t.Fatalf("driver error was lost: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations not met: %v", err)
	}
}

// --- Source-level detectors ---

func repoSource(t *testing.T) string {
	t.Helper()
	b, err := os.ReadFile("repository.go")
	if err != nil {
		t.Fatalf("read repository.go: %v", err)
	}
	return string(b)
}

var reNamedArg = regexp.MustCompile(`:[a-z_][a-z0-9_]*`)
var rePositionalArg = regexp.MustCompile(`\$[0-9]+`)
var reStatement = regexp.MustCompile(`(INSERT|UPDATE|SELECT|DELETE)\b`)

// mixesNamedAndPositional reports whether one statement carries both a named
// placeholder and a literal $N. Under NamedExecContext sqlx renumbers the named
// args and leaves a literal $N untouched, so the two styles cannot share a
// statement: that was UpdatePlan's pre-fix shape, with five misaligned slots.
func mixesNamedAndPositional(query string) bool {
	return reNamedArg.MatchString(query) && rePositionalArg.MatchString(query)
}

// stringLiterals returns every raw and interpreted string literal in src, in
// order. Both styles matter: UpdatePlan builds its statement inside a
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

func TestSource_NoStatementMixesNamedAndPositionalPlaceholders(t *testing.T) {
	checked := 0
	for _, lit := range stringLiterals(repoSource(t)) {
		if !reStatement.MatchString(strings.TrimSpace(lit)) {
			continue
		}
		checked++
		if mixesNamedAndPositional(lit) {
			t.Errorf("statement mixes named and positional placeholders: %s", lit)
		}
	}
	if checked != 10 {
		t.Fatalf("expected 10 statements to check, counted %d", checked)
	}
	t.Logf("checked %d statements for placeholder style mixing", checked)

	// Positive control: the pre-fix UpdatePlan statement must be rejected, and
	// the two all-one-style shapes the repository uses elsewhere must pass.
	if !mixesNamedAndPositional("UPDATE disaster_plans SET name=:name, steps=:steps, status=:status WHERE id=$1 AND tenant_id=$2") {
		t.Fatal("detector failed to flag the pre-fix mixed statement")
	}
	if mixesNamedAndPositional("UPDATE disaster_plans SET name=:name WHERE id=:id AND tenant_id=:tenant_id") {
		t.Fatal("detector flagged an all-named statement")
	}
	if mixesNamedAndPositional("SELECT * FROM disaster_plans WHERE id=$1 AND tenant_id=$2") {
		t.Fatal("detector flagged an all-positional statement")
	}
}

var rePlanWord = regexp.MustCompile(`disaster_plan\b`)

func TestSource_StatementsAddressDisasterPlans(t *testing.T) {
	src := repoSource(t)
	for _, m := range rePlanWord.FindAllString(src, -1) {
		t.Errorf("disaster_plan is not a relation any migration created; "+
			"124 creates disaster_plans and 239/570/572 own it (matched %q)", m)
	}
	if strings.Count(src, "disaster_plans") == 0 {
		t.Fatal("the repository addresses no disaster_plans statement")
	}
	if !rePlanWord.MatchString("SELECT * FROM disaster_plan WHERE id=$1") {
		t.Fatal("detector failed to match the singular relation name")
	}
	if rePlanWord.MatchString("SELECT * FROM disaster_plans WHERE id=$1") {
		t.Fatal("detector matched the plural relation name")
	}
}

// A method that reads one record and returns (*T, error) must convert
// sql.ErrNoRows into sentinel.NotFound, because the service decides
// missing-vs-broken by testing exactly that sentinel. The detector walks the
// method bodies rather than the whole file, so a body that returns the driver
// error for a no-row read is reported instead of silently passing.
const repoFuncDecl = "func (r *Repository) "

func repoMethodBodies(src string) []string {
	var out []string
	rest := src
	for {
		i := strings.Index(rest, repoFuncDecl)
		if i < 0 {
			return out
		}
		rest = rest[i:]
		j := strings.Index(rest[len(repoFuncDecl):], "\nfunc ")
		if j < 0 {
			out = append(out, rest)
			return out
		}
		out = append(out, rest[:len(repoFuncDecl)+j])
		rest = rest[len(repoFuncDecl)+j:]
	}
}

func TestSource_NoErrNoRowsLeaksPastTheRepository(t *testing.T) {
	bodies := repoMethodBodies(repoSource(t))
	if len(bodies) == 0 {
		t.Fatal("detector parsed no repository method")
	}
	checked := 0
	for _, body := range bodies {
		// Only the single-record reads return (*T, error); the list and count
		// methods return the slice or the int alongside the error and so cannot
		// confuse the service's not-found branch.
		if !strings.Contains(body, "GetContext(ctx, &") || !strings.Contains(body, "return nil, err") {
			continue
		}
		checked++
		if !strings.Contains(body, "sql.ErrNoRows") || !strings.Contains(body, "sentinel.NotFound") {
			t.Errorf("method returns sql.ErrNoRows to the service instead of sentinel.NotFound:\n%s", body)
		}
	}
	if checked != 2 {
		t.Fatalf("expected 2 single-record read methods to check, got %d", checked)
	}

	// Positive control: the pre-fix GetPlan body must be reported.
	preFix := repoFuncDecl + ` GetPlan(ctx context.Context, tenantID, id string) (*models.DisasterPlan, error) {
	var p models.DisasterPlan
	err := r.db.GetContext(ctx, &p,
		"SELECT * FROM disaster_plans WHERE id=$1 AND tenant_id=$2", id, tenantID)
	if err != nil {
		return nil, err
	}
	return &p, nil
}
`
	pre := repoMethodBodies(preFix)
	if len(pre) != 1 {
		t.Fatalf("fixture did not parse: %d bodies", len(pre))
	}
	if strings.Contains(pre[0], "sql.ErrNoRows") {
		t.Fatal("fixture is not the pre-fix body")
	}
	if !strings.Contains(pre[0], "return nil, err") {
		t.Fatal("fixture lost the leak")
	}
}

// Sentinel errors only matter if something produces them. This pins that the
// repository actually returns sentinel.NotFound somewhere, so the service's
// errors.Is checks are live rather than dead code that was never reachable.
func TestSource_RepositoryProducesSentinelNotFound(t *testing.T) {
	if !strings.Contains(repoSource(t), "sentinel.NotFound") {
		t.Fatal("the repository never returns sentinel.NotFound, so every " +
			"errors.Is(err, sentinel.NotFound) check in the service is dead")
	}
}

// CreateRun is the only way a run row is created. The completion path must
// UPDATE the row CreateRun made, because CreateRun reassigns the id on every
// call: a second INSERT appended a duplicate and left the original at
// status='running' forever. Exactly one INSERT for recovery_run is the invariant.
var reRunInsert = regexp.MustCompile(`(?i)INSERT\s+INTO\s+recovery_run\b`)

func TestSource_CreateRunIsTheOnlyRecoveryRunInsert(t *testing.T) {
	src := repoSource(t)
	count := len(reRunInsert.FindAllString(src, -1))
	if count != 1 {
		t.Fatalf("expected exactly 1 INSERT into recovery_run, found %d", count)
	}
	if !strings.Contains(src, "UPDATE recovery_run") {
		t.Fatal("there is no UPDATE for recovery_run, so a finished run cannot " +
			"be recorded as finished")
	}
	if !reRunInsert.MatchString("INSERT INTO recovery_run (id) VALUES ($1)") {
		t.Fatal("detector failed to match a recovery_run insert")
	}
}
