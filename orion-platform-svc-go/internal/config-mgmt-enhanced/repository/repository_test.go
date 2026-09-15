package repository

import (
	"context"
	"database/sql"
	"errors"
	"regexp"
	"strings"
	"testing"
	"time"

	"orion/go-common/pkg/sentinel"
	"orion/platform-svc-go/internal/config-mgmt-enhanced/models"

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

var ctx = context.Background()

var at = time.Date(2025, 11, 15, 12, 0, 0, 0, time.UTC)

func cfgRow() *sqlmock.Rows {
	return sqlmock.NewRows(strings.Split(configMgmtColumns, ", ")).AddRow(
		"cm-1", "tenant-a", "n", at, at)
}

func cfgQuery() string {
	return "SELECT " + regexp.QuoteMeta(configMgmtColumns) + ` FROM config_mgmt WHERE id=\$1 AND tenant_id=\$2`
}

// The INSERT used to go through NamedExecContext with :tenantId, which sqlx
// resolved against the struct field TenantID lowercased to "tenantid" and
// failed with 'could not find name tenantId' before any row was written. WithArgs
// pins every value to its positional placeholder, so that failure is caught here.
func TestCfgRepoCreateBindsEveryColumn(t *testing.T) {
	mock, repo := newMockRepo(t)
	mock.ExpectExec(`INSERT INTO config_mgmt \(id, tenant_id, name, created_at, updated_at\) VALUES \(\$1,\$2,\$3,\$4,\$5\)`).
		WithArgs(sqlmock.AnyArg(), "tenant-a", "n", sqlmock.AnyArg(), sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(0, 1))

	e := &models.ConfigMgmt{TenantID: "tenant-a", Name: "n"}
	if err := repo.Create(ctx, e); err != nil {
		t.Fatalf("Create: %v", err)
	}
	if e.ID == "" {
		t.Errorf("id = %q, want a generated uuid", e.ID)
	}
	if e.CreatedAt.IsZero() || e.UpdatedAt.IsZero() {
		t.Errorf("timestamps not set: %+v", e)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unexpected SQL: %v", err)
	}
}

func TestCfgRepoCreateDriverError(t *testing.T) {
	mock, repo := newMockRepo(t)
	mock.ExpectExec(`INSERT INTO config_mgmt`).WillReturnError(errors.New("connection refused"))
	if err := repo.Create(ctx, &models.ConfigMgmt{Name: "n"}); !strings.Contains(err.Error(), "connection refused") {
		t.Fatalf("err = %v", err)
	}
}

func TestCfgRepoGetByID(t *testing.T) {
	mock, repo := newMockRepo(t)
	mock.ExpectQuery(cfgQuery()).WillReturnRows(cfgRow())

	got, err := repo.GetByID(ctx, "cm-1", "tenant-a")
	if err != nil {
		t.Fatalf("GetByID: %v", err)
	}
	if got.ID != "cm-1" || got.TenantID != "tenant-a" || got.Name != "n" {
		t.Fatalf("got %+v", got)
	}
}

// sql.ErrNoRows has to reach the service unmapped at this layer: the service is
// the one that decides a missing row means a 404.
func TestCfgRepoGetByIDReturnsNoRows(t *testing.T) {
	mock, repo := newMockRepo(t)
	mock.ExpectQuery(cfgQuery()).WillReturnError(sql.ErrNoRows)
	if _, err := repo.GetByID(ctx, "cm-1", "tenant-a"); !errors.Is(err, sql.ErrNoRows) {
		t.Fatalf("err = %v, want sql.ErrNoRows", err)
	}
}

func TestCfgRepoListEmptyAndErrored(t *testing.T) {
	mock, repo := newMockRepo(t)
	mock.ExpectQuery(`SELECT ` + regexp.QuoteMeta(configMgmtColumns) + ` FROM config_mgmt WHERE tenant_id=\$1 ORDER BY created_at DESC`).
		WillReturnRows(sqlmock.NewRows(strings.Split(configMgmtColumns, ", ")))
	entities, err := repo.List(ctx, "tenant-a")
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if len(entities) != 0 {
		t.Fatalf("got %d rows, want 0", len(entities))
	}

	mock, repo = newMockRepo(t)
	mock.ExpectQuery(`SELECT ` + regexp.QuoteMeta(configMgmtColumns)).WillReturnError(errors.New("timeout"))
	if _, err := repo.List(ctx, "tenant-a"); !strings.Contains(err.Error(), "timeout") {
		t.Fatalf("err = %v", err)
	}
}

// No fields is a no-op re-read, not an UPDATE and not a not-found. The old code
// answered sentinel.NotFound here, so PUT /config-mgmt/:id with an empty body
// told the client the row had been deleted.
func TestCfgRepoUpdateEmptyAttrsRereads(t *testing.T) {
	mock, repo := newMockRepo(t)
	mock.ExpectQuery(cfgQuery()).WillReturnRows(cfgRow())

	got, err := repo.Update(ctx, "cm-1", "tenant-a", nil)
	if err != nil {
		t.Fatalf("Update: %v", err)
	}
	if got.ID != "cm-1" {
		t.Fatalf("got %+v", got)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("an empty body must not run an UPDATE: %v", err)
	}
}

func TestCfgRepoUpdateBuildsWhitelistedSet(t *testing.T) {
	mock, repo := newMockRepo(t)
	// Keys are sorted, so the SET clause is deterministic and the placeholder
	// numbers are pinned: name=$1, updated_at=$2, then the WHERE clause.
	mock.ExpectExec(`UPDATE config_mgmt SET name=\$1, updated_at=\$2 WHERE id=\$3 AND tenant_id=\$4`).
		WithArgs("renamed", sqlmock.AnyArg(), "cm-1", "tenant-a").
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectQuery(cfgQuery()).WillReturnRows(cfgRow())

	attrs := map[string]interface{}{"name": "renamed"}
	got, err := repo.Update(ctx, "cm-1", "tenant-a", attrs)
	if err != nil {
		t.Fatalf("Update: %v", err)
	}
	if got.ID != "cm-1" {
		t.Fatalf("got %+v", got)
	}
	// updated_at is stamped by the repository, so it must not leak into the map
	// the caller handed over.
	if len(attrs) != 1 {
		t.Fatalf("attrs = %v, want the caller's single key", attrs)
	}
}

// id, tenant_id and created_at are identity columns. Accepting them in the attrs
// map let a caller rewrite a row's identity or move it into another tenant.
func TestCfgRepoUpdateRejectsIdentityColumns(t *testing.T) {
	_, repo := newMockRepo(t)
	for _, bad := range []map[string]interface{}{
		{"id": "other"},
		{"tenant_id": "tenant-b"},
		{"created_at": at},
	} {
		if _, err := repo.Update(ctx, "cm-1", "tenant-a", bad); err == nil {
			t.Fatalf("attrs %v must be rejected", bad)
		} else if !strings.Contains(err.Error(), "cannot update") {
			t.Fatalf("err = %v, want the whitelist message", err)
		}
	}
}

// Zero rows is a missing row, not a driver failure. Getting this wrong makes an
// update of a deleted record answer 500 instead of 404.
func TestCfgRepoUpdateUnmatchedRowIsNotFound(t *testing.T) {
	mock, repo := newMockRepo(t)
	mock.ExpectExec(`UPDATE config_mgmt`).WillReturnResult(sqlmock.NewResult(0, 0))
	if _, err := repo.Update(ctx, "cm-1", "tenant-a", map[string]interface{}{"name": "x"}); !errors.Is(err, sentinel.NotFound) {
		t.Fatalf("err = %v, want sentinel.NotFound", err)
	}
}

func TestCfgRepoDeleteReportsMatchCount(t *testing.T) {
	mock, repo := newMockRepo(t)
	mock.ExpectExec(`DELETE FROM config_mgmt WHERE id=\$1 AND tenant_id=\$2`).
		WithArgs("cm-1", "tenant-a").WillReturnResult(sqlmock.NewResult(0, 1))
	ok, err := repo.Delete(ctx, "cm-1", "tenant-a")
	if err != nil || !ok {
		t.Fatalf("delete = %v, %v", ok, err)
	}

	mock, repo = newMockRepo(t)
	mock.ExpectExec(`DELETE FROM config_mgmt`).WillReturnResult(sqlmock.NewResult(0, 0))
	ok, err = repo.Delete(ctx, "cm-1", "tenant-a")
	if err != nil || ok {
		t.Fatalf("delete = %v, %v", ok, err)
	}
}

func crRow(approvals string) *sqlmock.Rows {
	return sqlmock.NewRows(strings.Split(changeRequestColumns, ", ")).AddRow(
		"cr-1", "tenant-a", "db.host", "db", "prod",
		"modify", "old", "new", "reason", "high", "u1", "pending",
		"plan", "rollback", approvals, int64(2), nil, nil, nil, nil, nil, nil, at, at)
}

func crQuery() string {
	return "SELECT " + regexp.QuoteMeta(changeRequestColumns) + ` FROM config_change_requests WHERE id=\$1 AND tenant_id=\$2`
}

// All 24 columns are supplied positionally. Approvals is serialised from
// ApprovalsList when the caller left the raw column empty.
func TestCfgRepoCreateChangeRequestBindsEveryColumn(t *testing.T) {
	mock, repo := newMockRepo(t)
	mock.ExpectExec(`(?s)INSERT INTO config_change_requests \(id, tenant_id, config_key.*\) VALUES \(\$1,.*\$24\)`).
		WithArgs(
			sqlmock.AnyArg(), "tenant-a", "db.host", "db", "prod",
			models.ChangeTypeModify, "old", "new", "reason", models.RiskHigh, "u1", models.StatusPending,
			"plan", "rollback", sqlmock.AnyArg(), int64(2), nil, nil, nil, nil, nil, nil, sqlmock.AnyArg(), sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(0, 1))

	cr := &models.ChangeRequest{
		TenantID: "tenant-a", ConfigKey: "db.host", ConfigGroup: "db", Environment: "prod",
		ChangeType: models.ChangeTypeModify, OldValue: "old", NewValue: "new", Reason: "reason",
		RiskLevel: models.RiskHigh, Requester: "u1", Status: models.StatusPending,
		ExecutionPlan: "plan", RollbackPlan: "rollback", RequiredApprovals: 2,
		ApprovalsList: []models.ApprovalRecord{{Approver: "u1", Action: "approve", ApprovedAt: at}},
	}
	if err := repo.CreateChangeRequest(ctx, cr); err != nil {
		t.Fatalf("CreateChangeRequest: %v", err)
	}
	if !strings.Contains(cr.Approvals, "u1") {
		t.Fatalf("approvals column = %q, want the serialised approval list", cr.Approvals)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unexpected SQL: %v", err)
	}
}

// required_approvals is a BIGINT column scanned into an int field. This is what
// makes the int64 above meaningful: a width mismatch would fail the whole read.
func TestCfgRepoGetChangeRequestDeserialisesApprovals(t *testing.T) {
	mock, repo := newMockRepo(t)
	mock.ExpectQuery(crQuery()).WillReturnRows(crRow(`[{"approver":"u1","action":"approve","comment":"ok","approvedAt":"2025-11-15T12:00:00Z"}]`))

	got, err := repo.GetChangeRequest(ctx, "cr-1", "tenant-a")
	if err != nil {
		t.Fatalf("GetChangeRequest: %v", err)
	}
	if got.RequiredApprovals != 2 {
		t.Fatalf("required_approvals = %d, want 2", got.RequiredApprovals)
	}
	if len(got.ApprovalsList) != 1 {
		t.Fatalf("approvals = %v", got.ApprovalsList)
	}
	rec := got.ApprovalsList[0]
	if rec.Approver != "u1" || rec.Action != "approve" || rec.Comment != "ok" {
		t.Fatalf("record = %+v", rec)
	}
	if rec.ApprovedAt.IsZero() {
		t.Errorf("the approval record lost its timestamp: %+v", rec)
	}
}

// A corrupt approvals column must not read as "zero approvals": an empty list is
// exactly the value a single-approval workflow uses to authorise a transition.
func TestCfgRepoGetChangeRequestRejectsCorruptApprovals(t *testing.T) {
	mock, repo := newMockRepo(t)
	mock.ExpectQuery(crQuery()).WillReturnRows(crRow(`{"`))
	_, err := repo.GetChangeRequest(ctx, "cr-1", "tenant-a")
	if err == nil {
		t.Fatalf("a corrupt approvals column must fail the read")
	}
	if !strings.Contains(err.Error(), "approvals for change request cr-1") {
		t.Fatalf("err = %v, want the row id named", err)
	}
}

// An empty approvals value is a legitimate "nobody has approved yet" row, not
// an error. Treating it as corruption would block the first approval. Both
// empty forms are exercised: the marshaler writes [] and a row written by
// anything that does not go through this repository holds a bare empty string,
// so dropping either conjunct of the deserialize guard would fail one of the two.
func TestCfgRepoGetChangeRequestAcceptsEmptyApprovals(t *testing.T) {
	for _, tc := range []struct {
		name   string
		stored string
	}{
		{"emptyArrayLiteral", "[]"},
		{"emptyString", ""},
	} {
		t.Run(tc.name, func(t *testing.T) {
			mock, repo := newMockRepo(t)
			mock.ExpectQuery(crQuery()).WillReturnRows(crRow(tc.stored))
			got, err := repo.GetChangeRequest(ctx, "cr-1", "tenant-a")
			if err != nil {
				t.Fatalf("GetChangeRequest: %v", err)
			}
			if len(got.ApprovalsList) != 0 {
				t.Fatalf("approvals = %v, want none", got.ApprovalsList)
			}
		})
	}
}

// Filters append numbered placeholders in declaration order; a mismatch between
// the number and the argument slice would make Postgres reject the query.
func TestCfgRepoListChangeRequestsBuildsFilters(t *testing.T) {
	mock, repo := newMockRepo(t)
	mock.ExpectQuery(`(?s)SELECT `+regexp.QuoteMeta(changeRequestColumns)+` FROM config_change_requests WHERE tenant_id=\$1 AND status=\$2 AND config_key=\$3 AND risk_level=\$4 ORDER BY created_at DESC`).
		WithArgs("tenant-a", "approved", "db.host", "high").
		WillReturnRows(sqlmock.NewRows(strings.Split(changeRequestColumns, ", ")))

	got, err := repo.ListChangeRequests(ctx, "tenant-a", &models.ChangeHistoryFilter{
		Status: models.StatusApproved, RiskLevel: models.RiskHigh, ConfigKey: "db.host",
	})
	if err != nil {
		t.Fatalf("ListChangeRequests: %v", err)
	}
	if len(got) != 0 {
		t.Fatalf("got %d rows", len(got))
	}
}

func TestCfgRepoUpdateChangeRequestWritesWhitelistedColumns(t *testing.T) {
	mock, repo := newMockRepo(t)
	// Sorted: approved_by=$1, status=$2, updated_at=$3, then the WHERE clause.
	mock.ExpectExec(`UPDATE config_change_requests SET approved_by=\$1, status=\$2, updated_at=\$3 WHERE id=\$4 AND tenant_id=\$5`).
		WithArgs("u1", models.StatusApproved, sqlmock.AnyArg(), "cr-1", "tenant-a").
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectQuery(crQuery()).WillReturnRows(crRow("[]"))

	got, err := repo.UpdateChangeRequest(ctx, "cr-1", "tenant-a", map[string]interface{}{
		"status": models.StatusApproved, "approved_by": "u1",
	})
	if err != nil {
		t.Fatalf("UpdateChangeRequest: %v", err)
	}
	if got.ID != "cr-1" {
		t.Fatalf("got %+v", got)
	}
}

func TestCfgRepoUpdateChangeRequestUnmatchedRowIsNotFound(t *testing.T) {
	mock, repo := newMockRepo(t)
	mock.ExpectExec(`UPDATE config_change_requests`).WillReturnResult(sqlmock.NewResult(0, 0))
	if _, err := repo.UpdateChangeRequest(ctx, "cr-1", "tenant-a", map[string]interface{}{"status": models.StatusApproved}); !errors.Is(err, sentinel.NotFound) {
		t.Fatalf("err = %v, want sentinel.NotFound", err)
	}
}

func TestCfgRepoDeleteChangeRequestReportsMatchCount(t *testing.T) {
	mock, repo := newMockRepo(t)
	mock.ExpectExec(`DELETE FROM config_change_requests WHERE id=\$1 AND tenant_id=\$2`).
		WithArgs("cr-1", "tenant-a").WillReturnResult(sqlmock.NewResult(0, 0))
	ok, err := repo.DeleteChangeRequest(ctx, "cr-1", "tenant-a")
	if err != nil || ok {
		t.Fatalf("delete = %v, %v", ok, err)
	}
}

func TestCfgRepoGetChangeHistoryEmptyIsASlice(t *testing.T) {
	mock, repo := newMockRepo(t)
	mock.ExpectQuery(`SELECT ` + regexp.QuoteMeta(changeHistoryColumns) + ` FROM config_change_history WHERE change_request_id=\$1 AND tenant_id=\$2 ORDER BY created_at ASC`).
		WillReturnRows(sqlmock.NewRows(strings.Split(changeHistoryColumns, ", ")))

	got, err := repo.GetChangeHistory(ctx, "cr-1", "tenant-a")
	if err != nil {
		t.Fatalf("GetChangeHistory: %v", err)
	}
	if got == nil {
		t.Fatalf("an empty trail must be an empty slice, not nil")
	}
	if len(got) != 0 {
		t.Fatalf("got %d rows", len(got))
	}
}

func TestCfgRepoGetChangeHistoryReadsRows(t *testing.T) {
	mock, repo := newMockRepo(t)
	mock.ExpectQuery(`SELECT ` + regexp.QuoteMeta(changeHistoryColumns)).
		WillReturnRows(sqlmock.NewRows(strings.Split(changeHistoryColumns, ", ")).AddRow(
			"h-1", "tenant-a", "cr-1", "db.host", "db", "prod", "approve", "u1", "", "", "ok", at))

	got, err := repo.GetChangeHistory(ctx, "cr-1", "tenant-a")
	if err != nil {
		t.Fatalf("GetChangeHistory: %v", err)
	}
	if len(got) != 1 || got[0].Actor != "u1" || got[0].Notes != "ok" {
		t.Fatalf("got %+v", got)
	}
}

func TestCfgRepoAddChangeHistoryBindsEveryColumn(t *testing.T) {
	mock, repo := newMockRepo(t)
	mock.ExpectExec(`(?s)INSERT INTO config_change_history \(id, tenant_id, change_request_id.*\) VALUES \(\$1,.*\$12\)`).
		WithArgs(sqlmock.AnyArg(), "tenant-a", "cr-1", "db.host", "db", "prod", "approve", "u1", "old", "new", "ok", sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(0, 1))

	h := &models.ChangeHistory{
		TenantID: "tenant-a", ChangeRequestID: "cr-1", ConfigKey: "db.host", ConfigGroup: "db",
		Environment: "prod", Action: "approve", Actor: "u1", OldValue: "old", NewValue: "new", Notes: "ok",
	}
	if err := repo.AddChangeHistory(ctx, h); err != nil {
		t.Fatalf("AddChangeHistory: %v", err)
	}
	if h.ID == "" || h.CreatedAt.IsZero() {
		t.Errorf("id/created_at not set: %+v", h)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unexpected SQL: %v", err)
	}
}

func driftRow(driftItems, log, expected, actual string) *sqlmock.Rows {
	return sqlmock.NewRows(strings.Split(driftReportColumns, ", ")).AddRow(
		"d-1", "tenant-a", "db", "drift_detected", expected, actual, driftItems,
		int64(3), int64(1), false, log, at, at, at)
}

func driftQuery() string {
	return "SELECT " + regexp.QuoteMeta(driftReportColumns) + ` FROM config_drift_reports WHERE id=\$1 AND tenant_id=\$2`
}

// expected_config, actual_config, drift_items and remediation_log are TEXT
// columns holding JSON; all four have to be decoded or the API returns empty
// objects for a report that has data.
func TestCfgRepoGetDriftReportDeserialisesEveryJSONColumn(t *testing.T) {
	mock, repo := newMockRepo(t)
	mock.ExpectQuery(driftQuery()).WillReturnRows(driftRow(
		`[{"configKey":"db.host"}]`,
		`[{"driftId":"d-1","configKey":"db.host","action":"remediate","success":true}]`,
		`{"db.host":"localhost"}`,
		`{"db.host":"db1"}`,
	))

	got, err := repo.GetDriftReport(ctx, "d-1", "tenant-a")
	if err != nil {
		t.Fatalf("GetDriftReport: %v", err)
	}
	if got.TotalDrifts != 3 || got.CriticalDrifts != 1 {
		t.Fatalf("drift counts = %d/%d", got.TotalDrifts, got.CriticalDrifts)
	}
	if len(got.DriftItemsList) != 1 || got.DriftItemsList[0].ConfigKey != "db.host" {
		t.Fatalf("drift items = %v", got.DriftItemsList)
	}
	if len(got.RemediationLogList) != 1 || !got.RemediationLogList[0].Success {
		t.Fatalf("remediation log = %v", got.RemediationLogList)
	}
	if got.ExpectedConfigData["db.host"] != "localhost" {
		t.Fatalf("expected = %v", got.ExpectedConfigData)
	}
	if got.ActualConfigData["db.host"] != "db1" {
		t.Fatalf("actual = %v", got.ActualConfigData)
	}
}

func TestCfgRepoGetDriftReportRejectsCorruptColumns(t *testing.T) {
	cases := []struct {
		name      string
		row       *sqlmock.Rows
		wantInErr string
	}{
		{"driftItems", driftRow(`{`, "[]", "{}", "{}"), "drift_items"},
		{"remediationLog", driftRow("[]", `{`, "{}", "{}"), "remediation_log"},
		{"expectedConfig", driftRow("[]", "[]", `{`, "{}"), "expected_config"},
		{"actualConfig", driftRow("[]", "[]", "{}", `{`), "actual_config"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			mock, repo := newMockRepo(t)
			mock.ExpectQuery(driftQuery()).WillReturnRows(tc.row)
			_, err := repo.GetDriftReport(ctx, "d-1", "tenant-a")
			if err == nil {
				t.Fatalf("a corrupt %s column must fail the read", tc.name)
			}
			if !strings.Contains(err.Error(), tc.wantInErr) || !strings.Contains(err.Error(), "d-1") {
				t.Fatalf("err = %v, want the column and the row id named", err)
			}
		})
	}
}

// A value the caller already supplied must survive the insert; writing "[]" over
// it discarded drift items and remediation logs at write time.
func TestCfgRepoCreateDriftReportMarshalsLists(t *testing.T) {
	mock, repo := newMockRepo(t)
	mock.ExpectExec(`(?s)INSERT INTO config_drift_reports \(id, tenant_id, config_group.*\) VALUES \(\$1,.*\$14\)`).
		WithArgs(
			sqlmock.AnyArg(), "tenant-a", "db", models.DriftDetected, "", "",
			sqlmock.AnyArg(), int64(1), int64(0), false, sqlmock.AnyArg(),
			sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(0, 1))

	dr := &models.DriftReport{
		TenantID: "tenant-a", ConfigGroup: "db", DriftStatus: models.DriftDetected, TotalDrifts: 1,
		DriftItemsList:     []models.DriftItem{{ConfigKey: "db.host"}},
		RemediationLogList: []models.RemediationEntry{{DriftID: "d-1", Action: "remediate", Success: true, Timestamp: at}},
	}
	if err := repo.CreateDriftReport(ctx, dr); err != nil {
		t.Fatalf("CreateDriftReport: %v", err)
	}
	if !strings.Contains(dr.DriftItems, "db.host") {
		t.Fatalf("drift_items = %q, want the serialised list", dr.DriftItems)
	}
	if !strings.Contains(dr.RemediationLog, "remediate") {
		t.Fatalf("remediation_log = %q", dr.RemediationLog)
	}
	if dr.DetectedAt.IsZero() || dr.LastCheckedAt.IsZero() || dr.CreatedAt.IsZero() {
		t.Errorf("timestamps not set: %+v", dr)
	}
}

func TestCfgRepoCreateDriftReportKeepsCallerValues(t *testing.T) {
	mock, repo := newMockRepo(t)
	mock.ExpectExec(`INSERT INTO config_drift_reports`).WillReturnResult(sqlmock.NewResult(0, 1))

	dr := &models.DriftReport{
		TenantID: "tenant-a", ConfigGroup: "db",
		DriftItems:     `[{"configKey":"kept"}]`,
		RemediationLog: `[{"driftId":"kept"}]`,
	}
	if err := repo.CreateDriftReport(ctx, dr); err != nil {
		t.Fatalf("CreateDriftReport: %v", err)
	}
	if dr.DriftItems != `[{"configKey":"kept"}]` || dr.RemediationLog != `[{"driftId":"kept"}]` {
		t.Fatalf("caller values overwritten: %q / %q", dr.DriftItems, dr.RemediationLog)
	}
}

func TestCfgRepoUpdateDriftReportWritesWhitelistedColumns(t *testing.T) {
	mock, repo := newMockRepo(t)
	// Sorted: last_checked_at=$1, remediation_log=$2, updated_at=$3,
	// drift_status=$4, then the WHERE clause.
	mock.ExpectExec(`UPDATE config_drift_reports SET drift_status=\$1, last_checked_at=\$2, remediation_log=\$3, updated_at=\$4 WHERE id=\$5 AND tenant_id=\$6`).
		WithArgs(models.DriftRemediated, sqlmock.AnyArg(), "[]", sqlmock.AnyArg(), "d-1", "tenant-a").
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectQuery(driftQuery()).WillReturnRows(driftRow("[]", "[]", "", ""))

	got, err := repo.UpdateDriftReport(ctx, "d-1", "tenant-a", map[string]interface{}{
		"drift_status":    models.DriftRemediated,
		"remediation_log": "[]",
		"last_checked_at": at,
	})
	if err != nil {
		t.Fatalf("UpdateDriftReport: %v", err)
	}
	if got.ID != "d-1" {
		t.Fatalf("got %+v", got)
	}
}

func TestCfgRepoUpdateDriftReportRejectsIdentityColumns(t *testing.T) {
	_, repo := newMockRepo(t)
	if _, err := repo.UpdateDriftReport(ctx, "d-1", "tenant-a", map[string]interface{}{"tenant_id": "tenant-b"}); err == nil {
		t.Fatalf("tenant_id must not be updatable")
	}
}

func TestCfgRepoUpdateDriftReportUnmatchedRowIsNotFound(t *testing.T) {
	mock, repo := newMockRepo(t)
	mock.ExpectExec(`UPDATE config_drift_reports`).WillReturnResult(sqlmock.NewResult(0, 0))
	if _, err := repo.UpdateDriftReport(ctx, "d-1", "tenant-a", map[string]interface{}{"drift_status": models.DriftRemediated}); !errors.Is(err, sentinel.NotFound) {
		t.Fatalf("err = %v, want sentinel.NotFound", err)
	}
}

// The SET builders must use Postgres positional placeholders only: a MySQL '?'
// anywhere in this file would make every write fail at runtime.
func TestCfgRepoUpdateSetUsesPositionalPlaceholders(t *testing.T) {
	set, args, err := updateSet(configMgmtUpdateColumns, map[string]interface{}{"name": "n", "updated_at": at})
	if err != nil {
		t.Fatalf("updateSet: %v", err)
	}
	if len(set) != 2 || len(args) != 2 {
		t.Fatalf("set = %v args = %v", set, args)
	}
	for _, s := range set {
		if strings.Contains(s, "?") {
			t.Fatalf("set clause uses a MySQL placeholder: %s", s)
		}
	}
	if set[0] != "name=$1" || set[1] != "updated_at=$2" {
		t.Fatalf("set = %v, want sorted keys with contiguous placeholders", set)
	}
}
