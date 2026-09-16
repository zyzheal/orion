package repository

import (
	"context"
	"regexp"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"

	"orion/platform-svc-go/internal/incident-action/models"
)

func newMockRepo(t *testing.T) (sqlmock.Sqlmock, *Repository) {
	t.Helper()
	db, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherRegexp))
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	return mock, NewRepository(sqlx.NewDb(db, "postgres"))
}

func actionRow(id, tenant, name, value string, enabled bool) *sqlmock.Rows {
	return sqlmock.NewRows([]string{
		"id", "tenant_id", "name", "value", "enabled", "created_at", "updated_at",
	}).AddRow(id, tenant, name, value, enabled, time.Now().UTC(), time.Now().UTC())
}

// Update built its SET clause from the caller's map keys but bound the WHERE
// keys at $idx-2 and $idx-1, which after two SET placeholders is $1 and $2 —
// the last two *values* rather than id and tenant_id. The UPDATE therefore
// matched nothing and GetByID returned the stale row, so every write was a
// silent no-op. Asserting the exact placeholder layout plus err == nil is what
// makes this test non-vacuous.
func TestUpdateBindsWhitelistedColumnsPositionally(t *testing.T) {
	mock, repo := newMockRepo(t)
	mock.ExpectExec(
		`UPDATE incident_actions SET name = \$1, value = \$2, enabled = \$3, `+
			`updated_at = \$4 WHERE id = \$5 AND tenant_id = \$6`,
	).WithArgs("n2", "v2", false, sqlmock.AnyArg(), "a-1", "tenant-a").
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectQuery(
		`SELECT \* FROM incident_actions WHERE id = \$1 AND tenant_id = \$2`,
	).WithArgs("a-1", "tenant-a").WillReturnRows(actionRow("a-1", "tenant-a", "n2", "v2", false))

	got, err := repo.Update(context.Background(), "tenant-a", "a-1", map[string]interface{}{
		"name":    "n2",
		"value":   "v2",
		"enabled": false,
	})
	if err != nil {
		t.Fatalf("Update: %v: id and tenant_id must be bound after the SET values", err)
	}
	if got == nil || got.ID != "a-1" || got.Name != "n2" || got.Value != "v2" || got.Enabled {
		t.Fatalf("Update returned %+v", got)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

// A key such as "tenant_id" was interpolated into the SET clause verbatim, so a
// caller could relocate its own row into another tenant. The whitelist must turn
// that into a caller error before any statement is issued.
func TestUpdateRejectsNonWritableColumn(t *testing.T) {
	mock, repo := newMockRepo(t)

	got, err := repo.Update(context.Background(), "tenant-a", "a-1", map[string]interface{}{
		"tenant_id": "tenant-b",
	})
	if err == nil {
		t.Fatalf("Update accepted a non-writable column: %+v", got)
	}
	if got != nil {
		t.Fatalf("Update returned a row on error: %+v", got)
	}
	if !regexp.MustCompile(`unknown update field: "tenant_id"`).MatchString(err.Error()) {
		t.Fatalf("unexpected error: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("a failing Update must not issue any statement: %v", err)
	}
}

// Keys are interpolated into SQL, so a key containing a clause separator used
// to be a raw-SQL injection site. The whitelist must reject it as an unknown
// column instead of parsing it.
func TestUpdateRejectsInjectionShapedKey(t *testing.T) {
	_, repo := newMockRepo(t)
	const evil = "name = $1, tenant_id = 'tenant-b' --"

	got, err := repo.Update(context.Background(), "tenant-a", "a-1", map[string]interface{}{
		evil: "1",
	})
	if err == nil {
		t.Fatalf("Update accepted an injection-shaped key: %+v", got)
	}
	if got != nil {
		t.Fatalf("Update returned a row on error: %+v", got)
	}
	if !regexp.MustCompile(`unknown update field: `).MatchString(err.Error()) {
		t.Fatalf("unexpected error: %v", err)
	}
}

// An empty body must stay a read-only no-op: it returns the current row and
// issues no UPDATE.
func TestUpdateEmptyMapIsReadOnly(t *testing.T) {
	mock, repo := newMockRepo(t)
	mock.ExpectQuery(
		`SELECT \* FROM incident_actions WHERE id = \$1 AND tenant_id = \$2`,
	).WithArgs("a-1", "tenant-a").WillReturnRows(actionRow("a-1", "tenant-a", "n", "v", true))

	got, err := repo.Update(context.Background(), "tenant-a", "a-1", map[string]interface{}{})
	if err != nil {
		t.Fatalf("Update: %v", err)
	}
	if got == nil || got.ID != "a-1" {
		t.Fatalf("Update returned %+v", got)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("an empty Update must not issue a statement: %v", err)
	}
}

// Pin the whitelist so a future "fix" that widens it (notably by adding
// tenant_id) fails here rather than silently re-opening mass assignment.
func TestUpdateableColumnsExcludesIdentityColumns(t *testing.T) {
	want := map[string]bool{"name": true, "value": true, "enabled": true}
	if len(models.UpdateableColumns) != len(want) {
		t.Fatalf("UpdateableColumns = %v", models.UpdateableColumns)
	}
	for _, c := range models.UpdateableColumns {
		if !want[c] {
			t.Fatalf("UpdateableColumns contains %q, which callers must not write", c)
		}
	}
}
