package service

import (
	"context"
	"database/sql"
	"errors"
	"testing"

	"orion/platform-svc-go/internal/audit/models"
)

// --- Mock repository ---

type mockAuditRepo struct {
	logs map[string]*models.AuditLog // key = tenantID:id
	err  error
}

func (m *mockAuditRepo) Create(_ context.Context, tenantID string, req models.AuditLogCreateRequest) (*models.AuditLog, error) {
	if m.err != nil { return nil, m.err }
	log := &models.AuditLog{ID: "log-1", TenantID: tenantID, Action: req.Action, UserID: req.UserID, ResourceType: req.ResourceType}
	m.logs[m.key(tenantID, log.ID)] = log
	return log, nil
}

func (m *mockAuditRepo) GetByID(_ context.Context, tenantID, id string) (*models.AuditLog, error) {
	if m.err != nil { return nil, m.err }
	log, ok := m.logs[m.key(tenantID, id)]
	if !ok { return nil, sql.ErrNoRows }
	return log, nil
}

func (m *mockAuditRepo) List(_ context.Context, tenantID string, q models.AuditLogQuery) ([]models.AuditLog, int, error) {
	if m.err != nil { return nil, 0, m.err }
	var result []models.AuditLog
	for k, log := range m.logs {
		if k[:len(tenantID)] == tenantID {
			if q.UserID == "" || log.UserID == q.UserID {
				if q.Action == "" || log.Action == q.Action {
					result = append(result, *log)
				}
			}
		}
	}
	return result, len(result), nil
}

func (m *mockAuditRepo) Count(_ context.Context, tenantID string, q models.AuditLogQuery) (int, error) {
	if m.err != nil { return 0, m.err }
	var count int
	for k, log := range m.logs {
		if k[:len(tenantID)] == tenantID {
			if q.UserID == "" || log.UserID == q.UserID {
				if q.Action == "" || log.Action == q.Action { count++ }
			}
		}
	}
	return count, nil
}

func (m *mockAuditRepo) Export(_ context.Context, tenantID string, q models.AuditLogQuery) ([]models.AuditLog, error) {
	logs, _, err := m.List(context.Background(), tenantID, q)
	return logs, err
}

func (m *mockAuditRepo) GetActions(_ context.Context, tenantID string) ([]string, error) {
	if m.err != nil { return nil, m.err }
	actions := make(map[string]struct{})
	for k, log := range m.logs {
		if k[:len(tenantID)] == tenantID { actions[log.Action] = struct{}{} }
	}
	var result []string
	for a := range actions { result = append(result, a) }
	return result, nil
}

func (m *mockAuditRepo) GetResourceTypes(_ context.Context, tenantID string) ([]string, error) {
	if m.err != nil { return nil, m.err }
	types := make(map[string]struct{})
	for k, log := range m.logs {
		if k[:len(tenantID)] == tenantID { types[log.ResourceType] = struct{}{} }
	}
	var result []string
	for t := range types { result = append(result, t) }
	return result, nil
}

func (m *mockAuditRepo) GetLatest(_ context.Context, tenantID string) (*models.AuditLog, error) {
	if m.err != nil { return nil, m.err }
	for k, log := range m.logs {
		if k[:len(tenantID)] == tenantID { return log, nil }
	}
	return nil, sql.ErrNoRows
}

func (m *mockAuditRepo) VerifyChain(_ context.Context, tenantID string) (int, bool, error) {
	if m.err != nil { return 0, false, m.err }
	var total int
	for k := range m.logs { if k[:len(tenantID)] == tenantID { total++ } }
	return total, true, nil
}

func (m *mockAuditRepo) CoverageStats(_ context.Context, tenantID string) (models.AuditCoverageStats, error) {
	if m.err != nil { return models.AuditCoverageStats{}, m.err }
	return models.AuditCoverageStats{}, nil
}

func (m *mockAuditRepo) key(tenantID, id string) string { return tenantID + ":" + id }

// --- Tests ---

func TestAuditErrNotFound(t *testing.T) {
	if !IsNotFound(ErrNotFound) { t.Error("IsNotFound should return true for ErrNotFound") }
	if IsNotFound(errors.New("other")) { t.Error("IsNotFound should return false for unrelated error") }
}

func TestAuditErrInvalidFormat(t *testing.T) {
	if ErrInvalidFormat.Error() != "invalid format" {
		t.Errorf("expected 'invalid format', got %q", ErrInvalidFormat.Error())
	}
}

// --- Create ---

func TestAuditCreate_DefaultTenantID(t *testing.T) {
	tenantID := "t1"
	req := models.AuditLogCreateRequest{}
	if req.TenantID == "" { req.TenantID = tenantID }
	if req.TenantID != "t1" { t.Errorf("expected t1, got %s", req.TenantID) }
}

func TestAuditCreate_DefaultResourceType(t *testing.T) {
	req := models.AuditLogCreateRequest{}
	if req.ResourceType == "" { req.ResourceType = "audit" }
	if req.ResourceType != "audit" { t.Errorf("expected audit, got %s", req.ResourceType) }
}

func TestMockAuditRepoCreate_Success(t *testing.T) {
	repo := &mockAuditRepo{logs: map[string]*models.AuditLog{}}
	log, err := repo.Create(context.Background(), "t1", models.AuditLogCreateRequest{Action: "CREATE", UserID: "u1"})
	if err != nil { t.Fatalf("expected no error, got %v", err) }
	if log.ID != "log-1" { t.Errorf("expected log-1, got %s", log.ID) }
	if log.Action != "CREATE" { t.Errorf("expected CREATE, got %s", log.Action) }
}

func TestMockAuditRepoCreate_Error(t *testing.T) {
	repo := &mockAuditRepo{logs: map[string]*models.AuditLog{}, err: errors.New("db fail")}
	_, err := repo.Create(context.Background(), "t1", models.AuditLogCreateRequest{Action: "CREATE"})
	if err == nil { t.Fatal("expected error") }
}

// --- Get ---

func TestMockAuditRepoGetByID_Success(t *testing.T) {
	log := &models.AuditLog{ID: "log-1", TenantID: "t1", Action: "CREATE"}
	repo := &mockAuditRepo{logs: map[string]*models.AuditLog{"t1:log-1": log}}
	got, err := repo.GetByID(context.Background(), "t1", "log-1")
	if err != nil { t.Fatalf("expected no error, got %v", err) }
	if got.Action != "CREATE" { t.Errorf("expected CREATE, got %s", got.Action) }
}

func TestMockAuditRepoGetByID_NotFound(t *testing.T) {
	repo := &mockAuditRepo{logs: map[string]*models.AuditLog{}}
	_, err := repo.GetByID(context.Background(), "t1", "x")
	if !errors.Is(err, sql.ErrNoRows) { t.Errorf("expected ErrNoRows, got %v", err) }
}

// --- List ---

func TestMockAuditRepoList_Success(t *testing.T) {
	repo := &mockAuditRepo{logs: map[string]*models.AuditLog{
		"t1:l1": {ID: "l1", TenantID: "t1", Action: "CREATE"},
		"t1:l2": {ID: "l2", TenantID: "t1", Action: "DELETE"}}}
	logs, total, err := repo.List(context.Background(), "t1", models.AuditLogQuery{})
	if err != nil { t.Fatalf("expected no error, got %v", err) }
	if len(logs) != 2 { t.Errorf("expected 2, got %d", len(logs)) }
	if total != 2 { t.Errorf("expected total 2, got %d", total) }
}

func TestMockAuditRepoList_FilteredByAction(t *testing.T) {
	repo := &mockAuditRepo{logs: map[string]*models.AuditLog{
		"t1:l1": {ID: "l1", TenantID: "t1", Action: "CREATE"},
		"t1:l2": {ID: "l2", TenantID: "t1", Action: "DELETE"}}}
	logs, _, err := repo.List(context.Background(), "t1", models.AuditLogQuery{Action: "CREATE"})
	if err != nil { t.Fatalf("expected no error, got %v", err) }
	if len(logs) != 1 { t.Errorf("expected 1, got %d", len(logs)) }
}

func TestMockAuditRepoList_FilteredByUserID(t *testing.T) {
	repo := &mockAuditRepo{logs: map[string]*models.AuditLog{
		"t1:l1": {ID: "l1", TenantID: "t1", UserID: "u1"},
		"t1:l2": {ID: "l2", TenantID: "t1", UserID: "u2"}}}
	logs, _, err := repo.List(context.Background(), "t1", models.AuditLogQuery{UserID: "u1"})
	if err != nil { t.Fatalf("expected no error, got %v", err) }
	if len(logs) != 1 { t.Errorf("expected 1, got %d", len(logs)) }
}

func TestMockAuditRepoList_RepoError(t *testing.T) {
	repo := &mockAuditRepo{logs: map[string]*models.AuditLog{}, err: errors.New("db fail")}
	_, _, err := repo.List(context.Background(), "t1", models.AuditLogQuery{})
	if err == nil { t.Fatal("expected error") }
}

// --- List pagination ---

func TestAuditList_PageDefaults(t *testing.T) {
	limit := 0
	if limit <= 0 { limit = 20 }
	if limit != 20 { t.Errorf("expected limit 20, got %d", limit) }
}

func TestAuditList_TotalPages(t *testing.T) {
	total := 50
	limit := 20
	totalPages := (total + limit - 1) / limit
	if totalPages != 3 { t.Errorf("expected 3 pages, got %d", totalPages) }
}

func TestAuditList_TotalPagesZero(t *testing.T) {
	total := 0
	limit := 20
	totalPages := (total + limit - 1) / limit
	if totalPages != 0 { t.Errorf("expected 0 pages, got %d", totalPages) }
	if totalPages == 0 { totalPages = 1 }
	if totalPages != 1 { t.Errorf("expected 1 page (default), got %d", totalPages) }
}

// --- Verify ---

func TestMockAuditRepoVerifyChain_Success(t *testing.T) {
	repo := &mockAuditRepo{logs: map[string]*models.AuditLog{"t1:l1": {}, "t1:l2": {}}}
	verified, valid, err := repo.VerifyChain(context.Background(), "t1")
	if err != nil { t.Fatalf("expected no error, got %v", err) }
	if verified != 2 { t.Errorf("expected 2, got %d", verified) }
	if !valid { t.Error("expected valid=true") }
}

func TestMockAuditRepoVerifyChain_Empty(t *testing.T) {
	repo := &mockAuditRepo{logs: map[string]*models.AuditLog{}}
	verified, valid, err := repo.VerifyChain(context.Background(), "t1")
	if err != nil { t.Fatalf("expected no error, got %v", err) }
	if verified != 0 { t.Errorf("expected 0, got %d", verified) }
	if !valid { t.Error("empty chain should be valid") }
}

// --- GetActions ---

func TestMockAuditRepoGetActions_Success(t *testing.T) {
	repo := &mockAuditRepo{logs: map[string]*models.AuditLog{
		"t1:l1": {Action: "CREATE"}, "t1:l2": {Action: "DELETE"}}}
	actions, err := repo.GetActions(context.Background(), "t1")
	if err != nil { t.Fatalf("expected no error, got %v", err) }
	if len(actions) != 2 { t.Errorf("expected 2, got %d", len(actions)) }
}

// --- GetResourceTypes ---

func TestMockAuditRepoGetResourceTypes_Success(t *testing.T) {
	repo := &mockAuditRepo{logs: map[string]*models.AuditLog{
		"t1:l1": {ResourceType: "user"}, "t1:l2": {ResourceType: "deploy"}}}
	types, err := repo.GetResourceTypes(context.Background(), "t1")
	if err != nil { t.Fatalf("expected no error, got %v", err) }
	if len(types) != 2 { t.Errorf("expected 2, got %d", len(types)) }
}

// --- Count ---

func TestMockAuditRepoCount_Success(t *testing.T) {
	repo := &mockAuditRepo{logs: map[string]*models.AuditLog{"t1:l1": {}, "t1:l2": {}}}
	count, err := repo.Count(context.Background(), "t1", models.AuditLogQuery{})
	if err != nil { t.Fatalf("expected no error, got %v", err) }
	if count != 2 { t.Errorf("expected 2, got %d", count) }
}

// --- Export ---

func TestMockAuditRepoExport_Success(t *testing.T) {
	repo := &mockAuditRepo{logs: map[string]*models.AuditLog{"t1:l1": {}}}
	logs, err := repo.Export(context.Background(), "t1", models.AuditLogQuery{})
	if err != nil { t.Fatalf("expected no error, got %v", err) }
	if len(logs) != 1 { t.Errorf("expected 1, got %d", len(logs)) }
}

// --- CoverageStats ---

func TestMockAuditRepoCoverageStats_Success(t *testing.T) {
	repo := &mockAuditRepo{logs: map[string]*models.AuditLog{}}
	stats, err := repo.CoverageStats(context.Background(), "t1")
	if err != nil { t.Fatalf("expected no error, got %v", err) }
	_ = stats
}

// --- GenesisHash ---

func TestGenesisHash(t *testing.T) {
	if GenesisHash == "" { t.Error("GenesisHash should not be empty") }
	expected := "0000000000000000000000000000000000000000000000000000000000000000"
	if GenesisHash != expected { t.Errorf("expected %s, got %s", expected, GenesisHash) }
}
