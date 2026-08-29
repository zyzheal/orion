package service

import (
	"context"
	"errors"
	"testing"

	"orion/platform-svc-go/internal/config/models"
	"orion/platform-svc-go/internal/config/repository"
)

// mockConfigRepo implements RepositoryInterface for testing.
type mockConfigRepo struct {
	configs        map[string]*models.Config
	templates      map[string]*models.ConfigTemplate
	canaries       map[string]*models.CanaryDeployment
	changeRequests map[string]*models.ChangeRequest
	gitOpsConfigs  map[string]*models.GitOpsConfig
	webhooks       map[string]*models.ConfigWebhook
	snapshots      map[string]*models.ConfigSnapshot
	versions       map[string][]models.ConfigVersion
	auditEntries   map[string][]models.AuditEntry
	err            error
	createErr      error
	updateErr      error
	deleteErr      error
}

func newMockConfigRepo() *mockConfigRepo {
	return &mockConfigRepo{
		configs:        make(map[string]*models.Config),
		templates:      make(map[string]*models.ConfigTemplate),
		canaries:       make(map[string]*models.CanaryDeployment),
		changeRequests: make(map[string]*models.ChangeRequest),
		gitOpsConfigs:  make(map[string]*models.GitOpsConfig),
		webhooks:       make(map[string]*models.ConfigWebhook),
		snapshots:      make(map[string]*models.ConfigSnapshot),
		versions:       make(map[string][]models.ConfigVersion),
		auditEntries:   make(map[string][]models.AuditEntry),
	}
}

func (m *mockConfigRepo) Create(_ context.Context, c *models.Config) error {
	if m.createErr != nil {
		return m.createErr
	}
	if c.ID == "" {
		c.ID = "cfg-1"
	}
	m.configs[c.ID] = c
	return nil
}

func (m *mockConfigRepo) GetByID(_ context.Context, _, id string) (*models.Config, error) {
	if m.err != nil {
		return nil, m.err
	}
	c, ok := m.configs[id]
	if !ok {
		return nil, errors.New("not found")
	}
	return c, nil
}

func (m *mockConfigRepo) GetTemplate(_ context.Context, _, id string) (*models.ConfigTemplate, error) {
	if m.err != nil {
		return nil, m.err
	}
	t, ok := m.templates[id]
	if !ok {
		return nil, errors.New("not found")
	}
	return t, nil
}

func (m *mockConfigRepo) CreateTemplate(_ context.Context, t *models.ConfigTemplate) error {
	if m.createErr != nil {
		return m.createErr
	}
	if t.ID == "" {
		t.ID = "tmpl-1"
	}
	m.templates[t.ID] = t
	return nil
}

func (m *mockConfigRepo) UpdateTemplate(_ context.Context, _ string, t *models.ConfigTemplate) error {
	return m.updateErr
}

func (m *mockConfigRepo) DeleteTemplate(_ context.Context, _, _ string) error {
	return m.deleteErr
}

func (m *mockConfigRepo) CreateTemplateVersion(_ context.Context, v *models.ConfigTemplateVersion) error {
	if v.ID == "" {
		v.ID = "ver-1"
	}
	return nil
}

func (m *mockConfigRepo) ListTemplateVersions(_ context.Context, tid string) ([]models.ConfigTemplateVersion, error) {
	return nil, nil
}

func (m *mockConfigRepo) ListTemplates(_ context.Context, _ string) ([]models.ConfigTemplate, error) {
	result := make([]models.ConfigTemplate, 0, len(m.templates))
	for _, t := range m.templates {
		result = append(result, *t)
	}
	return result, nil
}

func (m *mockConfigRepo) GetCanary(_ context.Context, _, id string) (*models.CanaryDeployment, error) {
	c, ok := m.canaries[id]
	if !ok {
		return nil, errors.New("not found")
	}
	return c, nil
}

func (m *mockConfigRepo) CreateCanary(_ context.Context, c *models.CanaryDeployment) error {
	if m.createErr != nil {
		return m.createErr
	}
	if c.ID == "" {
		c.ID = "canary-1"
	}
	m.canaries[c.ID] = c
	return nil
}

func (m *mockConfigRepo) UpdateCanaryStatus(_ context.Context, _, id, status string) error {
	if c, ok := m.canaries[id]; ok {
		c.Status = status
	}
	return nil
}

func (m *mockConfigRepo) CreateChangeRequest(_ context.Context, cr *models.ChangeRequest) error {
	if cr.ID == "" {
		cr.ID = "cr-1"
	}
	m.changeRequests[cr.ID] = cr
	return nil
}

func (m *mockConfigRepo) GetChangeRequest(_ context.Context, _, id string) (*models.ChangeRequest, error) {
	cr, ok := m.changeRequests[id]
	if !ok {
		return nil, errors.New("not found")
	}
	return cr, nil
}

func (m *mockConfigRepo) UpdateChangeRequestStatus(_ context.Context, _, id, status, _, _ string) error {
	if cr, ok := m.changeRequests[id]; ok {
		cr.Status = status
	}
	return nil
}

func (m *mockConfigRepo) ListChangeRequests(_ context.Context, _ string, status string, _, _ int) ([]models.ChangeRequest, int, error) {
	result := make([]models.ChangeRequest, 0)
	total := 0
	for _, cr := range m.changeRequests {
		if status == "" || cr.Status == status {
			result = append(result, *cr)
			total++
		}
	}
	return result, total, nil
}

func (m *mockConfigRepo) CreateWebhook(_ context.Context, w *models.ConfigWebhook) error {
	if m.createErr != nil {
		return m.createErr
	}
	if w.ID == "" {
		w.ID = "wh-1"
	}
	m.webhooks[w.ID] = w
	return nil
}

func (m *mockConfigRepo) GetWebhook(_ context.Context, _, id string) (*models.ConfigWebhook, error) {
	w, ok := m.webhooks[id]
	if !ok {
		return nil, errors.New("not found")
	}
	return w, nil
}

func (m *mockConfigRepo) UpdateWebhook(_ context.Context, _ string, w *models.ConfigWebhook) error {
	return m.updateErr
}

func (m *mockConfigRepo) DeleteWebhook(_ context.Context, _, _ string) error {
	return m.deleteErr
}

func (m *mockConfigRepo) ListWebhooks(_ context.Context, _ string) ([]models.ConfigWebhook, error) {
	result := make([]models.ConfigWebhook, 0, len(m.webhooks))
	for _, w := range m.webhooks {
		result = append(result, *w)
	}
	return result, nil
}

func (m *mockConfigRepo) CreateSnapshot(_ context.Context, s *models.ConfigSnapshot) error {
	if s.ID == "" {
		s.ID = "snap-1"
	}
	m.snapshots[s.ID] = s
	return nil
}

func (m *mockConfigRepo) GetSnapshot(_ context.Context, _, id string) (*models.ConfigSnapshot, error) {
	s, ok := m.snapshots[id]
	if !ok {
		return nil, errors.New("not found")
	}
	return s, nil
}

func (m *mockConfigRepo) ListSnapshots(_ context.Context, _, _ string) ([]models.ConfigSnapshot, error) {
	return nil, nil
}

func (m *mockConfigRepo) DeleteSnapshot(_ context.Context, _, _ string) error {
	return m.deleteErr
}

func (m *mockConfigRepo) GetVersions(_ context.Context, configID string) ([]models.ConfigVersion, error) {
	return m.versions[configID], nil
}

func (m *mockConfigRepo) GetVersion(_ context.Context, _, version string) (*models.ConfigVersion, error) {
	return &models.ConfigVersion{Version: version, Value: "restored-value"}, nil
}

func (m *mockConfigRepo) Update(_ context.Context, _, id string, updates map[string]any) error {
	if c, ok := m.configs[id]; ok {
		if v, ok := updates["value"]; ok {
			c.Value = v.(string)
		}
		if e, ok := updates["environment"]; ok {
			c.Environment = e.(string)
		}
	}
	return nil
}

func (m *mockConfigRepo) SoftDelete(_ context.Context, _, _ string) error {
	return m.deleteErr
}

func (m *mockConfigRepo) CreateAuditEntry(_ context.Context, a *models.AuditEntry) error {
	if a.ConfigID == "" {
		return nil
	}
	m.auditEntries[a.ConfigID] = append(m.auditEntries[a.ConfigID], *a)
	return nil
}

func (m *mockConfigRepo) GetAuditTrail(_ context.Context, configID string, _ int) ([]models.AuditEntry, error) {
	return m.auditEntries[configID], nil
}

func (m *mockConfigRepo) List(_ context.Context, tenantID string, filter repository.ConfigFilter) ([]models.Config, int, error) {
	result := make([]models.Config, 0)
	total := 0
	for _, c := range m.configs {
		if c.TenantID == tenantID {
			if filter.Environment != "" && c.Environment != filter.Environment {
				continue
			}
			if filter.Status != "" && c.Status != filter.Status {
				continue
			}
			result = append(result, *c)
			total++
		}
	}
	return result, total, nil
}

func (m *mockConfigRepo) CreateGitOps(_ context.Context, g *models.GitOpsConfig) error {
	if g.ID == "" {
		g.ID = "gitops-1"
	}
	m.gitOpsConfigs[g.ID] = g
	return nil
}

func (m *mockConfigRepo) GetGitOpsConfig(_ context.Context, _, id string) (*models.GitOpsConfig, error) {
	g, ok := m.gitOpsConfigs[id]
	if !ok {
		return nil, errors.New("not found")
	}
	return g, nil
}

func (m *mockConfigRepo) ListGitOpsConfigs(_ context.Context, _ string) ([]models.GitOpsConfig, error) {
	result := make([]models.GitOpsConfig, 0, len(m.gitOpsConfigs))
	for _, g := range m.gitOpsConfigs {
		result = append(result, *g)
	}
	return result, nil
}

func (m *mockConfigRepo) UpdateGitOpsStatus(_ context.Context, _, id, status string) error {
	if g, ok := m.gitOpsConfigs[id]; ok {
		g.Status = status
	}
	return nil
}

func (m *mockConfigRepo) RecordSyncStatus(_ context.Context, s *models.GitOpsSyncStatus) error {
	if s.ID == "" {
		s.ID = "sync-1"
	}
	return nil
}

func (m *mockConfigRepo) GetSyncStatus(_ context.Context, _ string, _ int) ([]models.GitOpsSyncStatus, error) {
	return nil, nil
}

func (m *mockConfigRepo) ListGitOpsConfigs_(_ context.Context, _ string) ([]models.GitOpsConfig, error) {
	return m.ListGitOpsConfigs(context.Background(), "")
}

func Test_NewService_NilRepo(t *testing.T) {
	svc := NewService(nil)
	if svc == nil {
		t.Fatal("expected non-nil service")
	}
	if svc.repo != nil {
		t.Fatal("expected nil repo")
	}
}

func Test_NewService_WithRepo(t *testing.T) {
	repo := newMockConfigRepo()
	svc := NewService(repo)
	if svc == nil {
		t.Fatal("expected non-nil service")
	}
}

func Test_Create_DefaultDataTypeString(t *testing.T) {
	repo := newMockConfigRepo()
	svc := NewService(repo)
	ctx := context.Background()

	req := models.CreateConfigRequest{
		Name:  "test-config",
		Key:   "test.key",
		Value: "test-value",
		// DataType intentionally empty to test default
	}

	c, err := svc.Create(ctx, "tenant-1", "user-1", req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if c == nil {
		t.Fatal("expected non-nil config")
	}
	if c.Name != "test-config" {
		t.Fatalf("expected 'test-config', got '%s'", c.Name)
	}
	if c.DataType != "string" {
		t.Fatalf("expected default datatype 'string', got '%s'", c.DataType)
	}
	if c.Status != "active" {
		t.Fatalf("expected default status 'active', got '%s'", c.Status)
	}
	if c.TenantID != "tenant-1" {
		t.Fatalf("expected tenant 'tenant-1', got '%s'", c.TenantID)
	}
	if c.CreatedBy != "user-1" {
		t.Fatalf("expected created_by 'user-1', got '%s'", c.CreatedBy)
	}
}

func Test_Create_CustomDataType(t *testing.T) {
	repo := newMockConfigRepo()
	svc := NewService(repo)
	ctx := context.Background()

	req := models.CreateConfigRequest{
		Name:     "json-config",
		Key:      "app.config",
		Value:    `{"key":"val"}`,
		DataType: "json",
	}

	c, err := svc.Create(ctx, "tenant-1", "user-1", req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if c.DataType != "json" {
		t.Fatalf("expected datatype 'json', got '%s'", c.DataType)
	}
}

func Test_Get_NotFound(t *testing.T) {
	repo := newMockConfigRepo()
	svc := NewService(repo)
	ctx := context.Background()

	_, err := svc.Get(ctx, "tenant-1", "nonexistent")
	if err == nil {
		t.Fatal("expected error for not found config")
	}
}

func Test_Delete_NilRepo(t *testing.T) {
	svc := NewService(nil)
	defer func() {
		if r := recover(); r != nil {
			t.Log("Delete with nil repo panicked as expected")
		}
	}()
	svc.Delete(context.Background(), "tenant-1", "cfg-1")
}

func Test_EnableGitOps_DefaultBranchAndPath(t *testing.T) {
	repo := newMockConfigRepo()
	svc := NewService(repo)
	ctx := context.Background()

	req := models.CreateGitOpsRequest{
		RepositoryURL: "https://github.com/org/repo.git",
		// Branch and Path intentionally empty to test defaults
	}

	g, err := svc.EnableGitOps(ctx, "tenant-1", req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if g == nil {
		t.Fatal("expected non-nil gitops config")
	}
	if g.Branch != "main" {
		t.Fatalf("expected default branch 'main', got '%s'", g.Branch)
	}
	if g.Path != "/configs" {
		t.Fatalf("expected default path '/configs', got '%s'", g.Path)
	}
	if g.RepositoryURL != "https://github.com/org/repo.git" {
		t.Fatalf("expected repo URL, got '%s'", g.RepositoryURL)
	}
}

func Test_EnableGitOps_CustomBranchAndPath(t *testing.T) {
	repo := newMockConfigRepo()
	svc := NewService(repo)
	ctx := context.Background()

	req := models.CreateGitOpsRequest{
		RepositoryURL: "https://github.com/org/repo.git",
		Branch:        "develop",
		Path:          "/configs/dev",
	}

	g, err := svc.EnableGitOps(ctx, "tenant-1", req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if g.Branch != "develop" {
		t.Fatalf("expected branch 'develop', got '%s'", g.Branch)
	}
	if g.Path != "/configs/dev" {
		t.Fatalf("expected path '/configs/dev', got '%s'", g.Path)
	}
}

func Test_CreateCanary_DefaultTrafficPercent(t *testing.T) {
	repo := newMockConfigRepo()
	svc := NewService(repo)
	ctx := context.Background()

	req := models.CreateCanaryRequest{
		ConfigID:       "cfg-1",
		TrafficPercent: 0, // 0 should default to 10
	}

	c, err := svc.CreateCanary(ctx, "tenant-1", "user-1", req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if c == nil {
		t.Fatal("expected non-nil canary")
	}
	if c.TrafficPercent != 10 {
		t.Fatalf("expected default traffic percent 10, got %d", c.TrafficPercent)
	}
}

func Test_CreateCanary_CustomTrafficPercent(t *testing.T) {
	repo := newMockConfigRepo()
	svc := NewService(repo)
	ctx := context.Background()

	req := models.CreateCanaryRequest{
		ConfigID:       "cfg-1",
		TrafficPercent: 25,
	}

	c, err := svc.CreateCanary(ctx, "tenant-1", "user-1", req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if c.TrafficPercent != 25 {
		t.Fatalf("expected traffic percent 25, got %d", c.TrafficPercent)
	}
}

func Test_CreateWebhook_DefaultEnabled(t *testing.T) {
	repo := newMockConfigRepo()
	svc := NewService(repo)
	ctx := context.Background()

	req := models.CreateWebhookRequest{
		Name:   "my-webhook",
		URL:    "http://example.com/hook",
		Secret: "secret123",
		Events: []string{"create", "update"},
		// Enabled intentionally nil to test default true
	}

	w, err := svc.CreateWebhook(ctx, "tenant-1", "user-1", req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if w == nil {
		t.Fatal("expected non-nil webhook")
	}
	if !w.Enabled {
		t.Fatal("expected enabled=true by default")
	}
	if w.Secret != "secret123" {
		t.Fatalf("expected secret 'secret123', got '%s'", w.Secret)
	}
}

func Test_CreateWebhook_CustomEnabled(t *testing.T) {
	repo := newMockConfigRepo()
	svc := NewService(repo)
	ctx := context.Background()

	disabled := false
	req := models.CreateWebhookRequest{
		Name:    "my-webhook",
		URL:     "http://example.com/hook",
		Enabled: &disabled,
	}

	w, err := svc.CreateWebhook(ctx, "tenant-1", "user-1", req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if w.Enabled {
		t.Fatal("expected enabled=false")
	}
}

func Test_CreateTemplateVersion(t *testing.T) {
	repo := newMockConfigRepo()
	repo.templates["tmpl-1"] = &models.ConfigTemplate{
		ID:       "tmpl-1",
		TenantID: "tenant-1",
		Name:     "test-template",
		Schema:   map[string]any{"field": "string"},
	}
	svc := NewService(repo)
	ctx := context.Background()

	v, err := svc.CreateTemplateVersion(ctx, "tenant-1", "tmpl-1", "user-1", "1.0.0")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if v == nil {
		t.Fatal("expected non-nil template version")
	}
	if v.TemplateID != "tmpl-1" {
		t.Fatalf("expected templateID 'tmpl-1', got '%s'", v.TemplateID)
	}
	if v.Version != "1.0.0" {
		t.Fatalf("expected version '1.0.0', got '%s'", v.Version)
	}
}

func Test_DetectDrift_Empty(t *testing.T) {
	repo := newMockConfigRepo()
	svc := NewService(repo)
	ctx := context.Background()

	result, err := svc.DetectDrift(ctx, "tenant-1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result == nil {
		t.Fatal("expected non-nil result")
	}
}

func Test_CompareEnvironments(t *testing.T) {
	repo := newMockConfigRepo()
	svc := NewService(repo)
	ctx := context.Background()

	result, err := svc.CompareEnvironments(ctx, "tenant-1", "dev", "prod")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result == nil {
		t.Fatal("expected non-nil result")
	}
	if result.SourceEnv != "dev" {
		t.Fatalf("expected source env 'dev', got '%s'", result.SourceEnv)
	}
	if result.TargetEnv != "prod" {
		t.Fatalf("expected target env 'prod', got '%s'", result.TargetEnv)
	}
}

func Test_CreateChangeRequest(t *testing.T) {
	repo := newMockConfigRepo()
	svc := NewService(repo)
	ctx := context.Background()

	req := models.CreateChangeRequestRequest{
		ConfigID:    "cfg-1",
		Description: "Updating configuration for Q3",
	}

	cr, err := svc.CreateChangeRequest(ctx, "tenant-1", "user-1", req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cr == nil {
		t.Fatal("expected non-nil change request")
	}
	if cr.RequestedBy != "user-1" {
		t.Fatalf("expected requested_by 'user-1', got '%s'", cr.RequestedBy)
	}
	if cr.ConfigID != "cfg-1" {
		t.Fatalf("expected configID 'cfg-1', got '%s'", cr.ConfigID)
	}
}

func Test_CreateSnapshot_WithConfig(t *testing.T) {
	repo := newMockConfigRepo()
	repo.configs["cfg-1"] = &models.Config{
		ID:       "cfg-1",
		TenantID: "tenant-1",
		Name:     "test-config",
		Value:    "v1",
	}
	svc := NewService(repo)
	ctx := context.Background()

	snap, err := svc.CreateSnapshot(ctx, "tenant-1", "cfg-1", "user-1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if snap == nil {
		t.Fatal("expected non-nil snapshot")
	}
	if snap.ConfigID != "cfg-1" {
		t.Fatalf("expected configID 'cfg-1', got '%s'", snap.ConfigID)
	}
}

func Test_Service_getTime_NonZero(t *testing.T) {
	svc := NewService(nil)
	t2 := svc.getTime()
	if t2.IsZero() {
		t.Fatal("expected non-zero time")
	}
	if t2 != t2.UTC() {
		t.Fatal("expected UTC time")
	}
}

func Test_ConfigFilter_FieldMapping(t *testing.T) {
	repo := newMockConfigRepo()
	repo.configs["cfg-1"] = &models.Config{
		ID:          "cfg-1",
		TenantID:    "tenant-1",
		Name:        "prod-config",
		Value:       "val",
		Environment: "production",
		Status:      "active",
	}
	repo.configs["cfg-2"] = &models.Config{
		ID:          "cfg-2",
		TenantID:    "tenant-1",
		Name:        "dev-config",
		Value:       "val",
		Environment: "development",
		Status:      "archived",
	}
	svc := NewService(repo)
	ctx := context.Background()

	// Filter by environment=production
	filter := models.ConfigFilter{Environment: "production"}
	result, err := svc.List(ctx, "tenant-1", filter)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result == nil {
		t.Fatal("expected non-nil list result")
	}
	if result.Total != 1 {
		t.Fatalf("expected 1 result for production filter, got %d", result.Total)
	}
}
