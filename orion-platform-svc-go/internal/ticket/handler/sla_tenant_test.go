package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"regexp"
	"strings"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/gin-gonic/gin"
	"github.com/jmoiron/sqlx"

	"orion/go-common/pkg/database"
	"orion/platform-svc-go/internal/ticket/models"
	"orion/platform-svc-go/internal/ticket/repository"
	"orion/platform-svc-go/internal/ticket/service"
)

// recordingDispatchRepo captures the tenant each queue call was handed, so a
// handler that reads the right value out of the context but drops it at the
// service boundary fails here. The SQL side is pinned by the real repository
// and the matcher, which sees the statement but not the bound values.
type recordingDispatchRepo struct {
	repo  repository.DispatchRepositoryInterface
	calls []string
}

func (f *recordingDispatchRepo) CreateEngineer(ctx context.Context, ep *models.EngineerProfile) error {
	return f.repo.CreateEngineer(ctx, ep)
}
func (f *recordingDispatchRepo) UpdateEngineer(ctx context.Context, ep *models.EngineerProfile) error {
	return f.repo.UpdateEngineer(ctx, ep)
}
func (f *recordingDispatchRepo) GetEngineer(ctx context.Context, id string) (*models.EngineerProfile, error) {
	return f.repo.GetEngineer(ctx, id)
}
func (f *recordingDispatchRepo) ListEngineers(ctx context.Context) ([]models.EngineerProfile, error) {
	return f.repo.ListEngineers(ctx)
}
func (f *recordingDispatchRepo) IncrementLoad(ctx context.Context, engineerID string) error {
	return f.repo.IncrementLoad(ctx, engineerID)
}
func (f *recordingDispatchRepo) DecrementLoad(ctx context.Context, engineerID string) error {
	return f.repo.DecrementLoad(ctx, engineerID)
}
func (f *recordingDispatchRepo) CreateRecord(ctx context.Context, rec *models.DispatchRecord) error {
	return f.repo.CreateRecord(ctx, rec)
}
func (f *recordingDispatchRepo) GetRecordByTicket(ctx context.Context, ticketID string) (*models.DispatchRecord, error) {
	return f.repo.GetRecordByTicket(ctx, ticketID)
}
func (f *recordingDispatchRepo) ListRecordsByEngineer(ctx context.Context, engineerID string, limit int) ([]models.DispatchRecord, error) {
	return f.repo.ListRecordsByEngineer(ctx, engineerID, limit)
}
func (f *recordingDispatchRepo) CreateRule(ctx context.Context, rule *models.DispatchRule) error {
	return f.repo.CreateRule(ctx, rule)
}
func (f *recordingDispatchRepo) ListRules(ctx context.Context) ([]models.DispatchRule, error) {
	return f.repo.ListRules(ctx)
}
func (f *recordingDispatchRepo) DeleteRule(ctx context.Context, id string) error {
	return f.repo.DeleteRule(ctx, id)
}
func (f *recordingDispatchRepo) Enqueue(ctx context.Context, ticketID, tenantID, priority string) error {
	f.calls = append(f.calls, "Enqueue:"+tenantID)
	return f.repo.Enqueue(ctx, ticketID, tenantID, priority)
}
func (f *recordingDispatchRepo) Dequeue(ctx context.Context, tenantID string, limit int) ([]models.DispatchQueueEntry, error) {
	f.calls = append(f.calls, fmt.Sprintf("Dequeue:%s:%d", tenantID, limit))
	return f.repo.Dequeue(ctx, tenantID, limit)
}
func (f *recordingDispatchRepo) RemoveFromQueue(ctx context.Context, tenantID, ticketID string) error {
	f.calls = append(f.calls, "RemoveFromQueue:"+tenantID+":"+ticketID)
	return f.repo.RemoveFromQueue(ctx, tenantID, ticketID)
}
func (f *recordingDispatchRepo) UpdateQueueEntry(ctx context.Context, tenantID, ticketID, lastError string, attempts int) error {
	f.calls = append(f.calls, "UpdateQueueEntry:"+tenantID)
	return f.repo.UpdateQueueEntry(ctx, tenantID, ticketID, lastError, attempts)
}
func (f *recordingDispatchRepo) GetQueueStatus(ctx context.Context, tenantID string) (*models.DispatchQueueStatus, error) {
	f.calls = append(f.calls, "GetQueueStatus:"+tenantID)
	return f.repo.GetQueueStatus(ctx, tenantID)
}
func (f *recordingDispatchRepo) GetMetrics(ctx context.Context, start, end time.Time) (*models.DispatchMetrics, error) {
	return f.repo.GetMetrics(ctx, start, end)
}

var _ repository.DispatchRepositoryInterface = (*recordingDispatchRepo)(nil)

// queueFixtureCols is the column list SELECT * FROM dispatch_queue expands to
// under migration 686.
func queueFixtureCols() []string {
	return []string{
		"ticket_id", "tenant_id", "priority", "enqueued_at", "attempts", "last_error",
	}
}

// Tenant isolation on the mounted SLA and queue routes.
//
// All four SLA routes and both SLA queue routes used to reach the database with
// no tenant predicate, so any authenticated tenant could read or influence any
// other tenant's SLA rows. The handler takes the tenant from the auth
// middleware's tenant_id key; these tests drive a real SLAService over a real
// SLARepository on a recording driver, so they assert the tenant that actually
// reaches the SQL, not just the handler's local variable.

var slaWS = regexp.MustCompile(`\s+`)

func slaNorm(s string) string {
	return strings.TrimSpace(slaWS.ReplaceAllString(s, " "))
}

func slaRecordCols() []string {
	return []string{
		"id", "ticket_id", "sla_target_id", "priority",
		"response_deadline_at", "resolution_deadline_at", "responded_at", "resolved_at",
		"breached", "breach_type", "paused", "paused_at", "paused_reason",
		"created_at", "updated_at",
	}
}

// slaMockDB records every statement the code under test runs. The matcher
// treats the expected SQL as a fragment that must appear in the statement
// actually run, so each test names the tenant predicate it is protecting. Bound
// argument order is pinned with WithArgs, which sqlmock verifies separately.
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

// recordingSLARepo sits between the handler and the real repository and captures
// the tenant and window the handler chose to pass down. The repository already
// proves the SQL; this proves the arguments, which the matcher cannot expose.
type recordingSLARepo struct {
	repo   repository.SLARepositoryInterface
	window struct{ start, end time.Time }
	calls  []string
}

func (f *recordingSLARepo) CreateTarget(ctx context.Context, target *models.SLATarget) error {
	f.calls = append(f.calls, "CreateTarget:"+target.TenantID)
	return f.repo.CreateTarget(ctx, target)
}
func (f *recordingSLARepo) ListTargets(ctx context.Context, tenantID string) ([]models.SLATarget, error) {
	f.calls = append(f.calls, "ListTargets:"+tenantID)
	return f.repo.ListTargets(ctx, tenantID)
}
func (f *recordingSLARepo) GetTargetByPriority(ctx context.Context, tenantID, priority string) (*models.SLATarget, error) {
	f.calls = append(f.calls, "GetTargetByPriority:"+tenantID)
	return f.repo.GetTargetByPriority(ctx, tenantID, priority)
}
func (f *recordingSLARepo) DeleteTarget(ctx context.Context, tenantID, id string) error {
	f.calls = append(f.calls, "DeleteTarget:"+tenantID)
	return f.repo.DeleteTarget(ctx, tenantID, id)
}
func (f *recordingSLARepo) CreateRecord(ctx context.Context, record *models.SLARecord) error {
	f.calls = append(f.calls, "CreateRecord:"+record.TicketID)
	return f.repo.CreateRecord(ctx, record)
}
func (f *recordingSLARepo) GetRecordByTicket(ctx context.Context, tenantID, ticketID string) (*models.SLARecord, error) {
	f.calls = append(f.calls, "GetRecordByTicket:"+tenantID+":"+ticketID)
	return f.repo.GetRecordByTicket(ctx, tenantID, ticketID)
}
func (f *recordingSLARepo) UpdateRecord(ctx context.Context, record *models.SLARecord) error {
	f.calls = append(f.calls, "UpdateRecord:"+record.ID)
	return f.repo.UpdateRecord(ctx, record)
}
func (f *recordingSLARepo) FindBreachedRecords(ctx context.Context, tenantID string) ([]models.SLARecord, error) {
	f.calls = append(f.calls, "FindBreachedRecords:"+tenantID)
	return f.repo.FindBreachedRecords(ctx, tenantID)
}
func (f *recordingSLARepo) FindPendingRecords(ctx context.Context, tenantID string) ([]models.SLARecord, error) {
	f.calls = append(f.calls, "FindPendingRecords:"+tenantID)
	return f.repo.FindPendingRecords(ctx, tenantID)
}
func (f *recordingSLARepo) PauseRecord(ctx context.Context, tenantID, ticketID, reason string) error {
	f.calls = append(f.calls, "PauseRecord:"+tenantID)
	return f.repo.PauseRecord(ctx, tenantID, ticketID, reason)
}
func (f *recordingSLARepo) UnpauseRecord(ctx context.Context, tenantID, ticketID string) error {
	f.calls = append(f.calls, "UnpauseRecord:"+tenantID)
	return f.repo.UnpauseRecord(ctx, tenantID, ticketID)
}
func (f *recordingSLARepo) GetComplianceReport(ctx context.Context, tenantID string, start, end time.Time) (*models.SLAComplianceReport, error) {
	f.calls = append(f.calls, "GetComplianceReport:"+tenantID)
	f.window.start, f.window.end = start, end
	return f.repo.GetComplianceReport(ctx, tenantID, start, end)
}

var _ repository.SLARepositoryInterface = (*recordingSLARepo)(nil)

// slaCtx builds a gin context the way the auth middleware would, and skips the
// tenant_id key when tenant is empty to model a request that reached the
// handler unauthenticated.
func slaCtx(tenant string, body any, params map[string]string) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	if tenant != "" {
		c.Set("tenant_id", tenant)
	}
	buf := new(strings.Builder)
	if body != nil {
		_ = json.NewEncoder(buf).Encode(body)
	}
	c.Request = httptest.NewRequest(http.MethodGet, "http://api/v1/tickets/sla", strings.NewReader(buf.String()))
	if body != nil {
		c.Request.Header.Set("Content-Type", "application/json")
	}
	if params != nil {
		c.Params = gin.Params{}
		for k, v := range params {
			c.Params = append(c.Params, gin.Param{Key: k, Value: v})
		}
	}
	return c, w
}

// A request without a tenant is refused before it touches the database: the
// mock carries no expectations, so a query reaching it would fail the handler
// with 500 instead of the intended 403.
func TestSLAHandler_RequiresTenant(t *testing.T) {
	// No expectations are queued. A query reaching the driver fails the handler
	// with 500, so asserting 403 proves the refusal happens before the DB call.
	db, _, _ := slaMockDB(t)
	h := NewSLAHandler(service.NewSLAService(repository.NewSLARepository(db), nil))

	cases := []struct {
		name string
		body any
		call func(*SLAHandler, *gin.Context)
	}{
		{"AddSLATarget", models.CreateSLATargetRequest{Name: "Gold", Priority: "critical", TargetResolutionTimeMs: 3600000},
			func(h *SLAHandler, c *gin.Context) { h.AddSLATarget(c) }},
		{"GetTicketSLA", nil,
			func(h *SLAHandler, c *gin.Context) { h.GetTicketSLA(c) }},
		{"GetSLACompliance", nil,
			func(h *SLAHandler, c *gin.Context) { h.GetSLACompliance(c) }},
		{"CheckSLABreaches", nil,
			func(h *SLAHandler, c *gin.Context) { h.CheckSLABreaches(c) }},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			c, w := slaCtx("", tc.body, map[string]string{"id": "t-42"})
			tc.call(h, c)
			if w.Code != http.StatusForbidden {
				t.Fatalf("%s: status %d, want 403: %s", tc.name, w.Code, w.Body.String())
			}
			if !strings.Contains(w.Body.String(), "tenant_id") {
				t.Errorf("%s: body %q does not say why the request was refused", tc.name, w.Body.String())
			}
		})
	}
}

func TestQueueHandler_SLARoutesRequireTenant(t *testing.T) {
	db, _, _ := slaMockDB(t)
	qm := service.NewQueueManager(repository.NewDispatchRepository(db), repository.NewSLARepository(db))
	h := NewQueueHandler(qm)

	c, w := slaCtx("", nil, nil)
	h.GetSLAQueueEntries(c)
	if w.Code != http.StatusForbidden {
		t.Fatalf("GetSLAQueueEntries: status %d, want 403: %s", w.Code, w.Body.String())
	}

	w2 := httptest.NewRecorder()
	c2, _ := gin.CreateTestContext(w2)
	c2.Request = httptest.NewRequest(http.MethodGet, "http://api/v1/tickets/dispatch/queue/sla-alerts", nil)
	h.GetSLAAlerts(c2)
	if w2.Code != http.StatusForbidden {
		t.Fatalf("GetSLAAlerts: status %d, want 403: %s", w2.Code, w2.Body.String())
	}
}

// The tenant the handler reads out of the context has to be the tenant the
// INSERT writes, and it has to land in the tenant_id column.
func TestSLAHandler_AddSLATargetWritesTheCallerTenant(t *testing.T) {
	db, mock, _ := slaMockDB(t)
	rec := &recordingSLARepo{repo: repository.NewSLARepository(db)}
	h := NewSLAHandler(service.NewSLAService(rec, nil))

	mock.ExpectExec("INSERT INTO sla_targets (id, tenant_id, name, priority, target_response_time_ms, target_resolution_time_ms, enabled)").
		WithArgs(sqlmock.AnyArg(), "ten-a", "Gold", "critical", int64(60000), int64(3600000), true).
		WillReturnResult(sqlmock.NewResult(1, 1))

	c, w := slaCtx("ten-a", models.CreateSLATargetRequest{
		Name: "Gold", Priority: "critical",
		TargetResponseTimeMs: 60000, TargetResolutionTimeMs: 3600000,
	}, nil)
	h.AddSLATarget(c)
	if w.Code != http.StatusCreated {
		t.Fatalf("status %d, want 201: %s", w.Code, w.Body.String())
	}
	if got := rec.calls; len(got) != 1 || got[0] != "CreateTarget:ten-a" {
		t.Fatalf("service saw %v, want CreateTarget with ten-a", got)
	}
	var out struct {
		Data struct {
			TenantID string `json:"tenant_id"`
		} `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &out); err != nil {
		t.Fatalf("response %q: %v", w.Body.String(), err)
	}
	if out.Data.TenantID != "ten-a" {
		t.Errorf("response tenant_id = %q, want ten-a", out.Data.TenantID)
	}
}

// The caller's tenant must bind as $1 in the record lookup and the ticket id as
// $2, so a lookup cannot be pointed at another tenant's row.
func TestSLAHandler_GetTicketSLABindsCallerTenant(t *testing.T) {
	db, mock, _ := slaMockDB(t)
	rec := &recordingSLARepo{repo: repository.NewSLARepository(db)}
	h := NewSLAHandler(service.NewSLAService(rec, nil))

	now := time.Now()
	deadline := now.Add(time.Hour)
	mock.ExpectQuery("ticket_id IN (SELECT id FROM tickets WHERE tenant_id = $1)").
		WithArgs("ten-a", "t-42").
		WillReturnRows(sqlmock.NewRows(slaRecordCols()).AddRow(
			"r-1", "t-42", "sla-1", "critical",
			deadline, deadline, nil, nil,
			false, "", false, nil, "",
			now, now,
		))

	c, w := slaCtx("ten-a", nil, map[string]string{"id": "t-42"})
	h.GetTicketSLA(c)
	if w.Code != http.StatusOK {
		t.Fatalf("status %d, want 200: %s", w.Code, w.Body.String())
	}
	if got := rec.calls; len(got) != 1 || got[0] != "GetRecordByTicket:ten-a:t-42" {
		t.Fatalf("service saw %v, want GetRecordByTicket ten-a t-42", got)
	}
	if !strings.Contains(w.Body.String(), "t-42") {
		t.Errorf("body does not carry the ticket: %s", w.Body.String())
	}
}

// The handler asks for the default window by passing zero times, and each of the
// five queries binds the caller's tenant as $1 with the window in $2 and $3.
func TestSLAHandler_GetSLAComplianceScopesAndFillsTheWindow(t *testing.T) {
	db, mock, seen := slaMockDB(t)
	rec := &recordingSLARepo{repo: repository.NewSLARepository(db)}
	h := NewSLAHandler(service.NewSLAService(rec, nil))

	mock.ExpectQuery("SELECT COUNT(*) FROM sla_records r").
		WithArgs("ten-a", sqlmock.AnyArg(), sqlmock.AnyArg()).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(int64(1)))
	mock.ExpectQuery("r.breached = true AND r.created_at BETWEEN $2 AND $3").
		WithArgs("ten-a", sqlmock.AnyArg(), sqlmock.AnyArg()).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(int64(0)))
	mock.ExpectQuery("EXTRACT(EPOCH FROM (r.responded_at - r.created_at))").
		WithArgs("ten-a", sqlmock.AnyArg(), sqlmock.AnyArg()).
		WillReturnRows(sqlmock.NewRows([]string{"avg"}).AddRow(float64(0)))
	mock.ExpectQuery("EXTRACT(EPOCH FROM (r.resolved_at - r.created_at))").
		WithArgs("ten-a", sqlmock.AnyArg(), sqlmock.AnyArg()).
		WillReturnRows(sqlmock.NewRows([]string{"avg"}).AddRow(float64(0)))
	mock.ExpectQuery("GROUP BY r.priority").
		WithArgs("ten-a", sqlmock.AnyArg(), sqlmock.AnyArg()).
		WillReturnRows(sqlmock.NewRows([]string{"priority", "total", "breached"}))

	c, w := slaCtx("ten-a", nil, nil)
	h.GetSLACompliance(c)
	if w.Code != http.StatusOK {
		t.Fatalf("status %d, want 200: %s", w.Code, w.Body.String())
	}
	if got := rec.calls; len(got) != 1 || got[0] != "GetComplianceReport:ten-a" {
		t.Fatalf("service saw %v, want GetComplianceReport with ten-a", got)
	}
	if rec.window.start.IsZero() || rec.window.end.IsZero() {
		t.Fatalf("window = %v..%v, want the service to fill in the default month", rec.window.start, rec.window.end)
	}
	if rec.window.start.After(rec.window.end) {
		t.Errorf("window start %v is after end %v", rec.window.start, rec.window.end)
	}

	if len(*seen) != 5 {
		t.Fatalf("ran %d queries, want 5", len(*seen))
	}
	const join = "ticket_id IN (SELECT id FROM tickets WHERE tenant_id = $1)"
	for _, q := range *seen {
		if !strings.Contains(q, join) {
			t.Errorf("unscoped compliance query: %s", q)
		}
	}
}

// CheckSLABreaches writes breached back to the rows it reads, so the tenant
// predicate on FindPendingRecords is what keeps one tenant from marking another
// tenant's record.
func TestSLAHandler_CheckSLABreachesScopesTheScan(t *testing.T) {
	db, mock, _ := slaMockDB(t)
	rec := &recordingSLARepo{repo: repository.NewSLARepository(db)}
	h := NewSLAHandler(service.NewSLAService(rec, nil))

	mock.ExpectQuery("r.breached = false AND r.resolved_at IS NULL AND r.paused = false").
		WithArgs("ten-a").
		WillReturnRows(sqlmock.NewRows(slaRecordCols()).AddRow(
			"r-1", "t-42", "sla-1", "critical",
			time.Now().Add(-2*time.Hour), time.Now().Add(-time.Hour),
			nil, nil, false, "", false, nil, "",
			time.Now(), time.Now(),
		))
	mock.ExpectExec("UPDATE sla_records SET responded_at=$1").
		WithArgs(sqlmock.AnyArg(), sqlmock.AnyArg(), true, "resolution",
			sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(), "r-1").
		WillReturnResult(sqlmock.NewResult(0, 1))

	c, w := slaCtx("ten-a", nil, nil)
	h.CheckSLABreaches(c)
	if w.Code != http.StatusOK {
		t.Fatalf("status %d, want 200: %s", w.Code, w.Body.String())
	}
	var out struct {
		Data struct {
			Breaches []models.SLARecord `json:"breaches"`
			Count    int                `json:"count"`
		} `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &out); err != nil {
		t.Fatalf("response %q: %v", w.Body.String(), err)
	}
	if out.Data.Count != 1 || len(out.Data.Breaches) != 1 || !out.Data.Breaches[0].Breached {
		t.Errorf("response = %+v, want one breached record", out.Data)
	}
	if len(rec.calls) != 2 || rec.calls[0] != "FindPendingRecords:ten-a" {
		t.Fatalf("service saw %v, want FindPendingRecords with ten-a first", rec.calls)
	}
	if rec.calls[1] != "UpdateRecord:r-1" {
		t.Errorf("second call = %q, want the breach written back to r-1", rec.calls[1])
	}
}

// GET /tickets/dispatch/queue/sla-alerts walks every queued ticket and looks up
// its SLA record, so the record lookup has to carry the caller's tenant too.
func TestQueueHandler_GetSLAAlertsScopesTheRecordLookup(t *testing.T) {
	db, mock, _ := slaMockDB(t)
	qm := service.NewQueueManager(repository.NewDispatchRepository(db), repository.NewSLARepository(db))
	h := NewQueueHandler(qm)

	mock.ExpectQuery("SELECT * FROM dispatch_queue WHERE tenant_id = $1 ORDER BY").
		WithArgs("ten-a", 100).
		WillReturnRows(sqlmock.NewRows(queueFixtureCols()).AddRow(
			"t-42", "ten-a", "critical", time.Now().Add(-2*time.Hour), int64(0), "",
		))
	mock.ExpectQuery("ticket_id IN (SELECT id FROM tickets WHERE tenant_id = $1)").
		WithArgs("ten-a", "t-42").
		WillReturnRows(sqlmock.NewRows(slaRecordCols()).AddRow(
			"r-1", "t-42", "sla-1", "critical",
			time.Now().Add(-time.Hour), time.Now().Add(-time.Hour),
			nil, nil, false, "", false, nil, "",
			time.Now(), time.Now(),
		))

	c, w := slaCtx("ten-a", nil, nil)
	h.GetSLAAlerts(c)
	if w.Code != http.StatusOK {
		t.Fatalf("status %d, want 200: %s", w.Code, w.Body.String())
	}
	var out struct {
		Data struct {
			Alerts []models.QueueAlert `json:"alerts"`
			Count  int                 `json:"count"`
		} `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &out); err != nil {
		t.Fatalf("response %q: %v", w.Body.String(), err)
	}
	if out.Data.Count != 1 || out.Data.Alerts[0].TicketID != "t-42" {
		t.Errorf("response = %+v, want one alert for t-42", out.Data)
	}
}

// The queue routes are the ones that used to ignore the caller entirely, so the
// tenant has to be shown to arrive both in the service call and bound in the
// SQL. "ten-b" is deliberately different from the fixture rows, which are
// "ten-a": a handler that echoed the fixture instead of the context would
// produce ten-a here and fail.
func TestQueueHandler_GetSLAQueueStatusThreadsTheCallerTenant(t *testing.T) {
	db, mock, seen := slaMockDB(t)
	rec := &recordingDispatchRepo{repo: repository.NewDispatchRepository(db)}
	h := NewQueueHandler(service.NewQueueManager(rec, repository.NewSLARepository(db)))

	mock.ExpectQuery("SELECT COUNT(*) FROM dispatch_queue WHERE tenant_id = $1").
		WithArgs("ten-b").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(int64(3)))
	mock.ExpectQuery("SELECT MIN(enqueued_at) FROM dispatch_queue WHERE tenant_id = $1").
		WithArgs("ten-b").
		WillReturnRows(sqlmock.NewRows([]string{"min"}).AddRow(time.Date(2026, 8, 26, 7, 0, 0, 0, time.UTC)))
	mock.ExpectQuery("COALESCE(AVG(EXTRACT(EPOCH FROM (NOW() - enqueued_at)) * 1000)").
		WithArgs("ten-b").
		WillReturnRows(sqlmock.NewRows([]string{"avg"}).AddRow(float64(900)))

	c, w := slaCtx("ten-b", nil, nil)
	h.GetSLAQueueStatus(c)
	if w.Code != http.StatusOK {
		t.Fatalf("status %d, want 200: %s", w.Code, w.Body.String())
	}
	if got := rec.calls; len(got) != 1 || got[0] != "GetQueueStatus:ten-b" {
		t.Fatalf("service saw %v, want GetQueueStatus with ten-b", got)
	}
	if len(*seen) != 3 {
		t.Fatalf("ran %d statements, want 3", len(*seen))
	}
	for i, sql := range *seen {
		if !strings.Contains(sql, "tenant_id = $1") {
			t.Errorf("unscoped queue statement #%d: %s", i, sql)
		}
	}
	var out struct {
		Data struct {
			PendingCount int `json:"pending_count"`
		} `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &out); err != nil {
		t.Fatalf("response %q: %v", w.Body.String(), err)
	}
	if out.Data.PendingCount != 3 {
		t.Errorf("pending_count = %d, want 3", out.Data.PendingCount)
	}
}

// The entries route walks every queued ticket into an SLA lookup, so both the
// queue read and the record lookup have to carry the caller's tenant.
func TestQueueHandler_GetSLAQueueEntriesThreadsTheCallerTenant(t *testing.T) {
	db, mock, seen := slaMockDB(t)
	rec := &recordingDispatchRepo{repo: repository.NewDispatchRepository(db)}
	h := NewQueueHandler(service.NewQueueManager(rec, repository.NewSLARepository(db)))

	mock.ExpectQuery("SELECT * FROM dispatch_queue WHERE tenant_id = $1 ORDER BY").
		WithArgs("ten-b", 100).
		WillReturnRows(sqlmock.NewRows(queueFixtureCols()).AddRow(
			"t-2", "ten-b", "high", time.Now().Add(-time.Hour), int64(0), ""))
	mock.ExpectQuery("ticket_id IN (SELECT id FROM tickets WHERE tenant_id = $1)").
		WithArgs("ten-b", "t-2").
		WillReturnRows(sqlmock.NewRows(slaRecordCols()).AddRow(
			"r-2", "t-2", "sla-2", "high",
			time.Now().Add(-30*time.Minute), time.Now().Add(time.Hour),
			nil, nil, false, "", false, nil, "",
			time.Now().Add(-time.Hour), time.Now().Add(-time.Hour)))

	c, w := slaCtx("ten-b", nil, nil)
	h.GetSLAQueueEntries(c)
	if w.Code != http.StatusOK {
		t.Fatalf("status %d, want 200: %s", w.Code, w.Body.String())
	}
	if got := rec.calls; len(got) != 1 || got[0] != "Dequeue:ten-b:100" {
		t.Fatalf("service saw %v, want Dequeue with ten-b", got)
	}
	if len(*seen) != 2 {
		t.Fatalf("ran %d statements, want 2", len(*seen))
	}
	for i, sql := range *seen {
		if !strings.Contains(sql, "tenant_id = $1") {
			t.Errorf("unscoped queue statement #%d: %s", i, sql)
		}
	}
	var out struct {
		Data struct {
			Entries []models.SLAQueueEntry `json:"entries"`
			Count   int                    `json:"count"`
		} `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &out); err != nil {
		t.Fatalf("response %q: %v", w.Body.String(), err)
	}
	if out.Data.Count != 1 || out.Data.Entries[0].TicketID != "t-2" {
		t.Errorf("response = %+v, want the one ten-b entry", out.Data)
	}
	if out.Data.Entries[0].SLADeadline == nil {
		t.Errorf("sla_deadline = nil, want the record's resolution deadline")
	}
}

// ReprioritizeAll reads the whole tenant queue, and it must be the caller's
// queue: the limit is 1000 here, not the 100 the status route uses, which is
// the only way to tell the two apart.
func TestQueueHandler_ReprioritizeQueueThreadsTheCallerTenant(t *testing.T) {
	db, mock, _ := slaMockDB(t)
	rec := &recordingDispatchRepo{repo: repository.NewDispatchRepository(db)}
	h := NewQueueHandler(service.NewQueueManager(rec, repository.NewSLARepository(db)))

	mock.ExpectQuery("SELECT * FROM dispatch_queue WHERE tenant_id = $1 ORDER BY").
		WithArgs("ten-b", 1000).
		WillReturnRows(sqlmock.NewRows(queueFixtureCols()).
			AddRow("t-2", "ten-b", "high", time.Now().Add(-time.Hour), int64(0), "").
			AddRow("t-3", "ten-b", "medium", time.Now(), int64(1), ""))

	c, w := slaCtx("ten-b", nil, nil)
	h.ReprioritizeQueue(c)
	if w.Code != http.StatusOK {
		t.Fatalf("status %d, want 200: %s", w.Code, w.Body.String())
	}
	if got := rec.calls; len(got) != 1 || got[0] != "Dequeue:ten-b:1000" {
		t.Fatalf("service saw %v, want Dequeue with ten-b and limit 1000", got)
	}
	var out struct {
		Data struct {
			Reprioritized int `json:"reprioritized"`
		} `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &out); err != nil {
		t.Fatalf("response %q: %v", w.Body.String(), err)
	}
	// ReprioritizeAll writes nothing, so this number is the queue size. The
	// assertion records that, rather than pretending it is a write count.
	if out.Data.Reprioritized != 2 {
		t.Errorf("reprioritized = %d, want the 2 ten-b entries read", out.Data.Reprioritized)
	}
}
