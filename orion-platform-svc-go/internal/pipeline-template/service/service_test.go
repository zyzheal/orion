package service

import (
	"context"
	"database/sql"
	"errors"
	"testing"

	"orion/platform-svc-go/internal/pipeline-template/models"
)

// --- mock repository ---

type mockRepo struct {
	templates     map[string]*models.PipelineTemplate
	listErr       error
	getByIDErr    error
	createErr     error
	updateErr     error
	deleteErr     error
	deleteRet     bool
	createPipeErr error
}

func (m *mockRepo) ListTemplates(_ context.Context, tenantID string) ([]models.PipelineTemplate, error) {
	if m.listErr != nil {
		return nil, m.listErr
	}
	var result []models.PipelineTemplate
	for _, t := range m.templates {
		if t.TenantID == tenantID {
			result = append(result, *t)
		}
	}
	return result, nil
}

func (m *mockRepo) GetTemplateByID(_ context.Context, id string, tenantID string) (*models.PipelineTemplate, error) {
	if m.getByIDErr != nil {
		return nil, m.getByIDErr
	}
	t, ok := m.templates[id]
	if !ok || t.TenantID != tenantID {
		return nil, sql.ErrNoRows
	}
	return t, nil
}

func (m *mockRepo) CreateTemplate(_ context.Context, template *models.PipelineTemplate) error {
	if m.createErr != nil {
		return m.createErr
	}
	template.ID = "new-id"
	m.templates["new-id"] = template
	return nil
}

func (m *mockRepo) UpdateTemplate(_ context.Context, id string, tenantID string, _ map[string]interface{}) (*models.PipelineTemplate, error) {
	if m.updateErr != nil {
		return nil, m.updateErr
	}
	t, ok := m.templates[id]
	if !ok || t.TenantID != tenantID {
		return nil, errors.New("not found")
	}
	return t, nil
}

func (m *mockRepo) DeleteTemplate(_ context.Context, id string, tenantID string) (bool, error) {
	if m.deleteErr != nil {
		return false, m.deleteErr
	}
	if m.deleteRet {
		return false, nil
	}
	t, ok := m.templates[id]
	if !ok || t.TenantID != tenantID {
		return false, nil
	}
	delete(m.templates, id)
	return true, nil
}

func (m *mockRepo) CreatePipelineFromTemplate(_ context.Context, tenantID string, templateID string, name string) (*models.InstantiatedPipeline, error) {
	if m.createPipeErr != nil {
		return nil, m.createPipeErr
	}
	return &models.InstantiatedPipeline{
		ID:       "pipeline-1",
		Name:     name,
		Status:   "draft",
		SourceID: templateID,
	}, nil
}

// --- test helpers ---

func newTestService(repo *mockRepo) *Service {
	return &Service{repo: repo}
}

func newTemplate(id, tenantID, name string) *models.PipelineTemplate {
	desc := "description"
	cat := "ci"
	ver := "1.0"
	by := "user"
	return &models.PipelineTemplate{
		ID:             id,
		TenantID:       tenantID,
		Name:           name,
		Description:    &desc,
		YAMLDefinition: "yaml: " + name,
		Tags:           "[]",
		Category:       &cat,
		Version:        &ver,
		CreatedBy:      &by,
	}
}

// --- tests ---

func TestService_ListTemplates_Success(t *testing.T) {
	repo := &mockRepo{
		templates: map[string]*models.PipelineTemplate{
			"t1": newTemplate("t1", "tenant-1", "template-1"),
			"t2": newTemplate("t2", "tenant-1", "template-2"),
		},
	}
	svc := newTestService(repo)

	templates, total, err := svc.ListTemplates(context.Background(), "tenant-1")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if total != 2 {
		t.Errorf("expected total 2, got %d", total)
	}
	if len(templates) != 2 {
		t.Errorf("expected 2 templates, got %d", len(templates))
	}
}

func TestService_ListTemplates_EmptyResult(t *testing.T) {
	repo := &mockRepo{templates: map[string]*models.PipelineTemplate{}}
	svc := newTestService(repo)

	templates, total, err := svc.ListTemplates(context.Background(), "tenant-1")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if total != 0 {
		t.Errorf("expected total 0, got %d", total)
	}
	if templates == nil {
		t.Error("expected non-nil empty slice, got nil")
	}
}

func TestService_ListTemplates_RepoError(t *testing.T) {
	repo := &mockRepo{listErr: errors.New("db error")}
	svc := newTestService(repo)

	_, _, err := svc.ListTemplates(context.Background(), "tenant-1")
	if err == nil {
		t.Fatal("expected error, got nil")
	}
}

func TestService_GetTemplate_Success(t *testing.T) {
	repo := &mockRepo{
		templates: map[string]*models.PipelineTemplate{
			"t1": newTemplate("t1", "tenant-1", "template-1"),
		},
	}
	svc := newTestService(repo)

	tmpl, err := svc.GetTemplate(context.Background(), "t1", "tenant-1")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if tmpl.Name != "template-1" {
		t.Errorf("expected name 'template-1', got %s", tmpl.Name)
	}
}

func TestService_GetTemplate_NotFound(t *testing.T) {
	repo := &mockRepo{templates: map[string]*models.PipelineTemplate{}}
	svc := newTestService(repo)

	_, err := svc.GetTemplate(context.Background(), "nonexistent", "tenant-1")
	if err != ErrTemplateNotFound {
		t.Errorf("expected ErrTemplateNotFound, got %v", err)
	}
}

func TestService_GetTemplate_RepoError(t *testing.T) {
	repo := &mockRepo{getByIDErr: errors.New("db error")}
	svc := newTestService(repo)

	_, err := svc.GetTemplate(context.Background(), "t1", "tenant-1")
	if err == nil {
		t.Fatal("expected error, got nil")
	}
}

func TestService_CreateTemplate_Success(t *testing.T) {
	repo := &mockRepo{templates: map[string]*models.PipelineTemplate{}}
	svc := newTestService(repo)

	req := &models.CreateTemplateRequest{
		Name:           "new-template",
		Description:    strPtr("a description"),
		YAMLDefinition: "yaml: content",
		Category:       strPtr("ci"),
		Version:        strPtr("1.0"),
		CreatedBy:      strPtr("user"),
	}
	tmpl, err := svc.CreateTemplate(context.Background(), req, "tenant-1")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if tmpl.Name != "new-template" {
		t.Errorf("expected name 'new-template', got %s", tmpl.Name)
	}
}

func TestService_CreateTemplate_WithTags(t *testing.T) {
	repo := &mockRepo{templates: map[string]*models.PipelineTemplate{}}
	svc := newTestService(repo)

	tags := `["ci","deploy"]`
	req := &models.CreateTemplateRequest{
		Name:           "tagged-template",
		YAMLDefinition: "yaml: content",
		Tags:           &tags,
	}
	tmpl, err := svc.CreateTemplate(context.Background(), req, "tenant-1")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if tmpl.Tags != tags {
		t.Errorf("expected tags %q, got %q", tags, tmpl.Tags)
	}
}

func TestService_CreateTemplate_RepoError(t *testing.T) {
	repo := &mockRepo{createErr: errors.New("db error")}
	svc := newTestService(repo)

	req := &models.CreateTemplateRequest{
		Name:           "new-template",
		YAMLDefinition: "yaml: content",
	}
	_, err := svc.CreateTemplate(context.Background(), req, "tenant-1")
	if err == nil {
		t.Fatal("expected error, got nil")
	}
}

func TestService_UpdateTemplate_Success(t *testing.T) {
	repo := &mockRepo{
		templates: map[string]*models.PipelineTemplate{
			"t1": newTemplate("t1", "tenant-1", "original"),
		},
	}
	svc := newTestService(repo)

	newName := "updated"
	req := &models.UpdateTemplateRequest{
		Name: &newName,
	}
	tmpl, err := svc.UpdateTemplate(context.Background(), "t1", req, "tenant-1")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if tmpl.Name != "original" {
		t.Errorf("expected name 'original' (mock returns original), got %s", tmpl.Name)
	}
}

func TestService_UpdateTemplate_NoFields(t *testing.T) {
	repo := &mockRepo{
		templates: map[string]*models.PipelineTemplate{
			"t1": newTemplate("t1", "tenant-1", "original"),
		},
	}
	svc := newTestService(repo)

	req := &models.UpdateTemplateRequest{}
	_, err := svc.UpdateTemplate(context.Background(), "t1", req, "tenant-1")
	if err == nil {
		t.Fatal("expected error for no fields, got nil")
	}
}

func TestService_UpdateTemplate_RepoError(t *testing.T) {
	repo := &mockRepo{
		templates: map[string]*models.PipelineTemplate{
			"t1": newTemplate("t1", "tenant-1", "original"),
		},
		updateErr: errors.New("db error"),
	}
	svc := newTestService(repo)

	newName := "updated"
	req := &models.UpdateTemplateRequest{
		Name: &newName,
	}
	_, err := svc.UpdateTemplate(context.Background(), "t1", req, "tenant-1")
	if err == nil {
		t.Fatal("expected error, got nil")
	}
}

func TestService_DeleteTemplate_Success(t *testing.T) {
	repo := &mockRepo{
		templates: map[string]*models.PipelineTemplate{
			"t1": newTemplate("t1", "tenant-1", "template-1"),
		},
	}
	svc := newTestService(repo)

	deleted, err := svc.DeleteTemplate(context.Background(), "t1", "tenant-1")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if !deleted {
		t.Error("expected deleted=true, got false")
	}
}

func TestService_DeleteTemplate_NotFound(t *testing.T) {
	repo := &mockRepo{templates: map[string]*models.PipelineTemplate{}}
	svc := newTestService(repo)

	deleted, err := svc.DeleteTemplate(context.Background(), "nonexistent", "tenant-1")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if deleted {
		t.Error("expected deleted=false, got true")
	}
}

func TestService_DeleteTemplate_RepoError(t *testing.T) {
	repo := &mockRepo{
		templates: map[string]*models.PipelineTemplate{
			"t1": newTemplate("t1", "tenant-1", "template-1"),
		},
		deleteErr: errors.New("db error"),
	}
	svc := newTestService(repo)

	_, err := svc.DeleteTemplate(context.Background(), "t1", "tenant-1")
	if err == nil {
		t.Fatal("expected error, got nil")
	}
}

func TestService_InstantiateTemplate_Success(t *testing.T) {
	repo := &mockRepo{
		templates: map[string]*models.PipelineTemplate{
			"t1": newTemplate("t1", "tenant-1", "template-1"),
		},
	}
	svc := newTestService(repo)

	req := &models.InstantiateRequest{
		Name: "my-pipeline",
	}
	inst, err := svc.InstantiateTemplate(context.Background(), "t1", req, "tenant-1")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if inst.Name != "my-pipeline" {
		t.Errorf("expected name 'my-pipeline', got %s", inst.Name)
	}
	if inst.Status != "draft" {
		t.Errorf("expected status 'draft', got %s", inst.Status)
	}
	if inst.SourceID != "t1" {
		t.Errorf("expected sourceID 't1', got %s", inst.SourceID)
	}
}

func TestService_InstantiateTemplate_WithParameters(t *testing.T) {
	repo := &mockRepo{
		templates: map[string]*models.PipelineTemplate{
			"t1": newTemplate("t1", "tenant-1", "template-1"),
		},
	}
	svc := newTestService(repo)

	req := &models.InstantiateRequest{
		Name:       "my-pipeline",
		Parameters: map[string]string{"key": "value"},
	}
	inst, err := svc.InstantiateTemplate(context.Background(), "t1", req, "tenant-1")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if inst.Name != "my-pipeline" {
		t.Errorf("expected name 'my-pipeline', got %s", inst.Name)
	}
}

func TestService_InstantiateTemplate_TemplateNotFound(t *testing.T) {
	repo := &mockRepo{templates: map[string]*models.PipelineTemplate{}}
	svc := newTestService(repo)

	req := &models.InstantiateRequest{
		Name: "my-pipeline",
	}
	_, err := svc.InstantiateTemplate(context.Background(), "nonexistent", req, "tenant-1")
	if err != ErrTemplateNotFound {
		t.Errorf("expected ErrTemplateNotFound, got %v", err)
	}
}

func TestService_InstantiateTemplate_RepoError(t *testing.T) {
	repo := &mockRepo{
		templates: map[string]*models.PipelineTemplate{
			"t1": newTemplate("t1", "tenant-1", "template-1"),
		},
		createPipeErr: errors.New("db error"),
	}
	svc := newTestService(repo)

	req := &models.InstantiateRequest{
		Name: "my-pipeline",
	}
	_, err := svc.InstantiateTemplate(context.Background(), "t1", req, "tenant-1")
	if err == nil {
		t.Fatal("expected error, got nil")
	}
}

func TestService_IsNotFound(t *testing.T) {
	if !IsNotFound(ErrTemplateNotFound) {
		t.Error("expected IsNotFound(ErrTemplateNotFound) to be true")
	}
	if IsNotFound(errors.New("some other error")) {
		t.Error("expected IsNotFound for other error to be false")
	}
}

// --- helpers ---

func strPtr(s string) *string {
	return &s
}