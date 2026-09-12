package service

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"

	"orion/platform-svc-go/internal/pipeline-engine/models"
	"orion/platform-svc-go/internal/pipeline-engine/repository"
)

// fakeEngine records the request it was given and returns a canned run.
type fakeEngine struct {
	run    *models.PipelineRun
	err    error
	calls  int
	gotReq models.TriggerRequest
	gotCtx context.Context
}

func (f *fakeEngine) Execute(ctx context.Context, tenantID string, req models.TriggerRequest) (*models.PipelineRun, error) {
	f.calls++
	f.gotReq = req
	f.gotCtx = ctx
	return f.run, f.err
}

func (f *fakeEngine) CancelRun(context.Context, string, string, string) (*models.PipelineRun, error) {
	return nil, errors.New("unused")
}

func (f *fakeEngine) GetRun(context.Context, string, string) (*models.PipelineRun, error) {
	return nil, errors.New("unused")
}

func (f *fakeEngine) ListRuns(context.Context, string, string, models.ListRunsQuery) (*models.RunListResponse, error) {
	return nil, errors.New("unused")
}

func (f *fakeEngine) GetStages(context.Context, string, string) ([]models.Stage, error) {
	return nil, errors.New("unused")
}

func (f *fakeEngine) GetTasks(context.Context, string, string) ([]models.Task, error) {
	return nil, errors.New("unused")
}

// cannedRun builds a finished child run for the fake engine.
func cannedRun(id string, status models.PipelineRunStatus, dur *int64) *models.PipelineRun {
	return &models.PipelineRun{ID: id, Status: status, DurationMs: dur}
}

// newExecutorWithMockRepo returns a StageExecutor whose repository records the
// two UpdateTaskStatus writes ExecuteTask makes: RUNNING on entry, then the
// final status.
func newExecutorWithMockRepo(t *testing.T) (*StageExecutor, sqlmock.Sqlmock) {
	t.Helper()
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	exec := NewStageExecutor(repository.NewRepository(sqlx.NewDb(db, "sqlmock")))
	mock.ExpectExec("UPDATE pipeline_tasks").WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec("UPDATE pipeline_tasks").WillReturnResult(sqlmock.NewResult(0, 1))
	return exec, mock
}

// subPipelineTask builds a task of type "sub-pipeline" with a resolvable
// StartedAt, which ExecuteTask dereferences when it measures duration.
func subPipelineTask() *models.Task {
	started := time.Now().Unix()
	return &models.Task{
		ID:         "task-1",
		StageID:    "stage-1",
		Name:       "child-run",
		Type:       "sub-pipeline",
		StartedAt:  &started,
		Parameters: `{"pipeline_id":"child-pipe","pipeline_version":"1"}`,
		TenantID:   "t1",
	}
}

// A sub-pipeline task must never report success without running anything.
// Before the fix this returned Success:true with "status: skipped", which marked
// the task green and let the whole parent run pass.
func TestSubPipelineTaskFailsLoudlyWithoutEngine(t *testing.T) {
	exec, mock := newExecutorWithMockRepo(t)

	name, res := exec.ExecuteTask(context.Background(), "t1", "stage-1", subPipelineTask(), nil)

	if name != "child-run" {
		t.Fatalf("task name = %q", name)
	}
	if res.Success {
		t.Error("sub-pipeline task succeeded with no engine wired: silent pass on a CI gate")
	}
	if !strings.Contains(res.Error, "no pipeline engine wired") {
		t.Errorf("error should name the missing engine, got %q", res.Error)
	}
	if !strings.Contains(res.Error, "child-pipe@1") {
		t.Errorf("error should name the child pipeline, got %q", res.Error)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("repo expectations: %v", err)
	}
}

func TestSubPipelineTaskRunsChildAndReportsItsStatus(t *testing.T) {
	exec, mock := newExecutorWithMockRepo(t)
	dur := int64(1234)
	fe := &fakeEngine{run: cannedRun("run-child-1", models.RunStatusSuccess, &dur)}
	exec.WithEngine(fe)

	_, res := exec.ExecuteTask(context.Background(), "t1", "stage-1", subPipelineTask(), map[string]string{"env": "prod"})

	if !res.Success {
		t.Fatalf("child run succeeded but task reported failure: %v", res.Error)
	}
	if fe.calls != 1 {
		t.Fatalf("engine.Execute calls = %d, want 1", fe.calls)
	}
	if fe.gotReq.PipelineID != "child-pipe" || fe.gotReq.PipelineVersion != "1" {
		t.Errorf("child request = %+v", fe.gotReq)
	}
	if fe.gotReq.TriggerType != string(models.TriggerSubPipeline) {
		t.Errorf("trigger type = %q, want %q", fe.gotReq.TriggerType, models.TriggerSubPipeline)
	}
	if fe.gotReq.Context["env"] != "prod" {
		t.Errorf("parent variables were not forwarded: %v", fe.gotReq.Context)
	}
	if got := res.Outputs["sub_pipeline_run"]; got != "run-child-1" {
		t.Errorf("sub_pipeline_run output = %q", got)
	}
	if got := res.Outputs["status"]; got != string(models.RunStatusSuccess) {
		t.Errorf("status output = %q", got)
	}
	if d := subPipelineDepth(fe.gotCtx); d != 1 {
		t.Errorf("child ctx depth = %d, want 1", d)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("repo expectations: %v", err)
	}
}

func TestSubPipelineTaskFailsWhenChildRunFails(t *testing.T) {
	exec, _ := newExecutorWithMockRepo(t)
	fe := &fakeEngine{run: cannedRun("run-child-2", models.RunStatusFailed, nil)}
	exec.WithEngine(fe)

	_, res := exec.ExecuteTask(context.Background(), "t1", "stage-1", subPipelineTask(), nil)
	if res.Success {
		t.Error("task succeeded although the child run failed: parent would pass on a broken child")
	}
	if !strings.Contains(res.Error, "run-child-2") {
		t.Errorf("error should name the child run so the operator knows what to open, got %q", res.Error)
	}
	if !strings.Contains(res.Error, string(models.RunStatusFailed)) {
		t.Errorf("error should name the child's final status, got %q", res.Error)
	}
	if fe.calls != 1 {
		t.Errorf("engine.Execute calls = %d, want 1", fe.calls)
	}
	if fe.gotCtx == nil {
		t.Error("engine never saw the child context")
	}
}

func TestSubPipelineTaskFailsWhenEngineReturnsError(t *testing.T) {
	exec, _ := newExecutorWithMockRepo(t)
	exec.WithEngine(&fakeEngine{err: errors.New("spec not registered for child-pipe@1")})

	_, res := exec.ExecuteTask(context.Background(), "t1", "stage-1", subPipelineTask(), nil)
	if res.Success {
		t.Error("task succeeded although the child run failed to start")
	}
}

func TestSubPipelineTaskFailsWhenEngineReturnsNilRun(t *testing.T) {
	exec, _ := newExecutorWithMockRepo(t)
	exec.WithEngine(&fakeEngine{run: nil})

	_, res := exec.ExecuteTask(context.Background(), "t1", "stage-1", subPipelineTask(), nil)
	if res.Success {
		t.Error("task succeeded although the engine returned no run")
	}
}

func TestSubPipelineTaskRequiresPipelineID(t *testing.T) {
	exec, _ := newExecutorWithMockRepo(t)
	task := subPipelineTask()
	task.Parameters = `{"pipeline_version":"1"}`

	_, res := exec.ExecuteTask(context.Background(), "t1", "stage-1", task, nil)
	if res.Success {
		t.Error("sub-pipeline task succeeded without a pipeline_id")
	}
}

// The depth guard stops a pipeline that triggers itself from looping forever.
// Depth lives in the context because sibling stages share one StageExecutor
// across parallel goroutines.
func TestSubPipelineDepthGuardBlocksCycle(t *testing.T) {
	exec, _ := newExecutorWithMockRepo(t)
	exec.WithMaxSubPipelineDepth(2)
	fe := &fakeEngine{run: cannedRun("run-child-3", models.RunStatusSuccess, nil)}
	exec.WithEngine(fe)

	ctx := context.WithValue(context.Background(), subPipelineDepthKey{}, 2)
	_, res := exec.ExecuteTask(ctx, "t1", "stage-1", subPipelineTask(), nil)
	if res.Success {
		t.Error("task succeeded past the sub-pipeline depth limit")
	}
	if fe.calls != 0 {
		t.Errorf("engine.Execute calls = %d, want 0 (refused before execution)", fe.calls)
	}
}

// Wiring link: NewPipelineEngine must hand its own executor a path back to the
// engine. Without that single line no sub-pipeline task can ever run.
func TestNewPipelineEngineWiresEngineIntoItsExecutor(t *testing.T) {
	db, _, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	repo := repository.NewRepository(sqlx.NewDb(db, "sqlmock"))

	e := NewPipelineEngine(repo)
	if e.executor == nil {
		t.Fatal("NewPipelineEngine left executor nil")
	}
	if e.orchestrator == nil {
		t.Fatal("NewPipelineEngine left orchestrator nil")
	}
	if e.executor.engine == nil {
		t.Error("executor has no engine: sub-pipeline tasks could never run")
	}
	if e.executor.engine != EngineInterface(e) {
		t.Error("executor's engine is not the engine that owns it")
	}
}
