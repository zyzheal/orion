package service

import (
	"context"
	"errors"
	"testing"

	"orion/go-common/pkg/sentinel"
	"orion/platform-svc-go/internal/dba/models"
)

// ADR-016 Phase 3 TEST-7 (docs/adr/ADR-016-测试基础设施决策.md §4.1):
// dba/service + slowquery depth coverage.
//
// The pre-existing service_test.go covered the pure SQL-safety helpers
// (IsReadOnlySQL, containsSQLKeyword, normalizeDBType, buildMySQLDSN,
// executeSQLQueryByType unsupported branch) but left all Service methods
// at 0% coverage. This file adds a mock RepositoryInterface so we can
// exercise the CRUD and workflow methods end-to-end without a database,
// plus tests for the pure helper functions resolveRowLimit and
// newExecutionRecord that had been 0% as well.
//
// Coverage improvement target: 24.7% → 60% (ADR-016 TEST-7).

// mockRepo implements RepositoryInterface with in-memory maps so tests
// can seed state, exercise branching, and assert on mutations.
type mockRepo struct {
	orders      map[string]*models.SqlOrder
	dataSources map[string]*models.DataSource
	rules       []models.AuditRule
	queryLogs   []models.QueryExecutionRecord
	totalOrders int
	totalLogs   int
	dbErr       error
}

func newMockRepo() *mockRepo {
	return &mockRepo{
		orders:      map[string]*models.SqlOrder{},
		dataSources: map[string]*models.DataSource{},
	}
}

func (m *mockRepo) CreateOrder(_ context.Context, o *models.SqlOrder) error {
	if m.dbErr != nil {
		return m.dbErr
	}
	if o.ID == "" {
		o.ID = "ord-" + o.UserID + "-" + o.Database
	}
	m.orders[o.ID] = o
	m.totalOrders++
	return nil
}
func (m *mockRepo) GetOrder(_ context.Context, id string) (*models.SqlOrder, error) {
	if m.dbErr != nil {
		return nil, m.dbErr
	}
	o, ok := m.orders[id]
	if !ok {
		return nil, sentinel.NotFound
	}
	return o, nil
}
func (m *mockRepo) ListOrders(_ context.Context, _tenantID, _status string, _page, _limit int) ([]models.SqlOrder, int, error) {
	if m.dbErr != nil {
		return nil, 0, m.dbErr
	}
	out := make([]models.SqlOrder, 0, len(m.orders))
	for _, o := range m.orders {
		out = append(out, *o)
	}
	return out, m.totalOrders, nil
}
func (m *mockRepo) UpdateOrderStatus(_ context.Context, id, status string, approvedBy, result *string) (*models.SqlOrder, error) {
	if m.dbErr != nil {
		return nil, m.dbErr
	}
	o, ok := m.orders[id]
	if !ok {
		return nil, sentinel.NotFound
	}
	o.Status = status
	if approvedBy != nil {
		o.ApprovedBy = approvedBy
	}
	if result != nil {
		o.Result = result
	}
	return o, nil
}
func (m *mockRepo) InsertQueryExecutionLog(_ context.Context, rec *models.QueryExecutionRecord) error {
	if m.dbErr != nil {
		return m.dbErr
	}
	m.queryLogs = append(m.queryLogs, *rec)
	m.totalLogs++
	return nil
}
func (m *mockRepo) ListQueryLogs(_ context.Context, _tenantID string, _q models.QueryLogQuery) ([]models.QueryExecutionRecord, int, error) {
	return m.queryLogs, m.totalLogs, nil
}
func (m *mockRepo) CreateAuditRule(_ context.Context, r *models.AuditRule) error {
	if m.dbErr != nil {
		return m.dbErr
	}
	if r.ID == "" {
		r.ID = "rule-1"
	}
	m.rules = append(m.rules, *r)
	return nil
}
func (m *mockRepo) ListAuditRules(_ context.Context, _tenantID string) ([]models.AuditRule, error) {
	if m.dbErr != nil {
		return nil, m.dbErr
	}
	return m.rules, nil
}
func (m *mockRepo) UpdateAuditRule(_ context.Context, id string, updates map[string]interface{}) (*models.AuditRule, error) {
	for i, r := range m.rules {
		if r.ID == id {
			m.rules[i] = r
			return &m.rules[i], nil
		}
	}
	return nil, sentinel.NotFound
}
func (m *mockRepo) CreateDataSource(_ context.Context, ds *models.DataSource) error {
	if m.dbErr != nil {
		return m.dbErr
	}
	if ds.ID == "" {
		ds.ID = "ds-1"
	}
	m.dataSources[ds.ID] = ds
	return nil
}
func (m *mockRepo) GetDataSource(_ context.Context, id string) (*models.DataSource, error) {
	ds, ok := m.dataSources[id]
	if !ok {
		return nil, sentinel.NotFound
	}
	return ds, nil
}
func (m *mockRepo) ListDataSources(_ context.Context, _tenantID string) ([]models.DataSource, error) {
	out := make([]models.DataSource, 0, len(m.dataSources))
	for _, ds := range m.dataSources {
		out = append(out, *ds)
	}
	return out, nil
}
func (m *mockRepo) UpdateDataSource(_ context.Context, id string, updates map[string]interface{}) (*models.DataSource, error) {
	ds, ok := m.dataSources[id]
	if !ok {
		return nil, sentinel.NotFound
	}
	return ds, nil
}
func (m *mockRepo) DeleteDataSource(_ context.Context, id string) error {
	delete(m.dataSources, id)
	return nil
}
func (m *mockRepo) UpdateDataSourceStatus(_ context.Context, id, status string) error {
	ds, ok := m.dataSources[id]
	if !ok {
		return sentinel.NotFound
	}
	ds.Status = status
	return nil
}

func ctxBg() context.Context { return context.Background() }

// ===========================================================================
// resolveRowLimit — pure boundary logic
// ===========================================================================

func TestResolveRowLimitNilReturnsDefault(t *testing.T) {
	if got := resolveRowLimit(nil); got != DefaultQueryRowLimit {
		t.Errorf("resolveRowLimit(nil) = %d, want %d", got, DefaultQueryRowLimit)
	}
}

func TestResolveRowLimitZeroOrNegativeReturnsDefault(t *testing.T) {
	for _, v := range []int{0, -1, -100} {
		if got := resolveRowLimit(&v); got != DefaultQueryRowLimit {
			t.Errorf("resolveRowLimit(%d) = %d, want %d", v, got, DefaultQueryRowLimit)
		}
	}
}

func TestResolveRowLimitHonorsExplicitValue(t *testing.T) {
	for _, v := range []int{1, 100, 500, 2500} {
		if got := resolveRowLimit(&v); got != v {
			t.Errorf("resolveRowLimit(%d) = %d, want %d", v, got, v)
		}
	}
}

func TestResolveRowLimitClampsAboveMax(t *testing.T) {
	for _, v := range []int{MaxQueryRowLimit + 1, 100000} {
		if got := resolveRowLimit(&v); got != MaxQueryRowLimit {
			t.Errorf("resolveRowLimit(%d) = %d, want %d", v, got, MaxQueryRowLimit)
		}
	}
}

func TestResolveRowLimitExactMaxIsHonored(t *testing.T) {
	max := MaxQueryRowLimit
	if got := resolveRowLimit(&max); got != MaxQueryRowLimit {
		t.Errorf("resolveRowLimit(%d) = %d, want %d", MaxQueryRowLimit, got, MaxQueryRowLimit)
	}
}

// ===========================================================================
// newExecutionRecord — pure constructor
// ===========================================================================

func TestNewExecutionRecordPopulatesAllFields(t *testing.T) {
	rec := newExecutionRecord(ctxBg(), "t-1", "u-1", "ds-1", "prod-db",
		"SELECT 1", "completed", "", 42, nil)
	if rec.TenantID != "t-1" || rec.UserID != "u-1" || rec.DataSourceID != "ds-1" {
		t.Errorf("rec = %+v", rec)
	}
	if rec.DataSourceName != "prod-db" || rec.SQL != "SELECT 1" || rec.Status != "completed" {
		t.Errorf("rec = %+v", rec)
	}
	if rec.RowCount != 42 {
		t.Errorf("RowCount = %d, want 42", rec.RowCount)
	}
	if rec.Latency != 0.0 {
		t.Errorf("Latency = %f, want 0.0", rec.Latency)
	}
	if rec.Error != nil {
		t.Error("Error should be nil when errMsg is empty")
	}
	if rec.ID == "" {
		t.Error("ID should be auto-populated")
	}
	if rec.CreatedAt.IsZero() {
		t.Error("CreatedAt should be populated")
	}
}

func TestNewExecutionRecordSetsErrorField(t *testing.T) {
	rec := newExecutionRecord(ctxBg(), "t-1", "u-1", "ds-1", "prod-db",
		"SELECT 1", "failed", "connection refused", 0, nil)
	if rec.Error == nil || *rec.Error != "connection refused" {
		t.Errorf("Error = %v, want 'connection refused'", rec.Error)
	}
}

func TestNewExecutionRecordUsesProvidedLatency(t *testing.T) {
	lat := 123.45
	rec := newExecutionRecord(ctxBg(), "t-1", "u-1", "ds-1", "prod-db",
		"SELECT 1", "completed", "", 10, &lat)
	if rec.Latency != 123.45 {
		t.Errorf("Latency = %f, want 123.45", rec.Latency)
	}
}

// ===========================================================================
// Service — ListOrders
// ===========================================================================

func TestListOrders_ReturnsDataAndTotal(t *testing.T) {
	repo := newMockRepo()
	repo.orders["o1"] = &models.SqlOrder{ID: "o1", TenantID: "t", Status: "pending"}
	repo.totalOrders = 5
	svc := NewService(repo)

	res, err := svc.ListOrders(ctxBg(), "t", "", 1, 10)
	if err != nil {
		t.Fatalf("ListOrders: %v", err)
	}
	if len(res.Data) != 1 || res.Data[0].ID != "o1" {
		t.Errorf("Data = %+v", res.Data)
	}
	if res.Total != 5 {
		t.Errorf("Total = %d, want 5", res.Total)
	}
}

func TestListOrders_PropagatesRepoError(t *testing.T) {
	repo := newMockRepo()
	repo.dbErr = errors.New("db down")
	svc := NewService(repo)
	if _, err := svc.ListOrders(ctxBg(), "t", "", 1, 10); err == nil {
		t.Error("expected propagated DB error")
	}
}

// ===========================================================================
// Service — GetOrder
// ===========================================================================

func TestGetOrder_Found(t *testing.T) {
	repo := newMockRepo()
	repo.orders["o1"] = &models.SqlOrder{ID: "o1", Status: "pending"}
	svc := NewService(repo)
	got, err := svc.GetOrder(ctxBg(), "o1")
	if err != nil {
		t.Fatalf("GetOrder: %v", err)
	}
	if got.ID != "o1" {
		t.Errorf("got.ID = %q", got.ID)
	}
}

func TestGetOrder_NotFound(t *testing.T) {
	svc := NewService(newMockRepo())
	_, err := svc.GetOrder(ctxBg(), "missing")
	if !errors.Is(err, sentinel.NotFound) {
		t.Errorf("err = %v, want sentinel.NotFound", err)
	}
}

// ===========================================================================
// Service — CreateOrder
// ===========================================================================

func TestCreateOrder_DefaultsTypeToQuery(t *testing.T) {
	repo := newMockRepo()
	svc := NewService(repo)
	got, err := svc.CreateOrder(ctxBg(), "t1", "u1", models.CreateOrderRequest{
		Database: "prod-db", SQL: "SELECT 1",
	})
	if err != nil {
		t.Fatalf("CreateOrder: %v", err)
	}
	if got.Type != "query" {
		t.Errorf("Type = %q, want query (default)", got.Type)
	}
	if got.TenantID != "t1" || got.UserID != "u1" {
		t.Errorf("got.TenantID/UserID = %q/%q", got.TenantID, got.UserID)
	}
}

func TestCreateOrder_AllValidTypes(t *testing.T) {
	repo := newMockRepo()
	svc := NewService(repo)
	for _, typ := range []string{"query", "grant", "revoke", "ddl", "dml"} {
		got, err := svc.CreateOrder(ctxBg(), "t1", "u1", models.CreateOrderRequest{
			Type: typ, Database: "db", SQL: "x",
		})
		if err != nil {
			t.Fatalf("type %q: %v", typ, err)
			continue
		}
		if got.Type != typ {
			t.Errorf("type = %q, want %q", got.Type, typ)
		}
	}
}

func TestCreateOrder_RejectsInvalidType(t *testing.T) {
	svc := NewService(newMockRepo())
	_, err := svc.CreateOrder(ctxBg(), "t1", "u1", models.CreateOrderRequest{
		Type: "unknown", Database: "db", SQL: "x",
	})
	if err == nil {
		t.Error("expected error on invalid type")
	}
}

// ===========================================================================
// Service — ApproveOrder
// ===========================================================================

func TestApproveOrder_RejectsSelfApproval(t *testing.T) {
	repo := newMockRepo()
	repo.orders["o1"] = &models.SqlOrder{ID: "o1", UserID: "u1", Status: "pending"}
	svc := NewService(repo)
	_, err := svc.ApproveOrder(ctxBg(), "o1", "u1")
	if err == nil {
		t.Error("expected self-approval to be rejected")
	}
}

func TestApproveOrder_RejectsNonPending(t *testing.T) {
	repo := newMockRepo()
	repo.orders["o1"] = &models.SqlOrder{ID: "o1", UserID: "u1", Status: "approved"}
	svc := NewService(repo)
	_, err := svc.ApproveOrder(ctxBg(), "o1", "u2")
	if err == nil {
		t.Error("expected already-approved order to be rejected")
	}
}

func TestApproveOrder_NotFound(t *testing.T) {
	svc := NewService(newMockRepo())
	_, err := svc.ApproveOrder(ctxBg(), "missing", "u1")
	if err == nil || err.Error() != "order not found" {
		t.Errorf("err = %v, want 'order not found'", err)
	}
}

func TestApproveOrder_PendingOrderTransitionsToApproved(t *testing.T) {
	repo := newMockRepo()
	repo.orders["o1"] = &models.SqlOrder{ID: "o1", UserID: "u1", Status: "pending"}
	svc := NewService(repo)
	got, err := svc.ApproveOrder(ctxBg(), "o1", "approver-1")
	if err != nil {
		t.Fatalf("ApproveOrder: %v", err)
	}
	if got.Status != "approved" {
		t.Errorf("Status = %q, want approved", got.Status)
	}
	if got.ApprovedBy == nil || *got.ApprovedBy != "approver-1" {
		t.Errorf("ApprovedBy = %v, want approver-1", got.ApprovedBy)
	}
}

// ===========================================================================
// Service — RejectOrder
// ===========================================================================

func TestRejectOrder_RejectsNonPending(t *testing.T) {
	repo := newMockRepo()
	repo.orders["o1"] = &models.SqlOrder{ID: "o1", UserID: "u1", Status: "approved"}
	svc := NewService(repo)
	_, err := svc.RejectOrder(ctxBg(), "o1")
	if err == nil {
		t.Error("expected approved order to be rejected from reject")
	}
}

func TestRejectOrder_PendingOrderTransitionsToRejected(t *testing.T) {
	repo := newMockRepo()
	repo.orders["o1"] = &models.SqlOrder{ID: "o1", UserID: "u1", Status: "pending"}
	svc := NewService(repo)
	got, err := svc.RejectOrder(ctxBg(), "o1")
	if err != nil {
		t.Fatalf("RejectOrder: %v", err)
	}
	if got.Status != "rejected" {
		t.Errorf("Status = %q, want rejected", got.Status)
	}
}

func TestRejectOrder_NotFound(t *testing.T) {
	svc := NewService(newMockRepo())
	_, err := svc.RejectOrder(ctxBg(), "missing")
	if err == nil {
		t.Error("expected not-found error")
	}
}

// ===========================================================================
// Service — ExecuteOrder (gate branches)
// ===========================================================================

func TestExecuteOrder_NotFound(t *testing.T) {
	svc := NewService(newMockRepo())
	_, err := svc.ExecuteOrder(ctxBg(), "t1", "u1", "missing")
	if err == nil {
		t.Error("expected not-found error")
	}
}

func TestExecuteOrder_TenantMismatch(t *testing.T) {
	repo := newMockRepo()
	repo.orders["o1"] = &models.SqlOrder{ID: "o1", TenantID: "other-tenant", Status: "approved"}
	svc := NewService(repo)
	_, err := svc.ExecuteOrder(ctxBg(), "t1", "u1", "o1")
	if err == nil || err.Error() != "order o1 does not belong to tenant" {
		t.Errorf("err = %v", err)
	}
}

func TestExecuteOrder_RejectsPendingOrder(t *testing.T) {
	repo := newMockRepo()
	repo.orders["o1"] = &models.SqlOrder{ID: "o1", TenantID: "t1", Status: "pending"}
	svc := NewService(repo)
	_, err := svc.ExecuteOrder(ctxBg(), "t1", "u1", "o1")
	if err == nil || err.Error() != "order o1 is pending approval; cannot execute" {
		t.Errorf("err = %v", err)
	}
}

func TestExecuteOrder_RejectsRejectedOrder(t *testing.T) {
	repo := newMockRepo()
	repo.orders["o1"] = &models.SqlOrder{ID: "o1", TenantID: "t1", Status: "rejected"}
	svc := NewService(repo)
	_, err := svc.ExecuteOrder(ctxBg(), "t1", "u1", "o1")
	if err == nil || err.Error() != "order o1 was rejected; cannot execute" {
		t.Errorf("err = %v", err)
	}
}

func TestExecuteOrder_RejectsCompletedOrder(t *testing.T) {
	repo := newMockRepo()
	repo.orders["o1"] = &models.SqlOrder{ID: "o1", TenantID: "t1", Status: "completed"}
	svc := NewService(repo)
	_, err := svc.ExecuteOrder(ctxBg(), "t1", "u1", "o1")
	if err == nil || err.Error() != "order o1 already completed; cannot re-execute" {
		t.Errorf("err = %v", err)
	}
}

func TestExecuteOrder_RejectsFailedOrder(t *testing.T) {
	repo := newMockRepo()
	repo.orders["o1"] = &models.SqlOrder{ID: "o1", TenantID: "t1", Status: "failed"}
	svc := NewService(repo)
	_, err := svc.ExecuteOrder(ctxBg(), "t1", "u1", "o1")
	if err == nil || err.Error() != "order o1 previously failed; create a new order to retry" {
		t.Errorf("err = %v", err)
	}
}

func TestExecuteOrder_RejectsInvalidStatus(t *testing.T) {
	repo := newMockRepo()
	repo.orders["o1"] = &models.SqlOrder{ID: "o1", TenantID: "t1", Status: "weird-state"}
	svc := NewService(repo)
	_, err := svc.ExecuteOrder(ctxBg(), "t1", "u1", "o1")
	if err == nil {
		t.Error("expected invalid-status error")
	}
}

// ===========================================================================
// Service — DataSources CRUD
// ===========================================================================

func TestListDataSources_ReturnsAll(t *testing.T) {
	repo := newMockRepo()
	repo.dataSources["ds-1"] = &models.DataSource{ID: "ds-1", TenantID: "t1", Name: "a"}
	repo.dataSources["ds-2"] = &models.DataSource{ID: "ds-2", TenantID: "t1", Name: "b"}
	svc := NewService(repo)
	out, err := svc.ListDataSources(ctxBg(), "t1")
	if err != nil {
		t.Fatalf("ListDataSources: %v", err)
	}
	if len(out) != 2 {
		t.Errorf("len = %d, want 2", len(out))
	}
}

func TestGetDataSource_Found(t *testing.T) {
	repo := newMockRepo()
	repo.dataSources["ds-1"] = &models.DataSource{ID: "ds-1", Name: "a"}
	svc := NewService(repo)
	got, err := svc.GetDataSource(ctxBg(), "t1", "ds-1")
	if err != nil {
		t.Fatalf("GetDataSource: %v", err)
	}
	if got.ID != "ds-1" {
		t.Errorf("got.ID = %q", got.ID)
	}
}

func TestGetDataSource_NotFound(t *testing.T) {
	svc := NewService(newMockRepo())
	_, err := svc.GetDataSource(ctxBg(), "t1", "missing")
	if !errors.Is(err, sentinel.NotFound) {
		t.Errorf("err = %v, want sentinel.NotFound", err)
	}
}

func TestCreateDataSource_AssignsID(t *testing.T) {
	repo := newMockRepo()
	svc := NewService(repo)
	got, err := svc.CreateDataSource(ctxBg(), "t1", models.CreateDataSourceRequest{
		Name: "my-db", Type: "postgres", Host: "localhost", Port: 5432,
		Username: ptrStr("u"), Password: ptrStr("p"), Database: "d",
	})
	if err != nil {
		t.Fatalf("CreateDataSource: %v", err)
	}
	if got.ID == "" {
		t.Error("ID should be assigned")
	}
	if got.Name != "my-db" || got.Host != "localhost" {
		t.Errorf("got = %+v", got)
	}
}

func TestUpdateDataSource_Found(t *testing.T) {
	repo := newMockRepo()
	repo.dataSources["ds-1"] = &models.DataSource{ID: "ds-1", Name: "a"}
	svc := NewService(repo)
	got, err := svc.UpdateDataSource(ctxBg(), "t1", "ds-1", models.UpdateDataSourceRequest{
		Name: ptrStr("renamed"),
	})
	if err != nil {
		t.Fatalf("UpdateDataSource: %v", err)
	}
	if got.ID != "ds-1" {
		t.Errorf("got.ID = %q", got.ID)
	}
}

func TestUpdateDataSource_NotFound(t *testing.T) {
	svc := NewService(newMockRepo())
	_, err := svc.UpdateDataSource(ctxBg(), "t1", "missing", models.UpdateDataSourceRequest{})
	if !errors.Is(err, sentinel.NotFound) {
		t.Errorf("err = %v, want sentinel.NotFound", err)
	}
}

func TestDeleteDataSource(t *testing.T) {
	repo := newMockRepo()
	repo.dataSources["ds-1"] = &models.DataSource{ID: "ds-1"}
	svc := NewService(repo)
	if err := svc.DeleteDataSource(ctxBg(), "t1", "ds-1"); err != nil {
		t.Fatalf("DeleteDataSource: %v", err)
	}
	if _, ok := repo.dataSources["ds-1"]; ok {
		t.Error("dataSource should be deleted")
	}
}

func TestDeleteDataSource_NotFound(t *testing.T) {
	svc := NewService(newMockRepo())
	err := svc.DeleteDataSource(ctxBg(), "t1", "missing")
	if !errors.Is(err, sentinel.NotFound) {
		t.Errorf("err = %v, want sentinel.NotFound", err)
	}
}

// ===========================================================================
// Service — Audit Rules
// ===========================================================================

func TestListAuditRules_ReturnsAll(t *testing.T) {
	repo := newMockRepo()
	repo.rules = []models.AuditRule{{ID: "r1"}, {ID: "r2"}}
	svc := NewService(repo)
	out, err := svc.ListAuditRules(ctxBg(), "t1")
	if err != nil {
		t.Fatalf("ListAuditRules: %v", err)
	}
	if len(out) != 2 {
		t.Errorf("len = %d, want 2", len(out))
	}
}

func TestCreateAuditRule_AssignsID(t *testing.T) {
	repo := newMockRepo()
	svc := NewService(repo)
	got, err := svc.CreateAuditRule(ctxBg(), "t1", models.CreateAuditRuleRequest{
		Name: "no-drop", Pattern: "DROP",
	})
	if err != nil {
		t.Fatalf("CreateAuditRule: %v", err)
	}
	if got.ID == "" {
		t.Error("ID should be assigned")
	}
	if got.Name != "no-drop" {
		t.Errorf("Name = %q", got.Name)
	}
}

func TestUpdateAuditRule_Found(t *testing.T) {
	repo := newMockRepo()
	repo.rules = []models.AuditRule{{ID: "r1", Name: "old"}}
	svc := NewService(repo)
	got, err := svc.UpdateAuditRule(ctxBg(), "r1", models.UpdateAuditRuleRequest{
		Name: ptrStr("new"),
	})
	if err != nil {
		t.Fatalf("UpdateAuditRule: %v", err)
	}
	if got.ID != "r1" {
		t.Errorf("got.ID = %q", got.ID)
	}
}

func TestUpdateAuditRule_NotFound(t *testing.T) {
	svc := NewService(newMockRepo())
	_, err := svc.UpdateAuditRule(ctxBg(), "missing", models.UpdateAuditRuleRequest{})
	if !errors.Is(err, sentinel.NotFound) {
		t.Errorf("err = %v, want sentinel.NotFound", err)
	}
}

// ===========================================================================
// Service — Query Logs
// ===========================================================================

func TestListQueryLogs_ReturnsPagedResult(t *testing.T) {
	repo := newMockRepo()
	repo.queryLogs = []models.QueryExecutionRecord{{ID: "q1"}}
	repo.totalLogs = 42
	svc := NewService(repo)
	res, err := svc.ListQueryLogs(ctxBg(), "t1", models.QueryLogQuery{Page: 2, Limit: 25})
	if err != nil {
		t.Fatalf("ListQueryLogs: %v", err)
	}
	if res.Total != 42 || res.Page != 2 || res.Limit != 25 {
		t.Errorf("res = %+v", res)
	}
	if len(res.Data) != 1 {
		t.Errorf("len(Data) = %d", len(res.Data))
	}
}

// ===========================================================================
// Service — Error propagation from repo
// ===========================================================================

func TestServicePropagatesRepoErrors(t *testing.T) {
	repo := newMockRepo()
	repo.dbErr = errors.New("db down")
	svc := NewService(repo)

	if _, err := svc.GetOrder(ctxBg(), "any"); err == nil {
		t.Error("GetOrder should propagate db error")
	}
	if _, err := svc.CreateOrder(ctxBg(), "t", "u", models.CreateOrderRequest{
		Type: "query", Database: "d", SQL: "s",
	}); err == nil {
		t.Error("CreateOrder should propagate db error")
	}
	if _, err := svc.ListOrders(ctxBg(), "t", "", 1, 10); err == nil {
		t.Error("ListOrders should propagate db error")
	}
}

// ===========================================================================
// Sentinel errors and NewService
// ===========================================================================

func TestNewServiceWithNilRepoPanicsOnCall(t *testing.T) {
	defer func() {
		if r := recover(); r == nil {
			t.Error("expected panic on nil repo dereference")
		}
	}()
	svc := NewService(nil)
	_, _ = svc.GetOrder(ctxBg(), "any")
}

// ptrStr is a tiny helper so tests don't have to declare &string locals.
func ptrStr(s string) *string { return &s }
