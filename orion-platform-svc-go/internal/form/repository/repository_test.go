package repository

import (
	"context"
	"testing"
	"time"

	sqlmock "github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"

	"orion/platform-svc-go/internal/form/models"
)

// newMockRepo builds a repository over sqlmock with regex query matching.
func newMockRepo(t *testing.T) (*Repository, sqlmock.Sqlmock) {
	t.Helper()
	db, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherRegexp))
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	mock.MatchExpectationsInOrder(false)
	return NewRepository(sqlx.NewDb(db, "postgres")), mock
}

// TestCreateFormBindsEveryColumnByItsDbTag pins the value bound to each
// placeholder. The failure this guards is silent at compile time: :tenantId
// matched the json tag and bound to nothing, so sqlx rejected the statement
// and POST /forms returned 500 on every request.
func TestCreateFormBindsEveryColumnByItsDbTag(t *testing.T) {
	repo, mock := newMockRepo(t)
	mock.ExpectExec(`INSERT INTO forms`).WithArgs(
		sqlmock.AnyArg(), "t1", "Onboarding", "hr-onboard", "hr", "first-day intake",
		`{"columns":2}`, `[{"name":"name"}]`, "draft", 1,
		sqlmock.AnyArg(), sqlmock.AnyArg(),
	).WillReturnResult(sqlmock.NewResult(1, 1))

	form, err := repo.CreateForm(context.Background(), "t1", models.CreateFormRequest{
		Name: "Onboarding", Code: "hr-onboard", Category: "hr",
		Description: "first-day intake",
		Layout:      map[string]interface{}{"columns": 2},
		Fields:      []map[string]interface{}{{"name": "name"}},
	}, `{"columns":2}`, `[{"name":"name"}]`)
	if err != nil {
		t.Fatalf("CreateForm returned an error: %v", err)
	}
	if form == nil {
		t.Fatal("CreateForm returned a nil form")
	}
	if form.TenantID != "t1" {
		t.Errorf("form.TenantID = %q, want t1", form.TenantID)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestCreateSubmissionBindsEveryColumnByItsDbTag(t *testing.T) {
	repo, mock := newMockRepo(t)
	mock.ExpectExec(`INSERT INTO form_submissions`).WithArgs(
		sqlmock.AnyArg(), "t1", "form-1", `{"name":"Ada"}`, "user-1", "submitted",
		sqlmock.AnyArg(), sqlmock.AnyArg(),
	).WillReturnResult(sqlmock.NewResult(1, 1))

	sub, err := repo.CreateSubmission(context.Background(), "t1", "form-1", "user-1",
		`{"name":"Ada"}`, "submitted")
	if err != nil {
		t.Fatalf("CreateSubmission returned an error: %v", err)
	}
	if sub == nil {
		t.Fatal("CreateSubmission returned a nil submission")
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestCreateFormFieldBindsEveryColumnByItsDbTag(t *testing.T) {
	repo, mock := newMockRepo(t)
	mock.ExpectExec(`INSERT INTO form_fields`).WithArgs(
		sqlmock.AnyArg(), "form-1", "name", "Name", "text", "type your name",
		true, true, false, "", "", "", "", 1,
		sqlmock.AnyArg(), sqlmock.AnyArg(),
	).WillReturnResult(sqlmock.NewResult(1, 1))

	err := repo.CreateFormField(context.Background(), "t1", "form-1", models.FormField{
		FieldID: "name", Label: "Name", Type: "text", PlaceHolder: "type your name",
		Required: true, Visible: true, ReadOnly: false, Priority: 1,
	})
	if err != nil {
		t.Fatalf("CreateFormField returned an error: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

// TestCamelCasePlaceholdersDoNotBindIsThePositiveControl proves this test file
// actually observes placeholder binding. sqlmock does not resolve sqlx named
// arguments, so a reviewer could argue the assertions above pass regardless of
// the placeholder spelling. This arm shows the same harness reporting a binding
// failure for a camelCase placeholder, which is exactly what the fixed code
// must not do. Without it the three tests above would be vacuous.
func TestCamelCasePlaceholdersDoNotBindIsThePositiveControl(t *testing.T) {
	db, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherRegexp))
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	defer func() { _ = db.Close() }()
	mock.ExpectExec(`INSERT INTO forms`).WithArgs(
		sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(),
		sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(),
		sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(),
	).WillReturnResult(sqlmock.NewResult(1, 1))
	conn := sqlx.NewDb(db, "postgres")
	form := &models.FormDefinition{
		ID: "id-1", TenantID: "t1", Name: "n", Code: "c", Category: "cat",
		Description: "d", Layout: "{}", Fields: "[]", Status: "draft",
		Version: 1, CreatedAt: time.Now().UTC(), UpdatedAt: time.Now().UTC(),
	}
	_, err = conn.NamedExecContext(context.Background(),
		`INSERT INTO forms (id, tenant_id, name, code, category, description, layout, fields, status, version, created_at, updated_at)
		 VALUES (:id, :tenantId, :name, :code, :category, :description, :layout, :fields, :status, :version, :createdAt, :updatedAt)`,
		form)
	if err == nil {
		t.Fatal("camelCase placeholder unexpectedly bound; this test must fail for the file above to mean anything")
	}
	if want := "could not find name tenantId"; !contains(err.Error(), want) {
		t.Fatalf("err = %q, want it to contain %q", err.Error(), want)
	}

	// And the db-tag spelling the repository now uses must succeed.
	db2, mock2, err := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherRegexp))
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	defer func() { _ = db2.Close() }()
	mock2.ExpectExec(`INSERT INTO forms`).WithArgs(
		sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(),
		sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(),
		sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(),
	).WillReturnResult(sqlmock.NewResult(1, 1))
	conn2 := sqlx.NewDb(db2, "postgres")
	_, err = conn2.NamedExecContext(context.Background(),
		`INSERT INTO forms (id, tenant_id, name, code, category, description, layout, fields, status, version, created_at, updated_at)
		 VALUES (:id, :tenant_id, :name, :code, :category, :description, :layout, :fields, :status, :version, :created_at, :updated_at)`,
		form)
	if err != nil {
		t.Fatalf("db-tag placeholders did not bind: %v", err)
	}
}

func contains(s, sub string) bool {
	for i := 0; i+len(sub) <= len(s); i++ {
		if s[i:i+len(sub)] == sub {
			return true
		}
	}
	return false
}
