package service

import (
	"context"
	"database/sql"
	"errors"
	"testing"

	"orion/platform-svc-go/internal/developer-portal/models"
)

type mockDPRepo struct {
	portals map[string]*models.DeveloperPortal
	docs    map[string]*models.PortalDocument
	rules   map[string]*models.MockRule
	tasks   map[string]*models.SDKTask
	subs    map[string]*models.Subscription
	dbErr   error
}

func newMockDPRepo() *mockDPRepo {
	return &mockDPRepo{
		portals: map[string]*models.DeveloperPortal{},
		docs:    map[string]*models.PortalDocument{},
		rules:   map[string]*models.MockRule{},
		tasks:   map[string]*models.SDKTask{},
		subs:    map[string]*models.Subscription{},
	}
}

func (m *mockDPRepo) Create(_ context.Context, p *models.DeveloperPortal) error {
	if m.dbErr != nil {
		return m.dbErr
	}
	if p.ID == "" {
		p.ID = p.TenantID + ":" + p.Name
	}
	m.portals[p.TenantID+":"+p.ID] = p
	return nil
}

func (m *mockDPRepo) GetByID(_ context.Context, tenantID, id string) (*models.DeveloperPortal, error) {
	if m.dbErr != nil {
		return nil, m.dbErr
	}
	p, ok := m.portals[tenantID+":"+id]
	if !ok {
		return nil, sql.ErrNoRows
	}
	return p, nil
}

func (m *mockDPRepo) List(_ context.Context, tenantID string, _limit, _offset int) ([]models.DeveloperPortal, error) {
	if m.dbErr != nil {
		return nil, m.dbErr
	}
	var out []models.DeveloperPortal
	for _, p := range m.portals {
		if p.TenantID == tenantID {
			out = append(out, *p)
		}
	}
	return out, nil
}

func (m *mockDPRepo) Update(_ context.Context, tenantID, id string, updates map[string]any) error {
	p, ok := m.portals[tenantID+":"+id]
	if !ok {
		return sql.ErrNoRows
	}
	if v, ok := updates["name"]; ok {
		p.Name = v.(string)
	}
	return nil
}

func (m *mockDPRepo) Delete(_ context.Context, tenantID, id string) error {
	_, ok := m.portals[tenantID+":"+id]
	if !ok {
		return sql.ErrNoRows
	}
	delete(m.portals, tenantID+":"+id)
	return nil
}

func (m *mockDPRepo) CreateDocument(_ context.Context, doc *models.PortalDocument) error {
	if m.dbErr != nil {
		return m.dbErr
	}
	if doc.ID == "" {
		doc.ID = doc.TenantID + ":" + doc.Title
	}
	m.docs[doc.TenantID+":"+doc.ID] = doc
	return nil
}

func (m *mockDPRepo) GetDocumentByID(_ context.Context, tenantID, id string) (*models.PortalDocument, error) {
	if m.dbErr != nil {
		return nil, m.dbErr
	}
	d, ok := m.docs[tenantID+":"+id]
	if !ok {
		return nil, sql.ErrNoRows
	}
	return d, nil
}

func (m *mockDPRepo) ListDocuments(_ context.Context, tenantID string, _page, _pageSize int) ([]models.PortalDocument, error) {
	var out []models.PortalDocument
	for _, d := range m.docs {
		if d.TenantID == tenantID {
			out = append(out, *d)
		}
	}
	return out, nil
}

func (m *mockDPRepo) SearchDocuments(_ context.Context, tenantID, query string) ([]models.PortalDocument, error) {
	return nil, nil
}

func (m *mockDPRepo) UpdateDocument(_ context.Context, tenantID string, doc *models.PortalDocument) error {
	m.docs[tenantID+":"+doc.ID] = doc
	return nil
}

func (m *mockDPRepo) DeleteDocument(_ context.Context, tenantID, id string) error {
	_, ok := m.docs[tenantID+":"+id]
	if !ok {
		return sql.ErrNoRows
	}
	delete(m.docs, tenantID+":"+id)
	return nil
}

func (m *mockDPRepo) IncrementViews(_ context.Context, tenantID, id string) error {
	return nil
}

func (m *mockDPRepo) CreateDocumentVersion(_ context.Context, v *models.DocumentVersion) error {
	return nil
}

func (m *mockDPRepo) GetDocumentVersions(_ context.Context, documentID string) ([]models.DocumentVersion, error) {
	return nil, nil
}

func (m *mockDPRepo) GetDocumentStats(_ context.Context, tenantID string) (*models.DocumentStats, error) {
	return &models.DocumentStats{}, nil
}

func (m *mockDPRepo) GetCategories(_ context.Context, tenantID string) ([]models.CategoryInfo, error) {
	return nil, nil
}

func (m *mockDPRepo) GetPopularDocuments(_ context.Context, tenantID string) ([]models.PortalDocument, error) {
	return nil, nil
}

func (m *mockDPRepo) RecordHelpful(_ context.Context, tenantID, id string, helpful bool) (*models.PortalDocument, error) {
	return nil, nil
}

func (m *mockDPRepo) CreateMockRule(_ context.Context, rule *models.MockRule) error {
	if m.dbErr != nil {
		return m.dbErr
	}
	if rule.ID == "" {
		rule.ID = rule.TenantID + ":" + rule.Name
	}
	m.rules[rule.TenantID+":"+rule.ID] = rule
	return nil
}

func (m *mockDPRepo) GetMockRuleByID(_ context.Context, tenantID, id string) (*models.MockRule, error) {
	if m.dbErr != nil {
		return nil, m.dbErr
	}
	r, ok := m.rules[tenantID+":"+id]
	if !ok {
		return nil, sql.ErrNoRows
	}
	return r, nil
}

func (m *mockDPRepo) ListMockRules(_ context.Context, tenantID string, _filter models.MockRuleFilter) ([]models.MockRule, int, error) {
	var out []models.MockRule
	for _, r := range m.rules {
		if r.TenantID == tenantID {
			out = append(out, *r)
		}
	}
	return out, len(out), nil
}

func (m *mockDPRepo) GetMockRuleStats(_ context.Context, tenantID string) (*models.MockRuleStats, error) {
	return &models.MockRuleStats{}, nil
}

func (m *mockDPRepo) UpdateMockRule(_ context.Context, tenantID string, rule *models.MockRule) error {
	m.rules[tenantID+":"+rule.ID] = rule
	return nil
}

func (m *mockDPRepo) DeleteMockRule(_ context.Context, tenantID, id string) error {
	_, ok := m.rules[tenantID+":"+id]
	if !ok {
		return sql.ErrNoRows
	}
	delete(m.rules, tenantID+":"+id)
	return nil
}

func (m *mockDPRepo) CreateSDKTask(_ context.Context, task *models.SDKTask) error {
	if task.ID == "" {
		task.ID = task.TenantID + ":" + task.Name
	}
	m.tasks[task.TenantID+":"+task.ID] = task
	return nil
}

func (m *mockDPRepo) GetSDKTaskByID(_ context.Context, tenantID, id string) (*models.SDKTask, error) {
	t, ok := m.tasks[tenantID+":"+id]
	if !ok {
		return nil, sql.ErrNoRows
	}
	return t, nil
}

func (m *mockDPRepo) ListSDKTasks(_ context.Context, tenantID string, _filter models.SDKTaskFilter) ([]models.SDKTask, int, error) {
	var out []models.SDKTask
	for _, t := range m.tasks {
		if t.TenantID == tenantID {
			out = append(out, *t)
		}
	}
	return out, len(out), nil
}

func (m *mockDPRepo) GetSDKTaskStats(_ context.Context, tenantID string) (*models.SDKTaskStats, error) {
	return &models.SDKTaskStats{}, nil
}

func (m *mockDPRepo) UpdateSDKTask(_ context.Context, tenantID string, task *models.SDKTask) error {
	m.tasks[tenantID+":"+task.ID] = task
	return nil
}

func (m *mockDPRepo) DeleteSDKTask(_ context.Context, tenantID, id string) error {
	_, ok := m.tasks[tenantID+":"+id]
	if !ok {
		return sql.ErrNoRows
	}
	delete(m.tasks, tenantID+":"+id)
	return nil
}

func (m *mockDPRepo) CreateSubscription(_ context.Context, sub *models.Subscription) error {
	if sub.ID == "" {
		sub.ID = sub.TenantID + ":" + sub.UserID + ":" + sub.APIName
	}
	m.subs[sub.TenantID+":"+sub.ID] = sub
	return nil
}

func (m *mockDPRepo) GetSubscriptionByID(_ context.Context, tenantID, id string) (*models.Subscription, error) {
	s, ok := m.subs[tenantID+":"+id]
	if !ok {
		return nil, sql.ErrNoRows
	}
	return s, nil
}

func (m *mockDPRepo) GetSubscriptionByUserAndAPI(_ context.Context, tenantID, userID, apiName string) (*models.Subscription, error) {
	for _, s := range m.subs {
		if s.TenantID == tenantID && s.UserID == userID && s.APIName == apiName {
			return s, nil
		}
	}
	return nil, sql.ErrNoRows
}

func (m *mockDPRepo) ListSubscriptions(_ context.Context, tenantID string, _filter models.SubscriptionFilter) ([]models.Subscription, int, error) {
	var out []models.Subscription
	for _, s := range m.subs {
		if s.TenantID == tenantID {
			out = append(out, *s)
		}
	}
	return out, len(out), nil
}

func (m *mockDPRepo) GetSubscriptionStats(_ context.Context, tenantID string) (*models.SubscriptionStats, error) {
	return &models.SubscriptionStats{}, nil
}

func (m *mockDPRepo) UpdateSubscription(_ context.Context, tenantID string, sub *models.Subscription) error {
	m.subs[tenantID+":"+sub.ID] = sub
	return nil
}

func (m *mockDPRepo) GetUsageRecords(_ context.Context, tenantID, subscriptionID string, _filter models.UsageRecordFilter) ([]models.UsageRecord, int, error) {
	return nil, 0, nil
}

func (m *mockDPRepo) CreatePlaygroundRequest(_ context.Context, preq *models.PlaygroundRequest) error {
	return nil
}

func (m *mockDPRepo) GetPlaygroundRequestByID(_ context.Context, tenantID, id string) (*models.PlaygroundRequest, error) {
	return nil, nil
}

func (m *mockDPRepo) ListPlaygroundRequests(_ context.Context, tenantID, userID string, _filter models.PlaygroundRequestFilter) ([]models.PlaygroundRequest, int, error) {
	return nil, 0, nil
}

func (m *mockDPRepo) GetPlaygroundStats(_ context.Context, tenantID, userID string) (*models.PlaygroundStats, error) {
	return &models.PlaygroundStats{}, nil
}

func (m *mockDPRepo) UpdatePlaygroundRequest(_ context.Context, tenantID string, preq *models.PlaygroundRequest) error {
	return nil
}

func (m *mockDPRepo) DeletePlaygroundRequest(_ context.Context, tenantID, id string) error {
	return nil
}

func (m *mockDPRepo) GetResponseHistory(_ context.Context, tenantID, requestID string, _filter models.UsageRecordFilter) ([]models.ResponseHistoryEntry, int, error) {
	return nil, 0, nil
}

func (m *mockDPRepo) ClearHistory(_ context.Context, tenantID, requestID string) error {
	return nil
}

func newTestDPService(repo *mockDPRepo) *Service {
	return &Service{repo: repo}
}

func setupPortal(repo *mockDPRepo, tenantID, id string) *models.DeveloperPortal {
	p := &models.DeveloperPortal{ID: id, TenantID: tenantID, Name: "test-portal"}
	repo.portals[tenantID+":"+id] = p
	return p
}

func TestCreateDeveloperPortal_Success(t *testing.T) {
	ctx := context.Background()
	repo := newMockDPRepo()
	svc := newTestDPService(repo)

	p, err := svc.Create(ctx, "t1", models.CreateDeveloperPortalRequest{Name: "new-portal"})
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if p.Name != "new-portal" {
		t.Errorf("expected 'new-portal', got %s", p.Name)
	}
}

func TestGetDeveloperPortal_Success(t *testing.T) {
	ctx := context.Background()
	repo := newMockDPRepo()
	setupPortal(repo, "t1", "p1")
	svc := newTestDPService(repo)

	p, err := svc.Get(ctx, "t1", "p1")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if p.Name != "test-portal" {
		t.Errorf("expected 'test-portal', got %s", p.Name)
	}
}

func TestGetDeveloperPortal_NotFound(t *testing.T) {
	ctx := context.Background()
	repo := newMockDPRepo()
	svc := newTestDPService(repo)

	_, err := svc.Get(ctx, "t1", "nonexist")
	if !errors.Is(err, sql.ErrNoRows) {
		t.Errorf("expected sql.ErrNoRows, got %v", err)
	}
}

func TestUpdateDeveloperPortal_Success(t *testing.T) {
	ctx := context.Background()
	repo := newMockDPRepo()
	setupPortal(repo, "t1", "p1")
	svc := newTestDPService(repo)

	name := "updated-portal"
	_, err := svc.Update(ctx, "t1", "p1", models.UpdateDeveloperPortalRequest{Name: &name})
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	p, _ := repo.GetByID(ctx, "t1", "p1")
	if p.Name != "updated-portal" {
		t.Errorf("expected 'updated-portal', got %s", p.Name)
	}
}

func TestDeleteDeveloperPortal_Success(t *testing.T) {
	ctx := context.Background()
	repo := newMockDPRepo()
	setupPortal(repo, "t1", "p1")
	svc := newTestDPService(repo)

	err := svc.Delete(ctx, "t1", "p1")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	_, err = repo.GetByID(ctx, "t1", "p1")
	if !errors.Is(err, sql.ErrNoRows) {
		t.Error("expected portal deleted")
	}
}

func TestCreateDocument_Success(t *testing.T) {
	ctx := context.Background()
	repo := newMockDPRepo()
	svc := newTestDPService(repo)

	d, err := svc.CreateDocument(ctx, "t1", "u1", models.CreateDocumentRequest{
		Title:    "doc1",
		Category: "guide",
		Content:  "content",
	})
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if d.Title != "doc1" {
		t.Errorf("expected 'doc1', got %s", d.Title)
	}
	if d.Status != "draft" {
		t.Errorf("expected status 'draft', got %s", d.Status)
	}
	if d.Version != "1.0" {
		t.Errorf("expected version '1.0', got %s", d.Version)
	}
}

func TestGetDocument_Success(t *testing.T) {
	ctx := context.Background()
	repo := newMockDPRepo()
	repo.docs["t1:doc1"] = &models.PortalDocument{ID: "doc1", TenantID: "t1", Title: "test-doc"}
	svc := newTestDPService(repo)

	d, err := svc.GetDocument(ctx, "t1", "doc1")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if d.Title != "test-doc" {
		t.Errorf("expected 'test-doc', got %s", d.Title)
	}
}

func TestCreateMockRule_Success(t *testing.T) {
	ctx := context.Background()
	repo := newMockDPRepo()
	svc := newTestDPService(repo)

	r, err := svc.CreateMockRule(ctx, "t1", models.CreateMockRuleRequest{
		Name:   "mock1",
		Method: "GET",
		Path:   "/api/v1/test",
	})
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if r.Name != "mock1" {
		t.Errorf("expected 'mock1', got %s", r.Name)
	}
}

func TestListSDKTasks_Success(t *testing.T) {
	ctx := context.Background()
	repo := newMockDPRepo()
	repo.tasks["t1:task1"] = &models.SDKTask{ID: "task1", TenantID: "t1", Name: "sdk-task", Language: "go", Status: "completed"}
	svc := newTestDPService(repo)

	result, err := svc.ListSDKTasks(ctx, "t1", models.SDKTaskFilter{})
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if result.Total != 1 {
		t.Errorf("expected total 1, got %d", result.Total)
	}
}

func TestCreateSubscription_Success(t *testing.T) {
	ctx := context.Background()
	repo := newMockDPRepo()
	svc := newTestDPService(repo)

	sub, err := svc.CreateSubscription(ctx, "t1", "u1", models.CreateSubscriptionRequest{
		APIName:  "api1",
		PlanName: "free",
	})
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if sub.UserID != "u1" {
		t.Errorf("expected userID 'u1', got %s", sub.UserID)
	}
	if sub.Status != "pending" {
		t.Errorf("expected status 'pending', got %s", sub.Status)
	}
}

func TestApproveSubscription_Success(t *testing.T) {
	ctx := context.Background()
	repo := newMockDPRepo()
	repo.subs["t1:t1:u1:api1"] = &models.Subscription{ID: "t1:u1:api1", TenantID: "t1", UserID: "u1", APIName: "api1", Status: "pending"}
	svc := newTestDPService(repo)

	sub, err := svc.ApproveSubscription(ctx, "t1", "t1:u1:api1", "admin")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if sub.Status != "approved" {
		t.Errorf("expected status 'approved', got %s", sub.Status)
	}
}

func TestGetUsageStats_Success(t *testing.T) {
	ctx := context.Background()
	repo := newMockDPRepo()
	svc := newTestDPService(repo)

	stats, err := svc.GetUsageStats(ctx, "t1")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if stats == nil {
		t.Error("expected non-nil stats")
	}
}
