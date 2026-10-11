package service

import (
	"context"
	"database/sql"
	"errors"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"

	"orion/platform-svc-go/internal/ci-cd/runner/models"
	"orion/platform-svc-go/internal/ci-cd/runner/repository"
)

// ---------------------------------------------------------------------------
// helpers — sqlmock DB wiring
// ---------------------------------------------------------------------------

func newMockDB(t *testing.T) (*sql.DB, sqlmock.Sqlmock) {
	t.Helper()
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	return db, mock
}

func newServiceWithMock(t *testing.T) (*Service, *sql.DB, sqlmock.Sqlmock) {
	t.Helper()
	raw, mock := newMockDB(t)
	repo := repository.NewRepository(sqlx.NewDb(raw, "postgres"))
	return NewService(repo), raw, mock
}

// runnerRows builds sqlmock rows matching the Runner struct's `db` column tags.
func runnerRows(runners ...models.Runner) *sqlmock.Rows {
	cols := []string{"id", "tenant_id", "name", "type", "status", "endpoint", "capacity", "max_concurrent", "current_jobs", "labels", "metadata", "last_heartbeat", "created_at", "updated_at"}
	r := sqlmock.NewRows(cols)
	for _, run := range runners {
		var hb sql.NullTime
		if run.LastHeartbeat != nil {
			hb.Time = *run.LastHeartbeat
			hb.Valid = true
		}
		r.AddRow(run.ID, run.TenantID, run.Name, run.Type, run.Status, run.Endpoint,
			run.Capacity, run.MaxConcurrent, run.CurrentJobs,
			[]byte("[]"), []byte("{}"), hb, time.Now(), time.Now())
	}
	return r
}

// ---------------------------------------------------------------------------
// SelectRunner — capacity-aware runner pick
// ---------------------------------------------------------------------------

func TestSelectRunnerPicksLowestUtilization(t *testing.T) {
	svc, _, mock := newServiceWithMock(t)
	// All online; r2 has 2 jobs (util 0.5), r1 has 0 (util 0), r3 has 0 (util 0.5).
	// Best: r1 (util 0).
	mock.ExpectQuery(`SELECT \* FROM runners WHERE tenant_id=\$1 AND labels @> \$2 ORDER BY last_heartbeat DESC`).
		WithArgs("t1", "null").
		WillReturnRows(runnerRows(
			models.Runner{ID: "r1", TenantID: "t1", Status: "online", MaxConcurrent: 2, CurrentJobs: 0},
			models.Runner{ID: "r2", TenantID: "t1", Status: "online", MaxConcurrent: 2, CurrentJobs: 2},
			models.Runner{ID: "r3", TenantID: "t1", Status: "online", MaxConcurrent: 2, CurrentJobs: 0},
		))

	out, err := svc.SelectRunner(context.Background(), "t1", nil)
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	// r1 and r3 both have util 0.0; the loop takes the FIRST one it encounters.
	if out.ID != "r1" {
		t.Errorf("picked %s, want r1 (first lowest)", out.ID)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("expectations: %v", err)
	}
}

func TestSelectRunnerExcludesOffline(t *testing.T) {
	svc, _, mock := newServiceWithMock(t)
	mock.ExpectQuery(`SELECT \* FROM runners WHERE tenant_id=\$1 AND labels @> \$2 ORDER BY last_heartbeat DESC`).
		WithArgs("t1", "null").
		WillReturnRows(runnerRows(
			models.Runner{ID: "offline-r", Status: "offline", MaxConcurrent: 1, CurrentJobs: 0},
			models.Runner{ID: "busy-r", Status: "online", MaxConcurrent: 1, CurrentJobs: 1},
			models.Runner{ID: "online-r", Status: "online", MaxConcurrent: 1, CurrentJobs: 0},
		))
	out, err := svc.SelectRunner(context.Background(), "t1", nil)
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if out.ID != "online-r" {
		t.Errorf("picked %s, want online-r (only available)", out.ID)
	}
}

func TestSelectRunnerReturnsNoCapacity(t *testing.T) {
	svc, _, mock := newServiceWithMock(t)
	// All online but at capacity
	mock.ExpectQuery(`SELECT \* FROM runners WHERE tenant_id=\$1 AND labels @> \$2 ORDER BY last_heartbeat DESC`).
		WithArgs("t1", "null").
		WillReturnRows(runnerRows(
			models.Runner{ID: "r1", Status: "online", MaxConcurrent: 1, CurrentJobs: 1},
			models.Runner{ID: "r2", Status: "online", MaxConcurrent: 1, CurrentJobs: 1},
		))
	_, err := svc.SelectRunner(context.Background(), "t1", nil)
	if !errors.Is(err, ErrNoCapacity) {
		t.Errorf("err = %v, want ErrNoCapacity", err)
	}
}

func TestSelectRunnerEmptyCandidates(t *testing.T) {
	svc, _, mock := newServiceWithMock(t)
	mock.ExpectQuery(`SELECT \* FROM runners WHERE tenant_id=\$1 AND labels @> \$2 ORDER BY last_heartbeat DESC`).
		WithArgs("t1", "null").
		WillReturnRows(runnerRows())
	_, err := svc.SelectRunner(context.Background(), "t1", nil)
	if !errors.Is(err, ErrNoCapacity) {
		t.Errorf("empty candidates should return ErrNoCapacity, got %v", err)
	}
}

func TestSelectRunnerPropagatesRepoError(t *testing.T) {
	svc, _, mock := newServiceWithMock(t)
	mock.ExpectQuery(`SELECT \* FROM runners WHERE tenant_id=\$1 AND labels @> \$2 ORDER BY last_heartbeat DESC`).
		WithArgs("t1", "null").
		WillReturnError(errors.New("db down"))
	if _, err := svc.SelectRunner(context.Background(), "t1", nil); err == nil {
		t.Error("expected db error")
	}
}

// ---------------------------------------------------------------------------
// GetStaleRunners — timeout filter
// ---------------------------------------------------------------------------

func TestGetStaleRunnersDefaultTimeout(t *testing.T) {
	svc, _, mock := newServiceWithMock(t)
	// timeoutMinutes <= 0 → defaults to 5
	now := time.Now()
	future := time.Date(2999, 1, 1, 0, 0, 0, 0, time.UTC)
	old := now.Add(-1 * time.Hour)

	mock.ExpectQuery(`SELECT \* FROM runners WHERE status=\$1 ORDER BY last_heartbeat DESC`).
		WithArgs("online").
		WillReturnRows(runnerRows(
			models.Runner{ID: "new-online", Status: "online", LastHeartbeat: &now},
		))
	mock.ExpectQuery(`SELECT \* FROM runners WHERE status=\$1 ORDER BY last_heartbeat DESC`).
		WithArgs("busy").
		WillReturnRows(runnerRows(
			models.Runner{ID: "stale-busy", Status: "busy", LastHeartbeat: &old},
		))

	out, err := svc.GetStaleRunners(context.Background(), 0)
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if len(out) != 1 || out[0].ID != "stale-busy" {
		t.Errorf("stale = %+v, want exactly stale-busy", out)
	}
	_ = future
}

func TestGetStaleRunnersSkipsNilHeartbeat(t *testing.T) {
	svc, _, mock := newServiceWithMock(t)
	mock.ExpectQuery(`SELECT \* FROM runners WHERE status=\$1 ORDER BY last_heartbeat DESC`).
		WithArgs("online").
		WillReturnRows(runnerRows(
			models.Runner{ID: "no-hb", Status: "online"}, // LastHeartbeat nil
		))
	mock.ExpectQuery(`SELECT \* FROM runners WHERE status=\$1 ORDER BY last_heartbeat DESC`).
		WithArgs("busy").
		WillReturnRows(runnerRows())

	out, err := svc.GetStaleRunners(context.Background(), 5)
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if len(out) != 0 {
		t.Errorf("nil heartbeat should be skipped, got %+v", out)
	}
}

func TestGetStaleRunnersRecentHeartbeatNotStale(t *testing.T) {
	svc, _, mock := newServiceWithMock(t)
	now := time.Now()
	mock.ExpectQuery(`SELECT \* FROM runners WHERE status=\$1 ORDER BY last_heartbeat DESC`).
		WithArgs("online").
		WillReturnRows(runnerRows(
			models.Runner{ID: "fresh", Status: "online", LastHeartbeat: &now},
		))
	mock.ExpectQuery(`SELECT \* FROM runners WHERE status=\$1 ORDER BY last_heartbeat DESC`).
		WithArgs("busy").
		WillReturnRows(runnerRows())
	out, err := svc.GetStaleRunners(context.Background(), 5)
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if len(out) != 0 {
		t.Errorf("fresh heartbeat should not be stale, got %+v", out)
	}
}

func TestGetStaleRunnersPropagatesRepoError(t *testing.T) {
	svc, _, mock := newServiceWithMock(t)
	mock.ExpectQuery(`SELECT \* FROM runners WHERE status=\$1 ORDER BY last_heartbeat DESC`).
		WithArgs("online").
		WillReturnError(errors.New("db down"))
	if _, err := svc.GetStaleRunners(context.Background(), 5); err == nil {
		t.Error("expected db error")
	}
}
