package repository

import (
	"context"
	"database/sql/driver"
	"errors"
	"fmt"
	"os"
	"regexp"
	"strings"
	"testing"
	"time"

	"orion/platform-svc-go/internal/alert-escalation/models"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"
)

// The matcher compares statements after collapsing whitespace, so an
// expectation written against the full "INSERT INTO escalation_policy (...)"
// statement cannot quietly satisfy a statement that only says "WHERE tenant_id
// = $1 ORDER BY".
var ws = regexp.MustCompile(`\s+`)

func normSQL(s string) string {
	return strings.TrimSpace(ws.ReplaceAllString(s, " "))
}

func mockDB(t *testing.T) (*sqlx.DB, sqlmock.Sqlmock) {
	t.Helper()
	raw, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherFunc(func(expected, actual string) error {
		if normSQL(expected) != normSQL(actual) {
			return fmt.Errorf("sql mismatch: want %q got %q", expected, actual)
		}
		return nil
	})))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = raw.Close() })
	return sqlx.NewDb(raw, "postgres"), mock
}

func nowUTC() time.Time {
	return time.Date(2026, 9, 14, 0, 0, 0, 0, time.UTC)
}

func columnsOf(raw string) []string {
	parts := strings.Split(raw, ",")
	for i := range parts {
		parts[i] = strings.TrimSpace(parts[i])
	}
	return parts
}

// rowFor walks the column list down through a name-to-value map, so a test row
// cannot drift out of step with the column constant the statement uses.
func rowFor(t *testing.T, cols string, vals map[string]interface{}) *sqlmock.Rows {
	t.Helper()
	list := columnsOf(cols)
	row := make([]driver.Value, len(list))
	for i, c := range list {
		row[i] = vals[c]
	}
	return sqlmock.NewRows(list).AddRow(row...)
}

func policyValues(p *models.EscalationPolicy) map[string]interface{} {
	return map[string]interface{}{
		"id": p.ID, "tenant_id": p.TenantID, "name": p.Name, "description": p.Description,
		"severity": p.Severity, "status": p.Status, "rules": p.Rules, "created_by": p.CreatedBy,
		"created_at": p.CreatedAt, "updated_at": p.UpdatedAt,
	}
}

func triggerValues(tg *models.EscalationTrigger) map[string]interface{} {
	resolved := interface{}(nil)
	if tg.ResolvedAt != nil {
		resolved = *tg.ResolvedAt
	}
	return map[string]interface{}{
		"id": tg.ID, "tenant_id": tg.TenantID, "policy_id": tg.PolicyID, "alert_id": tg.AlertID,
		"level": tg.Level, "target": tg.Target, "channel": tg.Channel, "message": tg.Message,
		"triggered_at": tg.TriggeredAt, "status": tg.Status, "resolved_at": resolved,
	}
}

func closureValues(c *models.AlertClosure) map[string]interface{} {
	ack := interface{}(nil)
	if c.AcknowledgedAt != nil {
		ack = *c.AcknowledgedAt
	}
	resolved := interface{}(nil)
	if c.ResolvedAt != nil {
		resolved = *c.ResolvedAt
	}
	return map[string]interface{}{
		"id": c.ID, "tenant_id": c.TenantID, "alert_id": c.AlertID, "status": c.Status,
		"acknowledged_by": c.AcknowledgedBy, "acknowledged_at": ack,
		"resolved_by": c.ResolvedBy, "resolved_at": resolved,
		"resolution_note": c.ResolutionNote, "mttr_seconds": c.MTTRSeconds,
		"created_at": c.CreatedAt, "updated_at": c.UpdatedAt,
	}
}

func metricsValues(m *models.AlertMetrics) map[string]interface{} {
	return map[string]interface{}{
		"id": m.ID, "tenant_id": m.TenantID, "metric_date": m.MetricDate,
		"total_alerts": m.TotalAlerts, "acknowledged_count": m.AcknowledgedCount,
		"resolved_count": m.ResolvedCount, "escalated_count": m.EscalatedCount,
		"avg_response_seconds": m.AvgResponseSeconds, "avg_resolution_seconds": m.AvgResolutionSeconds,
		"p95_response_seconds": m.P95ResponseSeconds, "p95_resolution_seconds": m.P95ResolutionSeconds,
		"sla_breach_count": m.SLABreachCount, "auto_remediation_success": m.AutoRemediationSuccess,
		"auto_remediation_failed": m.AutoRemediationFailed, "created_at": m.CreatedAt,
	}
}

func TestRepo_CreatePolicy_bindsAllColumns(t *testing.T) {
	db, mock := mockDB(t)
	r := NewRepository(db)
	p := &models.EscalationPolicy{
		ID: "ep-1", TenantID: "t1", Name: "n", Description: "d", Severity: "critical",
		Status: "active", Rules: `[{"level":1}]`, CreatedBy: "u1",
		CreatedAt: nowUTC(), UpdatedAt: nowUTC(),
	}
	mock.ExpectExec(
		"INSERT INTO escalation_policy ("+policyColumns+") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)").
		WithArgs("ep-1", "t1", "n", "d", "critical", "active", `[{"level":1}]`, "u1", nowUTC(), nowUTC()).
		WillReturnResult(sqlmock.NewResult(1, 1))
	if err := r.CreatePolicy(context.Background(), p); err != nil {
		t.Fatalf("CreatePolicy error: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

func TestRepo_GetPolicy_bindsIDAndTenant(t *testing.T) {
	db, mock := mockDB(t)
	r := NewRepository(db)
	mock.ExpectQuery(
		"SELECT "+policyColumns+" FROM escalation_policy WHERE id = $1 AND tenant_id = $2").
		WithArgs("ep-1", "t1").
		WillReturnRows(rowFor(t, policyColumns, policyValues(&models.EscalationPolicy{
			ID: "ep-1", TenantID: "t1", Name: "n", Severity: "critical", Status: "active",
			Rules: "[]", CreatedAt: nowUTC(), UpdatedAt: nowUTC(),
		})))
	got, err := r.GetPolicy(context.Background(), "ep-1", "t1")
	if err != nil {
		t.Fatalf("GetPolicy error: %v", err)
	}
	if got.ID != "ep-1" || got.Name != "n" || got.Rules != "[]" {
		t.Errorf("policy = %+v", got)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

func TestRepo_ListPolicies(t *testing.T) {
	db, mock := mockDB(t)
	r := NewRepository(db)
	rows := sqlmock.NewRows(columnsOf(policyColumns))
	rows.AddRow("a", "t1", "n1", "", "all", "active", "[]", "u", nowUTC(), nowUTC())
	rows.AddRow("b", "t1", "n2", "", "all", "active", "[]", "u", nowUTC(), nowUTC())
	mock.ExpectQuery(
		"SELECT " + policyColumns + " FROM escalation_policy WHERE tenant_id = $1 ORDER BY created_at DESC").
		WithArgs("t1").
		WillReturnRows(rows)
	items, err := r.ListPolicies(context.Background(), "t1")
	if err != nil {
		t.Fatalf("ListPolicies error: %v", err)
	}
	if len(items) != 2 || items[0].ID != "a" || items[1].ID != "b" {
		t.Errorf("items = %+v", items)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

func TestRepo_UpdatePolicy_deterministicSetAndPlaceholders(t *testing.T) {
	db, mock := mockDB(t)
	r := NewRepository(db)
	// status sorts after name in the whitelist, so the SET clause must come out
	// name first even though the map hands its keys over in no order at all.
	mock.ExpectExec(
		"UPDATE escalation_policy SET name = $1, status = $2 WHERE id = $3 AND tenant_id = $4").
		WithArgs("new-name", "disabled", "ep-1", "t1").
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectQuery(
		"SELECT "+policyColumns+" FROM escalation_policy WHERE id = $1 AND tenant_id = $2").
		WithArgs("ep-1", "t1").
		WillReturnRows(rowFor(t, policyColumns, policyValues(&models.EscalationPolicy{
			ID: "ep-1", TenantID: "t1", Name: "new-name", Severity: "all", Status: "disabled",
			Rules: "[]", CreatedAt: nowUTC(), UpdatedAt: nowUTC(),
		})))
	p, err := r.UpdatePolicy(context.Background(), "ep-1", "t1", map[string]interface{}{
		"status": "disabled", "name": "new-name",
	})
	if err != nil {
		t.Fatalf("UpdatePolicy error: %v", err)
	}
	if p.Name != "new-name" {
		t.Errorf("Name = %q", p.Name)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

func TestRepo_UpdatePolicy_rejectsIdentityColumn(t *testing.T) {
	db, mock := mockDB(t)
	r := NewRepository(db)
	p, err := r.UpdatePolicy(context.Background(), "ep-1", "t1", map[string]interface{}{
		"tenant_id": "somebody-else",
	})
	if err == nil {
		t.Fatalf("UpdatePolicy accepted an identity column")
	}
	if p != nil {
		t.Fatalf("UpdatePolicy resp = %v, want nil", p)
	}
	if !strings.Contains(err.Error(), `column "tenant_id" is not updatable on escalation_policy`) {
		t.Errorf("err = %q, want the pinned guard text", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("a statement was issued although the guard should have stopped it: %v", err)
	}
}

func TestRepo_UpdateClosure_rejectsEmptyUpdate(t *testing.T) {
	db, mock := mockDB(t)
	r := NewRepository(db)
	c, err := r.UpdateClosure(context.Background(), "alert-1", "t1", map[string]interface{}{})
	if err == nil {
		t.Fatalf("UpdateClosure accepted an empty attribute map")
	}
	if c != nil {
		t.Fatalf("UpdateClosure resp = %v, want nil", c)
	}
	if !strings.Contains(err.Error(), "no updatable columns supplied for alert_closure") {
		t.Errorf("err = %q, want the pinned guard text", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("a statement was issued although the guard should have stopped it: %v", err)
	}
}

func TestRepo_UpdateTrigger_rejectsPolicyID(t *testing.T) {
	db, mock := mockDB(t)
	r := NewRepository(db)
	tg, err := r.UpdateTrigger(context.Background(), "et-1", "t1", map[string]interface{}{
		"policy_id": "another-policy",
	})
	if err == nil {
		t.Fatalf("UpdateTrigger accepted a re-parenting write")
	}
	if tg != nil {
		t.Fatalf("UpdateTrigger resp = %v, want nil", tg)
	}
	if !strings.Contains(err.Error(), `column "policy_id" is not updatable on escalation_trigger`) {
		t.Errorf("err = %q, want the pinned guard text", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("a statement was issued although the guard should have stopped it: %v", err)
	}
}

func TestRepo_DeletePolicy_readsRowsAffected(t *testing.T) {
	db, mock := mockDB(t)
	r := NewRepository(db)
	mock.ExpectExec("DELETE FROM escalation_policy WHERE id = $1 AND tenant_id = $2").
		WithArgs("ep-1", "t1").
		WillReturnResult(sqlmock.NewResult(0, 1))
	deleted, err := r.DeletePolicy(context.Background(), "ep-1", "t1")
	if err != nil {
		t.Fatalf("DeletePolicy error: %v", err)
	}
	if !deleted {
		t.Errorf("deleted = false, want true")
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}

	db2, mock2 := mockDB(t)
	r2 := NewRepository(db2)
	mock2.ExpectExec("DELETE FROM escalation_policy WHERE id = $1 AND tenant_id = $2").
		WithArgs("ep-2", "t1").
		WillReturnResult(sqlmock.NewResult(0, 0))
	deleted, err = r2.DeletePolicy(context.Background(), "ep-2", "t1")
	if err != nil {
		t.Fatalf("DeletePolicy error: %v", err)
	}
	if deleted {
		t.Errorf("deleted = true, want false")
	}
	if err := mock2.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

func TestRepo_DeletePolicy_propagatesExecError(t *testing.T) {
	db, mock := mockDB(t)
	r := NewRepository(db)
	mock.ExpectExec("DELETE FROM escalation_policy WHERE id = $1 AND tenant_id = $2").
		WithArgs("ep-1", "t1").
		WillReturnError(errors.New("relation escalation_policy does not exist"))
	deleted, err := r.DeletePolicy(context.Background(), "ep-1", "t1")
	if err == nil {
		t.Fatalf("DeletePolicy swallowed the Exec error")
	}
	if deleted {
		t.Errorf("deleted = true, want false on an error")
	}
}

func TestRepo_DeletePolicy_propagatesRowsAffectedError(t *testing.T) {
	// NewErrorResult makes Exec succeed while RowsAffected fails, which is the
	// only way to reach that branch. It used to be discarded, so a failure to
	// report how many rows went away came back as "deleted true".
	db, mock := mockDB(t)
	r := NewRepository(db)
	mock.ExpectExec("DELETE FROM escalation_policy WHERE id = $1 AND tenant_id = $2").
		WithArgs("ep-1", "t1").
		WillReturnResult(sqlmock.NewErrorResult(errors.New("rows affected unavailable")))
	deleted, err := r.DeletePolicy(context.Background(), "ep-1", "t1")
	if err == nil {
		t.Fatalf("DeletePolicy did not report the RowsAffected error")
	}
	if deleted {
		t.Errorf("deleted = true, want false on an error")
	}
	if !strings.Contains(err.Error(), "rows affected unavailable") {
		t.Errorf("err = %q, want the RowsAffected error", err)
	}
}

func TestRepo_CreateTrigger_bindsAllColumns(t *testing.T) {
	db, mock := mockDB(t)
	r := NewRepository(db)
	mock.ExpectExec(
		"INSERT INTO escalation_trigger ("+triggerColumns+") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)").
		WithArgs("et-1", "t1", "ep-1", "alert-1", int64(2), "oncall", "slack", "msg",
			nowUTC(), "pending", nil).
		WillReturnResult(sqlmock.NewResult(1, 1))
	if err := r.CreateTrigger(context.Background(), &models.EscalationTrigger{
		ID: "et-1", TenantID: "t1", PolicyID: "ep-1", AlertID: "alert-1", Level: 2,
		Target: "oncall", Channel: "slack", Message: "msg", TriggeredAt: nowUTC(), Status: "pending",
	}); err != nil {
		t.Fatalf("CreateTrigger error: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

func TestRepo_ListTriggers_appendsPolicyPredicate(t *testing.T) {
	db, mock := mockDB(t)
	r := NewRepository(db)
	mock.ExpectQuery(
		"SELECT "+triggerColumns+" FROM escalation_trigger WHERE tenant_id = $1 AND policy_id = $2 ORDER BY triggered_at DESC").
		WithArgs("t1", "ep-1").
		WillReturnRows(rowFor(t, triggerColumns, triggerValues(&models.EscalationTrigger{
			ID: "et-1", TenantID: "t1", PolicyID: "ep-1", AlertID: "a1", Level: 1,
			Target: "oncall", Channel: "slack", Message: "m", TriggeredAt: nowUTC(), Status: "pending",
		})))
	items, err := r.ListTriggers(context.Background(), "t1", "ep-1")
	if err != nil {
		t.Fatalf("ListTriggers error: %v", err)
	}
	if len(items) != 1 || items[0].Level != 1 || items[0].ResolvedAt != nil {
		t.Errorf("items = %+v", items)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

func TestRepo_ListTriggers_omitsPolicyPredicateWhenEmpty(t *testing.T) {
	db, mock := mockDB(t)
	r := NewRepository(db)
	mock.ExpectQuery(
		"SELECT " + triggerColumns + " FROM escalation_trigger WHERE tenant_id = $1 ORDER BY triggered_at DESC").
		WithArgs("t1").
		WillReturnRows(sqlmock.NewRows(columnsOf(triggerColumns)))
	items, err := r.ListTriggers(context.Background(), "t1", "")
	if err != nil {
		t.Fatalf("ListTriggers error: %v", err)
	}
	if len(items) != 0 {
		t.Errorf("items = %+v, want empty", items)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

func TestRepo_UpdateTrigger_bindsStatusAndResolvedAt(t *testing.T) {
	db, mock := mockDB(t)
	r := NewRepository(db)
	now := nowUTC()
	mock.ExpectExec(
		"UPDATE escalation_trigger SET status = $1, resolved_at = $2 WHERE id = $3 AND tenant_id = $4").
		WithArgs("resolved", now, "et-1", "t1").
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectQuery(
		"SELECT "+triggerColumns+" FROM escalation_trigger WHERE id = $1 AND tenant_id = $2").
		WithArgs("et-1", "t1").
		WillReturnRows(rowFor(t, triggerColumns, triggerValues(&models.EscalationTrigger{
			ID: "et-1", TenantID: "t1", PolicyID: "ep-1", AlertID: "a1", Level: 1,
			Target: "oncall", Channel: "slack", Message: "m", TriggeredAt: now, Status: "resolved",
			ResolvedAt: &now,
		})))
	tg, err := r.UpdateTrigger(context.Background(), "et-1", "t1", map[string]interface{}{
		"resolved_at": &now, "status": "resolved",
	})
	if err != nil {
		t.Fatalf("UpdateTrigger error: %v", err)
	}
	if tg.Status != "resolved" || tg.ResolvedAt == nil {
		t.Errorf("trigger = %+v", tg)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

func TestRepo_CreateClosure_bindsAllColumns(t *testing.T) {
	db, mock := mockDB(t)
	r := NewRepository(db)
	now := nowUTC()
	mock.ExpectExec(
		"INSERT INTO alert_closure ("+closureColumns+") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)").
		WithArgs("ac-1", "t1", "alert-1", "open", "", nil, "", nil, "", int64(0), now, now).
		WillReturnResult(sqlmock.NewResult(1, 1))
	if err := r.CreateClosure(context.Background(), &models.AlertClosure{
		ID: "ac-1", TenantID: "t1", AlertID: "alert-1", Status: "open",
		CreatedAt: now, UpdatedAt: now,
	}); err != nil {
		t.Fatalf("CreateClosure error: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

func TestRepo_GetClosure_readsNewestRowFirst(t *testing.T) {
	db, mock := mockDB(t)
	r := NewRepository(db)
	now := nowUTC()
	mock.ExpectQuery(
		"SELECT "+closureColumns+" FROM alert_closure WHERE alert_id = $1 AND tenant_id = $2 ORDER BY created_at DESC LIMIT 1").
		WithArgs("alert-1", "t1").
		WillReturnRows(rowFor(t, closureColumns, closureValues(&models.AlertClosure{
			ID: "ac-1", TenantID: "t1", AlertID: "alert-1", Status: "resolved",
			ResolvedAt: &now, MTTRSeconds: 600, CreatedAt: now, UpdatedAt: now,
		})))
	c, err := r.GetClosure(context.Background(), "alert-1", "t1")
	if err != nil {
		t.Fatalf("GetClosure error: %v", err)
	}
	if c.Status != "resolved" || c.MTTRSeconds != 600 || c.ResolvedAt == nil {
		t.Errorf("closure = %+v", c)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

func TestRepo_ListClosures_filtersOnStatus(t *testing.T) {
	db, mock := mockDB(t)
	r := NewRepository(db)
	now := nowUTC()
	mock.ExpectQuery(
		"SELECT "+closureColumns+" FROM alert_closure WHERE tenant_id = $1 AND status = $2 ORDER BY created_at DESC").
		WithArgs("t1", "resolved").
		WillReturnRows(rowFor(t, closureColumns, closureValues(&models.AlertClosure{
			ID: "ac-1", TenantID: "t1", AlertID: "a1", Status: "resolved",
			ResolvedAt: &now, MTTRSeconds: 120, CreatedAt: now, UpdatedAt: now,
		})))
	items, err := r.ListClosures(context.Background(), "t1", "resolved")
	if err != nil {
		t.Fatalf("ListClosures error: %v", err)
	}
	if len(items) != 1 || items[0].MTTRSeconds != 120 {
		t.Errorf("items = %+v", items)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

func TestRepo_UpdateClosure_bindsNewestLastAndKeysByAlert(t *testing.T) {
	db, mock := mockDB(t)
	r := NewRepository(db)
	now := nowUTC()
	mock.ExpectExec(
		"UPDATE alert_closure SET status = $1, acknowledged_by = $2, acknowledged_at = $3, resolution_note = $4, updated_at = $5 WHERE alert_id = $6 AND tenant_id = $7").
		WithArgs("acknowledged", "oncall", now, "note", now, "alert-1", "t1").
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectQuery(
		"SELECT "+closureColumns+" FROM alert_closure WHERE alert_id = $1 AND tenant_id = $2 ORDER BY created_at DESC LIMIT 1").
		WithArgs("alert-1", "t1").
		WillReturnRows(rowFor(t, closureColumns, closureValues(&models.AlertClosure{
			ID: "ac-1", TenantID: "t1", AlertID: "alert-1", Status: "acknowledged",
			AcknowledgedBy: "oncall", AcknowledgedAt: &now, ResolutionNote: "note",
			CreatedAt: now, UpdatedAt: now,
		})))
	c, err := r.UpdateClosure(context.Background(), "alert-1", "t1", map[string]interface{}{
		"acknowledged_by": "oncall", "acknowledged_at": &now, "resolution_note": "note",
		"status": "acknowledged", "updated_at": now,
	})
	if err != nil {
		t.Fatalf("UpdateClosure error: %v", err)
	}
	if c.AlertID != "alert-1" || c.AcknowledgedBy != "oncall" {
		t.Errorf("closure = %+v", c)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

func TestRepo_CreateMetrics_bindsDateAsText(t *testing.T) {
	db, mock := mockDB(t)
	r := NewRepository(db)
	day := time.Date(2026, 9, 14, 0, 0, 0, 0, time.UTC)
	mock.ExpectExec(
		"INSERT INTO alert_metrics ("+metricsColumns+") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)").
		WithArgs("am-1", "t1", "2026-09-14", int64(50), int64(40), int64(30), int64(7),
			int64(120), int64(900), int64(300), int64(2400), int64(2), int64(4), int64(1), nowUTC()).
		WillReturnResult(sqlmock.NewResult(1, 1))
	if err := r.CreateMetrics(context.Background(), &models.AlertMetrics{
		ID: "am-1", TenantID: "t1", MetricDate: day,
		TotalAlerts: 50, AcknowledgedCount: 40, ResolvedCount: 30, EscalatedCount: 7,
		AvgResponseSeconds: 120, AvgResolutionSeconds: 900, P95ResponseSeconds: 300,
		P95ResolutionSeconds: 2400, SLABreachCount: 2, AutoRemediationSuccess: 4,
		AutoRemediationFailed: 1, CreatedAt: nowUTC(),
	}); err != nil {
		t.Fatalf("CreateMetrics error: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

func TestRepo_ListMetrics_bindsDateRangeAsText(t *testing.T) {
	db, mock := mockDB(t)
	r := NewRepository(db)
	from := time.Date(2026, 9, 1, 0, 0, 0, 0, time.UTC)
	to := time.Date(2026, 9, 14, 0, 0, 0, 0, time.UTC)
	mock.ExpectQuery(
		"SELECT "+metricsColumns+" FROM alert_metrics WHERE tenant_id = $1 AND metric_date BETWEEN $2 AND $3 ORDER BY metric_date DESC").
		WithArgs("t1", "2026-09-01", "2026-09-14").
		WillReturnRows(rowFor(t, metricsColumns, metricsValues(&models.AlertMetrics{
			ID: "am-1", TenantID: "t1", MetricDate: to, TotalAlerts: 50, CreatedAt: nowUTC(),
		})))
	items, err := r.ListMetrics(context.Background(), "t1", from, to)
	if err != nil {
		t.Fatalf("ListMetrics error: %v", err)
	}
	if len(items) != 1 || items[0].TotalAlerts != 50 {
		t.Errorf("items = %+v", items)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

// TestRepo_BuildSET keeps the column order fixed by the whitelist and the
// placeholder numbering honest for any subset of it.
func TestRepo_BuildSET_numbersPlaceholdersFromTheWhitelist(t *testing.T) {
	set, args, err := buildSET("alert_closure", map[string]interface{}{
		"updated_at":   nowUTC(),
		"mttr_seconds": int64(90),
		"status":       "resolved",
	}, closureUpdatable)
	if err != nil {
		t.Fatalf("buildSET error: %v", err)
	}
	want := "status = $1, mttr_seconds = $2, updated_at = $3"
	if set != want {
		t.Fatalf("SET = %q, want %q", set, want)
	}
	if len(args) != 3 || args[0] != "resolved" || args[1] != int64(90) {
		t.Fatalf("args = %v", args)
	}

	if _, _, err := buildSET("escalation_policy", map[string]interface{}{}, policyUpdatable); err == nil {
		t.Fatalf("buildSET accepted an empty attribute map")
	}
	if _, _, err := buildSET("alert_closure", map[string]interface{}{"id": "x"}, closureUpdatable); err == nil {
		t.Fatalf("buildSET accepted an identity column")
	}
}

// TestRepo_StatementsUsePostgresPlaceholders is a tripwire over the source:
// MySQL question-mark placeholders are not Postgres syntax, and a SELECT *
// cannot be checked against migration 397 at all.
func TestRepo_StatementsUsePostgresPlaceholders(t *testing.T) {
	src, err := os.ReadFile("repository.go")
	if err != nil {
		t.Fatal(err)
	}
	for i, line := range strings.Split(string(src), "\n") {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "//") {
			continue
		}
		if strings.Contains(line, "SELECT *") {
			t.Errorf("line %d reads every column: %s", i+1, trimmed)
		}
		if strings.Contains(line, "?") {
			t.Errorf("line %d still uses a question-mark placeholder: %s", i+1, trimmed)
		}
	}
	for _, pair := range []struct {
		lit  string
		name string
	}{
		{`"SELECT "+policyColumns+" FROM escalation_policy`, "policyColumns"},
		{`"SELECT "+triggerColumns+" FROM escalation_trigger`, "triggerColumns"},
		{`"SELECT "+closureColumns+" FROM alert_closure`, "closureColumns"},
		{`"SELECT "+metricsColumns+" FROM alert_metrics`, "metricsColumns"},
	} {
		if !strings.Contains(string(src), pair.lit) {
			t.Errorf("%s is not used in a read statement for its own table", pair.name)
		}
	}
}

// TestRepo_WhitelistsKeepIdentityOut asserts the injection boundary: identity
// columns must never be writable, no matter which table the map targets.
func TestRepo_WhitelistsKeepIdentityOut(t *testing.T) {
	identity := []string{"id", "tenant_id", "policy_id", "alert_id"}
	for name, list := range map[string][]string{
		"policy":  policyUpdatable,
		"trigger": triggerUpdatable,
		"closure": closureUpdatable,
	} {
		for _, col := range list {
			for _, banned := range identity {
				if col == banned {
					t.Errorf("%s whitelist still permits the identity column %q", name, col)
				}
			}
		}
		if len(list) == 0 {
			t.Errorf("%s whitelist is empty", name)
		}
	}
}
