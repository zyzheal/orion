package template

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"
)

func newMockRepo(t *testing.T) (*PostgresRepository, sqlmock.Sqlmock) {
	t.Helper()
	raw, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	db := sqlx.NewDb(raw, "postgres")
		t.Cleanup(func() { _ = db.Close() })
	return NewPostgresRepository(db), mock
}

// fakeUniqueViolation simulates pgx's *pgconn.PgError shape.
type fakeUniqueViolation struct{}

func (fakeUniqueViolation) Error() string {
	return `pq: duplicate key value violates unique constraint "change_templates_tenant_id_name_key"`
}
func (fakeUniqueViolation) Code() string { return "23505" }

func templateRows() *sqlmock.Rows {
	return sqlmock.NewRows([]string{
		"id", "tenant_id", "name", "description", "is_active", "authority",
		"template_type", "team_uuid", "created_by", "created_at", "updated_at",
	}).AddRow(
		"id-1", "t-1", "template", sql.NullString{}, true, "public",
		"standard", sql.NullString{}, "user-1",
		time.Date(2026, 10, 1, 0, 0, 0, 0, time.UTC),
		time.Date(2026, 10, 1, 0, 0, 0, 0, time.UTC),
	)
}

func TestNewPostgresRepository_NilDB(t *testing.T) {
	r := NewPostgresRepository(nil)
	if r != nil {
		t.Error("expected nil for nil db")
	}
}

func TestCreateTemplate_Success(t *testing.T) {
	repo, mock := newMockRepo(t)
	mock.ExpectQuery("INSERT INTO change_templates").
		WithArgs("t-1", "template", sql.NullString{Valid: false}, true, "public", "standard", sql.NullString{Valid: false}, "user-1").
		WillReturnRows(templateRows())

	got, err := repo.CreateTemplate(context.Background(), "t-1", &CreateChangeTemplateRequest{
		Name: "template",
	}, "user-1")
	if err != nil {
		t.Fatalf("CreateTemplate failed: %v", err)
	}
	if got.ID != "id-1" {
		t.Errorf("ID mismatch: %q", got.ID)
	}
	if got.Name != "template" {
		t.Errorf("Name mismatch: %q", got.Name)
	}
	if got.Authority != AuthorityPublic {
		t.Errorf("Authority mismatch: %q", got.Authority)
	}
	if got.TemplateType != TemplateTypeStandard {
		t.Errorf("TemplateType mismatch: %q", got.TemplateType)
	}
	// sqlmock uses ExpectBegin for Insert — verify no error expectations remain.
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestCreateTemplate_DuplicateName(t *testing.T) {
	repo, mock := newMockRepo(t)
	mock.ExpectQuery("INSERT INTO change_templates").
		WillReturnError(fakeUniqueViolation{})
	_, err := repo.CreateTemplate(context.Background(), "t-1", &CreateChangeTemplateRequest{
		Name: "dup",
	}, "user-1")
	if !errors.Is(err, ErrDuplicate) {
		t.Errorf("expected ErrDuplicate, got %v", err)
	}
}

func TestCreateTemplate_NilRequest(t *testing.T) {
	repo, _ := newMockRepo(t)
	if _, err := repo.CreateTemplate(context.Background(), "t-1", nil, "user-1"); err == nil {
		t.Fatal("expected error for nil request")
	}
}

func TestGetTemplate_NotFound(t *testing.T) {
	repo, mock := newMockRepo(t)
	mock.ExpectQuery("SELECT").
		WillReturnError(sql.ErrNoRows)
	_, err := repo.GetTemplate(context.Background(), "t-1", "missing")
	if !errors.Is(err, ErrNotFound) {
		t.Errorf("expected ErrNotFound, got %v", err)
	}
}

func TestGetTemplate_Success(t *testing.T) {
	repo, mock := newMockRepo(t)
	mock.ExpectQuery("SELECT").WillReturnRows(templateRows())
	got, err := repo.GetTemplate(context.Background(), "t-1", "id-1")
	if err != nil {
		t.Fatalf("GetTemplate failed: %v", err)
	}
	if got.Name != "template" {
		t.Errorf("Name mismatch: %q", got.Name)
	}
}

func TestListTemplates_OnlyActive(t *testing.T) {
	repo, mock := newMockRepo(t)
	mock.ExpectQuery("SELECT").WillReturnRows(sqlmock.NewRows(nil))
	if _, err := repo.ListTemplates(context.Background(), "t-1", true); err != nil {
		t.Fatalf("ListTemplates failed: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestUpdateTemplate_Success(t *testing.T) {
	repo, mock := newMockRepo(t)
	name := "new name"
	mock.ExpectQuery("UPDATE change_templates").
		WithArgs(name, true, "t-1", "id-1").
		WillReturnRows(templateRows())

	got, err := repo.UpdateTemplate(context.Background(), "t-1", "id-1", &UpdateChangeTemplateRequest{
		Name:     &name,
		IsActive: boolPtr(true),
	})
	if err != nil {
		t.Fatalf("UpdateTemplate failed: %v", err)
	}
	if got.ID != "id-1" {
		t.Errorf("ID mismatch: %q", got.ID)
	}
}

func TestDeleteTemplate_Success(t *testing.T) {
	repo, mock := newMockRepo(t)
	mock.ExpectExec("DELETE FROM change_templates").
		WithArgs("t-1", "id-1").
		WillReturnResult(sqlmock.NewResult(0, 1))
	deleted, err := repo.DeleteTemplate(context.Background(), "t-1", "id-1")
	if err != nil {
		t.Fatalf("DeleteTemplate failed: %v", err)
	}
	if !deleted {
		t.Error("expected deleted=true")
	}
}

func TestDeleteTemplate_NotFound(t *testing.T) {
	repo, mock := newMockRepo(t)
	mock.ExpectExec("DELETE FROM change_templates").
		WillReturnResult(sqlmock.NewResult(0, 0))
	deleted, err := repo.DeleteTemplate(context.Background(), "t-1", "missing")
	if err != nil {
		t.Fatalf("DeleteTemplate failed: %v", err)
	}
	if deleted {
		t.Error("expected deleted=false for missing row")
	}
}

// --- SOP tests ---

func sopRows() *sqlmock.Rows {
	return sqlmock.NewRows([]string{
		"id", "tenant_id", "template_id", "name", "description", "is_active",
		"authority", "sop_type", "team_uuid", "version", "created_by",
		"created_at", "updated_at",
	}).AddRow(
		"sop-1", "t-1", "tpl-1", "sop", sql.NullString{}, true, "public",
		"standard", sql.NullString{}, 1, "user-1",
		time.Date(2026, 10, 1, 0, 0, 0, 0, time.UTC),
		time.Date(2026, 10, 1, 0, 0, 0, 0, time.UTC),
	)
}

func TestCreateSOP_Success(t *testing.T) {
	repo, mock := newMockRepo(t)
	mock.ExpectQuery("INSERT INTO change_sops").WillReturnRows(sopRows())
	got, err := repo.CreateSOP(context.Background(), "t-1", &CreateChangeSOPRequest{
		TemplateID: "tpl-1",
		Name:       "sop",
	}, "user-1")
	if err != nil {
		t.Fatalf("CreateSOP failed: %v", err)
	}
	if got.TemplateID != "tpl-1" {
		t.Errorf("TemplateID mismatch: %q", got.TemplateID)
	}
	if got.Version != 1 {
		t.Errorf("Version should be 1, got %d", got.Version)
	}
}

func TestUpdateSOP_VersionMismatch(t *testing.T) {
	repo, mock := newMockRepo(t)
	// UPDATE returns no rows (version mismatch).
	mock.ExpectQuery("UPDATE change_sops").WillReturnError(sql.ErrNoRows)
	// Probe query returns 1 (row exists).
	mock.ExpectQuery("SELECT COUNT").WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(1))

	v := int32(999)
	_, err := repo.UpdateSOP(context.Background(), "t-1", "sop-1", &UpdateChangeSOPRequest{
		ExpectedVersion: &v,
		Name:            strPtr("new"),
	})
	if !errors.Is(err, ErrVersionMismatch) {
		t.Errorf("expected ErrVersionMismatch, got %v", err)
	}
}

func TestUpdateSOP_NotFound(t *testing.T) {
	repo, mock := newMockRepo(t)
	mock.ExpectQuery("UPDATE change_sops").WillReturnError(sql.ErrNoRows)
	// Probe returns 0 (row doesn't exist).
	mock.ExpectQuery("SELECT COUNT").WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(0))

	v := int32(1)
	_, err := repo.UpdateSOP(context.Background(), "t-1", "missing", &UpdateChangeSOPRequest{
		ExpectedVersion: &v,
		Name:            strPtr("new"),
	})
	if !errors.Is(err, ErrNotFound) {
		t.Errorf("expected ErrNotFound, got %v", err)
	}
}

func TestGetSOPDetail_Success(t *testing.T) {
	repo, mock := newMockRepo(t)
	// First: GetSOP query
	mock.ExpectQuery("SELECT").WillReturnRows(sopRows())
	// Second: ListSteps returns empty
	mock.ExpectQuery("SELECT").WillReturnRows(sqlmock.NewRows(nil))

	detail, err := repo.GetSOPDetail(context.Background(), "t-1", "sop-1")
	if err != nil {
		t.Fatalf("GetSOPDetail failed: %v", err)
	}
	if detail.ID != "sop-1" {
		t.Errorf("detail.ID mismatch: %q", detail.ID)
	}
	if len(detail.Steps) != 0 {
		t.Errorf("expected 0 steps, got %d", len(detail.Steps))
	}
}

// --- Step tests ---

func stepRows() *sqlmock.Rows {
	return sqlmock.NewRows([]string{
		"id", "tenant_id", "sop_id", "code", "name", "content", "plan_start_date",
		"start_time_window", "end_time_window", "worker", "file_ids",
		"sort_order", "version", "created_by", "created_at", "updated_at",
	}).AddRow(
		"step-1", "t-1", "sop-1", "install", "Install", sql.NullString{Valid: false},
		sql.NullTime{}, sql.NullString{Valid: false}, sql.NullString{Valid: false},
		sql.NullString{Valid: false}, []byte(`["file-1"]`),
		1, 1, "user-1",
		time.Date(2026, 10, 1, 0, 0, 0, 0, time.UTC),
		time.Date(2026, 10, 1, 0, 0, 0, 0, time.UTC),
	)
}

func TestCreateStep_Success(t *testing.T) {
	repo, mock := newMockRepo(t)
	mock.ExpectQuery("INSERT INTO change_sop_steps").WillReturnRows(stepRows())

	got, err := repo.CreateStep(context.Background(), "t-1", &CreateChangeSopStepRequest{
		SOPID:   "sop-1",
		Code:    "install",
		Name:    "Install",
		FileIDs: []string{"file-1"},
	}, "user-1")
	if err != nil {
		t.Fatalf("CreateStep failed: %v", err)
	}
	if got.Code != "install" {
		t.Errorf("Code mismatch: %q", got.Code)
	}
	if len(got.FileIDs) != 1 || got.FileIDs[0] != "file-1" {
		t.Errorf("FileIDs mismatch: %v", got.FileIDs)
	}
}

func TestListSteps_Success(t *testing.T) {
	repo, mock := newMockRepo(t)
	mock.ExpectQuery("SELECT").WillReturnRows(stepRows())
	got, err := repo.ListSteps(context.Background(), "t-1", "sop-1")
	if err != nil {
		t.Fatalf("ListSteps failed: %v", err)
	}
	if len(got) != 1 {
		t.Fatalf("expected 1 step, got %d", len(got))
	}
}

func TestUpdateStep_VersionIncrement(t *testing.T) {
	repo, mock := newMockRepo(t)
	// Simulate UPDATE returning version 2 (was 1, now incremented).
	updated := sqlmock.NewRows([]string{
		"id", "tenant_id", "sop_id", "code", "name", "content", "plan_start_date",
		"start_time_window", "end_time_window", "worker", "file_ids",
		"sort_order", "version", "created_by", "created_at", "updated_at",
	}).AddRow(
		"step-1", "t-1", "sop-1", "install", "Install", sql.NullString{Valid: false},
		sql.NullTime{}, sql.NullString{Valid: false}, sql.NullString{Valid: false},
		sql.NullString{Valid: false}, []byte(`["file-1"]`),
		1, 2, "user-1",
		time.Date(2026, 10, 1, 0, 0, 0, 0, time.UTC),
		time.Date(2026, 10, 1, 0, 0, 0, 0, time.UTC),
	)
	mock.ExpectQuery("UPDATE change_sop_steps").WillReturnRows(updated)

	got, err := repo.UpdateStep(context.Background(), "t-1", "step-1", &UpdateChangeSopStepRequest{
		Name: strPtr("Install V2"),
	})
	if err != nil {
		t.Fatalf("UpdateStep failed: %v", err)
	}
	if got.Version != 2 {
		t.Errorf("expected version=2 after increment, got %d", got.Version)
	}
}

// --- JSONB helpers ---

func TestMarshalFileIDs_Empty(t *testing.T) {
	b, err := marshalFileIDs(nil)
	if err != nil {
		t.Fatalf("marshalFileIDs failed: %v", err)
	}
	if string(b) != "[]" {
		t.Errorf("expected [], got %s", b)
	}
}

func TestMarshalFileIDs_NonEmpty(t *testing.T) {
	b, err := marshalFileIDs([]string{"a", "b"})
	if err != nil {
		t.Fatalf("marshalFileIDs failed: %v", err)
	}
	var got []string
	if err := json.Unmarshal(b, &got); err != nil {
		t.Fatalf("unmarshal failed: %v", err)
	}
	if len(got) != 2 || got[0] != "a" || got[1] != "b" {
		t.Errorf("FileIDs mismatch: %v", got)
	}
}

func TestUnmarshalFileIDs_Empty(t *testing.T) {
	got, err := unmarshalFileIDs(nil)
	if err != nil {
		t.Fatalf("unmarshalFileIDs failed: %v", err)
	}
	if got != nil {
		t.Errorf("expected nil, got %v", got)
	}
}

func TestUnmarshalFileIDs_Invalid(t *testing.T) {
	_, err := unmarshalFileIDs([]byte(`{invalid`))
	if err == nil {
		t.Fatal("expected error for invalid JSON")
	}
}

// --- Helpers ---

func boolPtr(b bool) *bool { return &b }
