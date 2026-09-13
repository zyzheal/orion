package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"regexp"
	"strings"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"
	"orion/platform-svc-go/internal/roweditor"
)

// exactMatcher compares queries after collapsing whitespace, so the multi-line
// SQL in this package can be written against a single-line expectation. It is
// string equality, not a regexp, so expectations are plain SQL.
func exactMatcher(expectedSQL, actualSQL string) error {
	normalize := func(s string) string {
		s = regexp.MustCompile(`\s+`).ReplaceAllString(s, " ")
		return strings.TrimSpace(s)
	}
	exp, act := normalize(expectedSQL), normalize(actualSQL)
	if exp == act {
		return nil
	}
	return &sqlMismatch{expected: exp, actual: act}
}

type sqlMismatch struct{ expected, actual string }

func (m *sqlMismatch) Error() string {
	return "sql mismatch:\n expected: " + m.expected + "\n    actual: " + m.actual
}

func newMockDB(t *testing.T) (*sqlx.DB, sqlmock.Sqlmock) {
	t.Helper()
	db, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherFunc(exactMatcher)))
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	return sqlx.NewDb(db, "postgres"), mock
}

const saveSQL = `INSERT INTO row_editor (id, tenant_id, key, value, created_at, updated_at) VALUES ($1, $2, $3, $4, NOW(), NOW()) ON CONFLICT (tenant_id, key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW()`
const getSQL = `SELECT * FROM row_editor WHERE tenant_id=$1 AND key=$2`
const listSQL = `SELECT * FROM row_editor WHERE tenant_id=$1 ORDER BY key`
const deleteSQL = `DELETE FROM row_editor WHERE tenant_id=$1 AND key=$2`
const existsSQL = `SELECT EXISTS(SELECT 1 FROM row_editor WHERE tenant_id=$1 AND key=$2)`

func specJSON(t *testing.T, spec roweditor.RowSpec) string {
	t.Helper()
	b, err := json.Marshal(spec)
	if err != nil {
		t.Fatalf("spec is not marshalable: %v", err)
	}
	return string(b)
}

func rowsFor(keys ...string) *sqlmock.Rows {
	rows := sqlmock.NewRows([]string{"id", "tenant_id", "key", "value", "created_at", "updated_at"})
	for _, k := range keys {
		rows.AddRow("11111111-1111-1111-1111-111111111111", "t1", k, k, time.Now(), time.Now())
	}
	return rows
}

func TestRepositoryGetIsTenantScoped(t *testing.T) {
	db, mock := newMockDB(t)
	r := NewRepository(db)

	mock.ExpectQuery(getSQL).
		WithArgs("t1", "users").
		WillReturnRows(sqlmock.NewRows([]string{"id", "tenant_id", "key", "value", "created_at", "updated_at"}).
			AddRow("11111111-1111-1111-1111-111111111111", "t1", "users", specJSON(t, roweditor.RowSpec{
				TableName:  "users",
				PrimaryKey: "id",
				Columns:    []roweditor.ColumnSpec{{Name: "id"}, {Name: "email", Required: true}},
			}), time.Now(), time.Now()))

	got, err := r.Get(context.Background(), "t1", "users")
	if err != nil {
		t.Fatalf("Get() error = %v", err)
	}
	if got == nil {
		t.Fatal("Get() returned nil")
	}
	if got.TableName != "users" {
		t.Fatalf("Get() table = %q, want users", got.TableName)
	}
	if len(got.Columns) != 2 || !got.Columns[1].Required {
		t.Fatalf("Get() lost the Required flag: %+v", got.Columns)
	}
	if got.Columns[1].Validate != nil {
		t.Fatal("Get() must not invent a validator; attach it with AttachRequiredValidators")
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestRepositoryGetReturnsNilWithoutRegistering(t *testing.T) {
	db, mock := newMockDB(t)
	r := NewRepository(db)

	// An empty result is "this tenant has not registered this editor", not an
	// error. Treating it as one made every unknown name a 500.
	mock.ExpectQuery(getSQL).
		WithArgs("t1", "missing").
		WillReturnError(sql.ErrNoRows)

	got, err := r.Get(context.Background(), "t1", "missing")
	if err != nil {
		t.Fatalf("Get() error = %v, want nil", err)
	}
	if got != nil {
		t.Fatalf("Get() = %+v, want nil", got)
	}
}

func TestRepositoryGetWrapsCorruptSpec(t *testing.T) {
	db, mock := newMockDB(t)
	r := NewRepository(db)

	mock.ExpectQuery(getSQL).
		WithArgs("t1", "users").
		WillReturnRows(sqlmock.NewRows([]string{"id", "tenant_id", "key", "value", "created_at", "updated_at"}).
			AddRow("11111111-1111-1111-1111-111111111111", "t1", "users", "{not json", time.Now(), time.Now()))

	got, err := r.Get(context.Background(), "t1", "users")
	if err == nil {
		t.Fatal("Get() must fail on a corrupt spec")
	}
	if got != nil {
		t.Fatalf("Get() = %+v, want nil", got)
	}
	if !strings.Contains(err.Error(), "corrupt spec") {
		t.Fatalf("Get() error = %q, want the corrupt-spec wrapper", err.Error())
	}
}

func TestRepositoryListIsTenantScopedAndSkipsCorruptRows(t *testing.T) {
	db, mock := newMockDB(t)
	r := NewRepository(db)

	mock.ExpectQuery(listSQL).
		WithArgs("t1").
		WillReturnRows(sqlmock.NewRows([]string{"id", "tenant_id", "key", "value", "created_at", "updated_at"}).
			AddRow("11111111-1111-1111-1111-111111111111", "t1", "broken", "{not json", time.Now(), time.Now()).
			AddRow("22222222-2222-2222-2222-222222222222", "t1", "users", specJSON(t, roweditor.RowSpec{
				TableName: "users", PrimaryKey: "id", Columns: []roweditor.ColumnSpec{{Name: "id"}},
			}), time.Now(), time.Now()))

	got := r.List(context.Background(), "t1")
	if len(got) != 1 {
		t.Fatalf("List() returned %d specs, want 1 (the corrupt row is skipped)", len(got))
	}
	spec, ok := got["users"]
	if !ok {
		t.Fatalf("List() = %v, want a users entry", got)
	}
	if spec.TableName != "users" {
		t.Fatalf("List() users table = %q, want users", spec.TableName)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestRepositoryDeleteIsTenantScoped(t *testing.T) {
	db, mock := newMockDB(t)
	r := NewRepository(db)

	mock.ExpectExec(deleteSQL).
		WithArgs("t1", "users").
		WillReturnResult(sqlmock.NewResult(0, 1))

	if err := r.Delete(context.Background(), "t1", "users"); err != nil {
		t.Fatalf("Delete() error = %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestRepositoryExistsIsTenantScoped(t *testing.T) {
	db, mock := newMockDB(t)
	r := NewRepository(db)

	mock.ExpectQuery(existsSQL).
		WithArgs("t1", "users").
		WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(true))

	if !r.Exists(context.Background(), "t1", "users") {
		t.Fatal("Exists() = false, want true")
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestRepositorySavePersistsSpecWithValidator(t *testing.T) {
	db, mock := newMockDB(t)
	r := NewRepository(db)

	mock.ExpectExec(saveSQL).
		WithArgs(sqlmock.AnyArg(), "t1", "users", sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(0, 1))

	// A spec that carries a validator used to fail here: encoding/json returns
	// "unsupported type: func(...) error" for a struct field of func type, so
	// every registration with a required column returned 500.
	spec := roweditor.RowSpec{
		TableName:  "users",
		PrimaryKey: "id",
		Columns:    []roweditor.ColumnSpec{{Name: "id"}, {Name: "email", Required: true, Validate: roweditor.ValidateRequired}},
	}
	if err := r.Save(context.Background(), "t1", "users", spec); err != nil {
		t.Fatalf("Save() error = %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestRepositorySavePinsTenantAndKey(t *testing.T) {
	db, mock := newMockDB(t)
	r := NewRepository(db)

	// The expectation pins the tenant argument, so a Save that dropped the
	// tenant would fail the arg check rather than the SQL comparison.
	mock.ExpectExec(saveSQL).
		WithArgs(sqlmock.AnyArg(), "tenant-b", "users", sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(0, 1))

	spec := roweditor.RowSpec{TableName: "users", PrimaryKey: "id", Columns: []roweditor.ColumnSpec{{Name: "id"}}}
	if err := r.Save(context.Background(), "tenant-b", "users", spec); err != nil {
		t.Fatalf("Save() error = %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestSpecJSONOmitsValidatorAndKeepsRequired(t *testing.T) {
	// The wire format must carry Required (so the rule survives a restart) but
	// not Validate (so Marshal does not reject the struct). Dropping the
	// json:"-" tag makes Save unusable; dropping Required makes the rule vanish
	// after a restart.
	spec := roweditor.RowSpec{
		TableName:  "users",
		PrimaryKey: "id",
		Columns:    []roweditor.ColumnSpec{{Name: "email", Required: true, Validate: roweditor.ValidateRequired}},
	}
	b, err := json.Marshal(spec)
	if err != nil {
		t.Fatalf("Marshal() error = %v", err)
	}
	jsonText := string(b)
	if strings.Contains(jsonText, "Validate") {
		t.Fatalf("spec JSON must not carry the validator: %s", jsonText)
	}
	if !strings.Contains(jsonText, `"Required":true`) {
		t.Fatalf("spec JSON must carry Required so the rule survives: %s", jsonText)
	}

	round := roweditor.RowSpec{}
	if err := json.Unmarshal(b, &round); err != nil {
		t.Fatalf("Unmarshal() error = %v", err)
	}
	if len(round.Columns) != 1 || !round.Columns[0].Required {
		t.Fatalf("round trip lost Required: %+v", round.Columns)
	}
	round.AttachRequiredValidators()
	if round.Columns[0].Validate == nil {
		t.Fatal("AttachRequiredValidators() did not re-attach the validator")
	}
	if err := round.Columns[0].Validate(""); err == nil {
		t.Fatal("the restored validator must still reject an empty value")
	}
}
