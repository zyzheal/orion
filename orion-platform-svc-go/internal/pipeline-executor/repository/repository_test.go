package repository

import (
	"context"
	"testing"
	"time"

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

func pipelineRow() *sqlmock.Rows {
	return sqlmock.NewRows([]string{
		"id", "tenant_id", "name", "description", "category", "status", "created_at", "updated_at",
	}).AddRow(
		"pl-1", "tenant-a", "deploy-web", "deploys the web service", "automation", "active",
		time.Now().UTC(), time.Now().UTC(),
	)
}

// UpdatePipeline had the same defect as auto-exec's UpdateTask: the SET clause
// was generated from the field names while the argument map carried only the
// WHERE keys, so sqlx failed with
// "could not find name name in map[string]interface{}{...}" and PUT
// /pipelines/:id always returned 500 with the edit silently lost.
func TestUpdatePipelinePersistsEveryField(t *testing.T) {
	mock, repo := newMockRepo(t)
	mock.ExpectExec(`UPDATE pipelines SET`).WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectQuery(`SELECT \* FROM pipelines`).WillReturnRows(pipelineRow())

	pipe, err := repo.UpdatePipeline(context.Background(), "tenant-a", "pl-1", map[string]interface{}{
		"name":        "deploy-web-v2",
		"description": "deploys the web service and its workers",
		"status":      "disabled",
	})
	if err != nil {
		t.Fatalf("UpdatePipeline: %v: every field in the SET clause must be in the argument map", err)
	}
	if pipe == nil || pipe.ID != "pl-1" {
		t.Fatalf("UpdatePipeline returned %+v, want the updated pipeline", pipe)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("the UPDATE was never issued: %v", err)
	}
}

func TestUpdatePipelineWithNoFieldsRereads(t *testing.T) {
	mock, repo := newMockRepo(t)
	mock.ExpectQuery(`SELECT \* FROM pipelines`).WillReturnRows(pipelineRow())

	pipe, err := repo.UpdatePipeline(context.Background(), "tenant-a", "pl-1", nil)
	if err != nil {
		t.Fatalf("UpdatePipeline: %v", err)
	}
	if pipe.Status != "active" {
		t.Fatalf("pipe.Status = %q, want the stored value", pipe.Status)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unexpected SQL: %v", err)
	}
}

func stepRow() *sqlmock.Rows {
	return sqlmock.NewRows([]string{
		"id", "tenant_id", "pipeline_id", "name", "type", "config", "priority",
		"enabled", "status", "error", "created_at", "updated_at",
	}).AddRow(
		"st-1", "tenant-a", "pl-1", "notify-slack", "notify", `{"channel":"#deploy"}`,
		10, true, "ready", "", time.Now().UTC(), time.Now().UTC(),
	)
}

// PUT /pipelines/:id/steps/:stepId is the only routed step-write endpoint, so
// the broken arg map made every step edit a 500.
func TestUpdateStepPersistsEveryField(t *testing.T) {
	mock, repo := newMockRepo(t)
	mock.ExpectExec(`UPDATE pipeline_steps SET`).WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectQuery(`SELECT \* FROM pipeline_steps`).WillReturnRows(stepRow())

	step, err := repo.UpdateStep(context.Background(), "tenant-a", "st-1", map[string]interface{}{
		"name":     "notify-slack",
		"priority": 20,
		"enabled":  false,
		"status":   "ready",
		"error":    "",
	})
	if err != nil {
		t.Fatalf("UpdateStep: %v: every field in the SET clause must be in the argument map", err)
	}
	if step == nil || step.ID != "st-1" {
		t.Fatalf("UpdateStep returned %+v, want the updated step", step)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("the UPDATE was never issued: %v", err)
	}
}

// A step config arrives as a map and is re-serialised before the UPDATE; that
// block must still land on a complete argument map.
func TestUpdateStepPersistsConfig(t *testing.T) {
	mock, repo := newMockRepo(t)
	mock.ExpectExec(`UPDATE pipeline_steps SET`).WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectQuery(`SELECT \* FROM pipeline_steps`).WillReturnRows(stepRow())

	step, err := repo.UpdateStep(context.Background(), "tenant-a", "st-1", map[string]interface{}{
		"config": map[string]string{"channel": "#releases", "mention": "@oncall"},
	})
	if err != nil {
		t.Fatalf("UpdateStep: %v", err)
	}
	if step == nil || step.Config != `{"channel":"#deploy"}` {
		t.Fatalf("UpdateStep returned %+v, want the re-read step", step)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("the UPDATE was never issued: %v", err)
	}
}

func TestUpdateStepWithNoFieldsRereads(t *testing.T) {
	mock, repo := newMockRepo(t)
	mock.ExpectQuery(`SELECT \* FROM pipeline_steps`).WillReturnRows(stepRow())

	step, err := repo.UpdateStep(context.Background(), "tenant-a", "st-1", nil)
	if err != nil {
		t.Fatalf("UpdateStep: %v", err)
	}
	if step.Name != "notify-slack" {
		t.Fatalf("step.Name = %q, want the stored value", step.Name)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unexpected SQL: %v", err)
	}
}
