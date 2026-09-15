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
	"orion/platform-svc-go/internal/artifact-lifecycle/models"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"
)

// Four things were wrong in this repository, all of them on routes that are
// registered on every boot (cmd/server mounts the artifact-lifecycle handler
// unconditionally):
//
//  1. Every statement addressed `artifact_lifecycle` (singular). Migration 094
//     creates `artifact_lifecycles`, and 239, 570 and 572 all alter the plural
//     relation: a tenant_id cast, the fk_artifact_lifecycles_tenant constraint
//     and the created_by/updated_by audit columns. Nothing ever created the
//     singular name, so all seven /artifact-lifecycle routes died at the driver
//     with `pq: relation "artifact_lifecycle" does not exist`.
//
//  2. Update mixed named placeholders in the SET clause with literal $1/$2 in
//     the WHERE clause. sqlx renumbers the named args to $1..$N in appearance
//     order and leaves a literal $N untouched, so id=$1 received the stage
//     value and tenant_id=$2 received the stage_status value: the WHERE clause
//     never named the row the caller picked and never scoped the tenant.
//
//  3. Update set stage_status unconditionally. AdvanceStageRequest has no
//     status field, so the service never put stage_status in the map, the
//     missing key bound as nil, and Postgres rejected every advance with a
//     not-null violation on stage_status.
//
//  4. GetByID and GetByArtifactID returned sql.ErrNoRows straight to the
//     service, which tests the result with errors.Is(err, sentinel.NotFound).
//     Those are different errors, so every such check was dead and
//     POST /artifact-lifecycle answered 500 with "sql: no rows in result set"
//     instead of creating the row.
//
// The expectations below are the compiled statements sqlx actually sends. They
// assert the relation and column names verbatim, which sqlmock cannot check on
// its own: it does not know what 094 created.
// cmd/server/migration_artifact_lifecycle_test.go pins the other direction.

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

var lifecycleColumns = []string{
	"id", "tenant_id", "artifact_id", "stage", "stage_status", "created_at", "updated_at",
}

func TestCreate_WritesToArtifactLifecycles(t *testing.T) {
	db, mock := mockDB(t)
	mock.ExpectExec(`INSERT INTO artifact_lifecycles (id, tenant_id, artifact_id, stage, stage_status, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)`).
		WithArgs(sqlmock.AnyArg(), "t-1", "art-1", "build", "success",
			sqlmock.AnyArg(), sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(1, 1))

	err := NewRepository(db).Create(context.Background(), &models.ArtifactLifecycle{
		TenantID: "t-1", ArtifactID: "art-1", Stage: "build", Status: "success",
	})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations not met: %v", err)
	}
}

// The service Create tests the repository error with errors.Is(err,
// sentinel.NotFound) to decide whether the artifact already has a lifecycle.
// A nil response with a non-nil error is required, not a zero-value record.
func TestGetByID_NoRowsReturnsSentinelNotFound(t *testing.T) {
	db, mock := mockDB(t)
	mock.ExpectQuery(`SELECT * FROM artifact_lifecycles WHERE id=$1 AND tenant_id=$2`).
		WithArgs("lc-1", "t-1").
		WillReturnError(sql.ErrNoRows)

	lc, err := NewRepository(db).GetByID(context.Background(), "t-1", "lc-1")
	if err == nil {
		t.Fatal("expected an error for a missing row")
	}
	if lc != nil {
		t.Fatalf("expected a nil record with an error, got %+v", lc)
	}
	if !errors.Is(err, sentinel.NotFound) {
		t.Fatalf("repository must surface sentinel.NotFound, got %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations not met: %v", err)
	}
}

func TestGetByID_DriverErrorIsNotMaskedAsNotFound(t *testing.T) {
	db, mock := mockDB(t)
	mock.ExpectQuery(`SELECT * FROM artifact_lifecycles WHERE id=$1 AND tenant_id=$2`).
		WithArgs("lc-1", "t-1").
		WillReturnError(errors.New("connection refused"))

	lc, err := NewRepository(db).GetByID(context.Background(), "t-1", "lc-1")
	if err == nil {
		t.Fatal("expected an error")
	}
	if lc != nil {
		t.Fatalf("expected a nil record with an error, got %+v", lc)
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

func TestGetByArtifactID_NoRowsReturnsSentinelNotFound(t *testing.T) {
	db, mock := mockDB(t)
	mock.ExpectQuery(`SELECT * FROM artifact_lifecycles WHERE artifact_id=$1 AND tenant_id=$2 ORDER BY created_at DESC LIMIT 1`).
		WithArgs("art-1", "t-1").
		WillReturnError(sql.ErrNoRows)

	lc, err := NewRepository(db).GetByArtifactID(context.Background(), "t-1", "art-1")
	if err == nil {
		t.Fatal("expected an error for a missing row")
	}
	if lc != nil {
		t.Fatalf("expected a nil record with an error, got %+v", lc)
	}
	if !errors.Is(err, sentinel.NotFound) {
		t.Fatalf("repository must surface sentinel.NotFound, got %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations not met: %v", err)
	}
}

func TestGetByArtifactID_DriverErrorIsNotMaskedAsNotFound(t *testing.T) {
	db, mock := mockDB(t)
	mock.ExpectQuery(`SELECT * FROM artifact_lifecycles WHERE artifact_id=$1 AND tenant_id=$2 ORDER BY created_at DESC LIMIT 1`).
		WithArgs("art-1", "t-1").
		WillReturnError(errors.New("connection refused"))

	lc, err := NewRepository(db).GetByArtifactID(context.Background(), "t-1", "art-1")
	if err == nil {
		t.Fatal("expected an error")
	}
	if lc != nil {
		t.Fatalf("expected a nil record with an error, got %+v", lc)
	}
	if errors.Is(err, sentinel.NotFound) {
		t.Fatal("a driver error must not look like a missing row")
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations not met: %v", err)
	}
}

func TestList_ReadsArtifactLifecycles(t *testing.T) {
	db, mock := mockDB(t)
	now := time.Now().UTC()
	mock.ExpectQuery(`SELECT * FROM artifact_lifecycles WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`).
		WithArgs("t-1", 50, 0).
		WillReturnRows(sqlmock.NewRows(lifecycleColumns).
			AddRow("lc-1", "t-1", "art-1", "build", "success", now, now))

	items, err := NewRepository(db).List(context.Background(), "t-1", 50, 0)
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if len(items) != 1 || items[0].Status != "success" {
		t.Fatalf("got %+v", items)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations not met: %v", err)
	}
}

func TestCount_ReadsArtifactLifecycles(t *testing.T) {
	db, mock := mockDB(t)
	mock.ExpectQuery(`SELECT COUNT(*) FROM artifact_lifecycles WHERE tenant_id=$1`).
		WithArgs("t-1").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(3))

	count, err := NewRepository(db).Count(context.Background(), "t-1")
	if err != nil {
		t.Fatalf("Count: %v", err)
	}
	if count != 3 {
		t.Fatalf("got %d", count)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations not met: %v", err)
	}
}

// The service AdvanceStage builds updates with exactly one key, stage. This is
// the shape that hits the live route PUT /artifact-lifecycle/:id/stage, so the
// compiled statement must have no stage_status slot: 094 declares stage_status
// NOT NULL, and the pre-fix statement bound a missing map key there as nil.
func TestUpdate_StageOnlyEmitsNoStageStatusPlaceholder(t *testing.T) {
	db, mock := mockDB(t)
	mock.ExpectExec(`UPDATE artifact_lifecycles SET stage=$1, updated_at=$2 WHERE id=$3 AND tenant_id=$4`).
		WithArgs("deploy", sqlmock.AnyArg(), "lc-1", "t-1").
		WillReturnResult(sqlmock.NewResult(1, 1))

	err := NewRepository(db).Update(context.Background(), "t-1", "lc-1",
		map[string]interface{}{"stage": "deploy"})
	if err != nil {
		t.Fatalf("Update: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations not met: %v", err)
	}
}

// Both whitelisted data columns reach their own SET slot, updated_at is added
// when the caller did not send it, and id/tenant_id stay in the WHERE clause.
// sqlx renumbers named args in appearance order, so the identity fields occupy
// $4 and $5 -- the last two -- which is the only arrangement in which the WHERE
// clause can still find the row the caller named.
func TestUpdate_AllWhitelistedColumnsReachTheirOwnSetSlot(t *testing.T) {
	db, mock := mockDB(t)
	mock.ExpectExec(`UPDATE artifact_lifecycles SET stage=$1, stage_status=$2, updated_at=$3 WHERE id=$4 AND tenant_id=$5`).
		WithArgs("deploy", "running", sqlmock.AnyArg(), "lc-1", "t-1").
		WillReturnResult(sqlmock.NewResult(1, 1))

	err := NewRepository(db).Update(context.Background(), "t-1", "lc-1",
		map[string]interface{}{"stage": "deploy", "stage_status": "running"})
	if err != nil {
		t.Fatalf("Update: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations not met: %v", err)
	}
}

// updated_at appears exactly once in the SET clause even when the caller also
// sends it. The repository stamps the column itself, because a caller choosing
// its own updated_at is a write-poisoning path (set it into the past to hide
// that the row moved); the whitelist still lists the column so a caller that
// only sends updated_at is not silently dropped by the guard.
func TestUpdate_UpdatedAtIsSetOnce(t *testing.T) {
	db, mock := mockDB(t)
	mock.ExpectExec(`UPDATE artifact_lifecycles SET stage=$1, updated_at=$2 WHERE id=$3 AND tenant_id=$4`).
		WithArgs("deploy", sqlmock.AnyArg(), "lc-1", "t-1").
		WillReturnResult(sqlmock.NewResult(1, 1))

	err := NewRepository(db).Update(context.Background(), "t-1", "lc-1",
		map[string]interface{}{"stage": "deploy", "updated_at": time.Unix(0, 0)})
	if err != nil {
		t.Fatalf("Update: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations not met: %v", err)
	}
}

func TestUpdate_UnlistedKeysNeverReachSQL(t *testing.T) {
	db, mock := mockDB(t)
	err := NewRepository(db).Update(context.Background(), "t-1", "lc-1",
		map[string]interface{}{"id": "lc-2", "tenant_id": "t-999", "password": "hunter2"})
	if err != nil {
		t.Fatalf("Update must refuse unlisted keys without running SQL, got %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations not met: %v", err)
	}
}

func TestUpdate_EmptyMapIsANoOp(t *testing.T) {
	db, mock := mockDB(t)
	if err := NewRepository(db).Update(context.Background(), "t-1", "lc-1",
		map[string]interface{}{}); err != nil {
		t.Fatalf("Update: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations not met: %v", err)
	}
}

func TestUpdate_ReturnsTheDriverError(t *testing.T) {
	db, mock := mockDB(t)
	mock.ExpectExec(`UPDATE artifact_lifecycles SET stage=$1, updated_at=$2 WHERE id=$3 AND tenant_id=$4`).
		WithArgs("deploy", sqlmock.AnyArg(), "lc-1", "t-1").
		WillReturnError(errors.New("null value in column stage_status"))

	err := NewRepository(db).Update(context.Background(), "t-1", "lc-1",
		map[string]interface{}{"stage": "deploy"})
	if err == nil {
		t.Fatal("Update returned nil for a driver error")
	}
	if !strings.Contains(err.Error(), "stage_status") {
		t.Fatalf("driver error was lost: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations not met: %v", err)
	}
}

func TestDelete_DeletesFromArtifactLifecycles(t *testing.T) {
	db, mock := mockDB(t)
	mock.ExpectExec(`DELETE FROM artifact_lifecycles WHERE id=$1 AND tenant_id=$2`).
		WithArgs("lc-1", "t-1").
		WillReturnResult(sqlmock.NewResult(1, 1))

	if err := NewRepository(db).Delete(context.Background(), "t-1", "lc-1"); err != nil {
		t.Fatalf("Delete: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations not met: %v", err)
	}
}

func TestGetStageHistory_ReadsArtifactLifecycles(t *testing.T) {
	db, mock := mockDB(t)
	now := time.Now().UTC()
	mock.ExpectQuery(`SELECT * FROM artifact_lifecycles WHERE artifact_id=$1 AND tenant_id=$2 ORDER BY created_at ASC`).
		WithArgs("art-1", "t-1").
		WillReturnRows(sqlmock.NewRows(lifecycleColumns).
			AddRow("lc-1", "t-1", "art-1", "build", "success", now, now))

	items, err := NewRepository(db).GetStageHistory(context.Background(), "t-1", "art-1")
	if err != nil {
		t.Fatalf("GetStageHistory: %v", err)
	}
	if len(items) != 1 || items[0].Stage != "build" {
		t.Fatalf("got %+v", items)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations not met: %v", err)
	}
}

func TestArchive_WritesToArtifactLifecycles(t *testing.T) {
	db, mock := mockDB(t)
	mock.ExpectExec(`UPDATE artifact_lifecycles SET stage='archived', stage_status='archived', updated_at=NOW()
		WHERE id=$1 AND tenant_id=$2`).
		WithArgs("lc-1", "t-1").
		WillReturnResult(sqlmock.NewResult(1, 1))

	if err := NewRepository(db).Archive(context.Background(), "t-1", "lc-1"); err != nil {
		t.Fatalf("Archive: %v", err)
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
// statement: that was Update's pre-fix shape.
func mixesNamedAndPositional(query string) bool {
	return reNamedArg.MatchString(query) && rePositionalArg.MatchString(query)
}

// stringLiterals returns every raw and interpreted string literal in src, in
// order. Both styles matter: Update builds its statement inside a
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
	if checked == 0 {
		t.Fatal("detector parsed no statement")
	}
	t.Logf("checked %d statements for placeholder style mixing", checked)

	// Positive controls: the pre-fix Update statement must be rejected, and the
	// two all-one-style shapes the repository uses elsewhere must pass.
	if !mixesNamedAndPositional("UPDATE artifact_lifecycles SET stage=:stage WHERE id=$1 AND tenant_id=$2") {
		t.Fatal("detector failed to flag the pre-fix mixed statement")
	}
	if mixesNamedAndPositional("UPDATE artifact_lifecycles SET stage=:stage WHERE id=:id AND tenant_id=:tenant_id") {
		t.Fatal("detector flagged an all-named statement")
	}
	if mixesNamedAndPositional("SELECT * FROM artifact_lifecycles WHERE id=$1 AND tenant_id=$2") {
		t.Fatal("detector flagged an all-positional statement")
	}
}

var reLifecycleWord = regexp.MustCompile(`artifact_lifecycle\b`)

func TestSource_StatementsAddressArtifactLifecycles(t *testing.T) {
	for range reLifecycleWord.FindAllStringIndex(repoSource(t), -1) {
		t.Errorf("artifact_lifecycle is not a relation any migration created; " +
			"094 creates artifact_lifecycles and 239/570/572 own it")
	}
	if !reLifecycleWord.MatchString("SELECT * FROM artifact_lifecycle WHERE id=$1") {
		t.Fatal("detector failed to match the singular relation name")
	}
	if reLifecycleWord.MatchString("SELECT * FROM artifact_lifecycles WHERE id=$1") {
		t.Fatal("detector matched the plural relation name")
	}
}

// A method that reads one record and returns (*T, error) must convert
// sql.ErrNoRows into sentinel.NotFound, because the service decides
// duplicate-vs-missing by testing exactly that sentinel. The detector walks the
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
		if !strings.Contains(body, "GetContext(ctx, &lc") || !strings.Contains(body, "return nil, err") {
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

	// Positive control: the pre-fix GetByID body must be reported.
	preFix := repoFuncDecl + ` GetByID(ctx context.Context, tenantID, id string) (*models.ArtifactLifecycle, error) {
	var lc models.ArtifactLifecycle
	err := r.db.GetContext(ctx, &lc,
		"SELECT * FROM artifact_lifecycles WHERE id=$1 AND tenant_id=$2", id, tenantID)
	if err != nil {
		return nil, err
	}
	return &lc, nil
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
