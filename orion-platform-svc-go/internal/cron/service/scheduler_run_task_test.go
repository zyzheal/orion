package service

import (
	"context"
	"sync/atomic"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"
	"go.uber.org/zap"

	"orion/platform-svc-go/internal/cron/models"
	"orion/platform-svc-go/internal/cron/repository"
)

// testJob is a recording IJob handler used to prove that scheduled jobs fire.
type testJob struct {
	name  string
	execs int32
}

func (j *testJob) Name() string     { return j.name }
func (j *testJob) CronExpr() string { return "0 0 * * *" }
func (j *testJob) Validate() error  { return nil }
func (j *testJob) Execute(ctx context.Context, cfg map[string]string) (string, error) {
	atomic.AddInt32(&j.execs, 1)
	return "ran", nil
}

func jobDefRows(id, jobType string, enabled bool) *sqlmock.Rows {
	now := time.Now().UTC()
	return sqlmock.NewRows([]string{
		"id", "tenant_id", "name", "cron_expr", "job_type", "config", "status",
		"last_run_at", "next_run_at", "max_retries", "timeout_sec", "enabled",
		"error", "created_at", "updated_at",
	}).AddRow(id, "t1", "nightly", "0 0 * * *", jobType, "{}",
		"enabled", nil, nil, 0, 5, enabled, "", now, now)
}

// TestRunTaskScheduleLoopIsReachable proves the per-job scheduling loop body
// executes at all.
//
// runTask previously opened with a blocking select whose only two cases both
// returned, making every statement below it unreachable. startTask spawned the
// goroutine, but the job definition was never re-read, next_run_at was never
// persisted, no execution log was ever written, and no job ever fired.
//
// The discriminator is deterministic: with the loop body reachable the SELECT is
// issued and ExpectationsWereMet passes; with it unreachable the expectation is
// never matched and this test fails without any sleep-based waiting.
func TestRunTaskScheduleLoopIsReachable(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	defer db.Close()

	mock.ExpectQuery("scheduler_job_definitions WHERE id").
		WithArgs("job-1").
		WillReturnRows(jobDefRows("job-1", "probe", false)) // disabled → exits after the read

	m := NewSchedulerManager(repository.NewJobRepository(sqlx.NewDb(db, "sqlmock")),
		nil, zap.NewNop())
	m.Register(&testJob{name: "probe"})
	m.startTask(context.Background(), "job-1", "t1")

	// Wait until the goroutine has consumed the definition-read expectation.
	// Never close t.quit first: with the fix the leading select is a poll, so an
	// already-closed quit channel makes the goroutine return before it does
	// anything at all, which would hide the very bug this test pins.
	deadline := time.Now().Add(2 * time.Second)
	for mock.ExpectationsWereMet() != nil {
		if time.Now().After(deadline) {
			break
		}
		time.Sleep(2 * time.Millisecond)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("loop body never reached the job definition read: %v", err)
	}

	m.mu.RLock()
	close(m.tasks["job-1"].quit)
	m.mu.RUnlock()

	done := make(chan struct{})
	go func() { m.wg.Wait(); close(done) }()
	select {
	case <-done:
	case <-time.After(3 * time.Second):
		t.Fatal("runTask goroutine did not exit")
	}
}

// TestRunTaskFiresJobOnStop proves a pending job still fires when the manager
// shuts down (the "let the job fire once more if close to deadline" branch) and
// that the goroutine then exits instead of leaking.
func TestRunTaskFiresJobOnStop(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	defer db.Close()

	mock.ExpectQuery("scheduler_job_definitions WHERE id").
		WithArgs("job-2").
		WillReturnRows(jobDefRows("job-2", "probe2", true))
	mock.ExpectExec("UPDATE scheduler_job_definitions SET status").
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec("INSERT INTO scheduler_job_execution_logs").
		WillReturnResult(sqlmock.NewResult(0, 1))

	job := &testJob{name: "probe2"}
	m := NewSchedulerManager(repository.NewJobRepository(sqlx.NewDb(db, "sqlmock")),
		nil, zap.NewNop())
	m.Register(job)
	m.startTask(context.Background(), "job-2", "t1")

	// The goroutine needs to reach the timer select before we shut down. The
	// intervening work is one in-memory sqlmock SELECT plus one UPDATE, so a few
	// hundred ms is orders of magnitude more than required.
	time.Sleep(300 * time.Millisecond)

	close(m.stopCh)

	deadline := time.Now().Add(3 * time.Second)
	for atomic.LoadInt32(&job.execs) != 1 {
		if time.Now().After(deadline) {
			t.Fatalf("job never fired; execs=%d", atomic.LoadInt32(&job.execs))
		}
		time.Sleep(5 * time.Millisecond)
	}

	done := make(chan struct{})
	go func() { m.wg.Wait(); close(done) }()
	select {
	case <-done:
	case <-time.After(3 * time.Second):
		t.Fatal("runTask goroutine did not exit after Stop")
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet sqlmock expectations: %v", err)
	}
}

// TestExecuteJobPersistsLog pins the fire path itself: the handler runs, the
// log records the result, and the execution log is written to the database.
func TestExecuteJobPersistsLog(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	defer db.Close()

	mock.ExpectExec("INSERT INTO scheduler_job_execution_logs").
		WillReturnResult(sqlmock.NewResult(0, 1))

	job := &testJob{name: "probe3"}
	m := NewSchedulerManager(repository.NewJobRepository(sqlx.NewDb(db, "sqlmock")),
		nil, zap.NewNop())
	m.Register(job)

	j := &models.JobDefinition{ID: "job-3", JobType: "probe3", Config: `{"k":"v"}`}
	log, err := m.executeJob(context.Background(), j, job, 5*time.Second)
	if err != nil {
		t.Fatalf("executeJob: %v", err)
	}
	if log.Status != "completed" || log.Output != "ran" {
		t.Errorf("log = {status:%q output:%q}, want completed/ran", log.Status, log.Output)
	}
	if atomic.LoadInt32(&job.execs) != 1 {
		t.Errorf("handler was not invoked exactly once; execs=%d", atomic.LoadInt32(&job.execs))
	}
	if log.FinishedAt == nil {
		t.Error("FinishedAt is nil")
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet sqlmock expectations: %v", err)
	}
}
