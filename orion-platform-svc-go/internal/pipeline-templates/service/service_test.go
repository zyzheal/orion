package service

import (
	"context"
	"errors"
	"testing"

	"orion/platform-svc-go/internal/pipeline-templates/models"
)

// --- mock repository ---

type mockRepo struct {
	createFn                func(ctx context.Context, m *models.PipelineTemplate) error
	getByIDFn               func(ctx context.Context, tenantID, id string) (*models.PipelineTemplate, error)
	listFn                  func(ctx context.Context, tenantID string, q *models.ListQuery) ([]models.PipelineTemplate, int, error)
	updateFn                func(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.PipelineTemplate, error)
	deleteFn                func(ctx context.Context, tenantID, id string) error
	setStatusFn             func(ctx context.Context, tenantID, id string, status models.TemplateStatus, publishedAt *int64) (*models.PipelineTemplate, error)
	createVersionFn         func(ctx context.Context, v *models.TemplateVersion) error
	listVersionsFn          func(ctx context.Context, tenantID, templateID string, q *models.ListQuery) ([]models.TemplateVersion, int, error)
	deleteVersionsByTIDFn   func(ctx context.Context, templateID string) error
	incrementUsageCountFn   func(ctx context.Context, tenantID, id string) error
	incrementStarCountFn    func(ctx context.Context, tenantID, id string) error
	decrementStarCountFn    func(ctx context.Context, tenantID, id string) error
	categoryCountsFn        func(ctx context.Context, tenantID string) (map[string]int, error)
}

func (m *mockRepo) Create(ctx context.Context, mt *models.PipelineTemplate) error {
	if m.createFn != nil {
		return m.createFn(ctx, mt)
	}
	return nil
}

func (m *mockRepo) GetByID(ctx context.Context, tenantID, id string) (*models.PipelineTemplate, error) {
	if m.getByIDFn != nil {
		return m.getByIDFn(ctx, tenantID, id)
	}
	return nil, errors.New("not implemented")
}

func (m *mockRepo) List(ctx context.Context, tenantID string, q *models.ListQuery) ([]models.PipelineTemplate, int, error) {
	if m.listFn != nil {
		return m.listFn(ctx, tenantID, q)
	}
	return nil, 0, errors.New("not implemented")
}

func (m *mockRepo) Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.PipelineTemplate, error) {
	if m.updateFn != nil {
		return m.updateFn(ctx, tenantID, id, updates)
	}
	return nil, errors.New("not implemented")
}

func (m *mockRepo) Delete(ctx context.Context, tenantID, id string) error {
	if m.deleteFn != nil {
		return m.deleteFn(ctx, tenantID, id)
	}
	return nil
}

func (m *mockRepo) SetStatus(ctx context.Context, tenantID, id string, status models.TemplateStatus, publishedAt *int64) (*models.PipelineTemplate, error) {
	if m.setStatusFn != nil {
		return m.setStatusFn(ctx, tenantID, id, status, publishedAt)
	}
	return nil, errors.New("not implemented")
}

func (m *mockRepo) CreateVersion(ctx context.Context, v *models.TemplateVersion) error {
	if m.createVersionFn != nil {
		return m.createVersionFn(ctx, v)
	}
	return nil
}

func (m *mockRepo) ListVersions(ctx context.Context, tenantID, templateID string, q *models.ListQuery) ([]models.TemplateVersion, int, error) {
	if m.listVersionsFn != nil {
		return m.listVersionsFn(ctx, tenantID, templateID, q)
	}
	return nil, 0, errors.New("not implemented")
}

func (m *mockRepo) DeleteVersionsByTemplateID(ctx context.Context, templateID string) error {
	if m.deleteVersionsByTIDFn != nil {
		return m.deleteVersionsByTIDFn(ctx, templateID)
	}
	return nil
}

func (m *mockRepo) IncrementUsageCount(ctx context.Context, tenantID, id string) error {
	if m.incrementUsageCountFn != nil {
		return m.incrementUsageCountFn(ctx, tenantID, id)
	}
	return nil
}

func (m *mockRepo) IncrementStarCount(ctx context.Context, tenantID, id string) error {
	if m.incrementStarCountFn != nil {
		return m.incrementStarCountFn(ctx, tenantID, id)
	}
	return nil
}

func (m *mockRepo) DecrementStarCount(ctx context.Context, tenantID, id string) error {
	if m.decrementStarCountFn != nil {
		return m.decrementStarCountFn(ctx, tenantID, id)
	}
	return nil
}

func (m *mockRepo) CategoryCounts(ctx context.Context, tenantID string) (map[string]int, error) {
	if m.categoryCountsFn != nil {
		return m.categoryCountsFn(ctx, tenantID)
	}
	return nil, errors.New("not implemented")
}

// --- test helpers ---

func newTestSvc(repo Repository) *Service {
	return &Service{repo: repo}
}

func ptr(s string) *string { return &s }

// --- Create ---

func TestCreate_Success(t *testing.T) {
	var captured *models.PipelineTemplate
	repo := &mockRepo{
		createFn: func(_ context.Context, m *models.PipelineTemplate) error {
			captured = m
			return nil
		},
	}
	svc := newTestSvc(repo)

	req := models.CreateTemplateRequest{
		Name:        "test-template",
		DisplayName: "Test Template",
		Description: "A test template",
		Category:    models.CategoryCICD,
		Tags:        []string{"ci", "cd"},
		Visibility:  models.VisibilityPublic,
		Config:      map[string]interface{}{"key": "val"},
		Parameters:  []models.TemplateParameter{{Name: "param1", Type: models.ParamTypeString, Required: true}},
		Readme:      ptr("# Readme"),
		Icon:        ptr("icon-url"),
	}

	tmpl, err := svc.Create(context.Background(), "tenant-1", req, "user-1")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if tmpl.Name != "test-template" {
		t.Errorf("expected name test-template, got %s", tmpl.Name)
	}
	if tmpl.Status != models.StatusDraft {
		t.Errorf("expected status draft, got %s", tmpl.Status)
	}
	if tmpl.Version != "1.0.0" {
		t.Errorf("expected version 1.0.0, got %s", tmpl.Version)
	}
	if tmpl.Visibility != models.VisibilityPublic {
		t.Errorf("expected visibility public, got %s", tmpl.Visibility)
	}
	if tmpl.Author != "user-1" {
		t.Errorf("expected author user-1, got %s", tmpl.Author)
	}
	if tmpl.TenantID != "tenant-1" {
		t.Errorf("expected tenant-1, got %s", tmpl.TenantID)
	}

	// Verify captured model was passed to repo
	if captured == nil {
		t.Fatal("expected repo.Create to be called")
	}
	if captured.Name != "test-template" {
		t.Errorf("captured name mismatch")
	}
	if captured.TenantID != "tenant-1" {
		t.Errorf("captured tenant_id mismatch")
	}
}

func TestCreate_DefaultVisibility(t *testing.T) {
	var captured *models.PipelineTemplate
	repo := &mockRepo{
		createFn: func(_ context.Context, m *models.PipelineTemplate) error {
			captured = m
			return nil
		},
	}
	svc := newTestSvc(repo)

	req := models.CreateTemplateRequest{
		Name:        "test",
		DisplayName: "Test",
		Category:    models.CategoryBuild,
		Config:      map[string]interface{}{},
	}

	tmpl, err := svc.Create(context.Background(), "tenant-1", req, "user-1")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if tmpl.Visibility != models.VisibilityPrivate {
		t.Errorf("expected visibility private (default), got %s", tmpl.Visibility)
	}
	if captured.Visibility != models.VisibilityPrivate {
		t.Errorf("captured visibility should be private, got %s", captured.Visibility)
	}
}

func TestCreate_DefaultTagsAndParamsAndConfig(t *testing.T) {
	var captured *models.PipelineTemplate
	repo := &mockRepo{
		createFn: func(_ context.Context, m *models.PipelineTemplate) error {
			captured = m
			return nil
		},
	}
	svc := newTestSvc(repo)

	req := models.CreateTemplateRequest{
		Name:        "test",
		DisplayName: "Test",
		Category:    models.CategoryDeploy,
		Config:      map[string]interface{}{},
	}

	_, err := svc.Create(context.Background(), "tenant-1", req, "user-1")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if captured.Tags != "[]" {
		t.Errorf("expected empty tags array, got %s", captured.Tags)
	}
	if captured.Parameters != "[]" {
		t.Errorf("expected empty parameters array, got %s", captured.Parameters)
	}
	if captured.Config != "{}" {
		t.Errorf("expected empty config object, got %s", captured.Config)
	}
}

func TestCreate_RepoError(t *testing.T) {
	repo := &mockRepo{
		createFn: func(_ context.Context, _ *models.PipelineTemplate) error {
			return errors.New("db error")
		},
	}
	svc := newTestSvc(repo)

	req := models.CreateTemplateRequest{
		Name:        "test",
		DisplayName: "Test",
		Category:    models.CategoryTest,
		Config:      map[string]interface{}{},
	}

	_, err := svc.Create(context.Background(), "tenant-1", req, "user-1")
	if err == nil {
		t.Fatal("expected error, got nil")
	}
}

// --- Get ---

func TestGet_Success(t *testing.T) {
	expected := &models.PipelineTemplate{ID: "tmpl-1", Name: "test", TenantID: "tenant-1"}
	repo := &mockRepo{
		getByIDFn: func(_ context.Context, tenantID, id string) (*models.PipelineTemplate, error) {
			return expected, nil
		},
	}
	svc := newTestSvc(repo)

	tmpl, err := svc.Get(context.Background(), "tenant-1", "tmpl-1")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if tmpl.ID != "tmpl-1" {
		t.Errorf("expected tmpl-1, got %s", tmpl.ID)
	}
}

func TestGet_NotFound(t *testing.T) {
	repo := &mockRepo{
		getByIDFn: func(_ context.Context, _, _ string) (*models.PipelineTemplate, error) {
			return nil, errors.New("template not found")
		},
	}
	svc := newTestSvc(repo)

	_, err := svc.Get(context.Background(), "tenant-1", "nonexistent")
	if err == nil {
		t.Fatal("expected error, got nil")
	}
}

// --- List ---

func TestList_Success(t *testing.T) {
	items := []models.PipelineTemplate{
		{ID: "tmpl-1", Name: "template1"},
		{ID: "tmpl-2", Name: "template2"},
	}
	repo := &mockRepo{
		listFn: func(_ context.Context, tenantID string, q *models.ListQuery) ([]models.PipelineTemplate, int, error) {
			return items, 2, nil
		},
	}
	svc := newTestSvc(repo)

	q := &models.ListQuery{Limit: 20, Offset: 0}
	result, total, err := svc.List(context.Background(), "tenant-1", q)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if total != 2 {
		t.Errorf("expected total 2, got %d", total)
	}
	if len(result) != 2 {
		t.Errorf("expected 2 items, got %d", len(result))
	}
}

func TestList_PassesQuery(t *testing.T) {
	var capturedQ *models.ListQuery
	repo := &mockRepo{
		listFn: func(_ context.Context, _ string, q *models.ListQuery) ([]models.PipelineTemplate, int, error) {
			capturedQ = q
			return nil, 0, nil
		},
	}
	svc := newTestSvc(repo)

	q := &models.ListQuery{Category: "ci_cd", Status: "published", Limit: 10}
	_, _, err := svc.List(context.Background(), "tenant-1", q)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if capturedQ.Category != "ci_cd" {
		t.Errorf("expected category ci_cd, got %s", capturedQ.Category)
	}
	if capturedQ.Status != "published" {
		t.Errorf("expected status published, got %s", capturedQ.Status)
	}
	if capturedQ.Limit != 10 {
		t.Errorf("expected limit 10, got %d", capturedQ.Limit)
	}
}

func TestList_RepoError(t *testing.T) {
	repo := &mockRepo{
		listFn: func(_ context.Context, _ string, _ *models.ListQuery) ([]models.PipelineTemplate, int, error) {
			return nil, 0, errors.New("db error")
		},
	}
	svc := newTestSvc(repo)

	_, _, err := svc.List(context.Background(), "tenant-1", &models.ListQuery{})
	if err == nil {
		t.Fatal("expected error, got nil")
	}
}

// --- Update ---

func TestUpdate_Success(t *testing.T) {
	var capturedUpdates map[string]interface{}
	repo := &mockRepo{
		updateFn: func(_ context.Context, _, _ string, updates map[string]interface{}) (*models.PipelineTemplate, error) {
			capturedUpdates = updates
			return &models.PipelineTemplate{ID: "tmpl-1", Name: "updated"}, nil
		},
	}
	svc := newTestSvc(repo)

	name := "updated-name"
	req := models.UpdateTemplateRequest{
		Name: &name,
	}

	tmpl, err := svc.Update(context.Background(), "tenant-1", "tmpl-1", req)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if tmpl.Name != "updated" {
		t.Errorf("expected name updated, got %s", tmpl.Name)
	}
	if capturedUpdates["name"] != "updated-name" {
		t.Errorf("expected name update, got %v", capturedUpdates["name"])
	}
}

func TestUpdate_WithAllFields(t *testing.T) {
	var capturedUpdates map[string]interface{}
	repo := &mockRepo{
		updateFn: func(_ context.Context, _, _ string, updates map[string]interface{}) (*models.PipelineTemplate, error) {
			capturedUpdates = updates
			return &models.PipelineTemplate{ID: "tmpl-1"}, nil
		},
	}
	svc := newTestSvc(repo)

	cat := models.CategoryMonitoring
	vis := models.VisibilityOrganization
	req := models.UpdateTemplateRequest{
		DisplayName: ptr("New Display"),
		Description: ptr("New desc"),
		Category:    &cat,
		Tags:        []string{"new-tag"},
		Visibility:  &vis,
		Config:      map[string]interface{}{"timeout": 60},
		Parameters:  []models.TemplateParameter{{Name: "p1", Type: models.ParamTypeNumber}},
		Readme:      ptr("# Updated"),
		Icon:        ptr("new-icon"),
	}

	_, err := svc.Update(context.Background(), "tenant-1", "tmpl-1", req)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if capturedUpdates["display_name"] != "New Display" {
		t.Errorf("missing or wrong display_name")
	}
	if capturedUpdates["description"] != "New desc" {
		t.Errorf("missing or wrong description")
	}
	if capturedUpdates["category"] != models.CategoryMonitoring {
		t.Errorf("missing or wrong category, got %v (type %T)", capturedUpdates["category"], capturedUpdates["category"])
	}
	if capturedUpdates["visibility"] != models.VisibilityOrganization {
		t.Errorf("missing or wrong visibility, got %v (type %T)", capturedUpdates["visibility"], capturedUpdates["visibility"])
	}
	if capturedUpdates["readme"] != "# Updated" {
		t.Errorf("missing or wrong readme")
	}
	if capturedUpdates["icon"] != "new-icon" {
		t.Errorf("missing or wrong icon")
	}
}

func TestUpdate_RepoError(t *testing.T) {
	repo := &mockRepo{
		updateFn: func(_ context.Context, _, _ string, _ map[string]interface{}) (*models.PipelineTemplate, error) {
			return nil, errors.New("db error")
		},
	}
	svc := newTestSvc(repo)

	name := "test"
	_, err := svc.Update(context.Background(), "tenant-1", "tmpl-1", models.UpdateTemplateRequest{Name: &name})
	if err == nil {
		t.Fatal("expected error, got nil")
	}
}

// --- Delete ---

func TestDelete_Success(t *testing.T) {
	var called bool
	repo := &mockRepo{
		deleteFn: func(_ context.Context, _, _ string) error {
			called = true
			return nil
		},
	}
	svc := newTestSvc(repo)

	err := svc.Delete(context.Background(), "tenant-1", "tmpl-1")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if !called {
		t.Error("expected repo.Delete to be called")
	}
}

func TestDelete_RepoError(t *testing.T) {
	repo := &mockRepo{
		deleteFn: func(_ context.Context, _, _ string) error {
			return errors.New("db error")
		},
	}
	svc := newTestSvc(repo)

	err := svc.Delete(context.Background(), "tenant-1", "tmpl-1")
	if err == nil {
		t.Fatal("expected error, got nil")
	}
}

// --- Publish ---

func TestPublish_Success(t *testing.T) {
	tmpl := &models.PipelineTemplate{
		ID:      "tmpl-1",
		Name:    "test",
		Version: "1.0.0",
		Status:  models.StatusDraft,
		Config:  `{"key":"val"}`,
		Parameters: `[{"name":"p1","type":"string","required":true}]`,
		Author:  "user-1",
	}

	var setStatusCalled bool
	var createVersionCalled bool
	var capturedVersion *models.TemplateVersion

	repo := &mockRepo{
		getByIDFn: func(_ context.Context, _, _ string) (*models.PipelineTemplate, error) {
			return tmpl, nil
		},
		setStatusFn: func(_ context.Context, _, _ string, status models.TemplateStatus, _ *int64) (*models.PipelineTemplate, error) {
			setStatusCalled = true
			if status != models.StatusPublished {
				t.Errorf("expected StatusPublished, got %s", status)
			}
			updated := *tmpl
			updated.Status = models.StatusPublished
			return &updated, nil
		},
		createVersionFn: func(_ context.Context, v *models.TemplateVersion) error {
			createVersionCalled = true
			capturedVersion = v
			return nil
		},
	}

	svc := newTestSvc(repo)
	result, err := svc.Publish(context.Background(), "tenant-1", "tmpl-1")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if !setStatusCalled {
		t.Error("expected SetStatus to be called")
	}
	if !createVersionCalled {
		t.Error("expected CreateVersion to be called")
	}
	if result.Status != models.StatusPublished {
		t.Errorf("expected status published, got %s", result.Status)
	}
	if capturedVersion == nil {
		t.Fatal("expected a version to be captured")
	}
	if capturedVersion.TemplateID != "tmpl-1" {
		t.Errorf("expected template_id tmpl-1, got %s", capturedVersion.TemplateID)
	}
	if capturedVersion.Version != "1.0.0" {
		t.Errorf("expected version 1.0.0, got %s", capturedVersion.Version)
	}
	if capturedVersion.ChangeLog != "Initial publication" {
		t.Errorf("expected changelog 'Initial publication', got %s", capturedVersion.ChangeLog)
	}
	if capturedVersion.CreatedBy != "user-1" {
		t.Errorf("expected created_by user-1, got %s", capturedVersion.CreatedBy)
	}
}

func TestPublish_GetByIDError(t *testing.T) {
	repo := &mockRepo{
		getByIDFn: func(_ context.Context, _, _ string) (*models.PipelineTemplate, error) {
			return nil, errors.New("not found")
		},
	}
	svc := newTestSvc(repo)

	_, err := svc.Publish(context.Background(), "tenant-1", "tmpl-1")
	if err == nil {
		t.Fatal("expected error, got nil")
	}
}

func TestPublish_SetStatusError(t *testing.T) {
	repo := &mockRepo{
		getByIDFn: func(_ context.Context, _, _ string) (*models.PipelineTemplate, error) {
			return &models.PipelineTemplate{ID: "tmpl-1"}, nil
		},
		setStatusFn: func(_ context.Context, _, _ string, _ models.TemplateStatus, _ *int64) (*models.PipelineTemplate, error) {
			return nil, errors.New("set status failed")
		},
	}
	svc := newTestSvc(repo)

	_, err := svc.Publish(context.Background(), "tenant-1", "tmpl-1")
	if err == nil {
		t.Fatal("expected error, got nil")
	}
}

func TestPublish_CreateVersionError(t *testing.T) {
	repo := &mockRepo{
		getByIDFn: func(_ context.Context, _, _ string) (*models.PipelineTemplate, error) {
			return &models.PipelineTemplate{ID: "tmpl-1", Version: "1.0.0", Config: "{}", Parameters: "[]", Author: "user-1"}, nil
		},
		setStatusFn: func(_ context.Context, _, _ string, _ models.TemplateStatus, _ *int64) (*models.PipelineTemplate, error) {
			return &models.PipelineTemplate{ID: "tmpl-1", Status: models.StatusPublished}, nil
		},
		createVersionFn: func(_ context.Context, _ *models.TemplateVersion) error {
			return errors.New("create version failed")
		},
	}
	svc := newTestSvc(repo)

	_, err := svc.Publish(context.Background(), "tenant-1", "tmpl-1")
	if err == nil {
		t.Fatal("expected error, got nil")
	}
}

// --- Deprecate ---

func TestDeprecate_Success(t *testing.T) {
	var setStatusCalled bool
	repo := &mockRepo{
		setStatusFn: func(_ context.Context, _, _ string, status models.TemplateStatus, publishedAt *int64) (*models.PipelineTemplate, error) {
			setStatusCalled = true
			if status != models.StatusDeprecated {
				t.Errorf("expected StatusDeprecated, got %s", status)
			}
			if publishedAt != nil {
				t.Error("expected publishedAt to be nil for deprecate")
			}
			return &models.PipelineTemplate{ID: "tmpl-1", Status: models.StatusDeprecated}, nil
		},
	}
	svc := newTestSvc(repo)

	result, err := svc.Deprecate(context.Background(), "tenant-1", "tmpl-1")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if !setStatusCalled {
		t.Error("expected SetStatus to be called")
	}
	if result.Status != models.StatusDeprecated {
		t.Errorf("expected status deprecated, got %s", result.Status)
	}
}

func TestDeprecate_RepoError(t *testing.T) {
	repo := &mockRepo{
		setStatusFn: func(_ context.Context, _, _ string, _ models.TemplateStatus, _ *int64) (*models.PipelineTemplate, error) {
			return nil, errors.New("db error")
		},
	}
	svc := newTestSvc(repo)

	_, err := svc.Deprecate(context.Background(), "tenant-1", "tmpl-1")
	if err == nil {
		t.Fatal("expected error, got nil")
	}
}

// --- GetVersions ---

func TestGetVersions_Success(t *testing.T) {
	versions := []models.TemplateVersion{
		{ID: "ver-1", Version: "1.0.0"},
	}
	repo := &mockRepo{
		listVersionsFn: func(_ context.Context, _, _ string, _ *models.ListQuery) ([]models.TemplateVersion, int, error) {
			return versions, 1, nil
		},
	}
	svc := newTestSvc(repo)

	result, total, err := svc.GetVersions(context.Background(), "tenant-1", "tmpl-1", &models.ListQuery{})
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if total != 1 {
		t.Errorf("expected total 1, got %d", total)
	}
	if len(result) != 1 {
		t.Errorf("expected 1 version, got %d", len(result))
	}
}

func TestGetVersions_PassesQuery(t *testing.T) {
	var capturedQ *models.ListQuery
	repo := &mockRepo{
		listVersionsFn: func(_ context.Context, _, _ string, q *models.ListQuery) ([]models.TemplateVersion, int, error) {
			capturedQ = q
			return nil, 0, nil
		},
	}
	svc := newTestSvc(repo)

	q := &models.ListQuery{Limit: 5, Offset: 10}
	_, _, err := svc.GetVersions(context.Background(), "tenant-1", "tmpl-1", q)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if capturedQ != q {
		t.Error("expected query to be passed through")
	}
}

func TestGetVersions_RepoError(t *testing.T) {
	repo := &mockRepo{
		listVersionsFn: func(_ context.Context, _, _ string, _ *models.ListQuery) ([]models.TemplateVersion, int, error) {
			return nil, 0, errors.New("db error")
		},
	}
	svc := newTestSvc(repo)

	_, _, err := svc.GetVersions(context.Background(), "tenant-1", "tmpl-1", &models.ListQuery{})
	if err == nil {
		t.Fatal("expected error, got nil")
	}
}

// --- Instantiate ---

func TestInstantiate_Success(t *testing.T) {
	tmpl := &models.PipelineTemplate{
		ID:      "tmpl-1",
		Name:    "test",
		Status:  models.StatusPublished,
		Config:  `{"key":"val"}`,
		Parameters: `[]`,
	}
	repo := &mockRepo{
		getByIDFn: func(_ context.Context, _, _ string) (*models.PipelineTemplate, error) {
			return tmpl, nil
		},
		incrementUsageCountFn: func(_ context.Context, _, _ string) error {
			return nil
		},
	}
	svc := newTestSvc(repo)

	result, err := svc.Instantiate(context.Background(), "tenant-1", "tmpl-1", models.InstantiateTemplateRequest{
		Name: "my-pipeline",
	})
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if result.PipelineID == "" {
		t.Error("expected non-empty pipeline ID")
	}
	if result.Config == nil {
		t.Error("expected non-nil config")
	}
}

func TestInstantiate_NotPublished(t *testing.T) {
	tmpl := &models.PipelineTemplate{
		ID:     "tmpl-1",
		Name:   "test",
		Status: models.StatusDraft,
	}
	repo := &mockRepo{
		getByIDFn: func(_ context.Context, _, _ string) (*models.PipelineTemplate, error) {
			return tmpl, nil
		},
	}
	svc := newTestSvc(repo)

	_, err := svc.Instantiate(context.Background(), "tenant-1", "tmpl-1", models.InstantiateTemplateRequest{
		Name: "my-pipeline",
	})
	if err != ErrTemplateNotPublished {
		t.Errorf("expected ErrTemplateNotPublished, got %v", err)
	}
}

func TestInstantiate_MissingRequiredParam(t *testing.T) {
	tmpl := &models.PipelineTemplate{
		ID:         "tmpl-1",
		Name:       "test",
		Status:     models.StatusPublished,
		Config:     `{}`,
		Parameters: `[{"name":"reqParam","type":"string","required":true}]`,
	}
	repo := &mockRepo{
		getByIDFn: func(_ context.Context, _, _ string) (*models.PipelineTemplate, error) {
			return tmpl, nil
		},
	}
	svc := newTestSvc(repo)

	_, err := svc.Instantiate(context.Background(), "tenant-1", "tmpl-1", models.InstantiateTemplateRequest{
		Name:       "my-pipeline",
		Parameters: map[string]interface{}{},
	})
	if err == nil {
		t.Fatal("expected error for missing required parameter")
	}
	if !errors.Is(err, ErrValidation) {
		t.Errorf("expected ErrValidation, got %v", err)
	}
}

func TestInstantiate_WithPlaceholderReplacement(t *testing.T) {
	tmpl := &models.PipelineTemplate{
		ID:     "tmpl-1",
		Name:   "test",
		Status: models.StatusPublished,
		Config: `{"namespace":"${namespace}","replicas":3,"labels":{"app":"${appName}"}}`,
		Parameters: `[{"name":"namespace","type":"string","required":true},{"name":"appName","type":"string","required":true}]`,
	}
	repo := &mockRepo{
		getByIDFn: func(_ context.Context, _, _ string) (*models.PipelineTemplate, error) {
			return tmpl, nil
		},
		incrementUsageCountFn: func(_ context.Context, _, _ string) error {
			return nil
		},
	}
	svc := newTestSvc(repo)

	result, err := svc.Instantiate(context.Background(), "tenant-1", "tmpl-1", models.InstantiateTemplateRequest{
		Name: "my-pipeline",
		Parameters: map[string]interface{}{
			"namespace": "prod-ns",
			"appName":   "my-app",
		},
	})
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	ns, ok := result.Config["namespace"]
	if !ok {
		t.Fatal("expected namespace in config")
	}
	if ns != "prod-ns" {
		t.Errorf("expected namespace 'prod-ns', got %v", ns)
	}

	labels, ok := result.Config["labels"].(map[string]interface{})
	if !ok {
		t.Fatal("expected labels map")
	}
	if labels["app"] != "my-app" {
		t.Errorf("expected app 'my-app', got %v", labels["app"])
	}

	// replicas should remain as-is
	if result.Config["replicas"] != float64(3) {
		t.Errorf("expected replicas 3, got %v", result.Config["replicas"])
	}
}

func TestInstantiate_IncrementUsageError(t *testing.T) {
	tmpl := &models.PipelineTemplate{
		ID:         "tmpl-1",
		Name:       "test",
		Status:     models.StatusPublished,
		Config:     `{}`,
		Parameters: `[]`,
	}
	repo := &mockRepo{
		getByIDFn: func(_ context.Context, _, _ string) (*models.PipelineTemplate, error) {
			return tmpl, nil
		},
		incrementUsageCountFn: func(_ context.Context, _, _ string) error {
			return errors.New("db error")
		},
	}
	svc := newTestSvc(repo)

	_, err := svc.Instantiate(context.Background(), "tenant-1", "tmpl-1", models.InstantiateTemplateRequest{
		Name: "my-pipeline",
	})
	if err == nil {
		t.Fatal("expected error, got nil")
	}
}

// --- Star ---

func TestStar_Success(t *testing.T) {
	var incrementCalled bool
	repo := &mockRepo{
		incrementStarCountFn: func(_ context.Context, _, _ string) error {
			incrementCalled = true
			return nil
		},
		getByIDFn: func(_ context.Context, _, _ string) (*models.PipelineTemplate, error) {
			return &models.PipelineTemplate{ID: "tmpl-1", StarCount: 1}, nil
		},
	}
	svc := newTestSvc(repo)

	result, err := svc.Star(context.Background(), "tenant-1", "tmpl-1")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if !incrementCalled {
		t.Error("expected IncrementStarCount to be called")
	}
	if result.StarCount != 1 {
		t.Errorf("expected star_count 1, got %d", result.StarCount)
	}
}

func TestStar_IncrementError(t *testing.T) {
	repo := &mockRepo{
		incrementStarCountFn: func(_ context.Context, _, _ string) error {
			return errors.New("db error")
		},
	}
	svc := newTestSvc(repo)

	_, err := svc.Star(context.Background(), "tenant-1", "tmpl-1")
	if err == nil {
		t.Fatal("expected error, got nil")
	}
}

func TestStar_GetError(t *testing.T) {
	repo := &mockRepo{
		incrementStarCountFn: func(_ context.Context, _, _ string) error {
			return nil
		},
		getByIDFn: func(_ context.Context, _, _ string) (*models.PipelineTemplate, error) {
			return nil, errors.New("not found")
		},
	}
	svc := newTestSvc(repo)

	_, err := svc.Star(context.Background(), "tenant-1", "tmpl-1")
	if err == nil {
		t.Fatal("expected error, got nil")
	}
}

// --- Unstar ---

func TestUnstar_Success(t *testing.T) {
	var decrementCalled bool
	repo := &mockRepo{
		decrementStarCountFn: func(_ context.Context, _, _ string) error {
			decrementCalled = true
			return nil
		},
		getByIDFn: func(_ context.Context, _, _ string) (*models.PipelineTemplate, error) {
			return &models.PipelineTemplate{ID: "tmpl-1", StarCount: 0}, nil
		},
	}
	svc := newTestSvc(repo)

	result, err := svc.Unstar(context.Background(), "tenant-1", "tmpl-1")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if !decrementCalled {
		t.Error("expected DecrementStarCount to be called")
	}
	if result.StarCount != 0 {
		t.Errorf("expected star_count 0, got %d", result.StarCount)
	}
}

func TestUnstar_DecrementError(t *testing.T) {
	repo := &mockRepo{
		decrementStarCountFn: func(_ context.Context, _, _ string) error {
			return errors.New("db error")
		},
	}
	svc := newTestSvc(repo)

	_, err := svc.Unstar(context.Background(), "tenant-1", "tmpl-1")
	if err == nil {
		t.Fatal("expected error, got nil")
	}
}

// --- GetCategories ---

func TestGetCategories_Success(t *testing.T) {
	repo := &mockRepo{
		categoryCountsFn: func(_ context.Context, _ string) (map[string]int, error) {
			return map[string]int{
				"ci_cd":  5,
				"deploy": 3,
			}, nil
		},
	}
	svc := newTestSvc(repo)

	cats, err := svc.GetCategories(context.Background(), "tenant-1")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	// Should return exactly 10 categories with display names
	if len(cats) != 10 {
		t.Errorf("expected 10 categories, got %d", len(cats))
	}

	// Verify all categories
	expectedCategories := []struct {
		name        string
		displayName string
	}{
		{"ci_cd", "CI/CD"},
		{"build", "构建"},
		{"deploy", "部署"},
		{"test", "测试"},
		{"security", "安全"},
		{"monitoring", "监控"},
		{"infrastructure", "基础设施"},
		{"data_pipeline", "数据管道"},
		{"ml_ops", "ML Ops"},
		{"custom", "自定义"},
	}
	for i, exp := range expectedCategories {
		if cats[i].Name != exp.name {
			t.Errorf("[%d] expected name %s, got %s", i, exp.name, cats[i].Name)
		}
		if cats[i].DisplayName != exp.displayName {
			t.Errorf("[%d] expected displayName %s, got %s", i, exp.displayName, cats[i].DisplayName)
		}
	}

	// ci_cd should have count 5
	if cats[0].Count != 5 {
		t.Errorf("expected ci_cd count 5, got %d", cats[0].Count)
	}
	// deploy should have count 3
	if cats[2].Count != 3 {
		t.Errorf("expected deploy count 3, got %d", cats[2].Count)
	}
	// uncounted categories should have count 0
	if cats[1].Count != 0 {
		t.Errorf("expected build count 0, got %d", cats[1].Count)
	}
}

func TestGetCategories_RepoError(t *testing.T) {
	repo := &mockRepo{
		categoryCountsFn: func(_ context.Context, _ string) (map[string]int, error) {
			return nil, errors.New("db error")
		},
	}
	svc := newTestSvc(repo)

	_, err := svc.GetCategories(context.Background(), "tenant-1")
	if err == nil {
		t.Fatal("expected error, got nil")
	}
}

// --- replacePlaceholders ---

func TestReplacePlaceholders_String(t *testing.T) {
	svc := newTestSvc(&mockRepo{})
	params := map[string]interface{}{
		"name": "test-app",
		"env":  "prod",
	}

	result := svc.replacePlaceholders("${name}", params)
	if result != "test-app" {
		t.Errorf("expected 'test-app', got %v", result)
	}

	// Non-placeholder string should remain unchanged
	result = svc.replacePlaceholders("static-value", params)
	if result != "static-value" {
		t.Errorf("expected 'static-value', got %v", result)
	}
}

func TestReplacePlaceholders_Map(t *testing.T) {
	svc := newTestSvc(&mockRepo{})
	params := map[string]interface{}{
		"namespace": "prod-ns",
		"app":       "my-app",
	}

	config := map[string]interface{}{
		"namespace": "${namespace}",
		"app":       "${app}",
		"replicas":  3,
	}

	result := svc.replacePlaceholders(config, params).(map[string]interface{})
	if result["namespace"] != "prod-ns" {
		t.Errorf("expected 'prod-ns', got %v", result["namespace"])
	}
	if result["app"] != "my-app" {
		t.Errorf("expected 'my-app', got %v", result["app"])
	}
	if result["replicas"] != 3 {
		t.Errorf("expected 3, got %v", result["replicas"])
	}
}

func TestReplacePlaceholders_Array(t *testing.T) {
	svc := newTestSvc(&mockRepo{})
	params := map[string]interface{}{
		"image": "nginx:latest",
	}

	arr := []interface{}{
		"${image}",
		"sidecar:latest",
	}

	result := svc.replacePlaceholders(arr, params).([]interface{})
	if result[0] != "nginx:latest" {
		t.Errorf("expected 'nginx:latest', got %v", result[0])
	}
	if result[1] != "sidecar:latest" {
		t.Errorf("expected 'sidecar:latest', got %v", result[1])
	}
}

func TestReplacePlaceholders_Nested(t *testing.T) {
	svc := newTestSvc(&mockRepo{})
	params := map[string]interface{}{
		"env": "production",
	}

	config := map[string]interface{}{
		"deployments": []interface{}{
			map[string]interface{}{
				"name": "app",
				"env":  "${env}",
				"containers": []interface{}{
					map[string]interface{}{
						"image": "nginx:${env}",
					},
				},
			},
		},
	}

	result := svc.replacePlaceholders(config, params).(map[string]interface{})
	deployments := result["deployments"].([]interface{})
	first := deployments[0].(map[string]interface{})
	if first["env"] != "production" {
		t.Errorf("expected 'production', got %v", first["env"])
	}
	containers := first["containers"].([]interface{})
	container := containers[0].(map[string]interface{})
	// "nginx:${env}" is NOT an exact match (has prefix), so it stays as-is
	if container["image"] != "nginx:${env}" {
		t.Errorf("expected 'nginx:${env}', got %v", container["image"])
	}
}

func TestReplacePlaceholders_UnknownParam(t *testing.T) {
	svc := newTestSvc(&mockRepo{})

	result := svc.replacePlaceholders("${unknown}", map[string]interface{}{})
	// Unknown placeholder should remain as-is
	if result != "${unknown}" {
		t.Errorf("expected '${unknown}', got %v", result)
	}
}

// --- Service error messages ---

func TestServiceErrors(t *testing.T) {
	tests := []struct {
		err error
		msg string
	}{
		{ErrTemplateNotPublished, "template must be published before instantiation"},
		{ErrValidation, "validation error"},
	}
	for _, tt := range tests {
		if tt.err.Error() != tt.msg {
			t.Errorf("expected %q, got %q", tt.msg, tt.err.Error())
		}
	}
}