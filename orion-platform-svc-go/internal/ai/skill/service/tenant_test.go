package service

import (
	"context"
	"database/sql"
	"database/sql/driver"
	"errors"
	"testing"
	"time"

	"orion/platform-svc-go/internal/ai/skill/models"
	"orion/platform-svc-go/internal/ai/skill/repository"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"
)

// These tests pin which tenant reaches the SQL for CreateInstance and
// ExecuteSkill. Both used to take the tenant from the request body: the handler
// had `if req.TenantID == "" { req.TenantID = tenantID }`, but the body field
// carried `binding:"required"`, so ShouldBindJSON rejected requests without it
// and the fallback was unreachable dead code — the body tenant won every time.
//
// The assertions are on the bound arguments, not on return values. The service
// builds the row it returns in memory, so asserting on the returned tenant would
// be self-proving.

const (
	callerTenant   = "caller-tenant"
	attackerTenant = "attacker-tenant"
)

func newMockDB() (*sql.DB, sqlmock.Sqlmock, error) {
	return sqlmock.New()
}

func newTenantTestService(t *testing.T) (*Service, sqlmock.Sqlmock) {
	t.Helper()
	db, mock, err := newMockDB()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	return NewService(repository.NewRepository(sqlx.NewDb(db, "postgres"))), mock
}

func skillRow() *sqlmock.Rows {
	return sqlmock.NewRows([]string{
		"id", "name", "version", "description", "category", "tags", "author",
		"status", "schema", "capabilities", "schemas", "is_version_locked",
		"install_count", "rating", "rating_count", "created_at", "updated_at",
	}).AddRow(
		"sk-1", "greet", "1.0.0", "test", "ai", `[]`, "author-1",
		"published", `{}`, `[]`, `{}`, false,
		0, 0.0, 0, rowTime, rowTime,
	)
}

func instanceRow(id, skillID, tenantID string, isDefault bool) *sqlmock.Rows {
	return sqlmock.NewRows([]string{
		"id", "skill_id", "tenant_id", "project_id", "name", "description",
		"status", "config", "bindings", "metadata", "is_default", "version",
		"created_by", "created_at", "updated_at",
	}).AddRow(
		id, skillID, tenantID, nil, "existing", nil,
		"active", `{}`, `{}`, `{}`, isDefault, "1.0.0",
		"creator-1", rowTime, rowTime,
	)
}

func executionRow(id, tenantID, skillID string, status string) *sqlmock.Rows {
	return sqlmock.NewRows([]string{
		"id", "tenant_id", "skill_id", "instance_id", "capability", "status",
		"input", "output", "error_message", "duration_ms", "triggered_by",
		"trigger_mode", "metadata", "started_at", "completed_at", "created_at",
	}).AddRow(
		id, tenantID, skillID, nil, nil, status,
		`{}`, nil, nil, nil, nil,
		"manual", `{}`, rowTime, nil, rowTime,
	)
}

// sqlmock reports every column as VARCHAR, and database/sql refuses to scan a
// string into time.Time. Passing a real time.Time is the workaround.
var rowTime = time.Unix(0, 0)

func TestCreateInstance_WritesCallerTenantNotRequestBody(t *testing.T) {
	svc, mock := newTenantTestService(t)

	mock.ExpectQuery(`SELECT \* FROM skill_packages WHERE id = \$1`).
		WithArgs("sk-1").WillReturnRows(skillRow())
	// tenant_id is the 3rd INSERT argument; pinning it is the whole point.
	mock.ExpectExec(`INSERT INTO skill_instances`).
		WithArgs(
			sqlmock.AnyArg(), "sk-1", callerTenant, sqlmock.AnyArg(),
			"instance-a", sqlmock.AnyArg(), "inactive", sqlmock.AnyArg(),
			sqlmock.AnyArg(), sqlmock.AnyArg(), false, "1.0.0", sqlmock.AnyArg(),
		).WillReturnResult(sqlmock.NewResult(1, 1))

	req := &models.CreateInstanceRequest{
		SkillID:  "sk-1",
		TenantID: attackerTenant, // must be ignored
		Name:     "instance-a",
	}
	inst, err := svc.CreateInstance(context.Background(), callerTenant, req)
	if err != nil {
		t.Fatalf("CreateInstance: %v", err)
	}
	if inst.TenantID != callerTenant {
		t.Errorf("instance tenant = %q, want %q", inst.TenantID, callerTenant)
	}
	if inst.TenantID == attackerTenant {
		t.Errorf("body tenant leaked into the instance row")
	}
	assertExpectations(t, mock)
}

func TestCreateInstance_ClearsDefaultsUnderCallerTenant(t *testing.T) {
	svc, mock := newTenantTestService(t)

	mock.ExpectQuery(`SELECT \* FROM skill_packages WHERE id = \$1`).
		WithArgs("sk-1").WillReturnRows(skillRow())
	// Finding the defaults to clear is the write that reaches another tenant.
	mock.ExpectQuery(`SELECT \* FROM skill_instances[\s\S]*skill_id = \$1 AND tenant_id = \$2`).
		WithArgs("sk-1", callerTenant).WillReturnRows(instanceRow("inst-old", "sk-1", callerTenant, true))
	// GetContext with RETURNING * — a query, not an exec.
	mock.ExpectQuery(`UPDATE skill_instances[\s\S]*WHERE id = \$\d+ AND tenant_id = \$\d+`).
		WithArgs(false, "inst-old", callerTenant).
		WillReturnRows(instanceRow("inst-old", "sk-1", callerTenant, false))
	mock.ExpectExec(`INSERT INTO skill_instances`).
		WithArgs(
			sqlmock.AnyArg(), "sk-1", callerTenant, sqlmock.AnyArg(),
			"instance-b", sqlmock.AnyArg(), "inactive", sqlmock.AnyArg(),
			sqlmock.AnyArg(), sqlmock.AnyArg(), true, "1.0.0", sqlmock.AnyArg(),
		).WillReturnResult(sqlmock.NewResult(1, 1))

	req := &models.CreateInstanceRequest{
		SkillID:   "sk-1",
		TenantID:  attackerTenant, // must be ignored
		Name:      "instance-b",
		IsDefault: true,
	}
	inst, err := svc.CreateInstance(context.Background(), callerTenant, req)
	if err != nil {
		t.Fatalf("CreateInstance: %v", err)
	}
	if !inst.IsDefault {
		t.Errorf("expected the new instance to be marked default")
	}
	assertExpectations(t, mock)
}

func TestCreateInstance_EmptyCallerTenantStillBinds(t *testing.T) {
	svc, mock := newTenantTestService(t)

	mock.ExpectQuery(`SELECT \* FROM skill_packages WHERE id = \$1`).
		WithArgs("sk-1").WillReturnRows(skillRow())
	// Empty caller tenant must still be bound: the tenant predicate is always
	// present, never conditionally appended.
	mock.ExpectExec(`INSERT INTO skill_instances`).
		WithArgs(
			sqlmock.AnyArg(), "sk-1", "", sqlmock.AnyArg(),
			"instance-c", sqlmock.AnyArg(), "inactive", sqlmock.AnyArg(),
			sqlmock.AnyArg(), sqlmock.AnyArg(), false, "1.0.0", sqlmock.AnyArg(),
		).WillReturnResult(sqlmock.NewResult(1, 1))

	req := &models.CreateInstanceRequest{SkillID: "sk-1", TenantID: attackerTenant, Name: "instance-c"}
	inst, err := svc.CreateInstance(context.Background(), "", req)
	if err != nil {
		t.Fatalf("CreateInstance: %v", err)
	}
	if inst.TenantID != "" {
		t.Errorf("empty caller tenant must not be backfilled from the body, got %q", inst.TenantID)
	}
	assertExpectations(t, mock)
}

func TestExecuteSkill_WritesCallerTenantNotRequestBody(t *testing.T) {
	svc, mock := newTenantTestService(t)

	mock.ExpectQuery(`SELECT \* FROM skill_packages WHERE id = \$1`).
		WithArgs("sk-1").WillReturnRows(skillRow())
	// tenant_id is the 2nd INSERT argument.
	mock.ExpectExec(`INSERT INTO skill_executions`).
		WithArgs(
			sqlmock.AnyArg(), callerTenant, "sk-1", driver.Value(nil),
			driver.Value(nil), "pending", sqlmock.AnyArg(),
			driver.Value(nil), "manual", sqlmock.AnyArg(),
		).WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectExec(`INSERT INTO skill_audit_logs`).
		WithArgs(
			sqlmock.AnyArg(), "sk-1", "executed", sqlmock.AnyArg(),
			sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(),
			sqlmock.AnyArg(), sqlmock.AnyArg(),
		).WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectQuery(`UPDATE skill_executions[\s\S]*WHERE id = \$2 AND tenant_id = \$3`).
		WithArgs("completed", sqlmock.AnyArg(), callerTenant).
		WillReturnRows(executionRow("exec-1", callerTenant, "sk-1", "completed"))

	req := &models.CreateExecutionRequest{
		SkillID:  "sk-1",
		TenantID: attackerTenant, // must be ignored
	}
	exec, err := svc.ExecuteSkill(context.Background(), callerTenant, "sk-1", req)
	if err != nil {
		t.Fatalf("ExecuteSkill: %v", err)
	}
	if exec.TenantID != callerTenant {
		t.Errorf("execution tenant = %q, want %q", exec.TenantID, callerTenant)
	}
	assertExpectations(t, mock)
}

func TestExecuteSkill_InstanceOwnershipCheckUsesCallerTenant(t *testing.T) {
	svc, mock := newTenantTestService(t)

	mock.ExpectQuery(`SELECT \* FROM skill_packages WHERE id = \$1`).
		WithArgs("sk-1").WillReturnRows(skillRow())
	mock.ExpectQuery(`SELECT \* FROM skill_instances[\s\S]*WHERE id = \$1 AND tenant_id = \$2`).
		WithArgs("inst-1", callerTenant).WillReturnRows(instanceRow("inst-1", "sk-1", callerTenant, false))
	mock.ExpectExec(`INSERT INTO skill_executions`).
		WithArgs(
			sqlmock.AnyArg(), callerTenant, "sk-1", "inst-1",
			driver.Value(nil), "pending", sqlmock.AnyArg(),
			driver.Value(nil), "manual", sqlmock.AnyArg(),
		).WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectExec(`INSERT INTO skill_audit_logs`).
		WithArgs(
			sqlmock.AnyArg(), "sk-1", "executed", sqlmock.AnyArg(),
			sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(),
			sqlmock.AnyArg(), sqlmock.AnyArg(),
		).WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectQuery(`UPDATE skill_executions[\s\S]*WHERE id = \$2 AND tenant_id = \$3`).
		WithArgs("completed", sqlmock.AnyArg(), callerTenant).
		WillReturnRows(executionRow("exec-2", callerTenant, "sk-1", "completed"))

	req := &models.CreateExecutionRequest{
		SkillID:    "sk-1",
		TenantID:   attackerTenant, // must be ignored by the ownership check too
		InstanceID: "inst-1",
	}
	if _, err := svc.ExecuteSkill(context.Background(), callerTenant, "sk-1", req); err != nil {
		t.Fatalf("ExecuteSkill: %v", err)
	}
	assertExpectations(t, mock)
}

func TestExecuteSkill_RejectsInstanceOwnedByAnotherTenant(t *testing.T) {
	svc, mock := newTenantTestService(t)

	mock.ExpectQuery(`SELECT \* FROM skill_packages WHERE id = \$1`).
		WithArgs("sk-1").WillReturnRows(skillRow())
	// The instance exists, but under another tenant: the ownership check must
	// see it as missing. If the check were tenant-blind this test would pass.
	mock.ExpectQuery(`SELECT \* FROM skill_instances[\s\S]*WHERE id = \$1 AND tenant_id = \$2`).
		WithArgs("inst-victim", callerTenant).WillReturnError(sql.ErrNoRows)

	if _, err := svc.ExecuteSkill(context.Background(), callerTenant, "sk-1", &models.CreateExecutionRequest{
		SkillID:    "sk-1",
		InstanceID: "inst-victim",
	}); !errors.Is(err, ErrInstanceNotFound) {
		t.Fatalf("error = %v, want ErrInstanceNotFound", err)
	}
	assertExpectations(t, mock)
}

func assertExpectations(t *testing.T, mock sqlmock.Sqlmock) {
	t.Helper()
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

// Ensure the helper compiles against the concrete repository: guards against a
// future refactor dropping a method these tests drive.
var _ = repository.NewRepository

// driver.Value(nil) is kept as a named import so the NULL binds above read as
// explicit rather than as untyped nil.
var _ driver.Value = driver.Value(nil)
var _ = sql.ErrNoRows
var _ = models.JSONB(nil)
