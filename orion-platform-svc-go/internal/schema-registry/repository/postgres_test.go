package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"testing"
	"time"

	"orion/platform-svc-go/internal/schema-registry/models"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"
)

// The matcher compares statements after collapsing whitespace, so an
// expectation written against "INSERT INTO schema_registry_versions ..." will
// not quietly satisfy a statement with a different column list. sqlx.NewDb
// never calls Unsafe, which is how go-common builds the production handle.
var ws = regexp.MustCompile(`\s+`)

func normSQL(s string) string {
	return strings.TrimSpace(ws.ReplaceAllString(s, " "))
}

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

// schemaRows returns one row shaped exactly like the aliases in `columns`, so
// the best-effort schema snapshot that AppendVersion takes is exercised rather
// than silently skipped.
// insertVersionSQL and updateVersionSQL are the two statements AppendVersion
// can issue. They are written out in full so the exact matcher compares the
// whole statement: a prefix expectation would let a dropped or reordered column
// slip through.
const insertVersionSQL = `
	INSERT INTO schema_registry_versions
		(id, tenant_id, namespace, name, version, schema_json, changes, released_at, released_by, created_at)
	VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`

const updateVersionSQL = `
	UPDATE schema_registry_versions
	 SET schema_json=$1, changes=$2, released_at=$3, released_by=$4
	 WHERE tenant_id = 'default' AND namespace = $5 AND name = $6 AND version = $7`

func schemaRows() *sqlmock.Rows {
	return sqlmock.NewRows([]string{
		"id", "tenantid", "namespace", "name", "type", "version", "status",
		"owner", "description", "fieldsraw", "relationshipsraw", "indexesraw",
		"compatibility", "metadatraw", "createdat", "updatedat",
	}).AddRow("ns1/users", "default", "ns1", "users", "postgresql", 1, "active",
		"alice", "the users table", []byte(`[{"name":"id","type":"int64"}]`), nil, nil,
		"backward", nil, time.Date(2026, 1, 2, 3, 4, 5, 0, time.UTC), time.Date(2026, 1, 3, 3, 4, 5, 0, time.UTC))
}

func TestAppendVersionInsertsTheVersionRow(t *testing.T) {
	db, mock := mockDB(t)
	releasedAt := time.Date(2026, 1, 2, 3, 4, 5, 0, time.UTC)

	mock.ExpectQuery(normSQL(`SELECT `+columns+` FROM schema_registry WHERE tenant_id = 'default' AND namespace = $1 AND name = $2`)).
		WithArgs("ns1", "users").WillReturnRows(schemaRows())
	mock.ExpectExec(insertVersionSQL).
		WithArgs(sqlmock.AnyArg(), "default", "ns1", "users", 7,
			sqlmock.AnyArg(), nil, releasedAt, "alice", sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(1, 1))

	err := NewPostgres(db).AppendVersion(context.Background(), "ns1", "users",
		&models.SchemaVersion{Version: 7, ReleasedBy: "alice", ReleasedAt: releasedAt})
	if err != nil {
		t.Fatalf("AppendVersion: %v", err)
	}
	// A stray UPDATE expectation is left unmet by an insert that succeeded, and
	// an insert that was dropped into a blank identifier leaves this unmet too.
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("not every expected statement ran: %v", err)
	}
}

func TestAppendVersionUpgradesAnExistingVersionInPlace(t *testing.T) {
	db, mock := mockDB(t)
	releasedAt := time.Date(2026, 1, 2, 3, 4, 5, 0, time.UTC)

	mock.ExpectQuery(normSQL(`SELECT `+columns+` FROM schema_registry WHERE tenant_id = 'default' AND namespace = $1 AND name = $2`)).
		WithArgs("ns1", "users").WillReturnRows(schemaRows())
	mock.ExpectExec(insertVersionSQL).
		WillReturnError(errors.New("duplicate key value violates unique constraint uq_schema_registry_versions"))
	mock.ExpectExec(updateVersionSQL).
		WithArgs(sqlmock.AnyArg(), nil, releasedAt, "bob", "ns1", "users", 3).
		WillReturnResult(sqlmock.NewResult(1, 1))

	err := NewPostgres(db).AppendVersion(context.Background(), "ns1", "users",
		&models.SchemaVersion{Version: 3, ReleasedBy: "bob", ReleasedAt: releasedAt})
	if err != nil {
		t.Fatalf("a colliding version that updates cleanly must report success, got %v", err)
	}
	// Both statements must have run: ExpectationsWereMet fails if the unique
	// branch never issued the UPDATE at all.
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("the in-place UPDATE was not issued: %v", err)
	}
}

// The unique branch used to end in "return nil" no matter what the UPDATE did,
// because the result was assigned to two blank identifiers. A versions table
// that collides and then refuses the update therefore reported success all the
// way up to the client.
func TestAppendVersionReportsAFailedInPlaceUpdate(t *testing.T) {
	db, mock := mockDB(t)
	releasedAt := time.Date(2026, 1, 2, 3, 4, 5, 0, time.UTC)
	deadlock := errors.New("deadlock detected")

	mock.ExpectQuery(normSQL(`SELECT `+columns+` FROM schema_registry WHERE tenant_id = 'default' AND namespace = $1 AND name = $2`)).
		WithArgs("ns1", "users").WillReturnRows(schemaRows())
	mock.ExpectExec(insertVersionSQL).
		WillReturnError(errors.New("duplicate key value violates unique constraint uq_schema_registry_versions"))
	mock.ExpectExec(updateVersionSQL).
		WillReturnError(deadlock)

	err := NewPostgres(db).AppendVersion(context.Background(), "ns1", "users",
		&models.SchemaVersion{Version: 3, ReleasedBy: "bob", ReleasedAt: releasedAt})
	if err == nil {
		t.Fatalf("a failed in-place UPDATE reported success")
	}
	if !errors.Is(err, deadlock) {
		t.Fatalf("error %v does not wrap the underlying driver error", err)
	}
	if !strings.Contains(err.Error(), "version 3") || !strings.Contains(err.Error(), "ns1/users") {
		t.Fatalf("error %q must name the version and schema that were left behind", err.Error())
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("%v", err)
	}
}

// AppendVersion fills in a zero ReleasedAt for the statement it sends. It must
// not rewrite the timestamp the caller already chose, or two concurrent callers
// would observe different values for the same version.
func TestAppendVersionKeepsTheReleasedAtTheCallerSent(t *testing.T) {
	db, mock := mockDB(t)
	releasedAt := time.Date(2026, 1, 2, 3, 4, 5, 0, time.UTC)
	before := releasedAt

	mock.ExpectQuery(normSQL(`SELECT `+columns+` FROM schema_registry WHERE tenant_id = 'default' AND namespace = $1 AND name = $2`)).
		WithArgs("ns1", "users").WillReturnRows(schemaRows())
	mock.ExpectExec(insertVersionSQL).
		WillReturnResult(sqlmock.NewResult(1, 1))

	v := &models.SchemaVersion{Version: 1, ReleasedBy: "alice", ReleasedAt: releasedAt}
	if err := NewPostgres(db).AppendVersion(context.Background(), "ns1", "users", v); err != nil {
		t.Fatalf("AppendVersion: %v", err)
	}
	if !v.ReleasedAt.Equal(before) {
		t.Fatalf("ReleasedAt changed from %v to %v", before, v.ReleasedAt)
	}
}

// A schema snapshot is optional: if the schema row cannot be read the version
// is still recorded, just without a snapshot. A repository failure in the
// snapshot step must not prevent the version row from being written.
func TestAppendVersionStillRecordsTheVersionWithoutASchemaSnapshot(t *testing.T) {
	db, mock := mockDB(t)
	releasedAt := time.Date(2026, 1, 2, 3, 4, 5, 0, time.UTC)

	mock.ExpectQuery(normSQL(`SELECT `+columns+` FROM schema_registry WHERE tenant_id = 'default' AND namespace = $1 AND name = $2`)).
		WithArgs("ns1", "users").WillReturnError(sql.ErrNoRows)
	mock.ExpectExec(insertVersionSQL).
		WillReturnResult(sqlmock.NewResult(1, 1))

	err := NewPostgres(db).AppendVersion(context.Background(), "ns1", "users",
		&models.SchemaVersion{Version: 1, ReleasedBy: "alice", ReleasedAt: releasedAt})
	if err != nil {
		t.Fatalf("a missing snapshot must not block the version row: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("%v", err)
	}
}
