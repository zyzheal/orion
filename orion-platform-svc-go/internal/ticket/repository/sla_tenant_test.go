package repository

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"

	"orion/go-common/pkg/database"
	"orion/platform-svc-go/internal/ticket/models"
)

// Tenant scoping for the SLA tables.
//
// sla_targets.tenant_id exists in migration 686, but nothing wrote it and
// nothing filtered on it: every target row landed with NULL ownership, so
// GetTargetByPriority resolved the first enabled row of that priority anywhere
// in the registry and became another tenant's deadline. sla_records has no
// tenant column at all, so its reads are scoped through the parent ticket.
//
// Each fixture pins both the tenant predicate in the SQL and the order of the
// bound arguments. Either half can be wrong while the code still compiles and
// the migration still applies, so a compile check and a migration check both
// miss it.

var slaWS = regexp.MustCompile(`\s+`)

func slaNorm(s string) string {
	return strings.TrimSpace(slaWS.ReplaceAllString(s, " "))
}

func slaTargetCols() []string {
	return []string{
		"id", "tenant_id", "name", "priority",
		"target_response_time_ms", "target_resolution_time_ms", "enabled", "created_at",
	}
}

func slaRecordCols() []string {
	return []string{
		"id", "ticket_id", "sla_target_id", "priority",
		"response_deadline_at", "resolution_deadline_at", "responded_at", "resolved_at",
		"breached", "breach_type", "paused", "paused_at", "paused_reason",
		"created_at", "updated_at",
	}
}

// slaMockDB wires a recording driver behind database.DB. The matcher treats the
// expected SQL as a fragment that must appear in the statement actually run, so
// each test names the exact tenant predicate it is protecting. Every statement
// is appended to *seen so a test can assert over the whole set instead of one
// query at a time.
func slaMockDB(t *testing.T) (*database.DB, sqlmock.Sqlmock, *[]string) {
	t.Helper()
	seen := []string{}
	raw, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherFunc(func(expected, actual string) error {
		seen = append(seen, slaNorm(actual))
		if !strings.Contains(slaNorm(actual), slaNorm(expected)) {
			return fmt.Errorf("sql mismatch: want fragment %q in %q", expected, slaNorm(actual))
		}
		return nil
	})))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = raw.Close() })
	return &database.DB{DB: sqlx.NewDb(raw, "postgres")}, mock, &seen
}

func slaTargetRow() *sqlmock.Rows {
	now := time.Now()
	return sqlmock.NewRows(slaTargetCols()).AddRow(
		"sla-1", "ten-a", "Gold", "critical",
		int64(60000), int64(3600000), true, now,
	)
}

func slaRecordRow(breached bool) *sqlmock.Rows {
	now := time.Now()
	deadline := now.Add(time.Hour)
	return sqlmock.NewRows(slaRecordCols()).AddRow(
		"r-1", "t-42", "sla-1", "critical",
		deadline, deadline, nil, nil,
		breached, "", false, nil, "",
		now, now,
	)
}

// ---------------------------------------------------------------- sla_targets

// CreateTarget is the only INSERT that writes sla_targets. Leaving tenant_id
// out of the column list is legal SQL because the column is nullable, so it
// compiles, migrates, and returns 200 while storing rows with no owner.
func TestSLARepository_CreateTargetWritesTenantID(t *testing.T) {
	db, mock, seen := slaMockDB(t)
	r := NewSLARepository(db)

	mock.ExpectExec("INSERT INTO sla_targets (id, tenant_id, name, priority, target_response_time_ms, target_resolution_time_ms, enabled)").
		WithArgs("sla-1", "ten-a", "Gold", "critical", int64(60000), int64(3600000), true).
		WillReturnResult(sqlmock.NewResult(1, 1))

	target := &models.SLATarget{
		ID:                     "sla-1",
		TenantID:               "ten-a",
		Name:                   "Gold",
		Priority:               "critical",
		TargetResponseTimeMs:   60000,
		TargetResolutionTimeMs: 3600000,
		Enabled:                true,
	}
	if err := r.CreateTarget(context.Background(), target); err != nil {
		t.Fatalf("CreateTarget: %v", err)
	}
	if len(*seen) != 1 {
		t.Fatalf("ran %d statements, want 1", len(*seen))
	}
	if !strings.Contains((*seen)[0], "tenant_id") {
		t.Errorf("INSERT does not list tenant_id: %s", (*seen)[0])
	}
}

func TestSLARepository_ListTargetsIsTenantScoped(t *testing.T) {
	db, mock, _ := slaMockDB(t)
	r := NewSLARepository(db)

	mock.ExpectQuery("SELECT * FROM sla_targets WHERE tenant_id = $1").
		WithArgs("ten-a").
		WillReturnRows(slaTargetRow())

	targets, err := r.ListTargets(context.Background(), "ten-a")
	if err != nil {
		t.Fatalf("ListTargets: %v", err)
	}
	if len(targets) != 1 || targets[0].TenantID != "ten-a" {
		t.Errorf("targets = %+v, want one row owned by ten-a", targets)
	}
}

// GetTargetByPriority used to be WHERE priority = $1 AND enabled = true:
// priority alone resolves across the whole registry. tenant_id has to lead the
// predicate and bind first.
func TestSLARepository_GetTargetByPriorityIsTenantScoped(t *testing.T) {
	db, mock, _ := slaMockDB(t)
	r := NewSLARepository(db)

	mock.ExpectQuery("WHERE tenant_id = $1 AND priority = $2 AND enabled = true LIMIT 1").
		WithArgs("ten-a", "critical").
		WillReturnRows(slaTargetRow())

	target, err := r.GetTargetByPriority(context.Background(), "ten-a", "critical")
	if err != nil {
		t.Fatalf("GetTargetByPriority: %v", err)
	}
	if target == nil || target.TenantID != "ten-a" || target.Priority != "critical" {
		t.Errorf("target = %+v, want the ten-a critical row", target)
	}
}

func TestSLARepository_DeleteTargetIsTenantScoped(t *testing.T) {
	db, mock, _ := slaMockDB(t)
	r := NewSLARepository(db)

	mock.ExpectExec("DELETE FROM sla_targets WHERE id = $2 AND tenant_id = $1").
		WithArgs("ten-a", "sla-1").
		WillReturnResult(sqlmock.NewResult(0, 1))

	if err := r.DeleteTarget(context.Background(), "ten-a", "sla-1"); err != nil {
		t.Fatalf("DeleteTarget: %v", err)
	}
}

// ---------------------------------------------------------------- sla_records

// GetRecordByTicket used to answer WHERE ticket_id = $1 alone, so any
// authenticated tenant read any other tenant's deadline and breach state by
// learning a ticket id. tenant_id binds first and the semi-join carries it.
func TestSLARepository_GetRecordByTicketIsTenantScoped(t *testing.T) {
	db, mock, _ := slaMockDB(t)
	r := NewSLARepository(db)

	mock.ExpectQuery("ticket_id IN (SELECT id FROM tickets WHERE tenant_id = $1)").
		WithArgs("ten-a", "t-42").
		WillReturnRows(slaRecordRow(false))

	record, err := r.GetRecordByTicket(context.Background(), "ten-a", "t-42")
	if err != nil {
		t.Fatalf("GetRecordByTicket: %v", err)
	}
	if record == nil || record.TicketID != "t-42" {
		t.Errorf("record = %+v, want the t-42 row", record)
	}
}

// A ticket outside the caller's tenant has no matching semi-join row, so the
// lookup reports absence rather than leaking the record.
func TestSLARepository_GetRecordByTicketOfAnotherTenantIsNotFound(t *testing.T) {
	db, mock, _ := slaMockDB(t)
	r := NewSLARepository(db)

	mock.ExpectQuery("ticket_id IN (SELECT id FROM tickets WHERE tenant_id = $1)").
		WithArgs("ten-a", "t-999").
		WillReturnRows(sqlmock.NewRows(slaRecordCols()))

	record, err := r.GetRecordByTicket(context.Background(), "ten-a", "t-999")
	if err == nil {
		t.Fatalf("err = nil, want not found; got %+v", record)
	}
	if record != nil {
		t.Errorf("record = %+v, want nil", record)
	}
}

func TestSLARepository_FindBreachedRecordsIsTenantScoped(t *testing.T) {
	db, mock, seen := slaMockDB(t)
	r := NewSLARepository(db)

	mock.ExpectQuery("r.breached = true AND r.resolved_at IS NULL AND r.ticket_id IN (SELECT id FROM tickets WHERE tenant_id = $1)").
		WithArgs("ten-a").
		WillReturnRows(slaRecordRow(true))

	records, err := r.FindBreachedRecords(context.Background(), "ten-a")
	if err != nil {
		t.Fatalf("FindBreachedRecords: %v", err)
	}
	if len(records) != 1 || !records[0].Breached {
		t.Errorf("records = %+v, want the one breached row", records)
	}
	assertSemiJoin(t, seen, "FindBreachedRecords")
}

// assertSemiJoin reads the statement the driver actually received. It is
// independent of the ExpectQuery fragment, so softening either one alone still
// leaves a check behind.
func assertSemiJoin(t *testing.T, seen *[]string, method string) {
	t.Helper()
	if len(*seen) == 0 {
		t.Errorf("%s ran no statement", method)
		return
	}
	want := "ticket_id IN (SELECT id FROM tickets WHERE tenant_id = $1)"
	for i, sql := range *seen {
		if !strings.Contains(sql, want) {
			t.Errorf("%s ran an unscoped statement #%d: %q", method, i, sql)
		}
	}
}

// The predicate fragment alone does not discriminate: with it as the whole
// expectation the query still matches once the semi-join is removed, so the
// expectation carries the semi-join too and the executed statement is checked
// separately. Without both, a mutation that drops the tenant predicate passes.
func TestSLARepository_FindPendingRecordsIsTenantScoped(t *testing.T) {
	db, mock, seen := slaMockDB(t)
	r := NewSLARepository(db)

	mock.ExpectQuery("r.breached = false AND r.resolved_at IS NULL AND r.paused = false AND r.ticket_id IN (SELECT id FROM tickets WHERE tenant_id = $1)").
		WithArgs("ten-a").
		WillReturnRows(slaRecordRow(false))

	records, err := r.FindPendingRecords(context.Background(), "ten-a")
	if err != nil {
		t.Fatalf("FindPendingRecords: %v", err)
	}
	if len(records) != 1 || records[0].Breached {
		t.Errorf("records = %+v, want the one pending row", records)
	}
	assertSemiJoin(t, seen, "FindPendingRecords")
}

// PauseRecord binds the tenant last, as $3, so the fragment has to name it.
func TestSLARepository_PauseRecordIsTenantScoped(t *testing.T) {
	db, mock, _ := slaMockDB(t)
	r := NewSLARepository(db)

	mock.ExpectExec("ticket_id IN (SELECT id FROM tickets WHERE tenant_id = $3)").
		WithArgs("maintenance window", "t-42", "ten-a").
		WillReturnResult(sqlmock.NewResult(0, 1))

	if err := r.PauseRecord(context.Background(), "ten-a", "t-42", "maintenance window"); err != nil {
		t.Fatalf("PauseRecord: %v", err)
	}
}

func TestSLARepository_UnpauseRecordIsTenantScoped(t *testing.T) {
	db, mock, _ := slaMockDB(t)
	r := NewSLARepository(db)

	mock.ExpectExec("ticket_id IN (SELECT id FROM tickets WHERE tenant_id = $1)").
		WithArgs("ten-a", "t-42").
		WillReturnResult(sqlmock.NewResult(0, 1))

	if err := r.UnpauseRecord(context.Background(), "ten-a", "t-42"); err != nil {
		t.Fatalf("UnpauseRecord: %v", err)
	}
}

// ---------------------------------------------------------------- compliance

// The compliance report runs five queries. tenantID must bind as $1 in every
// one and the semi-join must survive in every one: dropping it from a single
// query leaves a leak in exactly that figure.
func TestSLARepository_GetComplianceReportScopesAllFiveQueries(t *testing.T) {
	db, mock, seen := slaMockDB(t)
	r := NewSLARepository(db)

	start := time.Date(2026, 8, 1, 0, 0, 0, 0, time.UTC)
	end := time.Date(2026, 8, 31, 23, 59, 59, 0, time.UTC)

	mock.ExpectQuery("SELECT COUNT(*) FROM sla_records r").
		WithArgs("ten-a", start, end).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(int64(5)))
	mock.ExpectQuery("r.breached = true AND r.created_at BETWEEN $2 AND $3").
		WithArgs("ten-a", start, end).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(int64(2)))
	mock.ExpectQuery("EXTRACT(EPOCH FROM (r.responded_at - r.created_at))").
		WithArgs("ten-a", start, end).
		WillReturnRows(sqlmock.NewRows([]string{"avg"}).AddRow(float64(1200)))
	mock.ExpectQuery("EXTRACT(EPOCH FROM (r.resolved_at - r.created_at))").
		WithArgs("ten-a", start, end).
		WillReturnRows(sqlmock.NewRows([]string{"avg"}).AddRow(float64(5000)))
	mock.ExpectQuery("GROUP BY r.priority").
		WithArgs("ten-a", start, end).
		WillReturnRows(sqlmock.NewRows([]string{"priority", "total", "breached"}).
			AddRow("critical", int64(3), int64(2)))

	report, err := r.GetComplianceReport(context.Background(), "ten-a", start, end)
	if err != nil {
		t.Fatalf("GetComplianceReport: %v", err)
	}
	if report == nil {
		t.Fatal("report = nil")
	}
	if report.TotalTickets != 5 || report.BreachedCount != 2 {
		t.Errorf("total/breached = %d/%d, want 5/2", report.TotalTickets, report.BreachedCount)
	}
	if report.ComplianceRate < 59.99 || report.ComplianceRate > 60.01 {
		t.Errorf("ComplianceRate = %v, want 60", report.ComplianceRate)
	}
	if report.AvgResponseMs != 1200 || report.AvgResolutionMs != 5000 {
		t.Errorf("averages = %v/%v, want 1200/5000", report.AvgResponseMs, report.AvgResolutionMs)
	}
	stats, ok := report.ByPriority["critical"]
	if !ok {
		t.Fatalf("ByPriority missing critical: %+v", report.ByPriority)
	}
	if stats.Total != 3 || stats.Breached != 2 {
		t.Errorf("ByPriority[critical] = %+v, want total 3 breached 2", stats)
	}

	if len(*seen) != 5 {
		t.Fatalf("ran %d queries, want 5: %+v", len(*seen), *seen)
	}
	const join = "ticket_id IN (SELECT id FROM tickets WHERE tenant_id = $1)"
	for _, q := range *seen {
		if !strings.Contains(q, join) {
			t.Errorf("unscoped compliance query: %s", q)
		}
	}
}

// A fault on the first query must surface rather than being reported as a
// report with zero tickets.
func TestSLARepository_GetComplianceReportPropagatesErrors(t *testing.T) {
	db, mock, _ := slaMockDB(t)
	r := NewSLARepository(db)

	want := errors.New("connection refused")
	start := time.Date(2026, 8, 1, 0, 0, 0, 0, time.UTC)
	end := time.Date(2026, 8, 31, 23, 59, 59, 0, time.UTC)
	mock.ExpectQuery("SELECT COUNT(*) FROM sla_records r").
		WithArgs("ten-a", start, end).
		WillReturnError(want)

	report, err := r.GetComplianceReport(context.Background(), "ten-a", start, end)
	if err == nil {
		t.Fatalf("err = nil, want the driver error; report was %v", report)
	}
	if report != nil {
		t.Errorf("report = %v, want nil alongside an error", report)
	}
	if err.Error() != want.Error() {
		t.Errorf("error = %q, want %q", err.Error(), want.Error())
	}
}
