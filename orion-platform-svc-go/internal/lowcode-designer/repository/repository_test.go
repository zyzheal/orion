package repository

import (
	"context"
	"errors"
	"fmt"
	"os"
	"regexp"
	"strings"
	"testing"
	"time"

	"orion/platform-svc-go/internal/lowcode-designer/models"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"
)

// The matcher compares statements after collapsing whitespace, so an
// expectation written against a full "SELECT ... FROM form_definition WHERE ..."
// statement cannot quietly satisfy a statement that only says "WHERE tenant_id
// = $1". That is the defect under test here.
var ws = regexp.MustCompile(`\s+`)

// reUpdateWord finds an UPDATE statement. A plain Contains check for
// UPDATE also matches updated_at, so the empty-attrs tests could never
// have failed.
var reUpdateWord = regexp.MustCompile(`(?i)\bUPDATE\b`)

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

// mockDBRecording returns a database plus a record of every statement it was
// handed, so a test can assert that a statement was never issued.
// ExpectationsWereMet cannot prove that for an expectation that was never
// registered.
func mockDBRecording(t *testing.T) (*sqlx.DB, sqlmock.Sqlmock, *[]string) {
	t.Helper()
	seen := []string{}
	raw, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherFunc(func(expected, actual string) error {
		seen = append(seen, normSQL(actual))
		if normSQL(expected) != normSQL(actual) {
			return fmt.Errorf("sql mismatch: want %q got %q", expected, actual)
		}
		return nil
	})))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = raw.Close() })
	return sqlx.NewDb(raw, "postgres"), mock, &seen
}

// Hand-transcribed copies of the statements the repository emits. Writing them
// out instead of referencing the constants keeps this test able to fail when
// the repository's column list or placeholder numbering drifts.
const formCreate = "INSERT INTO form_definition (id, tenant_id, name, title, description, " +
	"version, status, category, module_name, tags, layout, fields, meta, created_by, " +
	"updated_by, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)"

const fieldCreate = "INSERT INTO form_field (id, tenant_id, form_id, key, label, type, " +
	"required, visible, disabled, placeholder, default_val, options, rules, meta, " +
	"layout_config, sortable_index, parent_key, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)"

const templateCreate = "INSERT INTO form_template (id, tenant_id, name, description, " +
	"category, is_builtin, form_schema, preview_url, usage_count, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)"

const instanceCreate = "INSERT INTO form_instance (id, tenant_id, form_id, data, status, " +
	"submitted_by, submitted_at, approved_by, approved_at, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)"

const componentCreate = "INSERT INTO component_registry (id, tenant_id, name, display_name, " +
	"category, version, props_schema, default_config, icon, is_builtin, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)"

func names(constant string) []string {
	parts := strings.Split(constant, ", ")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		out = append(out, strings.TrimSpace(p))
	}
	return out
}

var now = time.Date(2026, 1, 2, 3, 4, 5, 0, time.UTC)

func formFixture(t *testing.T) *sqlmock.Rows {
	t.Helper()
	return sqlmock.NewRows(names(formColumns)).AddRow(
		"fd-1", "t-1", "user-form", "User Registration", "a form",
		1, "draft", "auth", "auth", `["beta"]`, `{"tabs":2}`, `[{"key":"email"}]`,
		`{"owner":"team"}`, "u-1", "u-1", now, now)
}

func fieldFixture(t *testing.T) *sqlmock.Rows {
	t.Helper()
	return sqlmock.NewRows(names(fieldColumns)).AddRow(
		"ff-1", "t-1", "fd-1", "email", "Email", "text",
		true, true, false, "you@x", `{"hex":"#000"}`, `["a","b"]`, `[{"min":3}]`,
		`{"hint":1}`, `{"col":2}`, 4, "section", now, now)
}

func templateFixture(t *testing.T) *sqlmock.Rows {
	t.Helper()
	return sqlmock.NewRows(names(templateColumns)).AddRow(
		"ft-1", "t-1", "login-tpl", "a template", "auth", false,
		`{"fields":[]}`, "https://x/preview", 7, now, now)
}

func instanceFixture(t *testing.T) *sqlmock.Rows {
	t.Helper()
	return sqlmock.NewRows(names(instanceColumns)).AddRow(
		"fi-1", "t-1", "fd-1", `{"email":"a@x"}`, "submitted",
		"u-1", now, "", nil, now, now)
}

func componentFixture(t *testing.T) *sqlmock.Rows {
	t.Helper()
	return sqlmock.NewRows(names(componentColumns)).AddRow(
		"cr-1", "t-1", "btn", "Button", "ui", "1.0.0",
		`{"label":"string"}`, `{"label":"Click"}`, "button", false, now)
}

// --- static checks over the repository source ---

// everySQLLine returns the non-comment lines of the repository source, so a
// check over the statements cannot be satisfied by text inside a comment.
func everySQLLine(t *testing.T, path string) []string {
	t.Helper()
	src, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	var lines []string
	for _, l := range strings.Split(string(src), "\n") {
		if strings.HasPrefix(strings.TrimSpace(l), "//") {
			continue
		}
		lines = append(lines, l)
	}
	return lines
}

func TestNoStatementUsesAMySQLPlaceholder(t *testing.T) {
	// The driver is lib/pq, a Postgres client. A "?" placeholder is not
	// Postgres syntax, so the statement fails before it reaches the server's
	// planner and every one of these methods fails on every call.
	for _, l := range everySQLLine(t, "repository.go") {
		if strings.Contains(l, "?") {
			t.Errorf("a statement uses a ? placeholder, which Postgres rejects: %s", strings.TrimSpace(l))
		}
	}
}

func TestNoStatementSelectsEveryColumn(t *testing.T) {
	// Migration 572 alters a thousand tables repository-wide, so a later
	// migration that adds one column to any of these five tables would make
	// every read here fail: safe-mode sqlx refuses a result column with no
	// matching struct field.
	for _, l := range everySQLLine(t, "repository.go") {
		if strings.Contains(strings.ToUpper(l), "SELECT *") {
			t.Errorf("a statement selects every column: %s", strings.TrimSpace(l))
		}
	}
}

func TestColumnListsNameEveryColumnOnce(t *testing.T) {
	for _, pair := range []struct {
		table    string
		constant string
	}{
		{"form_definition", formColumns},
		{"form_field", fieldColumns},
		{"form_template", templateColumns},
		{"form_instance", instanceColumns},
		{"component_registry", componentColumns},
	} {
		cols := names(pair.constant)
		if len(cols) == 0 {
			t.Fatalf("%s column list is empty", pair.table)
		}
		seen := map[string]bool{}
		for _, c := range cols {
			if c == "" || !regexp.MustCompile(`^[a-z0-9_]+$`).MatchString(c) {
				t.Errorf("%s column list has a malformed entry %q: %s", pair.table, c, pair.constant)
			}
			if seen[c] {
				t.Errorf("%s column list names %q twice: %s", pair.table, c, pair.constant)
			}
			seen[c] = true
		}
	}
}

// --- inserts ---

func TestCreateFormBindsAllSeventeenColumns(t *testing.T) {
	db, mock, seen := mockDBRecording(t)
	repo := NewRepository(db)

	mock.ExpectExec(normSQL(formCreate)).
		WithArgs("fd-1", "t-1", "user-form", "User Registration", "a form",
			1, "draft", "auth", "auth", `["beta"]`, `{"tabs":2}`, `[{"key":"email"}]`,
			`{"owner":"team"}`, "u-1", "u-1", now, now).
		WillReturnResult(sqlmock.NewResult(0, 1))

	err := repo.CreateForm(context.Background(), &models.FormDefinition{
		ID: "fd-1", TenantID: "t-1", Name: "user-form", Title: "User Registration",
		Description: "a form", Version: 1, Status: "draft", Category: "auth",
		ModuleName: "auth", Tags: `["beta"]`, Layout: `{"tabs":2}`,
		FieldsJSON: `[{"key":"email"}]`, Meta: `{"owner":"team"}`,
		CreatedBy: "u-1", UpdatedBy: "u-1", CreatedAt: now, UpdatedAt: now,
	})
	if err != nil {
		t.Fatalf("CreateForm: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("the insert did not reach the database: %v", err)
	}
	if len(*seen) != 1 {
		t.Fatalf("CreateForm issued %d statements: %v", len(*seen), *seen)
	}
	// One placeholder per column: a column added to the table without a bound
	// value would make every insert fail, and fields is NOT NULL with no
	// default, so it must never be bound as null.
	if got := len(names(formColumns)); got != 17 {
		t.Fatalf("the form column list names %d columns: %s", got, formColumns)
	}
	if got := strings.Count(normSQL(formCreate), "$"); got != 17 {
		t.Fatalf("the form insert has %d placeholders for %d columns", got, len(names(formColumns)))
	}
}

func TestCreateFormBindsNullForAnEmptyJSONAttribute(t *testing.T) {
	db, mock := mockDB(t)
	repo := NewRepository(db)

	mock.ExpectExec(normSQL(formCreate)).
		WithArgs("fd-1", "t-1", "plain", "Plain", "",
			1, "draft", "", "", nil, nil, `[{"key":"email"}]`, nil,
			"", "", now, now).
		WillReturnResult(sqlmock.NewResult(0, 1))

	err := repo.CreateForm(context.Background(), &models.FormDefinition{
		ID: "fd-1", TenantID: "t-1", Name: "plain", Title: "Plain",
		Version: 1, Status: "draft", FieldsJSON: `[{"key":"email"}]`,
		CreatedAt: now, UpdatedAt: now,
	})
	if err != nil {
		t.Fatalf("CreateForm: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("an empty json attribute was not bound as null: %v", err)
	}
}

func TestCreateFieldBindsNullForAnAbsentJSONAttribute(t *testing.T) {
	db, mock, seen := mockDBRecording(t)
	repo := NewRepository(db)

	mock.ExpectExec(normSQL(fieldCreate)).
		WithArgs("ff-1", "t-1", "fd-1", "email", "Email", "text",
			true, true, false, "", nil, nil, nil, nil, nil,
			1, "", now, now).
		WillReturnResult(sqlmock.NewResult(0, 1))

	err := repo.CreateField(context.Background(), &models.FormField{
		ID: "ff-1", TenantID: "t-1", FormID: "fd-1", Key: "email", Label: "Email",
		Type: "text", Required: true, Visible: true, SortableIndex: 1,
		CreatedAt: now, UpdatedAt: now,
	})
	if err != nil {
		t.Fatalf("CreateField: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("the five json attributes of a plain text field were not bound as null: %v", err)
	}
	if len(*seen) != 1 {
		t.Fatalf("CreateField issued %d statements: %v", len(*seen), *seen)
	}
}

func TestCreateFieldBindsJSONWhenPresent(t *testing.T) {
	db, mock := mockDB(t)
	repo := NewRepository(db)

	mock.ExpectExec(normSQL(fieldCreate)).
		WithArgs("ff-1", "t-1", "fd-1", "color", "Color", "select",
			false, true, false, "pick one", `{"hex":"#000"}`, `["red","green"]`,
			`[{"max":2}]`, `{"hint":1}`, `{"col":2}`, 3, "palette", now, now).
		WillReturnResult(sqlmock.NewResult(0, 1))

	err := repo.CreateField(context.Background(), &models.FormField{
		ID: "ff-1", TenantID: "t-1", FormID: "fd-1", Key: "color", Label: "Color",
		Type: "select", Visible: true, Placeholder: "pick one",
		DefaultVal: `{"hex":"#000"}`, Options: `["red","green"]`,
		Rules: `[{"max":2}]`, Meta: `{"hint":1}`, LayoutConfig: `{"col":2}`,
		SortableIndex: 3, ParentKey: "palette", CreatedAt: now, UpdatedAt: now,
	})
	if err != nil {
		t.Fatalf("CreateField: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("the json attributes were not bound: %v", err)
	}
}

func TestCreateTemplateBindsAllElevenColumns(t *testing.T) {
	db, mock := mockDB(t)
	repo := NewRepository(db)

	mock.ExpectExec(normSQL(templateCreate)).
		WithArgs("ft-1", "t-1", "login-tpl", "a template", "auth", false,
			`{"fields":[]}`, "https://x/preview", 7, now, now).
		WillReturnResult(sqlmock.NewResult(0, 1))

	err := repo.CreateTemplate(context.Background(), &models.FormTemplate{
		ID: "ft-1", TenantID: "t-1", Name: "login-tpl", Description: "a template",
		Category: "auth", FormSchema: `{"fields":[]}`, PreviewURL: "https://x/preview",
		UsageCount: 7, CreatedAt: now, UpdatedAt: now,
	})
	if err != nil {
		t.Fatalf("CreateTemplate: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("the insert did not bind all eleven columns: %v", err)
	}
}

func TestCreateInstanceBindsAllElevenColumns(t *testing.T) {
	db, mock := mockDB(t)
	repo := NewRepository(db)

	mock.ExpectExec(normSQL(instanceCreate)).
		WithArgs("fi-1", "t-1", "fd-1", `{"email":"a@x"}`, "submitted",
			"u-1", now, "", nil, now, now).
		WillReturnResult(sqlmock.NewResult(0, 1))

	err := repo.CreateInstance(context.Background(), &models.FormInstance{
		ID: "fi-1", TenantID: "t-1", FormID: "fd-1", Data: `{"email":"a@x"}`,
		Status: "submitted", SubmittedBy: "u-1", SubmittedAt: &now,
		CreatedAt: now, UpdatedAt: now,
	})
	if err != nil {
		t.Fatalf("CreateInstance: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("the insert did not bind all eleven columns: %v", err)
	}
}

func TestCreateComponentBindsNullForAnAbsentDefaultConfig(t *testing.T) {
	db, mock := mockDB(t)
	repo := NewRepository(db)

	mock.ExpectExec(normSQL(componentCreate)).
		WithArgs("cr-1", "t-1", "btn", "Button", "ui", "1.0.0",
			`{"label":"string"}`, nil, "button", false, now).
		WillReturnResult(sqlmock.NewResult(0, 1))

	err := repo.CreateComponent(context.Background(), &models.ComponentRegistry{
		ID: "cr-1", TenantID: "t-1", Name: "btn", DisplayName: "Button",
		Category: "ui", Version: "1.0.0", PropsSchema: `{"label":"string"}`,
		Icon: "button", CreatedAt: now,
	})
	if err != nil {
		t.Fatalf("CreateComponent: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("an absent default_config was not bound as null: %v", err)
	}
}

// --- reads ---

func TestGetFormReadsEveryColumnAndFiltersByTenant(t *testing.T) {
	db, mock := mockDB(t)
	repo := NewRepository(db)

	mock.ExpectQuery(normSQL("SELECT "+formColumns+" FROM form_definition WHERE id = $1 AND tenant_id = $2")).
		WithArgs("fd-1", "t-1").WillReturnRows(formFixture(t))

	got, err := repo.GetForm(context.Background(), "fd-1", "t-1")
	if err != nil {
		t.Fatalf("GetForm: %v", err)
	}
	if got.Name != "user-form" || got.FieldsJSON != `[{"key":"email"}]` {
		t.Fatalf("unexpected row: %+v", got)
	}
	if got.Tags != `["beta"]` || got.Layout != `{"tabs":2}` || got.Meta != `{"owner":"team"}` {
		t.Fatalf("the json columns were not read: %+v", got)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("GetForm did not issue the expected statement: %v", err)
	}
}

func TestGetFormPropagatesAStatementFailure(t *testing.T) {
	db, mock := mockDB(t)
	repo := NewRepository(db)
	fail := errors.New("relation form_definition does not exist")
	mock.ExpectQuery(normSQL("SELECT "+formColumns+" FROM form_definition WHERE id = $1 AND tenant_id = $2")).
		WithArgs("fd-1", "t-1").WillReturnError(fail)

	got, err := repo.GetForm(context.Background(), "fd-1", "t-1")
	if !errors.Is(err, fail) {
		t.Fatalf("error %q is not the statement failure", err)
	}
	if got != nil {
		t.Fatalf("GetForm returned %v for a failed statement", got)
	}
}

func TestListFormsBuildsPlaceholdersOffTheArgumentCount(t *testing.T) {
	db, mock := mockDB(t)
	repo := NewRepository(db)

	mock.ExpectQuery(normSQL("SELECT "+formColumns+" FROM form_definition WHERE tenant_id = $1 AND category = $2 AND status = $3 ORDER BY created_at DESC")).
		WithArgs("t-1", "auth", "draft").WillReturnRows(formFixture(t))

	items, err := repo.ListForms(context.Background(), "t-1", "auth", "draft")
	if err != nil {
		t.Fatalf("ListForms: %v", err)
	}
	if len(items) != 1 || items[0].Name != "user-form" {
		t.Fatalf("unexpected rows: %+v", items)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("ListForms did not number its placeholders per filter: %v", err)
	}
}

func TestListFormsOmitsAFillterClauseThatHasNoValue(t *testing.T) {
	db, mock := mockDB(t)
	repo := NewRepository(db)

	mock.ExpectQuery(normSQL("SELECT " + formColumns + " FROM form_definition WHERE tenant_id = $1 ORDER BY created_at DESC")).
		WithArgs("t-1").WillReturnRows(formFixture(t))

	if _, err := repo.ListForms(context.Background(), "t-1", "", ""); err != nil {
		t.Fatalf("ListForms: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("an empty filter still generated a clause: %v", err)
	}
}

func TestGetFieldReadsEveryColumn(t *testing.T) {
	db, mock := mockDB(t)
	repo := NewRepository(db)

	mock.ExpectQuery(normSQL("SELECT "+fieldColumns+" FROM form_field WHERE id = $1 AND tenant_id = $2")).
		WithArgs("ff-1", "t-1").WillReturnRows(fieldFixture(t))

	got, err := repo.GetField(context.Background(), "ff-1", "t-1")
	if err != nil {
		t.Fatalf("GetField: %v", err)
	}
	if got.Key != "email" || got.SortableIndex != 4 || got.ParentKey != "section" {
		t.Fatalf("unexpected row: %+v", got)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("GetField did not issue the expected statement: %v", err)
	}
}

func TestGetFieldsByFormOrdersBySortPosition(t *testing.T) {
	db, mock := mockDB(t)
	repo := NewRepository(db)

	mock.ExpectQuery(normSQL("SELECT "+fieldColumns+" FROM form_field WHERE form_id = $1 AND tenant_id = $2 ORDER BY sortable_index")).
		WithArgs("fd-1", "t-1").WillReturnRows(fieldFixture(t))

	items, err := repo.GetFieldsByForm(context.Background(), "fd-1", "t-1")
	if err != nil {
		t.Fatalf("GetFieldsByForm: %v", err)
	}
	if len(items) != 1 || items[0].FormID != "fd-1" {
		t.Fatalf("unexpected rows: %+v", items)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("GetFieldsByForm did not issue the expected statement: %v", err)
	}
}

func TestGetTemplateRequiresATenant(t *testing.T) {
	db, mock, seen := mockDBRecording(t)
	repo := NewRepository(db)

	mock.ExpectQuery(normSQL("SELECT "+templateColumns+" FROM form_template WHERE id = $1 AND tenant_id = $2")).
		WithArgs("ft-1", "t-1").WillReturnRows(templateFixture(t))

	got, err := repo.GetTemplate(context.Background(), "ft-1", "t-1")
	if err != nil {
		t.Fatalf("GetTemplate: %v", err)
	}
	if got.Name != "login-tpl" || got.UsageCount != 7 {
		t.Fatalf("unexpected row: %+v", got)
	}
	if len(*seen) != 1 {
		t.Fatalf("GetTemplate issued %d statements: %v", len(*seen), *seen)
	}
	if !strings.Contains((*seen)[0], "tenant_id = $2") {
		t.Fatalf("the tenant is not in the where clause: %s", (*seen)[0])
	}
}

func TestGetTemplateReturnsAStatementFailure(t *testing.T) {
	db, mock := mockDB(t)
	repo := NewRepository(db)
	fail := errors.New("relation form_template does not exist")
	mock.ExpectQuery(normSQL("SELECT "+templateColumns+" FROM form_template WHERE id = $1 AND tenant_id = $2")).
		WithArgs("ft-1", "t-1").WillReturnError(fail)

	got, err := repo.GetTemplate(context.Background(), "ft-1", "t-1")
	if !errors.Is(err, fail) {
		t.Fatalf("error %q is not the statement failure", err)
	}
	if got != nil {
		t.Fatalf("GetTemplate returned %v for a failed statement", got)
	}
}

func TestGetComponentRequiresATenant(t *testing.T) {
	db, mock, seen := mockDBRecording(t)
	repo := NewRepository(db)

	mock.ExpectQuery(normSQL("SELECT "+componentColumns+" FROM component_registry WHERE id = $1 AND tenant_id = $2")).
		WithArgs("cr-1", "t-1").WillReturnRows(componentFixture(t))

	got, err := repo.GetComponent(context.Background(), "cr-1", "t-1")
	if err != nil {
		t.Fatalf("GetComponent: %v", err)
	}
	if got.DisplayName != "Button" || got.PropsSchema != `{"label":"string"}` {
		t.Fatalf("unexpected row: %+v", got)
	}
	if len(*seen) != 1 {
		t.Fatalf("GetComponent issued %d statements: %v", len(*seen), *seen)
	}
	if !strings.Contains((*seen)[0], "tenant_id = $2") {
		t.Fatalf("the tenant is not in the where clause: %s", (*seen)[0])
	}
}

func TestGetComponentReturnsAStatementFailure(t *testing.T) {
	db, mock := mockDB(t)
	repo := NewRepository(db)
	fail := errors.New("relation component_registry does not exist")
	mock.ExpectQuery(normSQL("SELECT "+componentColumns+" FROM component_registry WHERE id = $1 AND tenant_id = $2")).
		WithArgs("cr-1", "t-1").WillReturnError(fail)

	got, err := repo.GetComponent(context.Background(), "cr-1", "t-1")
	if !errors.Is(err, fail) {
		t.Fatalf("error %q is not the statement failure", err)
	}
	if got != nil {
		t.Fatalf("GetComponent returned %v for a failed statement", got)
	}
}

func TestGetInstanceReadsTheNullableApprovalColumns(t *testing.T) {
	db, mock := mockDB(t)
	repo := NewRepository(db)

	mock.ExpectQuery(normSQL("SELECT "+instanceColumns+" FROM form_instance WHERE id = $1 AND tenant_id = $2")).
		WithArgs("fi-1", "t-1").WillReturnRows(instanceFixture(t))

	got, err := repo.GetInstance(context.Background(), "fi-1", "t-1")
	if err != nil {
		t.Fatalf("GetInstance: %v", err)
	}
	if got.Data != `{"email":"a@x"}` || got.SubmittedBy != "u-1" {
		t.Fatalf("unexpected row: %+v", got)
	}
	if got.SubmittedAt == nil || !got.SubmittedAt.Equal(now) {
		t.Fatalf("submitted_at was not read: %v", got.SubmittedAt)
	}
	if got.ApprovedAt != nil {
		t.Fatalf("a null approved_at must stay nil: %v", got.ApprovedAt)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("GetInstance did not issue the expected statement: %v", err)
	}
}

func TestListInstancesBuildsPlaceholdersOffTheArgumentCount(t *testing.T) {
	db, mock := mockDB(t)
	repo := NewRepository(db)

	mock.ExpectQuery(normSQL("SELECT "+instanceColumns+" FROM form_instance WHERE tenant_id = $1 AND form_id = $2 AND status = $3 ORDER BY created_at DESC")).
		WithArgs("t-1", "fd-1", "approved").WillReturnRows(instanceFixture(t))

	items, err := repo.ListInstances(context.Background(), "t-1", "fd-1", "approved")
	if err != nil {
		t.Fatalf("ListInstances: %v", err)
	}
	if len(items) != 1 || items[0].Status != "submitted" {
		t.Fatalf("unexpected rows: %+v", items)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("ListInstances did not number its placeholders per filter: %v", err)
	}
}

func TestListTemplatesBuildsPlaceholdersOffTheArgumentCount(t *testing.T) {
	db, mock := mockDB(t)
	repo := NewRepository(db)

	mock.ExpectQuery(normSQL("SELECT "+templateColumns+" FROM form_template WHERE tenant_id = $1 AND category = $2 ORDER BY usage_count DESC")).
		WithArgs("t-1", "auth").WillReturnRows(templateFixture(t))

	items, err := repo.ListTemplates(context.Background(), "t-1", "auth")
	if err != nil {
		t.Fatalf("ListTemplates: %v", err)
	}
	if len(items) != 1 {
		t.Fatalf("unexpected rows: %+v", items)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("ListTemplates did not number its placeholders per filter: %v", err)
	}
}

func TestListComponentsBuildsPlaceholdersOffTheArgumentCount(t *testing.T) {
	db, mock := mockDB(t)
	repo := NewRepository(db)

	mock.ExpectQuery(normSQL("SELECT "+componentColumns+" FROM component_registry WHERE tenant_id = $1 AND category = $2 ORDER BY created_at DESC")).
		WithArgs("t-1", "ui").WillReturnRows(componentFixture(t))

	items, err := repo.ListComponents(context.Background(), "t-1", "ui")
	if err != nil {
		t.Fatalf("ListComponents: %v", err)
	}
	if len(items) != 1 || items[0].Name != "btn" {
		t.Fatalf("unexpected rows: %+v", items)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("ListComponents did not number its placeholders per filter: %v", err)
	}
}

// --- updates ---

func TestUpdateFormPinsEveryAttributeInWhitelistOrder(t *testing.T) {
	db, mock := mockDB(t)
	repo := NewRepository(db)

	mock.ExpectExec(normSQL("UPDATE form_definition SET title = $1, status = $2, tags = $3, updated_at = NOW() WHERE id = $4 AND tenant_id = $5")).
		WithArgs("New Title", "published", `["beta"]`, "fd-1", "t-1").
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectQuery(normSQL("SELECT "+formColumns+" FROM form_definition WHERE id = $1 AND tenant_id = $2")).
		WithArgs("fd-1", "t-1").WillReturnRows(formFixture(t))

	got, err := repo.UpdateForm(context.Background(), "fd-1", "t-1", map[string]interface{}{
		"tags":   `["beta"]`,
		"status": "published",
		"title":  "New Title",
	})
	if err != nil {
		t.Fatalf("UpdateForm: %v", err)
	}
	if got.Title != "User Registration" {
		t.Fatalf("the re-read row was not returned: %+v", got)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("the update did not reach the database: %v", err)
	}
}

func TestUpdateFormRejectsAColumnItWillNotWrite(t *testing.T) {
	db, mock, seen := mockDBRecording(t)
	repo := NewRepository(db)

	// The expectation pins the statement a whitelist bypass would emit. sqlmock
	// invokes its matcher only for a registered expectation, so without it the
	// no-statement assertion at the end could never see a stray UPDATE.
	mock.ExpectExec(normSQL("UPDATE form_definition SET tenant_id = $1, updated_at = NOW() WHERE id = $2 AND tenant_id = $3")).
		WithArgs("tenant-other", "fd-1", "t-1").
		WillReturnError(errors.New("unexpected write"))

	got, err := repo.UpdateForm(context.Background(), "fd-1", "t-1",
		map[string]interface{}{"tenant_id": "tenant-other"})
	if err == nil || !strings.Contains(err.Error(), `column "tenant_id" is not updatable`) {
		t.Fatalf("error %q is not the whitelist rejection", err)
	}
	if got != nil {
		t.Fatalf("UpdateForm returned %v for a rejected column", got)
	}
	if len(*seen) != 0 {
		t.Fatalf("a rejected update still issued statements: %v", *seen)
	}
	_ = mock
}

func TestUpdateFormRejectsTheIdentityColumns(t *testing.T) {
	db, mock, seen := mockDBRecording(t)
	repo := NewRepository(db)

	// Each column gets the expectation the bypass would satisfy, so a rejection
	// is pinned to the whitelist's own message rather than to sqlmock's
	// no-expectation error, which would satisfy an err != nil check just as well.
	for _, col := range []string{"id", "created_at", "updated_at"} {
		mock.ExpectExec(normSQL("UPDATE form_definition SET "+col+" = $1, updated_at = NOW() WHERE id = $2 AND tenant_id = $3")).
			WithArgs("x", "fd-1", "t-1").
			WillReturnError(errors.New("unexpected write"))
		got, err := repo.UpdateForm(context.Background(), "fd-1", "t-1",
			map[string]interface{}{col: "x"})
		if err == nil || !strings.Contains(err.Error(), `column "`+col+`" is not updatable`) {
			t.Fatalf("%s: error %q is not the whitelist rejection", col, err)
		}
		if got != nil {
			t.Fatalf("UpdateForm returned %v for a rejected column", got)
		}
	}
	if len(*seen) != 0 {
		t.Fatalf("a rejected update still issued statements: %v", *seen)
	}
}

func TestUpdateFormWithNoColumnsReturnsTheExistingRow(t *testing.T) {
	db, mock, seen := mockDBRecording(t)
	repo := NewRepository(db)

	mock.ExpectQuery(normSQL("SELECT "+formColumns+" FROM form_definition WHERE id = $1 AND tenant_id = $2")).
		WithArgs("fd-1", "t-1").WillReturnRows(formFixture(t))

	got, err := repo.UpdateForm(context.Background(), "fd-1", "t-1", nil)
	if err != nil {
		t.Fatalf("UpdateForm: %v", err)
	}
	if got.Name != "user-form" {
		t.Fatalf("the existing row was not returned: %+v", got)
	}
	if len(*seen) != 1 || reUpdateWord.MatchString((*seen)[0]) {
		t.Fatalf("an empty update still wrote the row: %v", *seen)
	}
}

func TestUpdateFormPropagatesAStatementFailure(t *testing.T) {
	db, mock := mockDB(t)
	repo := NewRepository(db)
	fail := errors.New("column is not updatable")
	mock.ExpectExec(normSQL("UPDATE form_definition SET title = $1, updated_at = NOW() WHERE id = $2 AND tenant_id = $3")).
		WithArgs("New Title", "fd-1", "t-1").WillReturnError(fail)

	got, err := repo.UpdateForm(context.Background(), "fd-1", "t-1",
		map[string]interface{}{"title": "New Title"})
	if !errors.Is(err, fail) {
		t.Fatalf("error %q is not the statement failure", err)
	}
	if got != nil {
		t.Fatalf("UpdateForm returned %v for a failed statement", got)
	}
}

func TestUpdateFieldPinsEveryAttributeInWhitelistOrder(t *testing.T) {
	db, mock := mockDB(t)
	repo := NewRepository(db)

	mock.ExpectExec(normSQL("UPDATE form_field SET visible = $1, sortable_index = $2, parent_key = $3, updated_at = NOW() WHERE id = $4 AND tenant_id = $5")).
		WithArgs(false, 7, "section", "ff-1", "t-1").
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectQuery(normSQL("SELECT "+fieldColumns+" FROM form_field WHERE id = $1 AND tenant_id = $2")).
		WithArgs("ff-1", "t-1").WillReturnRows(fieldFixture(t))

	got, err := repo.UpdateField(context.Background(), "ff-1", "t-1", map[string]interface{}{
		"sortable_index": 7,
		"parent_key":     "section",
		"visible":        false,
	})
	if err != nil {
		t.Fatalf("UpdateField: %v", err)
	}
	if got.Key != "email" {
		t.Fatalf("the re-read row was not returned: %+v", got)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("the update did not reach the database: %v", err)
	}
}

func TestUpdateFieldRejectsTheUniqueKeyPair(t *testing.T) {
	db, mock, seen := mockDBRecording(t)
	repo := NewRepository(db)

	// The expectation is registered for the same reason as in the form test:
	// without it the recording matcher never runs and the rejection could not be
	// distinguished from a whitelist that quietly allowed the column.
	for _, col := range []string{"key", "form_id"} {
		mock.ExpectExec(normSQL("UPDATE form_field SET "+col+" = $1, updated_at = NOW() WHERE id = $2 AND tenant_id = $3")).
			WithArgs("x", "ff-1", "t-1").
			WillReturnError(errors.New("unexpected write"))
		got, err := repo.UpdateField(context.Background(), "ff-1", "t-1",
			map[string]interface{}{col: "x"})
		if err == nil || !strings.Contains(err.Error(), `column "`+col+`" is not updatable`) {
			t.Fatalf("%s: error %q is not the whitelist rejection", col, err)
		}
		if got != nil {
			t.Fatalf("UpdateField returned %v for a rejected column", got)
		}
	}
	if len(*seen) != 0 {
		t.Fatalf("a rejected update still issued statements: %v", *seen)
	}
}

func TestUpdateFieldWithNoColumnsReturnsTheExistingRow(t *testing.T) {
	db, mock, seen := mockDBRecording(t)
	repo := NewRepository(db)

	mock.ExpectQuery(normSQL("SELECT "+fieldColumns+" FROM form_field WHERE id = $1 AND tenant_id = $2")).
		WithArgs("ff-1", "t-1").WillReturnRows(fieldFixture(t))

	got, err := repo.UpdateField(context.Background(), "ff-1", "t-1", map[string]interface{}{})
	if err != nil {
		t.Fatalf("UpdateField: %v", err)
	}
	if got.Key != "email" {
		t.Fatalf("the existing row was not returned: %+v", got)
	}
	if len(*seen) != 1 || reUpdateWord.MatchString((*seen)[0]) {
		t.Fatalf("an empty update still wrote the row: %v", *seen)
	}
}

func TestUpdateInstancePinsEveryAttributeInWhitelistOrder(t *testing.T) {
	db, mock := mockDB(t)
	repo := NewRepository(db)

	mock.ExpectExec(normSQL("UPDATE form_instance SET status = $1, approved_by = $2, approved_at = $3, updated_at = NOW() WHERE id = $4 AND tenant_id = $5")).
		WithArgs("approved", "mgr-1", now, "fi-1", "t-1").
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectQuery(normSQL("SELECT "+instanceColumns+" FROM form_instance WHERE id = $1 AND tenant_id = $2")).
		WithArgs("fi-1", "t-1").WillReturnRows(instanceFixture(t))

	got, err := repo.UpdateInstance(context.Background(), "fi-1", "t-1", map[string]interface{}{
		"approved_by": "mgr-1",
		"approved_at": now,
		"status":      "approved",
	})
	if err != nil {
		t.Fatalf("UpdateInstance: %v", err)
	}
	if got.ID != "fi-1" {
		t.Fatalf("the re-read row was not returned: %+v", got)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("the update did not reach the database: %v", err)
	}
}

func TestUpdateInstanceRejectsTheFormLink(t *testing.T) {
	db, mock, seen := mockDBRecording(t)
	repo := NewRepository(db)

	mock.ExpectExec(normSQL("UPDATE form_instance SET form_id = $1, updated_at = NOW() WHERE id = $2 AND tenant_id = $3")).
		WithArgs("fd-2", "fi-1", "t-1").
		WillReturnError(errors.New("unexpected write"))

	got, err := repo.UpdateInstance(context.Background(), "fi-1", "t-1",
		map[string]interface{}{"form_id": "fd-2"})
	if err == nil || !strings.Contains(err.Error(), `column "form_id" is not updatable`) {
		t.Fatalf("error %q is not the whitelist rejection", err)
	}
	if got != nil {
		t.Fatalf("UpdateInstance returned %v for a rejected column", got)
	}
	if len(*seen) != 0 {
		t.Fatalf("a rejected update still issued statements: %v", *seen)
	}
}

func TestUpdateInstanceWithNoColumnsReturnsTheExistingRow(t *testing.T) {
	db, mock, seen := mockDBRecording(t)
	repo := NewRepository(db)

	mock.ExpectQuery(normSQL("SELECT "+instanceColumns+" FROM form_instance WHERE id = $1 AND tenant_id = $2")).
		WithArgs("fi-1", "t-1").WillReturnRows(instanceFixture(t))

	got, err := repo.UpdateInstance(context.Background(), "fi-1", "t-1", map[string]interface{}{})
	if err != nil {
		t.Fatalf("UpdateInstance: %v", err)
	}
	if got.ID != "fi-1" {
		t.Fatalf("the existing row was not returned: %+v", got)
	}
	if len(*seen) != 1 || reUpdateWord.MatchString((*seen)[0]) {
		t.Fatalf("an empty update still wrote the row: %v", *seen)
	}
}

// --- deletes ---

type failingRowsResult struct{}

func (failingRowsResult) LastInsertId() (int64, error) { return 0, nil }

func (failingRowsResult) RowsAffected() (int64, error) {
	return 0, errors.New("counting rows failed")
}

func TestDeleteFormReportsARowCountFailure(t *testing.T) {
	db, mock := mockDB(t)
	repo := NewRepository(db)

	mock.ExpectExec(normSQL("DELETE FROM form_definition WHERE id = $1 AND tenant_id = $2")).
		WithArgs("fd-1", "t-1").WillReturnResult(failingRowsResult{})

	deleted, err := repo.DeleteForm(context.Background(), "fd-1", "t-1")
	if err == nil {
		t.Fatalf("DeleteForm reported a successful delete")
	}
	if !strings.Contains(err.Error(), "counting deleted forms") {
		t.Fatalf("error %q does not name the failure", err)
	}
	if deleted {
		t.Fatalf("a failed row count was reported as deleted")
	}
}

func TestDeleteFormReportsTheRowItRemoved(t *testing.T) {
	db, mock := mockDB(t)
	repo := NewRepository(db)

	mock.ExpectExec(normSQL("DELETE FROM form_definition WHERE id = $1 AND tenant_id = $2")).
		WithArgs("fd-1", "t-1").WillReturnResult(sqlmock.NewResult(0, 1))

	deleted, err := repo.DeleteForm(context.Background(), "fd-1", "t-1")
	if err != nil {
		t.Fatalf("DeleteForm: %v", err)
	}
	if !deleted {
		t.Fatalf("a removed row was not reported")
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("the delete did not reach the database: %v", err)
	}
}

func TestDeleteFieldReportsARowCountFailure(t *testing.T) {
	db, mock := mockDB(t)
	repo := NewRepository(db)

	mock.ExpectExec(normSQL("DELETE FROM form_field WHERE id = $1 AND tenant_id = $2")).
		WithArgs("ff-1", "t-1").WillReturnResult(failingRowsResult{})

	deleted, err := repo.DeleteField(context.Background(), "ff-1", "t-1")
	if err == nil {
		t.Fatalf("DeleteField reported a successful delete")
	}
	if !strings.Contains(err.Error(), "counting deleted fields") {
		t.Fatalf("error %q does not name the failure", err)
	}
	if deleted {
		t.Fatalf("a failed row count was reported as deleted")
	}
}

func TestDeleteFieldReportsTheRowItRemoved(t *testing.T) {
	db, mock := mockDB(t)
	repo := NewRepository(db)

	mock.ExpectExec(normSQL("DELETE FROM form_field WHERE id = $1 AND tenant_id = $2")).
		WithArgs("ff-1", "t-1").WillReturnResult(sqlmock.NewResult(0, 1))

	deleted, err := repo.DeleteField(context.Background(), "ff-1", "t-1")
	if err != nil {
		t.Fatalf("DeleteField: %v", err)
	}
	if !deleted {
		t.Fatalf("a removed row was not reported")
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("the delete did not reach the database: %v", err)
	}
}

func TestDeleteFormPropagatesAStatementFailure(t *testing.T) {
	db, mock := mockDB(t)
	repo := NewRepository(db)
	fail := errors.New("cannot lock form_definition")
	mock.ExpectExec(normSQL("DELETE FROM form_definition WHERE id = $1 AND tenant_id = $2")).
		WithArgs("fd-1", "t-1").WillReturnError(fail)

	deleted, err := repo.DeleteForm(context.Background(), "fd-1", "t-1")
	if !errors.Is(err, fail) {
		t.Fatalf("error %q is not the statement failure", err)
	}
	if deleted {
		t.Fatalf("a failed statement was reported as deleted")
	}
}
