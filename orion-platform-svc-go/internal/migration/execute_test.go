package migration

import (
	"context"
	"database/sql"
	"fmt"
	"testing"

	sqlmock "github.com/DATA-DOG/go-sqlmock"
	"go.uber.org/zap"
)

// mockFactory describes how a fresh *sql.DB should behave. `nExec` is
// the number of Exec calls to expect in a single plan execution, and
// `rowsPerStmt` is the RowsAffected returned by each.
type mockFactory struct {
	nExec       int
	rowsPerStmt int64
	openErr     error
}

// newMockService builds a Service wired to sqlmock. Every plan
// execution opens a fresh *sql.DB with expectations: Begin, then nExec
// Execs (rowsPerStmt each), then Commit. Rollback is also registered so
// tests that swap in a failing factory still work.
func newMockService(t *testing.T, f *mockFactory) *Service {
	t.Helper()
	logger, _ := zap.NewDevelopment()
	repo := NewRepository()
	factory := func(ctx context.Context, ep MigrationEndpoint) (*sql.DB, error) {
		if f.openErr != nil {
			return nil, f.openErr
		}
		db, mock, err := sqlmock.New(
			sqlmock.QueryMatcherOption(sqlmock.QueryMatcherRegexp),
		)
		if err != nil {
			return nil, err
		}
		mock.ExpectBegin()
		for i := 0; i < f.nExec; i++ {
			mock.ExpectExec(".*").
				WillReturnResult(sqlmock.NewResult(f.rowsPerStmt, f.rowsPerStmt))
		}
		mock.ExpectCommit()
		mock.ExpectRollback()
		return db, nil
	}
	return NewService(repo, logger, factory)
}

// newFailingOnStmtFactory builds a DBFactory whose mock returns err on
// the failIndex-th Exec call (1-based) and rowsPerStmt on every other
// Exec call up to nExec.
func newFailingOnStmtFactory(failIndex, nExec int, err error, rowsPerStmt int64) DBFactory {
	return func(ctx context.Context, ep MigrationEndpoint) (*sql.DB, error) {
		db, mock, merr := sqlmock.New(
			sqlmock.QueryMatcherOption(sqlmock.QueryMatcherRegexp),
		)
		if merr != nil {
			return nil, merr
		}
		mock.ExpectBegin()
		for i := 1; i <= nExec; i++ {
			exp := mock.ExpectExec(".*")
			if i == failIndex {
				exp.WillReturnError(err)
			} else {
				exp.WillReturnResult(sqlmock.NewResult(rowsPerStmt, rowsPerStmt))
			}
		}
		mock.ExpectRollback()
		mock.ExpectCommit()
		return db, nil
	}
}

func TestExecute_SuccessfulMultiStatement(t *testing.T) {
	svc := newMockService(t, &mockFactory{nExec: 2, rowsPerStmt: 5})
	ctx := context.Background()

	plan, err := svc.CreatePlan(ctx, CreatePlanInput{
		Name:   "Exec OK",
		Type:   MigrationSchema,
		Source: MigrationEndpoint{Host: "src", Type: "postgresql", Port: 5432, Database: "d"},
		Target: MigrationEndpoint{Host: "tgt", Type: "postgresql", Port: 5432, Database: "d"},
		Direction: DirectionForward,
		SqlStatements: []string{
			"INSERT INTO users (id) VALUES (1)",
			"INSERT INTO users (id) VALUES (2)",
		},
	})
	if err != nil {
		t.Fatalf("CreatePlan: %v", err)
	}

	result, err := svc.Execute(ctx, "", plan.ID)
	if err != nil {
		t.Fatalf("Execute: %v", err)
	}
	if result.Status != "success" {
		t.Fatalf("expected success, got %s: %s", result.Status, result.Error)
	}
	if result.Steps != 2 {
		t.Fatalf("expected 2 steps, got %d", result.Steps)
	}
	if result.StepsOK != 2 {
		t.Fatalf("expected 2 ok steps, got %d", result.StepsOK)
	}
	if result.Rows != 10 {
		t.Fatalf("expected 10 rows (2 x 5), got %d", result.Rows)
	}
	if result.Phase != PhaseCompleted {
		t.Fatalf("expected completed, got %s", result.Phase)
	}

	steps, err := svc.GetSteps(ctx, plan.ID)
	if err != nil {
		t.Fatalf("GetSteps: %v", err)
	}
	for i, s := range steps {
		if s.Rows != 5 {
			t.Fatalf("step %d: expected Rows=5 (from driver), got %d", i, s.Rows)
		}
		if s.Status != "done" {
			t.Fatalf("step %d: expected done, got %q", i, s.Status)
		}
		if s.Started == nil || s.Finished == nil {
			t.Fatalf("step %d: expected timestamps set", i)
		}
	}
}

func TestExecute_MidExecutionFailureMarksFailedAndStops(t *testing.T) {
	svc := newMockService(t, &mockFactory{nExec: 2, rowsPerStmt: 3})
	// Swap in a factory that fails the 2nd Exec call (syntax error).
	svc.SetDBFactory(newFailingOnStmtFactory(2, 2, fmt.Errorf("syntax error near 'BANG'"), 3))

	ctx := context.Background()
	plan, err := svc.CreatePlan(ctx, CreatePlanInput{
		Name:   "Exec Fail",
		Type:   MigrationSchema,
		Source: MigrationEndpoint{Host: "src", Type: "postgresql", Port: 5432, Database: "d"},
		Target: MigrationEndpoint{Host: "tgt", Type: "postgresql", Port: 5432, Database: "d"},
		Direction: DirectionForward,
		SqlStatements: []string{
			"INSERT INTO t (id) VALUES (1)",
			"INSERT INTO t BANG",
			"INSERT INTO t (id) VALUES (3)",
		},
	})
	if err != nil {
		t.Fatalf("CreatePlan: %v", err)
	}

	result, err := svc.Execute(ctx, "", plan.ID)
	if err != nil {
		t.Fatalf("Execute: %v", err)
	}
	if result.Status != "failed" {
		t.Fatalf("expected failed, got %s", result.Status)
	}
	if result.Phase != PhaseFailed {
		t.Fatalf("expected failed phase, got %s", result.Phase)
	}
	if result.StepsErr != 1 {
		t.Fatalf("expected 1 err step, got %d", result.StepsErr)
	}
	if result.StepsOK != 1 {
		t.Fatalf("expected 1 ok step, got %d", result.StepsOK)
	}
	if result.Rows != 3 {
		t.Fatalf("expected 3 rows from successful first step, got %d", result.Rows)
	}

	phase, _ := svc.GetPlanPhase(ctx, plan.ID)
	if phase != PhaseFailed {
		t.Fatalf("expected failed, got %s", phase)
	}

	steps, err := svc.GetSteps(ctx, plan.ID)
	if err != nil {
		t.Fatalf("GetSteps: %v", err)
	}
	if len(steps) != 2 {
		t.Fatalf("expected 2 recorded steps (stopped at failure), got %d", len(steps))
	}
	if steps[0].Status != "rolled_back" {
		t.Fatalf("expected first step rolled_back, got %q", steps[0].Status)
	}
	if steps[1].Status != "failed" {
		t.Fatalf("expected second step failed, got %q", steps[1].Status)
	}
	if steps[1].ErrMsg == "" {
		t.Fatal("expected non-empty ErrMsg on failed step")
	}
	for _, s := range steps {
		if s.SQL == "INSERT INTO t (id) VALUES (3)" {
			t.Fatalf("third statement should not have been attempted")
		}
	}
}

func TestExecute_EmptyStatementsReturnsSuccess(t *testing.T) {
	svc := newMockService(t, &mockFactory{})
	ctx := context.Background()

	plan, err := svc.CreatePlan(ctx, CreatePlanInput{
		Name:   "Empty",
		Type:   MigrationSchema,
		Source: MigrationEndpoint{Host: "src", Type: "postgresql", Port: 5432, Database: "d"},
		Target: MigrationEndpoint{Host: "tgt", Type: "postgresql", Port: 5432, Database: "d"},
		Direction: DirectionForward,
	})
	if err != nil {
		t.Fatalf("CreatePlan: %v", err)
	}

	result, err := svc.Execute(ctx, "", plan.ID)
	if err != nil {
		t.Fatalf("Execute: %v", err)
	}
	if result.Status != "success" {
		t.Fatalf("expected success, got %s: %s", result.Status, result.Error)
	}
	if result.Steps != 0 {
		t.Fatalf("expected 0 steps, got %d", result.Steps)
	}
	if result.Rows != 0 {
		t.Fatalf("expected 0 rows, got %d", result.Rows)
	}
	if result.Phase != PhaseCompleted {
		t.Fatalf("expected completed, got %s", result.Phase)
	}
}

func TestExecute_MissingConfigFailsCleanly(t *testing.T) {
	svc := newMockService(t, &mockFactory{nExec: 1, rowsPerStmt: 0})
	svc.SetDBFactory(func(ctx context.Context, ep MigrationEndpoint) (*sql.DB, error) {
		return nil, fmt.Errorf("endpoint unreachable: %s", ep.Host)
	})

	ctx := context.Background()
	plan, err := svc.CreatePlan(ctx, CreatePlanInput{
		Name:   "No DB",
		Type:   MigrationSchema,
		Source: MigrationEndpoint{Host: "src", Type: "postgresql", Port: 5432, Database: "d"},
		Target: MigrationEndpoint{Host: "tgt", Type: "postgresql", Port: 5432, Database: "d"},
		Direction: DirectionForward,
		SqlStatements: []string{"SELECT 1"},
	})
	if err != nil {
		t.Fatalf("CreatePlan: %v", err)
	}

	result, err := svc.Execute(ctx, "", plan.ID)
	if err != nil {
		t.Fatalf("Execute should record failure in result, not return error: %v", err)
	}
	if result.Status != "failed" {
		t.Fatalf("expected failed, got %s", result.Status)
	}
	if result.Phase != PhaseFailed {
		t.Fatalf("expected failed phase, got %s", result.Phase)
	}
	if result.Error == "" {
		t.Fatal("expected non-empty error message")
	}
	phase, _ := svc.GetPlanPhase(ctx, plan.ID)
	if phase != PhaseFailed {
		t.Fatalf("expected phase failed, got %s", phase)
	}
}

func TestExecute_ContextCancelled(t *testing.T) {
	svc := newMockService(t, &mockFactory{nExec: 1, rowsPerStmt: 0})
	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	plan, err := svc.CreatePlan(ctx, CreatePlanInput{
		Name:   "Cancelled",
		Type:   MigrationSchema,
		Source: MigrationEndpoint{Host: "src", Type: "postgresql", Port: 5432, Database: "d"},
		Target: MigrationEndpoint{Host: "tgt", Type: "postgresql", Port: 5432, Database: "d"},
		Direction: DirectionForward,
		SqlStatements: []string{"SELECT 1"},
	})
	if err != nil {
		t.Fatalf("CreatePlan: %v", err)
	}

	result, err := svc.Execute(ctx, "", plan.ID)
	if err != nil {
		t.Fatalf("Execute: %v", err)
	}
	if result.Status != "failed" {
		t.Fatalf("expected failed, got %s: %s", result.Status, result.Error)
	}
}

func TestExecute_RollbackWithFactory(t *testing.T) {
	svc := newMockService(t, &mockFactory{nExec: 1, rowsPerStmt: 1})
	ctx := context.Background()
	// Rollback runs db.ExecContext directly (no Begin/Commit), so its
	// own factory call must not require transaction expectations.
	_ = ctx

	plan, err := svc.CreatePlan(ctx, CreatePlanInput{
		Name:   "Rollback real",
		Type:   MigrationSchema,
		Source: MigrationEndpoint{Host: "src", Type: "postgresql", Port: 5432, Database: "d"},
		Target: MigrationEndpoint{Host: "tgt", Type: "postgresql", Port: 5432, Database: "d"},
		Direction: DirectionForward,
		SqlStatements: []string{
			"INSERT INTO t (id) VALUES (10)",
		},
	})
	if err != nil {
		t.Fatalf("CreatePlan: %v", err)
	}

	if r, e := svc.Execute(ctx, "", plan.ID); e != nil {
		t.Fatalf("Execute: %v", e)
	} else if r.Status != "success" {
		t.Fatalf("Execute status: %s: %s", r.Status, r.Error)
	}

	plan.SqlStatements = []string{"DELETE FROM t WHERE id = 10"}
	result, err := svc.Rollback(ctx, "", plan.ID)
	if err != nil {
		t.Fatalf("Rollback: %v", err)
	}
	if result.Status != "success" {
		t.Fatalf("expected rollback success, got %s: %s", result.Status, result.Error)
	}
	if result.Phase != PhaseRolledBack {
		t.Fatalf("expected rolled_back phase, got %s", result.Phase)
	}
	if result.Rows != 1 {
		t.Fatalf("expected 1 row deleted, got %d", result.Rows)
	}
}

func TestDBFactory_DriverSelection(t *testing.T) {
	cases := []struct {
		ep       MigrationEndpoint
		wantErr  bool
		errSubst string
	}{
		{ep: MigrationEndpoint{Host: "", Type: "postgresql"}, wantErr: true, errSubst: "host required"},
		{ep: MigrationEndpoint{Host: "h", Type: "oracle"}, wantErr: true, errSubst: "unsupported type"},
	}
	for _, c := range cases {
		_, err := DefaultDBFactory(context.Background(), c.ep)
		if !c.wantErr && err == nil {
			t.Fatalf("ep=%+v: expected no error", c.ep)
		}
		if c.wantErr && err == nil {
			t.Fatalf("ep=%+v: expected error containing %q", c.ep, c.errSubst)
		}
		if c.wantErr && err != nil && !contains(err.Error(), c.errSubst) {
			t.Fatalf("ep=%+v: expected error containing %q, got %q", c.ep, c.errSubst, err.Error())
		}
	}
}

func TestDBFactory_DriverNamesAndPorts(t *testing.T) {
	cases := []struct {
		ep       MigrationEndpoint
		wantDrv  string
		wantPort int
	}{
		{ep: MigrationEndpoint{Type: "postgresql"}, wantDrv: "pgx", wantPort: 5432},
		{ep: MigrationEndpoint{Type: "postgres"}, wantDrv: "pgx", wantPort: 5432},
		{ep: MigrationEndpoint{Type: "pg"}, wantDrv: "pgx", wantPort: 5432},
		{ep: MigrationEndpoint{Type: ""}, wantDrv: "pgx", wantPort: 5432},
		{ep: MigrationEndpoint{Type: "mysql"}, wantDrv: "mysql", wantPort: 3306},
		{ep: MigrationEndpoint{Type: "mysql", Port: 3307}, wantDrv: "mysql", wantPort: 3307},
	}
	for _, c := range cases {
		d, p := resolveDriverAndPort(c.ep)
		if d != c.wantDrv {
			t.Fatalf("ep=%+v: expected driver %q, got %q", c.ep, c.wantDrv, d)
		}
		if p != c.wantPort {
			t.Fatalf("ep=%+v: expected port %d, got %d", c.ep, c.wantPort, p)
		}
	}
}

func TestService_NewServiceNilsLogger(t *testing.T) {
	repo := NewRepository()
	svc := NewService(repo, nil, nil)
	if svc == nil {
		t.Fatal("expected non-nil service")
	}
	if svc.log == nil {
		t.Fatal("expected log to be set to a default")
	}
}

func contains(haystack, needle string) bool {
	if needle == "" {
		return true
	}
	for i := 0; i+len(needle) <= len(haystack); i++ {
		if haystack[i:i+len(needle)] == needle {
			return true
		}
	}
	return false
}
