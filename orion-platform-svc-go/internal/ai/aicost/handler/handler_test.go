package handler

import (
	"bytes"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"regexp"
	"strings"
	"testing"
	"time"

	sqlmock "github.com/DATA-DOG/go-sqlmock"
	"github.com/gin-gonic/gin"
	"github.com/jmoiron/sqlx"

	"orion/platform-svc-go/internal/ai/aicost/repository"
	"orion/platform-svc-go/internal/ai/aicost/service"
)

const testTenant = "t1"

// The four statements these handlers reach, in the order the service issues
// them. They are matched exactly, so a mutation that renames a table, drops a
// clause or drops an argument changes the text and fails.
const spendSQL = `SELECT COALESCE(SUM(cost), 0) FROM ai_cost_records WHERE tenant_id = $1`
const savingsSQL = `SELECT COALESCE(SUM(amount), 0) FROM ai_cost_savings WHERE tenant_id=$1`
const historySQL = `SELECT * FROM ai_cost_savings WHERE tenant_id=$1 ORDER BY created_at DESC`

// collapse squeezes whitespace the way sqlmock does before comparing, so the
// per-model statement can be written across several lines and still match the
// repository's own layout.
var byModelSQL = collapse(`SELECT COALESCE(model_id, '') AS model_id,
		COALESCE(SUM(cost), 0) AS spend,
		COUNT(*) AS requests
	 FROM ai_cost_records
	 WHERE tenant_id = $1
	   AND created_at >= NOW() - INTERVAL '30 days'
	 GROUP BY 1
	 ORDER BY spend DESC, model_id`)

func collapse(sql string) string {
	return strings.Join(regexp.MustCompile(`\s+`).Split(sql, -1), " ")
}

// newRouter wires the real repository, service and handler over sqlmock and
// mounts them through RegisterRoutes, so these tests cross the mounted routes
// instead of calling the handler methods in isolation. The middleware stands in
// for the identity the auth middleware writes from a JWT claim: without it
// every auth.RequirePermission guard on the four routes would answer 403
// before a handler could run.
func newRouter(t *testing.T) (*gin.Engine, sqlmock.Sqlmock) {
	t.Helper()
	db, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherEqual))
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })

	h := NewHandler(service.NewService(repository.NewRepository(sqlx.NewDb(db, "postgres"))))

	gin.SetMode(gin.ReleaseMode)
	r := gin.New()
	r.Use(func(c *gin.Context) {
		c.Set("tenant_id", testTenant)
		c.Set("roles", []string{"admin"})
		c.Next()
	})
	h.RegisterRoutes(r.Group("/api/v1"))
	return r, mock
}

func request(t *testing.T, r *gin.Engine, method, path string, body []byte) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(method, path, bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

func envelope(t *testing.T, body []byte) map[string]any {
	t.Helper()
	var env map[string]any
	if err := json.Unmarshal(body, &env); err != nil {
		t.Fatalf("response is not a JSON envelope: %v\n%s", err, body)
	}
	return env
}

func obj(t *testing.T, env map[string]any, key, what string) map[string]any {
	t.Helper()
	v, ok := env[key].(map[string]any)
	if !ok {
		t.Fatalf("%s = %v (%T), want an object", what, env[key], env[key])
	}
	return v
}

func objOf(t *testing.T, v any, what string) map[string]any {
	t.Helper()
	m, ok := v.(map[string]any)
	if !ok {
		t.Fatalf("%s = %v (%T), want an object", what, v, v)
	}
	return m
}

func num(t *testing.T, m map[string]any, key string) float64 {
	t.Helper()
	v, ok := m[key].(float64)
	if !ok {
		t.Fatalf("%s = %v (%T), want a number", key, m[key], m[key])
	}
	return v
}

func str(t *testing.T, m map[string]any, key string) string {
	t.Helper()
	v, ok := m[key].(string)
	if !ok {
		t.Fatalf("%s = %v (%T), want a string", key, m[key], m[key])
	}
	return v
}

func list(t *testing.T, m map[string]any, key string) []any {
	t.Helper()
	v, ok := m[key].([]any)
	if !ok {
		t.Fatalf("%s = %v (%T), want an array", key, m[key], m[key])
	}
	return v
}

// assertInternalError pins the failure contract of every handler: a repository
// error answers 500 with the canonical INTERNAL_ERROR envelope, and the body
// still names the failing read so the caller can tell which query died.
func assertInternalError(t *testing.T, w *httptest.ResponseRecorder, wantErr string) {
	t.Helper()
	if w.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want 500; body %s", w.Code, w.Body.String())
	}
	env := envelope(t, w.Body.Bytes())
	if env["success"] != false {
		t.Fatalf("success = %v, want false", env["success"])
	}
	if env["code"] != "INTERNAL_ERROR" {
		t.Fatalf("code = %v, want INTERNAL_ERROR", env["code"])
	}
	msg, ok := env["error"].(string)
	if !ok || !strings.Contains(msg, wantErr) {
		t.Fatalf("error = %q, want it to contain %q", msg, wantErr)
	}
}

// TestGetSummary_ReturnsStoredSpendAndSavings is the contract of GET /ai/cost/summary.
//
// It used to return a hardcoded 5000.00 spend and two hardcoded opportunities.
// Only the repository's own statements are registered here, each bound to the
// context tenant: a leftover constant, a wrong table or a wrong binding all fail.
func TestGetSummary_ReturnsStoredSpendAndSavings(t *testing.T) {
	r, mock := newRouter(t)
	mock.ExpectQuery(spendSQL).WithArgs(testTenant).WillReturnRows(
		sqlmock.NewRows([]string{"total"}).AddRow(12.5))
	mock.ExpectQuery(byModelSQL).WithArgs(testTenant).WillReturnRows(
		sqlmock.NewRows([]string{"model_id", "spend", "requests"}).
			AddRow("gpt-4", 600.0, int64(10)).
			AddRow("claude-3", 400.0, int64(5)))
	mock.ExpectQuery(savingsSQL).WithArgs(testTenant).WillReturnRows(
		sqlmock.NewRows([]string{"total"}).AddRow(3.25))

	w := request(t, r, http.MethodGet, "/api/v1/ai/cost/summary", nil)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body %s", w.Code, w.Body.String())
	}
	env := envelope(t, w.Body.Bytes())
	if env["success"] != true {
		t.Fatalf("success = %v, want true", env["success"])
	}
	data := obj(t, env, "data", "data")
	if got := num(t, data, "total_spend"); got != 12.5 {
		t.Fatalf("total_spend = %v, want the 12.5 the repository returned", got)
	}
	if got := num(t, data, "total_savings_to_date"); got != 3.25 {
		t.Fatalf("total_savings_to_date = %v, want 3.25", got)
	}
	if got := num(t, data, "opportunity_count"); got != 2 {
		t.Fatalf("opportunity_count = %v, want the two models that recorded spend", got)
	}
	if got := str(t, data, "currency"); got != "CNY" {
		t.Fatalf("currency = %q, want CNY", got)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unexpected or unread queries: %v", err)
	}
}

// TestGetSummary_SpendQueryFailureAnswers500 pins the error branch added when
// AnalyzeCostSavings started returning an error. The old handler could not fail
// here, because the service always returned the constant 5000.00.
func TestGetSummary_SpendQueryFailureAnswers500(t *testing.T) {
	r, mock := newRouter(t)
	mock.ExpectQuery(spendSQL).WithArgs(testTenant).WillReturnError(errors.New("db down"))

	w := request(t, r, http.MethodGet, "/api/v1/ai/cost/summary", nil)

	assertInternalError(t, w, "read total spend")
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("the spend query must be the only query issued: %v", err)
	}
}

// TestGetSummary_OpportunityQueryFailureAnswers500 pins the branch that reads
// the per-model window. The all-time total already succeeded, so a handler that
// dropped the check would fall through to a zero-valued analysis and answer 200.
func TestGetSummary_OpportunityQueryFailureAnswers500(t *testing.T) {
	r, mock := newRouter(t)
	mock.ExpectQuery(spendSQL).WithArgs(testTenant).WillReturnRows(
		sqlmock.NewRows([]string{"total"}).AddRow(12.5))
	mock.ExpectQuery(byModelSQL).WithArgs(testTenant).WillReturnError(errors.New("db down"))

	w := request(t, r, http.MethodGet, "/api/v1/ai/cost/summary", nil)

	assertInternalError(t, w, "read spend by model")
}

// TestGetSummary_SavingsQueryFailureAnswers500 pins the branch on the second
// service call, which the summary reaches after the analysis has succeeded.
func TestGetSummary_SavingsQueryFailureAnswers500(t *testing.T) {
	r, mock := newRouter(t)
	mock.ExpectQuery(spendSQL).WithArgs(testTenant).WillReturnRows(
		sqlmock.NewRows([]string{"total"}).AddRow(12.5))
	mock.ExpectQuery(byModelSQL).WithArgs(testTenant).WillReturnRows(
		sqlmock.NewRows([]string{"model_id", "spend", "requests"}))
	mock.ExpectQuery(savingsSQL).WithArgs(testTenant).WillReturnError(errors.New("db down"))

	w := request(t, r, http.MethodGet, "/api/v1/ai/cost/summary", nil)

	assertInternalError(t, w, "db down")
}

// TestOptimize_Answers201WithTheCallerTenant is the contract of POST /ai/cost/optimize.
//
// The body carries a client-supplied tenant_id. The expectations bind the
// context tenant t1 and the analysis must report t1 as well, so a handler that
// trusted the body tenant would fail both checks.
func TestOptimize_Answers201WithTheCallerTenant(t *testing.T) {
	r, mock := newRouter(t)
	mock.ExpectQuery(spendSQL).WithArgs(testTenant).WillReturnRows(
		sqlmock.NewRows([]string{"total"}).AddRow(12.5))
	// AnalyzeCostSavings, then RecommendOptimization: the window is read twice.
	mock.ExpectQuery(byModelSQL).WithArgs(testTenant).WillReturnRows(
		sqlmock.NewRows([]string{"model_id", "spend", "requests"}).
			AddRow("gpt-4", 600.0, int64(10)).
			AddRow("claude-3", 400.0, int64(5)))
	mock.ExpectQuery(byModelSQL).WithArgs(testTenant).WillReturnRows(
		sqlmock.NewRows([]string{"model_id", "spend", "requests"}).
			AddRow("gpt-4", 600.0, int64(10)).
			AddRow("claude-3", 400.0, int64(5)))

	body := []byte(`{"tenant_id":"someone-else"}`)
	w := request(t, r, http.MethodPost, "/api/v1/ai/cost/optimize", body)

	if w.Code != http.StatusCreated {
		t.Fatalf("status = %d, want 201; body %s", w.Code, w.Body.String())
	}
	env := envelope(t, w.Body.Bytes())
	if env["success"] != true {
		t.Fatalf("success = %v, want true", env["success"])
	}
	t.Logf("OPTIMIZE BODY %s", w.Body.String())
	data := obj(t, env, "data", "data")
	analysis := obj(t, data, "analysis", "analysis")
	if got := str(t, analysis, "tenant_id"); got != testTenant {
		t.Fatalf("analysis.tenant_id = %q, want %q from the context, not the body", got, testTenant)
	}
	if got := num(t, analysis, "total_spend"); got != 12.5 {
		t.Fatalf("analysis.total_spend = %v, want 12.5", got)
	}
	recs := list(t, data, "recommendations")
	if len(recs) != 2 {
		t.Fatalf("recommendations = %v, want the two models that recorded spend", recs)
	}
	first := objOf(t, recs[0], "recommendations[0]")
	if got := str(t, first, "resource_name"); got != "gpt-4" {
		t.Fatalf("recommendations[0].resource_name = %q, want the largest spender", got)
	}
	if got := num(t, first, "estimated_monthly_savings"); got != 600 {
		t.Fatalf("recommendations[0].estimated_monthly_savings = %v, want 600", got)
	}
	if got := str(t, first, "category"); got != "model_consolidation" {
		t.Fatalf("recommendations[0].category = %q, want model_consolidation", got)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unexpected or unread queries: %v", err)
	}
}

// TestOptimize_AnalysisQueryFailureAnswers500 pins the first error branch: a
// handler that dropped the check on AnalyzeCostSavings would answer 201 with an
// empty analysis.
func TestOptimize_AnalysisQueryFailureAnswers500(t *testing.T) {
	r, mock := newRouter(t)
	mock.ExpectQuery(spendSQL).WithArgs(testTenant).WillReturnError(errors.New("db down"))

	w := request(t, r, http.MethodPost, "/api/v1/ai/cost/optimize",
		[]byte(`{"tenant_id":"someone-else"}`))

	assertInternalError(t, w, "read total spend")
}

// TestOptimize_RecommendationQueryFailureAnswers500 pins the second error
// branch: the analysis succeeded, so a handler that dropped the check on
// RecommendOptimization would answer 201 with nil recommendations.
func TestOptimize_RecommendationQueryFailureAnswers500(t *testing.T) {
	r, mock := newRouter(t)
	mock.ExpectQuery(spendSQL).WithArgs(testTenant).WillReturnRows(
		sqlmock.NewRows([]string{"total"}).AddRow(12.5))
	mock.ExpectQuery(byModelSQL).WithArgs(testTenant).WillReturnRows(
		sqlmock.NewRows([]string{"model_id", "spend", "requests"}))
	mock.ExpectQuery(byModelSQL).WithArgs(testTenant).WillReturnError(errors.New("db down"))

	w := request(t, r, http.MethodPost, "/api/v1/ai/cost/optimize",
		[]byte(`{"tenant_id":"someone-else"}`))

	assertInternalError(t, w, "read spend by model")
}

// TestGetAlerts_SurfaceOnlyOpportunitiesAboveTheFloor is the contract of
// GET /ai/cost/alerts: only opportunities above the savings floor are surfaced.
func TestGetAlerts_SurfaceOnlyOpportunitiesAboveTheFloor(t *testing.T) {
	r, mock := newRouter(t)
	mock.ExpectQuery(byModelSQL).WithArgs(testTenant).WillReturnRows(
		sqlmock.NewRows([]string{"model_id", "spend", "requests"}).
			AddRow("gpt-4", 600.0, int64(10)).
			AddRow("cheap", 100.0, int64(3)))

	w := request(t, r, http.MethodGet, "/api/v1/ai/cost/alerts", nil)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body %s", w.Code, w.Body.String())
	}
	env := envelope(t, w.Body.Bytes())
	if env["success"] != true {
		t.Fatalf("success = %v, want true", env["success"])
	}
	t.Logf("ALERTS BODY %s", w.Body.String())
	data := obj(t, env, "data", "data")
	alerts := list(t, data, "data")
	if len(alerts) != 1 {
		t.Fatalf("alerts = %v, want only the 600 opportunity above the floor", alerts)
	}
	if got := num(t, data, "total"); got != 1 {
		t.Fatalf("total = %v, want 1", got)
	}
	first := objOf(t, alerts[0], "alerts[0]")
	if got := str(t, first, "type"); got != "high_savings_opportunity" {
		t.Fatalf("alerts[0].type = %q", got)
	}
	if got := str(t, first, "resource_name"); got != "gpt-4" {
		t.Fatalf("alerts[0].resource_name = %q", got)
	}
	if got := num(t, first, "estimated_monthly_savings"); got != 600 {
		t.Fatalf("alerts[0].estimated_monthly_savings = %v, want 600", got)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unexpected or unread queries: %v", err)
	}
}

// TestGetAlerts_NoAlertsAnswersAnEmptyArray pins the JSON shape: a tenant with
// no qualifying opportunity gets [] in the payload, never null.
func TestGetAlerts_NoAlertsAnswersAnEmptyArray(t *testing.T) {
	r, mock := newRouter(t)
	mock.ExpectQuery(byModelSQL).WithArgs(testTenant).WillReturnRows(
		sqlmock.NewRows([]string{"model_id", "spend", "requests"}).
			AddRow("cheap", 100.0, int64(3)))

	w := request(t, r, http.MethodGet, "/api/v1/ai/cost/alerts", nil)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body %s", w.Code, w.Body.String())
	}
	body := w.Body.String()
	if !strings.Contains(body, `"data":[]`) {
		t.Fatalf("alerts serialized as %s, want an empty array rather than null", body)
	}
}

// TestGetAlerts_QueryFailureAnswers500 pins the error branch: the old handler
// answered 200 with nil alerts whenever the service returned nothing.
func TestGetAlerts_QueryFailureAnswers500(t *testing.T) {
	r, mock := newRouter(t)
	mock.ExpectQuery(byModelSQL).WithArgs(testTenant).WillReturnError(errors.New("db down"))

	w := request(t, r, http.MethodGet, "/api/v1/ai/cost/alerts", nil)

	assertInternalError(t, w, "read spend by model")
}

// TestGetHistory_ReturnsRecords is the contract of GET /ai/cost/history.
func TestGetHistory_ReturnsRecords(t *testing.T) {
	r, mock := newRouter(t)
	mock.ExpectQuery(historySQL).WithArgs(testTenant).WillReturnRows(
		sqlmock.NewRows([]string{"id", "tenant_id", "amount", "category", "description", "created_at"}).
			AddRow("s1", testTenant, 10.5, "model_consolidation", "note", time.Now()).
			AddRow("s2", testTenant, 2.5, "model_consolidation", "note", time.Now()))

	w := request(t, r, http.MethodGet, "/api/v1/ai/cost/history", nil)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body %s", w.Code, w.Body.String())
	}
	env := envelope(t, w.Body.Bytes())
	if env["success"] != true {
		t.Fatalf("success = %v, want true", env["success"])
	}
	data := obj(t, env, "data", "data")
	history := list(t, data, "data")
	if len(history) != 2 {
		t.Fatalf("history = %v, want the two stored records", history)
	}
	if got := num(t, data, "total"); got != 2 {
		t.Fatalf("total = %v, want 2", got)
	}
	first := objOf(t, history[0], "history[0]")
	if got := num(t, first, "amount"); got != 10.5 {
		t.Fatalf("history[0].amount = %v, want 10.5", got)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unexpected or unread queries: %v", err)
	}
}

// TestGetHistory_QueryFailureAnswers500 pins the error branch on the fourth
// handler: the old one answered 200 with an empty history on a query failure.
func TestGetHistory_QueryFailureAnswers500(t *testing.T) {
	r, mock := newRouter(t)
	mock.ExpectQuery(historySQL).WithArgs(testTenant).WillReturnError(errors.New("db down"))

	w := request(t, r, http.MethodGet, "/api/v1/ai/cost/history", nil)

	assertInternalError(t, w, "db down")
}
