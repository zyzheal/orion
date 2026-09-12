package repository

import (
	"context"
	"database/sql"
	"errors"
	"testing"
	"time"

	"orion/go-common/pkg/sentinel"
	"orion/platform-svc-go/internal/middleware-ops/models"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"
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

func rowsWith(id, name, status, meta string) *sqlmock.Rows {
	now := time.Now().UTC()
	return sqlmock.NewRows([]string{
		"id", "tenant_id", "name", "status", "metadata", "created_at", "updated_at", "deleted_at",
	}).AddRow(id, "t1", name, status, []byte(meta), now, now, nil)
}

// The service layer learned in Round 17 to send the tenant config through these
// methods. Until now this repository had no tests at all, so "the config was
// persisted" was only ever asserted against an in-memory fake. These pin the
// actual SQL so the write path is anchored to a real statement.

func TestCreate_SendsTheConfigAsMetadata(t *testing.T) {
	mock, repo := newMockRepo(t)
	mock.ExpectExec(`INSERT INTO middleware_ops_records`).
		WithArgs(sqlmock.AnyArg(), "t1", "gateway", models.StatusActive,
			[]byte(`{"replicas":3}`), sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(1, 1))

	rec, err := repo.Create(context.Background(), "t1", models.CreateRequest{
		Name:   "gateway",
		Config: map[string]interface{}{"replicas": 3},
	})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if rec == nil || rec.ID == "" || rec.Name != "gateway" {
		t.Fatalf("Create returned %+v, want the persisted record", rec)
	}
	// Create hands back req.Config verbatim without a SELECT, so 3 is still an
	// int here. Update and List go through json.Unmarshal and yield float64 --
	// so Create's reply is not the DB representation of the row it just wrote.
	if rec.Metadata["replicas"] != 3 {
		t.Errorf("Metadata = %v (type %T), want the submitted config", rec.Metadata, rec.Metadata["replicas"])
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("the INSERT never carried the submitted config: %v", err)
	}
}

func TestUpdate_SendsNameStatusAndMetadata(t *testing.T) {
	mock, repo := newMockRepo(t)
	mock.ExpectExec(`UPDATE middleware_ops_records SET name`).
		WithArgs("m-1", "t1", "gateway", models.StatusActive,
			[]byte(`{"replicas":9}`), sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectQuery(`SELECT \* FROM middleware_ops_records WHERE id`).
		WillReturnRows(rowsWith("m-1", "gateway", models.StatusActive, `{"replicas":9}`))

	rec, err := repo.Update(context.Background(), "t1", "m-1", models.CreateRequest{
		Name:   "gateway",
		Config: map[string]interface{}{"replicas": 9},
	})
	if err != nil {
		t.Fatalf("Update: %v", err)
	}
	if rec == nil || rec.Name != "gateway" || rec.Metadata["replicas"] != float64(9) {
		t.Fatalf("Update returned %+v, want the updated record", rec)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("the UPDATE never carried the config: %v", err)
	}
}

func TestUpdate_ReturnsNotFoundWhenNoRowMatched(t *testing.T) {
	mock, repo := newMockRepo(t)
	mock.ExpectExec(`UPDATE middleware_ops_records SET name`).
		WillReturnResult(sqlmock.NewResult(0, 0))

	_, err := repo.Update(context.Background(), "t1", "ghost", models.CreateRequest{Name: "gateway"})
	if !errors.Is(err, sentinel.NotFound) {
		t.Fatalf("err = %v, want sentinel.NotFound: a no-op update must not read as success", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("the UPDATE was never issued: %v", err)
	}
}

// Delete must soft-delete. sqlmock rejects an unexpected call, so if the
// repository reached for a hard DELETE this test would fail on the returned error.
func TestDelete_SoftDeletesWithAnUpdate(t *testing.T) {
	mock, repo := newMockRepo(t)
	mock.ExpectExec(`UPDATE middleware_ops_records SET deleted_at`).
		WithArgs("m-1", "t1", sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(0, 1))

	if err := repo.Delete(context.Background(), "t1", "m-1"); err != nil {
		t.Fatalf("Delete: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("the soft-delete UPDATE was never issued: %v", err)
	}
}

func TestGetByID_MapsNoRowToNotFound(t *testing.T) {
	mock, repo := newMockRepo(t)
	mock.ExpectQuery(`SELECT \* FROM middleware_ops_records WHERE id`).
		WillReturnError(sql.ErrNoRows)

	if _, err := repo.GetByID(context.Background(), "t1", "ghost"); !errors.Is(err, sentinel.NotFound) {
		t.Fatalf("err = %v, want sentinel.NotFound", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("the SELECT was never issued: %v", err)
	}
}

func TestList_DecodesMetadataFromJSONB(t *testing.T) {
	mock, repo := newMockRepo(t)
	now := time.Now().UTC()
	rows := sqlmock.NewRows([]string{
		"id", "tenant_id", "name", "status", "metadata", "created_at", "updated_at", "deleted_at",
	}).AddRow("m-1", "t1", "gateway", models.StatusActive, []byte(`{"replicas":3}`), now, now, nil).
		AddRow("m-2", "t1", "queue", "paused", []byte(`{}`), now, now, nil)

	mock.ExpectQuery(`SELECT \* FROM middleware_ops_records WHERE tenant_id`).WillReturnRows(rows)

	recs, err := repo.List(context.Background(), "t1")
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if len(recs) != 2 {
		t.Fatalf("records = %d, want 2", len(recs))
	}
	if got := recs[0].Metadata["replicas"]; got != float64(3) {
		t.Errorf("Metadata[replicas] = %v (type %T), want float64(3) from the JSONB column", got, got)
	}
	if recs[1].Status != "paused" {
		t.Errorf("status = %q, want paused", recs[1].Status)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("the SELECT was never issued: %v", err)
	}
}
