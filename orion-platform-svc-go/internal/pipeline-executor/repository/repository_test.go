package repository

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"testing"
	"time"

	"orion/platform-svc-go/internal/pipeline-executor/models"

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

// newMockRepo above uses sqlmock's regexp matcher, which is a substring test.
// The probe tests need an exact comparison so that a statement sending the
// pipeline id in the wrong placeholder cannot satisfy the expectation.

var probeWS = regexp.MustCompile(`\s+`)

func exactMockRepo(t *testing.T) (sqlmock.Sqlmock, *Repository) {
	t.Helper()
	db, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherFunc(func(expected, actual string) error {
		e := strings.TrimSpace(probeWS.ReplaceAllString(expected, " "))
		a := strings.TrimSpace(probeWS.ReplaceAllString(actual, " "))
		if e != a {
			return fmt.Errorf("sql mismatch: want %q got %q", e, a)
		}
		return nil
	})))
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	return mock, NewRepository(sqlx.NewDb(db, "postgres"))
}

const pipelineExistsQuery = `SELECT EXISTS(SELECT 1 FROM pipelines WHERE id=$1 AND tenant_id=$2)`

// pipelineExists used to drop the GetContext error into `_ =` and return the
// zero value. Every caller then read that as "pipeline not found", so an
// outage was answered with a 404-style message and no step was ever created
// while the pipeline it belonged to existed all along.
func TestCreateStepReportsAProbeOutageAsAnOutage(t *testing.T) {
	mock, repo := exactMockRepo(t)
	mock.ExpectQuery(pipelineExistsQuery).
		WithArgs("pl-1", "tenant-a").
		WillReturnError(errors.New("connection refused"))

	_, err := repo.CreateStep(context.Background(), "tenant-a", "pl-1",
		&models.AddStepRequest{Name: "build", Type: "build", Priority: 10})
	if err == nil {
		t.Fatalf("a failed ownership probe must not be treated as a missing pipeline")
	}
	if strings.Contains(err.Error(), "pipeline not found") {
		t.Fatalf("an outage was reported as a missing pipeline: %v", err)
	}
	// ExpectationsWereMet doubles as proof that no INSERT was issued.
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("%v", err)
	}
}

func TestCreateStepRejectsAMissingPipelineBeforeInserting(t *testing.T) {
	mock, repo := exactMockRepo(t)
	mock.ExpectQuery(pipelineExistsQuery).
		WithArgs("pl-1", "tenant-a").
		WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(false))

	_, err := repo.CreateStep(context.Background(), "tenant-a", "pl-1",
		&models.AddStepRequest{Name: "build", Type: "build", Priority: 10})
	if err == nil {
		t.Fatalf("a step must not be created for a pipeline the tenant does not own")
	}
	if !strings.Contains(err.Error(), "pipeline not found: pl-1") {
		t.Fatalf("error %q must name the missing pipeline", err.Error())
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("the probe must not have been followed by an INSERT: %v", err)
	}
}

func TestListStepsReportsAProbeOutageAsAnOutage(t *testing.T) {
	mock, repo := exactMockRepo(t)
	mock.ExpectQuery(pipelineExistsQuery).
		WithArgs("pl-1", "tenant-a").
		WillReturnError(errors.New("connection refused"))

	_, err := repo.ListSteps(context.Background(), "tenant-a", "pl-1", 10, 0)
	if err == nil {
		t.Fatalf("a failed ownership probe must not be treated as a missing pipeline")
	}
	if strings.Contains(err.Error(), "pipeline not found") {
		t.Fatalf("an outage was reported as a missing pipeline: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("no step list must be issued for a probe that failed: %v", err)
	}
}

func TestListStepsRejectsAMissingPipeline(t *testing.T) {
	mock, repo := exactMockRepo(t)
	mock.ExpectQuery(pipelineExistsQuery).
		WithArgs("pl-1", "tenant-a").
		WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(false))

	_, err := repo.ListSteps(context.Background(), "tenant-a", "pl-1", 10, 0)
	if err == nil {
		t.Fatalf("steps must not be listed for a pipeline the tenant does not own")
	}
	if !strings.Contains(err.Error(), "pipeline not found: pl-1") {
		t.Fatalf("error %q must name the missing pipeline", err.Error())
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("%v", err)
	}
}
