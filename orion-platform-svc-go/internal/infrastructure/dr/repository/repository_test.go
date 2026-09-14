package repository

import (
	"context"
	"database/sql"
	"database/sql/driver"
	"errors"
	"fmt"
	"strings"
	"testing"
	"time"

	"orion/platform-svc-go/internal/infrastructure/dr/models"

	"github.com/DATA-DOG/go-sqlmock"

	"github.com/jmoiron/sqlx"
)

// normSQL collapses whitespace so a multiline backtick literal compares equal to
// its single-line rendering. sqlmock's default regexp matcher would let a
// shortened column list pass, which is exactly how a dropped column slipped
// through unnoticed.
func normSQL(s string) string {
	return strings.Join(strings.Fields(s), " ")
}

var matchSQL = sqlmock.QueryMatcherOption(sqlmock.QueryMatcherFunc(func(expected, actual string) error {
	if normSQL(expected) != normSQL(actual) {
		return fmt.Errorf("query mismatch\n  expected: %s\n  actual:   %s",
			normSQL(expected), normSQL(actual))
	}
	return nil
}))

func newMock(t *testing.T) (*Repository, sqlmock.Sqlmock) {
	t.Helper()
	raw, mock, err := sqlmock.New(matchSQL)
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	return NewRepository(sqlx.NewDb(raw, "sqlmock")), mock
}

func ts() time.Time {
	return time.Date(2030, 1, 1, 2, 0, 0, 0, time.UTC)
}

func planRow() []driver.Value {
	return []driver.Value{
		"p-1", "t1", "api-dr", "database", 60, 300, "active", "high", "manual",
		[]byte(`["us-east-2"]`), []byte(`[{"name":"checkout"}]`), nil, []byte(`{}`),
		"u1", ts(), ts(),
	}
}

func testRow() []driver.Value {
	return []driver.Value{
		"ft-1", "t1", "p-1", "drill-1", "drill", ts(), nil, nil, nil, nil,
		"running", []byte(`["checkout"]`), nil, "u1", ts(),
	}
}

func backupRow() []driver.Value {
	return []driver.Value{
		"b-1", "t1", "db", "pg-1", "0 2 * * *", 30, "s3://dr", true, "gzip",
		nil, int64(0), true, "u1", ts(), ts(),
	}
}

func policyRow() []driver.Value {
	return []driver.Value{
		"pol-1", "t1", "primary", nil, []byte(`["checkout"]`), "warm-standby",
		"30m", "1h", 5, "active", nil, []byte(`{}`), "u1", ts(), ts(),
	}
}

func ctx0() context.Context {
	return context.Background()
}

func strp(s string) *string {
	return &s
}

func intp(i int) *int {
	return &i
}

func TestRepoCreatePlanInsertsAllColumns(t *testing.T) {
	r, mock := newMock(t)
	mock.ExpectExec("INSERT INTO dr_plans (id, tenant_id, name, plan_type, rpo, rto, "+
		"status, priority, failover_strategy, backup_regions, services, config, created_by, "+
		"created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)").
		WithArgs("p-1", "t1", "api-dr", "database", 60, 300, "active", "high", "manual",
			models.StringArray{"us-east-2"},
			models.JSONArray{map[string]interface{}{"name": "checkout"}},
			models.JSONB{}, "u1", sqlmock.AnyArg(), sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(0, 0))

	err := r.CreatePlan(ctx0(), &models.DRPlan{
		ID: "p-1", TenantID: "t1", Name: "api-dr", PlanType: "database",
		RPO: 60, RTO: 300, Status: "active", Priority: "high",
		FailoverStrategy: "manual",
		BackupRegions:    models.StringArray{"us-east-2"},
		Services:         models.JSONArray{map[string]interface{}{"name": "checkout"}},
		Config:           models.JSONB{}, CreatedBy: "u1", CreatedAt: ts(), UpdatedAt: ts(),
	})
	if err != nil {
		t.Fatalf("CreatePlan = %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

func TestRepoGetPlanByIDOrdersTenantAfterID(t *testing.T) {
	r, mock := newMock(t)
	mock.ExpectQuery("SELECT "+planColumns+" FROM dr_plans WHERE id=$1 AND tenant_id=$2").
		WithArgs("p-1", "t1").
		WillReturnRows(mock.NewRows(strings.Split(planColumns, ", ")).AddRow(planRow()...))

	got, err := r.GetPlanByID(ctx0(), "t1", "p-1")
	if err != nil {
		t.Fatalf("GetPlanByID = %v", err)
	}
	if got.TenantID != "t1" || got.RPO != 60 {
		t.Errorf("row = %+v", got)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

func TestRepoGetPlanByIDReturnsErrNoRows(t *testing.T) {
	r, mock := newMock(t)
	mock.ExpectQuery("SELECT "+planColumns+" FROM dr_plans WHERE id=$1 AND tenant_id=$2").
		WithArgs("p-9", "t1").WillReturnError(sql.ErrNoRows)

	got, err := r.GetPlanByID(ctx0(), "t1", "p-9")
	if err == nil || !errorsIs(err, sql.ErrNoRows) {
		t.Fatalf("err = %v, want sql.ErrNoRows so the service can tell missing from broken", err)
	}
	if got != nil {
		t.Errorf("row = %+v, want nil", got)
	}
}

func TestRepoListPlansBindsOffsetAndLimit(t *testing.T) {
	r, mock := newMock(t)
	mock.ExpectQuery("SELECT "+planColumns+" FROM dr_plans WHERE tenant_id=$1 "+
		"ORDER BY created_at DESC OFFSET $2 LIMIT $3").
		WithArgs("t1", 40, 20).
		WillReturnRows(mock.NewRows(strings.Split(planColumns, ", ")).AddRow(planRow()...))

	items, err := r.ListPlans(ctx0(), "t1", 40, 20)
	if err != nil {
		t.Fatalf("ListPlans = %v", err)
	}
	if len(items) != 1 {
		t.Fatalf("items = %d", len(items))
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

func TestRepoUpdatePlanEmitsOnlyChangedColumns(t *testing.T) {
	r, mock := newMock(t)
	mock.ExpectQuery("UPDATE dr_plans SET name=$1, rto=$2, updated_at=$3 "+
		"WHERE id=$4 AND tenant_id=$5 RETURNING "+planColumns).
		WithArgs("renamed", 120, sqlmock.AnyArg(), "p-1", "t1").
		WillReturnRows(mock.NewRows(strings.Split(planColumns, ", ")).AddRow(planRow()...))

	got, err := r.UpdatePlan(ctx0(), "t1", "p-1", &models.UpdateDRPlanRequest{
		Name: strp("renamed"), RTO: intp(120),
	})
	if err != nil {
		t.Fatalf("UpdatePlan = %v", err)
	}
	if got == nil || got.Name != "api-dr" {
		t.Errorf("row = %+v", got)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

func TestRepoUpdatePlanEmptySetReadsInsteadOfWriting(t *testing.T) {
	// An empty SET used to render an invalid UPDATE; reading the row is the only
	// safe fallback.
	r, mock := newMock(t)
	mock.ExpectQuery("SELECT "+planColumns+" FROM dr_plans WHERE id=$1 AND tenant_id=$2").
		WithArgs("p-1", "t1").
		WillReturnRows(mock.NewRows(strings.Split(planColumns, ", ")).AddRow(planRow()...))

	got, err := r.UpdatePlan(ctx0(), "t1", "p-1", &models.UpdateDRPlanRequest{})
	if err != nil {
		t.Fatalf("UpdatePlan = %v", err)
	}
	if got == nil {
		t.Fatal("want the unchanged row")
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

func TestRepoUpdatePlanBindsJSONAsDriverValues(t *testing.T) {
	r, mock := newMock(t)
	mock.ExpectQuery("UPDATE dr_plans SET backup_regions=$1, services=$2, config=$3, "+
		"updated_at=$4 WHERE id=$5 AND tenant_id=$6 RETURNING "+planColumns).
		WithArgs(models.StringArray{"eu-west-1"},
			models.JSONArray{map[string]interface{}{"name": "billing"}},
			models.JSONB{"allowed_regions": []interface{}{"eu-west-1"}},
			sqlmock.AnyArg(), "p-1", "t1").
		WillReturnRows(mock.NewRows(strings.Split(planColumns, ", ")).AddRow(planRow()...))

	_, err := r.UpdatePlan(ctx0(), "t1", "p-1", &models.UpdateDRPlanRequest{
		BackupRegions: []string{"eu-west-1"},
		Services:      []interface{}{map[string]interface{}{"name": "billing"}},
		Config:        models.JSONB{"allowed_regions": []interface{}{"eu-west-1"}},
	})
	if err != nil {
		t.Fatalf("UpdatePlan = %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

func TestRepoUpdatePlanStatus(t *testing.T) {
	r, mock := newMock(t)
	mock.ExpectExec("UPDATE dr_plans SET status=$1, updated_at=$2 WHERE id=$3 AND tenant_id=$4").
		WithArgs("failing-over", sqlmock.AnyArg(), "p-1", "t1").
		WillReturnResult(sqlmock.NewResult(0, 1))

	if err := r.UpdatePlanStatus(ctx0(), "t1", "p-1", "failing-over"); err != nil {
		t.Fatalf("UpdatePlanStatus = %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

func TestRepoUpdatePlanLastTested(t *testing.T) {
	r, mock := newMock(t)
	mock.ExpectExec("UPDATE dr_plans SET last_tested=$1, updated_at=$2 WHERE id=$3 AND tenant_id=$4").
		WithArgs(sqlmock.AnyArg(), sqlmock.AnyArg(), "p-1", "t1").
		WillReturnResult(sqlmock.NewResult(0, 1))

	if err := r.UpdatePlanLastTested(ctx0(), "t1", "p-1", ts()); err != nil {
		t.Fatalf("UpdatePlanLastTested = %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

func TestRepoDeletePlanScopesTenant(t *testing.T) {
	r, mock := newMock(t)
	mock.ExpectExec("DELETE FROM dr_plans WHERE id=$1 AND tenant_id=$2").
		WithArgs("p-1", "t1").WillReturnResult(sqlmock.NewResult(0, 1))

	if err := r.DeletePlan(ctx0(), "t1", "p-1"); err != nil {
		t.Fatalf("DeletePlan = %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

func TestRepoCountPlans(t *testing.T) {
	r, mock := newMock(t)
	mock.ExpectQuery("SELECT COUNT(*) FROM dr_plans WHERE tenant_id=$1").
		WithArgs("t1").WillReturnRows(mock.NewRows([]string{"count"}).AddRow(7))

	n, err := r.CountPlans(ctx0(), "t1")
	if err != nil || n != 7 {
		t.Fatalf("n = %d, err = %v, want 7", n, err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

func TestRepoCreateFailoverTestStoresScheduledAt(t *testing.T) {
	// scheduled_at was accepted by the API and never written, so a drill could not
	// be found again. Argument 7 is the scheduled time.
	r, mock := newMock(t)
	when := ts()
	mock.ExpectExec("INSERT INTO dr_failover_tests (id, tenant_id, plan_id, test_name, "+
		"test_type, started_at, scheduled_at, result, affected_services, created_by, created_at) "+
		"VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)").
		WithArgs("ft-1", "t1", "p-1", "drill-1", "scheduled-drill", ts(), &when,
			"scheduled", models.StringArray{"checkout"}, "u1", ts()).
		WillReturnResult(sqlmock.NewResult(0, 0))

	err := r.CreateFailoverTest(ctx0(), &models.FailoverTest{
		ID: "ft-1", TenantID: "t1", PlanID: "p-1", TestName: "drill-1",
		TestType: "scheduled-drill", StartedAt: ts(), ScheduledAt: &when,
		Result: "scheduled", AffectedServices: models.StringArray{"checkout"},
		CreatedBy: "u1", CreatedAt: ts(),
	})
	if err != nil {
		t.Fatalf("CreateFailoverTest = %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

func TestRepoGetFailoverTestByID(t *testing.T) {
	r, mock := newMock(t)
	mock.ExpectQuery("SELECT "+failoverTestColumns+" FROM dr_failover_tests "+
		"WHERE id=$1 AND tenant_id=$2").
		WithArgs("ft-1", "t1").
		WillReturnRows(mock.NewRows(strings.Split(failoverTestColumns, ", ")).AddRow(testRow()...))

	got, err := r.GetFailoverTestByID(ctx0(), "t1", "ft-1")
	if err != nil {
		t.Fatalf("GetFailoverTestByID = %v", err)
	}
	if got.Result != "running" {
		t.Errorf("row = %+v", got)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

func TestRepoListFailoverTestsFiltersOnPlanID(t *testing.T) {
	r, mock := newMock(t)
	mock.ExpectQuery("SELECT "+failoverTestColumns+" FROM dr_failover_tests "+
		"WHERE tenant_id=$1 AND plan_id=$2 ORDER BY created_at DESC").
		WithArgs("t1", "p-1").
		WillReturnRows(mock.NewRows(strings.Split(failoverTestColumns, ", ")).AddRow(testRow()...))

	items, err := r.ListFailoverTests(ctx0(), "t1", strp("p-1"))
	if err != nil || len(items) != 1 {
		t.Fatalf("items = %d, err = %v", len(items), err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

func TestRepoListFailoverTestsWithoutFilter(t *testing.T) {
	r, mock := newMock(t)
	mock.ExpectQuery("SELECT " + failoverTestColumns + " FROM dr_failover_tests " +
		"WHERE tenant_id=$1 ORDER BY created_at DESC").
		WithArgs("t1").
		WillReturnRows(mock.NewRows(strings.Split(failoverTestColumns, ", ")).AddRow(testRow()...))

	items, err := r.ListFailoverTests(ctx0(), "t1", nil)
	if err != nil || len(items) != 1 {
		t.Fatalf("items = %d, err = %v", len(items), err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

func TestRepoCompleteFailoverTestWritesThenRereads(t *testing.T) {
	r, mock := newMock(t)
	mock.ExpectExec("UPDATE dr_failover_tests SET completed_at=$1, actual_rto=$2, "+
		"actual_rpo=$3, result=$4, findings=$5 WHERE id=$6 AND tenant_id=$7").
		WithArgs(sqlmock.AnyArg(), intp(120), intp(30), "passed", strp("clean"), "ft-1", "t1").
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectQuery("SELECT "+failoverTestColumns+" FROM dr_failover_tests "+
		"WHERE id=$1 AND tenant_id=$2").
		WithArgs("ft-1", "t1").
		WillReturnRows(mock.NewRows(strings.Split(failoverTestColumns, ", ")).AddRow(testRow()...))

	got, err := r.CompleteFailoverTest(ctx0(), "t1", "ft-1",
		&models.CompleteFailoverTestRequest{
			ActualRTO: 120, ActualRPO: 30, Result: "passed", Findings: strp("clean"),
		})
	if err != nil {
		t.Fatalf("CompleteFailoverTest = %v", err)
	}
	if got == nil || got.ID != "ft-1" {
		t.Fatalf("row = %+v", got)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

func TestRepoCreateBackupConfig(t *testing.T) {
	r, mock := newMock(t)
	mock.ExpectExec("INSERT INTO dr_backup_configs (id, tenant_id, source_type, source_id, "+
		"backup_schedule, retention_days, storage_location, encryption, compression, enabled, "+
		"created_by, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)").
		WithArgs("b-1", "t1", "db", "pg-1", "0 2 * * *", 30, "s3://dr", true, "gzip",
			true, "u1", sqlmock.AnyArg(), sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(0, 0))

	err := r.CreateBackupConfig(ctx0(), &models.BackupConfig{
		ID: "b-1", TenantID: "t1", SourceType: "db", SourceID: "pg-1",
		BackupSchedule: "0 2 * * *", RetentionDays: 30, StorageLocation: "s3://dr",
		Encryption: true, Compression: "gzip", Enabled: true, CreatedBy: "u1",
		CreatedAt: ts(), UpdatedAt: ts(),
	})
	if err != nil {
		t.Fatalf("CreateBackupConfig = %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

func TestRepoBackupConfigListCountDelete(t *testing.T) {
	r, mock := newMock(t)
	mock.ExpectQuery("SELECT "+backupConfigColumns+" FROM dr_backup_configs "+
		"WHERE tenant_id=$1 ORDER BY created_at DESC OFFSET $2 LIMIT $3").
		WithArgs("t1", 0, 20).
		WillReturnRows(mock.NewRows(strings.Split(backupConfigColumns, ", ")).AddRow(backupRow()...))
	if items, err := r.ListBackupConfigs(ctx0(), "t1", 0, 20); err != nil || len(items) != 1 {
		t.Fatalf("ListBackupConfigs = %d, %v", len(items), err)
	}

	mock.ExpectQuery("SELECT COUNT(*) FROM dr_backup_configs WHERE tenant_id=$1").
		WithArgs("t1").WillReturnRows(mock.NewRows([]string{"count"}).AddRow(3))
	if n, err := r.CountBackupConfigs(ctx0(), "t1"); err != nil || n != 3 {
		t.Fatalf("CountBackupConfigs = %d, %v", n, err)
	}

	mock.ExpectExec("DELETE FROM dr_backup_configs WHERE id=$1 AND tenant_id=$2").
		WithArgs("b-1", "t1").WillReturnResult(sqlmock.NewResult(0, 1))
	if err := r.DeleteBackupConfig(ctx0(), "t1", "b-1"); err != nil {
		t.Fatalf("DeleteBackupConfig = %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

func TestRepoUpdateBackupConfig(t *testing.T) {
	r, mock := newMock(t)
	mock.ExpectQuery("UPDATE dr_backup_configs SET retention_days=$1, encryption=$2, "+
		"updated_at=$3 WHERE id=$4 AND tenant_id=$5 RETURNING "+backupConfigColumns).
		WithArgs(60, false, sqlmock.AnyArg(), "b-1", "t1").
		WillReturnRows(mock.NewRows(strings.Split(backupConfigColumns, ", ")).AddRow(backupRow()...))

	off := false
	_, err := r.UpdateBackupConfig(ctx0(), "t1", "b-1", &models.UpdateBackupConfigRequest{
		RetentionDays: intp(60), Encryption: &off,
	})
	if err != nil {
		t.Fatalf("UpdateBackupConfig = %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

func TestRepoUpdateBackupConfigEmptySetReads(t *testing.T) {
	r, mock := newMock(t)
	mock.ExpectQuery("SELECT "+backupConfigColumns+" FROM dr_backup_configs "+
		"WHERE id=$1 AND tenant_id=$2").
		WithArgs("b-1", "t1").
		WillReturnRows(mock.NewRows(strings.Split(backupConfigColumns, ", ")).AddRow(backupRow()...))

	got, err := r.UpdateBackupConfig(ctx0(), "t1", "b-1", &models.UpdateBackupConfigRequest{})
	if err != nil || got == nil {
		t.Fatalf("UpdateBackupConfig = %+v, %v", got, err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

func TestRepoCreatePolicy(t *testing.T) {
	r, mock := newMock(t)
	mock.ExpectExec("INSERT INTO dr_policies (id, tenant_id, name, description, services, "+
		"strategy, rpo, rto, priority, status, project_id, config, created_by, created_at, "+
		"updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)").
		WithArgs("pol-1", "t1", "primary", strp("core"),
			models.JSONArray{map[string]interface{}{"name": "checkout"}}, "warm-standby",
			"30m", "1h", 5, "active", nil, models.JSONB{}, "u1", sqlmock.AnyArg(), sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(0, 0))

	err := r.CreatePolicy(ctx0(), &models.DRPolicy{
		ID: "pol-1", TenantID: "t1", Name: "primary", Description: strp("core"),
		Services: models.JSONArray{map[string]interface{}{"name": "checkout"}},
		Strategy: "warm-standby", RPO: "30m", RTO: "1h", Priority: 5,
		Status: "active", Config: models.JSONB{}, CreatedBy: "u1",
		CreatedAt: ts(), UpdatedAt: ts(),
	})
	if err != nil {
		t.Fatalf("CreatePolicy = %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

func TestRepoListPoliciesOrdersByPriority(t *testing.T) {
	r, mock := newMock(t)
	mock.ExpectQuery("SELECT "+policyColumns+" FROM dr_policies WHERE tenant_id=$1 "+
		"ORDER BY priority, created_at DESC OFFSET $2 LIMIT $3").
		WithArgs("t1", 0, 10).
		WillReturnRows(mock.NewRows(strings.Split(policyColumns, ", ")).AddRow(policyRow()...))

	items, err := r.ListPolicies(ctx0(), "t1", 0, 10)
	if err != nil || len(items) != 1 {
		t.Fatalf("items = %d, %v", len(items), err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

func TestRepoListPoliciesByStrategyAndStatus(t *testing.T) {
	r, mock := newMock(t)
	mock.ExpectQuery("SELECT "+policyColumns+" FROM dr_policies "+
		"WHERE tenant_id=$1 AND strategy=$2 ORDER BY priority").
		WithArgs("t1", "cold-standby").
		WillReturnRows(mock.NewRows(strings.Split(policyColumns, ", ")).AddRow(policyRow()...))
	if items, err := r.ListPoliciesByStrategy(ctx0(), "t1", "cold-standby"); err != nil {
		t.Fatalf("ListPoliciesByStrategy = %v", err)
	} else if len(items) != 1 {
		t.Fatalf("items = %d", len(items))
	}

	mock.ExpectQuery("SELECT "+policyColumns+" FROM dr_policies "+
		"WHERE tenant_id=$1 AND status=$2 ORDER BY priority").
		WithArgs("t1", "active").
		WillReturnRows(mock.NewRows(strings.Split(policyColumns, ", ")).AddRow(policyRow()...))
	if items, err := r.ListPoliciesByStatus(ctx0(), "t1", "active"); err != nil {
		t.Fatalf("ListPoliciesByStatus = %v", err)
	} else if len(items) != 1 {
		t.Fatalf("items = %d", len(items))
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

func TestRepoPolicyGetCountDelete(t *testing.T) {
	r, mock := newMock(t)
	mock.ExpectQuery("SELECT "+policyColumns+" FROM dr_policies WHERE id=$1 AND tenant_id=$2").
		WithArgs("pol-1", "t1").
		WillReturnRows(mock.NewRows(strings.Split(policyColumns, ", ")).AddRow(policyRow()...))
	got, err := r.GetPolicyByID(ctx0(), "t1", "pol-1")
	if err != nil || got.Strategy != "warm-standby" {
		t.Fatalf("GetPolicyByID = %+v, %v", got, err)
	}

	mock.ExpectQuery("SELECT COUNT(*) FROM dr_policies WHERE tenant_id=$1").
		WithArgs("t1").WillReturnRows(mock.NewRows([]string{"count"}).AddRow(2))
	if n, err := r.CountPolicies(ctx0(), "t1"); err != nil || n != 2 {
		t.Fatalf("CountPolicies = %d, %v", n, err)
	}

	mock.ExpectExec("DELETE FROM dr_policies WHERE id=$1 AND tenant_id=$2").
		WithArgs("pol-1", "t1").WillReturnResult(sqlmock.NewResult(0, 1))
	if err := r.DeletePolicy(ctx0(), "t1", "pol-1"); err != nil {
		t.Fatalf("DeletePolicy = %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

func TestRepoUpdatePolicy(t *testing.T) {
	r, mock := newMock(t)
	mock.ExpectQuery("UPDATE dr_policies SET strategy=$1, priority=$2, updated_at=$3 "+
		"WHERE id=$4 AND tenant_id=$5 RETURNING "+policyColumns).
		WithArgs("cold-standby", 9, sqlmock.AnyArg(), "pol-1", "t1").
		WillReturnRows(mock.NewRows(strings.Split(policyColumns, ", ")).AddRow(policyRow()...))

	_, err := r.UpdatePolicy(ctx0(), "t1", "pol-1", &models.UpdatePolicyRequest{
		Strategy: strp("cold-standby"), Priority: intp(9),
	})
	if err != nil {
		t.Fatalf("UpdatePolicy = %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

func TestRepoUpdatePolicyEmptySetReads(t *testing.T) {
	r, mock := newMock(t)
	mock.ExpectQuery("SELECT "+policyColumns+" FROM dr_policies WHERE id=$1 AND tenant_id=$2").
		WithArgs("pol-1", "t1").
		WillReturnRows(mock.NewRows(strings.Split(policyColumns, ", ")).AddRow(policyRow()...))

	got, err := r.UpdatePolicy(ctx0(), "t1", "pol-1", &models.UpdatePolicyRequest{})
	if err != nil || got == nil {
		t.Fatalf("UpdatePolicy = %+v, %v", got, err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

func TestRepoReturnsStorageErrorsUnchanged(t *testing.T) {
	r, mock := newMock(t)
	refused := fmt.Errorf("connection refused")
	mock.ExpectQuery("SELECT "+planColumns+" FROM dr_plans WHERE id=$1 AND tenant_id=$2").
		WithArgs("p-1", "t1").WillReturnError(refused)

	got, err := r.GetPlanByID(ctx0(), "t1", "p-1")
	if err == nil || err != refused {
		t.Fatalf("err = %v, want the storage error passed through so the service can map it", err)
	}
	if got != nil {
		t.Errorf("row = %+v, want nil", got)
	}
}

// errorsIs keeps the sql.ErrNoRows comparison explicit in the test file.
func errorsIs(err, target error) bool {
	return errors.Is(err, target)
}
