package handler

import (
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/gin-gonic/gin"

	"orion/platform-svc-go/internal/ticket/models"
	"orion/platform-svc-go/internal/ticket/repository"
	"orion/platform-svc-go/internal/ticket/service"
)

// Tenant gating on the module A handlers that RegisterTicketDomainRoutes mounts
// and that were not using tenantFrom.
//
// Eight of the twenty-three routes registered there read the caller tenant with
// a bare c.GetString("tenant_id") while their twenty-one siblings already
// refused through tenantFrom. Both auth middlewares are disabled by default, so
// that key is never set and all eight ran with an empty tenant. An empty tenant
// is not a filter you can ignore: every repository predicate is
// WHERE tenant_id = $1, so it matched nothing and each handler invented a
// success answer for work it never did. DELETE /tickets/:id answered
// 200 "ticket deleted" after deleting zero rows, GET /tickets/stats answered
// {"count":0} indistinguishable from a tenant that really has no tickets, and
// POST /tickets/:id/dispatch/manual committed a dispatch_records row and
// incremented the engineer load while the ticket it claimed to have assigned
// stayed untouched.
//
// The first test asserts the refusal, the second asserts that the refusal runs
// before body validation, and the rest assert that the tenant the handler reads
// is the tenant that reaches SQL.

// tenantFixture wires the three handlers this file covers on one shared sqlmock
// driver with no expectations queued. Sharing the driver keeps every refusal
// assertion free of a happy path: a query reaching it fails the handler with
// 404 or 500 instead of the intended 403.
type tenantFixture struct {
	mock     sqlmock.Sqlmock
	ticket   *TicketHandler
	dispatch *DispatchHandler
	transfer *TransferHandler
}

func newTenantFixture(t *testing.T) *tenantFixture {
	t.Helper()
	db, mock, _ := slaMockDB(t)
	tRepo := repository.NewTicketRepository(db)
	dRepo := repository.NewDispatchRepository(db)
	sRepo := repository.NewSLARepository(db)
	svc := service.NewTicketService(
		tRepo,
		repository.NewCommentRepository(db),
		service.NewWorkflowService(repository.NewWorkflowRepository(db), tRepo),
		service.NewSLAService(sRepo, tRepo),
		repository.NewAssignmentRuleRepository(db),
	)
	return &tenantFixture{
		mock:     mock,
		ticket:   NewTicketHandler(svc),
		dispatch: NewDispatchHandler(service.NewDispatchService(dRepo, tRepo, sRepo)),
		transfer: NewTransferHandler(service.NewTransferService(
			repository.NewTransferRepository(db), tRepo, dRepo,
			repository.NewSuspendRepository(db),
		)),
	}
}

// ticketReadCols is the column list of ticketColumns in repository/ticket.go.
func ticketReadCols() []string {
	return []string{
		"id", "tenant_id", "title", "description", "category", "priority", "status",
		"reporter_id", "assignee_id", "resolved_at", "closed_at", "created_at", "updated_at",
	}
}

// engineerCols is the projection GetEngineer scans.
func engineerCols() []string {
	return []string{
		"id", "name", "expertise", "current_load", "max_capacity", "availability",
		"skills", "team", "on_call", "total_resolved", "avg_resolution_ms",
		"sla_compliance", "success_rate", "created_at", "updated_at",
	}
}

func TestTicketHandler_MountedRoutesRequireTenant(t *testing.T) {
	fx := newTenantFixture(t)

	cases := []struct {
		name   string
		body   any
		params map[string]string
		call   func(c *gin.Context)
	}{
		{"UpdateTicket", map[string]any{"title": "revised"}, map[string]string{"id": "t-42"},
			func(c *gin.Context) { fx.ticket.UpdateTicket(c) }},
		{"DeleteTicket", nil, map[string]string{"id": "t-42"},
			func(c *gin.Context) { fx.ticket.DeleteTicket(c) }},
		{"Count", nil, nil,
			func(c *gin.Context) { fx.ticket.Count(c) }},
		{"ListComments", nil, map[string]string{"id": "t-42"},
			func(c *gin.Context) { fx.ticket.ListComments(c) }},
		{"CreateComment", models.CreateCommentRequest{Author: "u-1", Content: "on it"},
			map[string]string{"id": "t-42"},
			func(c *gin.Context) { fx.ticket.CreateComment(c) }},
		{"AutoDispatch", map[string]any{"assigned_by": "u-1"}, map[string]string{"id": "t-42"},
			func(c *gin.Context) { fx.dispatch.AutoDispatch(c) }},
		{"ManualDispatch", map[string]any{"engineer_id": "e-1", "reason": "escalated"},
			map[string]string{"id": "t-42"},
			func(c *gin.Context) { fx.dispatch.ManualDispatch(c) }},
		{"CheckAutoTransfer", nil, nil,
			func(c *gin.Context) { fx.transfer.CheckAutoTransfer(c) }},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			c, w := slaCtx("", tc.body, tc.params)
			tc.call(c)
			if w.Code != http.StatusForbidden {
				t.Fatalf("%s: status %d, want 403: %s", tc.name, w.Code, w.Body.String())
			}
			if !strings.Contains(w.Body.String(), "tenant_id") {
				t.Errorf("%s: body %q does not say why the request was refused", tc.name, w.Body.String())
			}
		})
	}
}

// The guard runs before the body is validated, so a request that is wrong for
// two reasons reports the missing tenant instead of a misleading 400. The second
// half proves the body really does fail to bind, which keeps the 403 above from
// being vacuous.
func TestTicketHandler_TenantGuardRunsBeforeBinding(t *testing.T) {
	fx := newTenantFixture(t)

	for name, call := range map[string]func(*gin.Context){
		"CreateComment":  func(c *gin.Context) { fx.ticket.CreateComment(c) },
		"ManualDispatch": func(c *gin.Context) { fx.dispatch.ManualDispatch(c) },
	} {
		t.Run(name, func(t *testing.T) {
			// author, content and engineer_id are binding required, so this body
			// cannot bind and reaches no expectation.
			body := models.CreateCommentRequest{}
			c, w := slaCtx("", body, map[string]string{"id": "t-42"})
			call(c)
			if w.Code != http.StatusForbidden {
				t.Fatalf("status %d, want 403 from the tenant guard: %s", w.Code, w.Body.String())
			}

			c2, w2 := slaCtx("ten-a", body, map[string]string{"id": "t-42"})
			call(c2)
			if w2.Code != http.StatusBadRequest {
				t.Fatalf("with a tenant the same body must fail binding, got %d: %s", w2.Code, w2.Body.String())
			}
		})
	}
}

// The tenant the handler reads out of the context has to bind as $1 in the
// count, so an empty tenant cannot be served as an empty dashboard.
func TestTicketHandler_CountBindsTheCallerTenant(t *testing.T) {
	fx := newTenantFixture(t)
	fx.mock.ExpectQuery("SELECT COUNT(*) FROM tickets WHERE tenant_id=$1").
		WithArgs("ten-a").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(7))

	c, w := slaCtx("ten-a", nil, nil)
	fx.ticket.Count(c)
	if w.Code != http.StatusOK {
		t.Fatalf("status %d, want 200: %s", w.Code, w.Body.String())
	}
	if !strings.Contains(w.Body.String(), `"count":7`) {
		t.Errorf("body %q does not carry the tenant count", w.Body.String())
	}
	if err := fx.mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

// The delete must bind the caller tenant as $2 or it would delete nothing and
// still answer ticket deleted.
func TestTicketHandler_DeleteTicketBindsTheCallerTenant(t *testing.T) {
	fx := newTenantFixture(t)
	fx.mock.ExpectExec("DELETE FROM tickets WHERE id = $1 AND tenant_id = $2").
		WithArgs("t-42", "ten-a").
		WillReturnResult(sqlmock.NewResult(0, 1))

	c, w := slaCtx("ten-a", nil, map[string]string{"id": "t-42"})
	fx.ticket.DeleteTicket(c)
	if w.Code != http.StatusOK {
		t.Fatalf("status %d, want 200: %s", w.Code, w.Body.String())
	}
	if !strings.Contains(w.Body.String(), "ticket deleted") {
		t.Errorf("body %q does not confirm the delete", w.Body.String())
	}
	if err := fx.mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

// The update reads the ticket through the tenant predicate and writes it back
// with the same tenant, so a partial body cannot be applied to another tenants
// row.
func TestTicketHandler_UpdateTicketBindsTheCallerTenant(t *testing.T) {
	fx := newTenantFixture(t)
	now := time.Now()
	fx.mock.ExpectQuery("FROM tickets WHERE id = $1 AND tenant_id = $2").
		WithArgs("t-42", "ten-a").
		WillReturnRows(sqlmock.NewRows(ticketReadCols()).AddRow(
			"t-42", "ten-a", "old title", "desc", "incident", "high", "open",
			"u-1", "", nil, nil, now, now,
		))
	fx.mock.ExpectExec("UPDATE tickets SET title=$1").
		WithArgs("revised", "desc", "incident", "high", "open", "", nil, nil, "t-42", "ten-a").
		WillReturnResult(sqlmock.NewResult(0, 1))

	c, w := slaCtx("ten-a", map[string]any{"title": "revised"}, map[string]string{"id": "t-42"})
	fx.ticket.UpdateTicket(c)
	if w.Code != http.StatusOK {
		t.Fatalf("status %d, want 200: %s", w.Code, w.Body.String())
	}
	if !strings.Contains(w.Body.String(), `"title":"revised"`) ||
		!strings.Contains(w.Body.String(), `"tenant_id":"ten-a"`) {
		t.Errorf("body %q does not echo the scoped update", w.Body.String())
	}
	if err := fx.mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

// ManualDispatch is the route that used to write a dispatch record and bump the
// engineer load with an empty tenant while leaving the ticket untouched. Both
// ticket writes must bind ten-a.
func TestDispatchHandler_ManualDispatchBindsTheCallerTenant(t *testing.T) {
	fx := newTenantFixture(t)
	now := time.Now()
	fx.mock.ExpectQuery("FROM dispatch_engineers WHERE id = $1").
		WithArgs("e-1").
		WillReturnRows(sqlmock.NewRows(engineerCols()).AddRow(
			"e-1", "Ada", `["net"]`, 0, 4, "available", `[]`, "core", false,
			10, 120000.0, 95.0, 90.0, now, now,
		))
	fx.mock.ExpectExec("INSERT INTO dispatch_records").
		WithArgs(sqlmock.AnyArg(), "t-42", "e-1", "", "manual", float64(0), "escalated").
		WillReturnResult(sqlmock.NewResult(1, 1))
	fx.mock.ExpectExec("UPDATE tickets SET assignee_id=$1").
		WithArgs("e-1", "t-42", "ten-a").
		WillReturnResult(sqlmock.NewResult(0, 1))
	fx.mock.ExpectExec("UPDATE tickets SET status=$1").
		WithArgs("assigned", "t-42", "ten-a").
		WillReturnResult(sqlmock.NewResult(0, 1))
	fx.mock.ExpectExec("UPDATE dispatch_engineers SET current_load").
		WithArgs("e-1").
		WillReturnResult(sqlmock.NewResult(0, 1))
	fx.mock.ExpectExec("DELETE FROM dispatch_queue WHERE tenant_id = $1 AND ticket_id = $2").
		WithArgs("ten-a", "t-42").
		WillReturnResult(sqlmock.NewResult(0, 1))

	c, w := slaCtx("ten-a", map[string]any{"engineer_id": "e-1", "reason": "escalated"},
		map[string]string{"id": "t-42"})
	fx.dispatch.ManualDispatch(c)
	if w.Code != http.StatusOK {
		t.Fatalf("status %d, want 200: %s", w.Code, w.Body.String())
	}
	if !strings.Contains(w.Body.String(), `"ticket_id":"t-42"`) ||
		!strings.Contains(w.Body.String(), `"engineer_id":"e-1"`) {
		t.Errorf("body %q does not carry the record it committed", w.Body.String())
	}
	if err := fx.mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

// AutoDispatch must read the ticket through the tenant predicate before it
// scores engineers; the enqueue fallback also carries the tenant.
func TestDispatchHandler_AutoDispatchBindsTheCallerTenant(t *testing.T) {
	fx := newTenantFixture(t)
	now := time.Now()
	fx.mock.ExpectQuery("FROM tickets WHERE id = $1 AND tenant_id = $2").
		WithArgs("t-42", "ten-a").
		WillReturnRows(sqlmock.NewRows(ticketReadCols()).AddRow(
			"t-42", "ten-a", "title", "desc", "incident", "critical", "open",
			"u-1", "", nil, nil, now, now,
		))
	fx.mock.ExpectQuery("FROM dispatch_engineers ORDER BY name").
		WillReturnRows(sqlmock.NewRows(engineerCols()).AddRow(
			"e-1", "Ada", `["incident"]`, 0, 4, "available", `[]`, "core", false,
			10, 120000.0, 95.0, 90.0, now, now,
		))
	fx.mock.ExpectExec("INSERT INTO dispatch_records").
		WithArgs(sqlmock.AnyArg(), "t-42", "e-1", "u-1", "auto", sqlmock.AnyArg(), "").
		WillReturnResult(sqlmock.NewResult(1, 1))
	fx.mock.ExpectExec("UPDATE tickets SET assignee_id=$1").
		WithArgs("e-1", "t-42", "ten-a").
		WillReturnResult(sqlmock.NewResult(0, 1))
	fx.mock.ExpectExec("UPDATE tickets SET status=$1").
		WithArgs("assigned", "t-42", "ten-a").
		WillReturnResult(sqlmock.NewResult(0, 1))
	fx.mock.ExpectExec("UPDATE dispatch_engineers SET current_load").
		WithArgs("e-1").
		WillReturnResult(sqlmock.NewResult(0, 1))
	fx.mock.ExpectExec("DELETE FROM dispatch_queue WHERE tenant_id = $1 AND ticket_id = $2").
		WithArgs("ten-a", "t-42").
		WillReturnResult(sqlmock.NewResult(0, 1))

	c, w := slaCtx("ten-a", map[string]any{"assigned_by": "u-1"}, map[string]string{"id": "t-42"})
	fx.dispatch.AutoDispatch(c)
	if w.Code != http.StatusOK {
		t.Fatalf("status %d, want 200: %s", w.Code, w.Body.String())
	}
	if !strings.Contains(w.Body.String(), `"method":"auto"`) {
		t.Errorf("body %q does not carry the dispatch record", w.Body.String())
	}
	if err := fx.mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

// The transfer scan must dequeue the callers queue only.
func TestTransferHandler_CheckAutoTransferBindsTheCallerTenant(t *testing.T) {
	fx := newTenantFixture(t)
	fx.mock.ExpectQuery("SELECT * FROM dispatch_queue WHERE tenant_id = $1").
		WithArgs("ten-a", 100).
		WillReturnRows(sqlmock.NewRows(queueFixtureCols()))

	c, w := slaCtx("ten-a", nil, nil)
	fx.transfer.CheckAutoTransfer(c)
	if w.Code != http.StatusOK {
		t.Fatalf("status %d, want 200: %s", w.Code, w.Body.String())
	}
	if !strings.Contains(w.Body.String(), `"count":0`) {
		t.Errorf("body %q does not report an empty transfer batch", w.Body.String())
	}
	if err := fx.mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}
