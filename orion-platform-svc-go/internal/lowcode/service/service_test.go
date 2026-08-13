package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"orion/platform-svc-go/internal/lowcode/models"

	repoerr "orion/platform-svc-go/internal/lowcode/repository"
)

// --- Fake Repository ---

type fakeRepo struct {
	flows    map[string]*models.LowcodeFlow
	versions []models.VersionSnapshot
}

func newFakeRepo() *fakeRepo {
	return &fakeRepo{flows: make(map[string]*models.LowcodeFlow)}
}

func (f *fakeRepo) CreateFlow(ctx context.Context, flow *models.LowcodeFlow) error {
	f.flows[flow.ID] = flow
	return nil
}

func (f *fakeRepo) GetFlowByID(ctx context.Context, tenantID, id string) (*models.LowcodeFlow, error) {
	flow, ok := f.flows[id]
	if !ok {
		return nil, repoerr.ErrFlowNotFound
	}
	if flow.TenantID != tenantID {
		return nil, repoerr.ErrFlowNotFound
	}
	return flow, nil
}

func (f *fakeRepo) ListFlows(ctx context.Context, tenantID string, filter *models.ListFlowFilters, offset, limit int) ([]models.LowcodeFlow, error) {
	var items []models.LowcodeFlow
	for _, flow := range f.flows {
		if flow.TenantID != tenantID {
			continue
		}
		items = append(items, *flow)
	}
	end := offset + limit
	if end > len(items) {
		end = len(items)
	}
	return items[offset:end], nil
}

func (f *fakeRepo) CountFlows(ctx context.Context, tenantID string, filter *models.ListFlowFilters) (int, error) {
	count := 0
	for _, flow := range f.flows {
		if flow.TenantID == tenantID {
			count++
		}
	}
	return count, nil
}

func (f *fakeRepo) UpdateFlow(ctx context.Context, tenantID, id string, updates map[string]interface{}) error {
	flow, ok := f.flows[id]
	if !ok || flow.TenantID != tenantID {
		return repoerr.ErrFlowNotFound
	}
	if name, ok := updates["name"]; ok {
		flow.Name = name.(string)
	}
	if desc, ok := updates["description"]; ok {
		flow.Description = desc.(string)
	}
	if ver, ok := updates["version"]; ok {
		flow.Version = ver.(string)
	}
	if nodes, ok := updates["nodes"]; ok {
		flow.Nodes = nodes.(string)
	}
	if edges, ok := updates["edges"]; ok {
		flow.Edges = edges.(string)
	}
	if enabled, ok := updates["enabled"]; ok {
		flow.Enabled = enabled.(bool)
	}
	flow.UpdatedAt = time.Now()
	return nil
}

func (f *fakeRepo) DeleteFlow(ctx context.Context, tenantID, id string) error {
	flow, ok := f.flows[id]
	if !ok || flow.TenantID != tenantID {
		return repoerr.ErrFlowNotFound
	}
	delete(f.flows, id)
	return nil
}

func (f *fakeRepo) CreateInstance(ctx context.Context, inst *models.LowcodeInstance) error {
	return nil
}

func (f *fakeRepo) CreateTemplate(ctx context.Context, tmpl *models.LowcodeTemplate) error {
	return nil
}

func (f *fakeRepo) GetTemplateByID(ctx context.Context, id string) (*models.LowcodeTemplate, error) {
	return nil, repoerr.ErrTemplateNotFound
}

func (f *fakeRepo) ListTemplates(ctx context.Context) ([]models.LowcodeTemplate, error) {
	return nil, nil
}

func (f *fakeRepo) IncrementTemplateUsage(ctx context.Context, id string) error {
	return nil
}

func (f *fakeRepo) CreateVersionSnapshot(ctx context.Context, snap *models.VersionSnapshot) error {
	f.versions = append(f.versions, *snap)
	return nil
}

func (f *fakeRepo) ListVersionSnapshots(ctx context.Context, workflowID string) ([]models.VersionSnapshot, error) {
	return f.versions, nil
}

// --- Tests ---

func TestService_CreateFlow_success(t *testing.T) {
	repo := newFakeRepo()
	svc := NewService(repo)

	req := &models.CreateFlowRequest{Name: "test-flow", Description: "desc"}
	flow, err := svc.CreateFlow(context.Background(), "t1", "u1", req)
	if err != nil {
		t.Fatalf("CreateFlow error: %v", err)
	}
	if flow.Name != "test-flow" {
		t.Errorf("Name = %q, want test-flow", flow.Name)
	}
	if flow.Version != "1.0.0" {
		t.Errorf("Version = %q, want 1.0.0", flow.Version)
	}
	if flow.Enabled {
		t.Error("Enabled should be false on create")
	}
}

func TestService_CreateFlow_customVersion(t *testing.T) {
	repo := newFakeRepo()
	svc := NewService(repo)

	ver := "2.1.0"
	req := &models.CreateFlowRequest{Name: "f", Version: ver}
	flow, err := svc.CreateFlow(context.Background(), "t1", "u1", req)
	if err != nil {
		t.Fatalf("CreateFlow error: %v", err)
	}
	if flow.Version != "2.1.0" {
		t.Errorf("Version = %q, want 2.1.0", flow.Version)
	}
}

func TestService_GetFlow_notFound(t *testing.T) {
	svc := NewService(newFakeRepo())
	_, err := svc.GetFlow(context.Background(), "t1", "nonexistent")
	if !errors.Is(err, ErrFlowNotFound) {
		t.Errorf("GetFlow error = %v, want ErrFlowNotFound", err)
	}
}

func TestService_GetFlow_success(t *testing.T) {
	repo := newFakeRepo()
	svc := NewService(repo)

	// Create a flow via service first
	req := &models.CreateFlowRequest{Name: "get-test"}
	flow, err := svc.CreateFlow(context.Background(), "t1", "u1", req)
	if err != nil {
		t.Fatalf("setup CreateFlow: %v", err)
	}

	// Then get it
	got, err := svc.GetFlow(context.Background(), "t1", flow.ID)
	if err != nil {
		t.Fatalf("GetFlow error: %v", err)
	}
	if got.ID != flow.ID {
		t.Errorf("GetFlow ID = %q, want %q", got.ID, flow.ID)
	}
}

func TestService_DeleteFlow_success(t *testing.T) {
	repo := newFakeRepo()
	svc := NewService(repo)

	req := &models.CreateFlowRequest{Name: "del-test"}
	flow, err := svc.CreateFlow(context.Background(), "t1", "u1", req)
	if err != nil {
		t.Fatalf("setup: %v", err)
	}

	if err := svc.DeleteFlow(context.Background(), "t1", flow.ID); err != nil {
		t.Fatalf("DeleteFlow error: %v", err)
	}

	_, err = svc.GetFlow(context.Background(), "t1", flow.ID)
	if !errors.Is(err, ErrFlowNotFound) {
		t.Error("GetFlow after delete should return ErrFlowNotFound")
	}
}

func TestService_DeleteFlow_notFound(t *testing.T) {
	svc := NewService(newFakeRepo())
	err := svc.DeleteFlow(context.Background(), "t1", "ghost")
	if !errors.Is(err, ErrFlowNotFound) {
		t.Errorf("DeleteFlow error = %v, want ErrFlowNotFound", err)
	}
}

func TestService_UpdateFlow_updatesFields(t *testing.T) {
	repo := newFakeRepo()
	svc := NewService(repo)

	req := &models.CreateFlowRequest{Name: "old-name"}
	flow, err := svc.CreateFlow(context.Background(), "t1", "u1", req)
	if err != nil {
		t.Fatalf("setup: %v", err)
	}

	newName := "new-name"
	update := &models.UpdateFlowRequest{Name: &newName}
	updated, err := svc.UpdateFlow(context.Background(), "t1", flow.ID, update)
	if err != nil {
		t.Fatalf("UpdateFlow error: %v", err)
	}
	if updated.Name != "new-name" {
		t.Errorf("Name = %q, want new-name", updated.Name)
	}
}

func TestService_UpdateFlow_notFound(t *testing.T) {
	svc := NewService(newFakeRepo())
	newName := "x"
	_, err := svc.UpdateFlow(context.Background(), "t1", "ghost", &models.UpdateFlowRequest{Name: &newName})
	if !errors.Is(err, ErrFlowNotFound) {
		t.Errorf("UpdateFlow error = %v, want ErrFlowNotFound", err)
	}
}

func TestService_PublishFlow_bumpsVersion(t *testing.T) {
	repo := newFakeRepo()
	svc := NewService(repo)

	req := &models.CreateFlowRequest{Name: "pub-test", Version: "1.2.3"}
	flow, err := svc.CreateFlow(context.Background(), "t1", "u1", req)
	if err != nil {
		t.Fatalf("setup: %v", err)
	}

	published, err := svc.PublishFlow(context.Background(), "t1", flow.ID)
	if err != nil {
		t.Fatalf("PublishFlow error: %v", err)
	}
	if !published.Enabled {
		t.Error("Enabled should be true after publish")
	}
	if published.Version != "1.2.4" {
		t.Errorf("Version = %q, want 1.2.4", published.Version)
	}
}

func TestService_PublishFlow_notFound(t *testing.T) {
	svc := NewService(newFakeRepo())
	_, err := svc.PublishFlow(context.Background(), "t1", "ghost")
	if !errors.Is(err, ErrFlowNotFound) {
		t.Errorf("PublishFlow error = %v, want ErrFlowNotFound", err)
	}
}

func TestService_ListFlows_pagination(t *testing.T) {
	repo := newFakeRepo()
	svc := NewService(repo)

	// Create 3 flows
	for i := 0; i < 3; i++ {
		_, err := svc.CreateFlow(context.Background(), "t1", "u1", &models.CreateFlowRequest{Name: "flow"})
		if err != nil {
			t.Fatalf("setup: %v", err)
		}
	}

	items, total, err := svc.ListFlows(context.Background(), "t1", nil, 1, 2)
	if err != nil {
		t.Fatalf("ListFlows error: %v", err)
	}
	if total != 3 {
		t.Errorf("total = %d, want 3", total)
	}
	if len(items) != 2 {
		t.Errorf("items = %d, want 2", len(items))
	}
}

func TestService_CreateVersion_createsSnapshot(t *testing.T) {
	repo := newFakeRepo()
	svc := NewService(repo)

	req := &models.CreateFlowRequest{Name: "ver-test", Nodes: `[]`}
	flow, err := svc.CreateFlow(context.Background(), "t1", "u1", req)
	if err != nil {
		t.Fatalf("setup: %v", err)
	}

	snap, err := svc.CreateVersion(context.Background(), "t1", "u1", flow.ID)
	if err != nil {
		t.Fatalf("CreateVersion error: %v", err)
	}
	if snap.WorkflowID != flow.ID {
		t.Errorf("WorkflowID = %q, want %q", snap.WorkflowID, flow.ID)
	}
	if snap.Version != "1.0.0" {
		t.Errorf("Version = %q, want 1.0.0", snap.Version)
	}
}

func TestService_CreateVersion_notFound(t *testing.T) {
	svc := NewService(newFakeRepo())
	_, err := svc.CreateVersion(context.Background(), "t1", "u1", "ghost")
	if !errors.Is(err, ErrFlowNotFound) {
		t.Errorf("CreateVersion error = %v, want ErrFlowNotFound", err)
	}
}

func TestService_ExportWorkflow(t *testing.T) {
	repo := newFakeRepo()
	svc := NewService(repo)

	nodes := `[]`
	edges := `[]`
	req := &models.CreateFlowRequest{Name: "exp-test", Nodes: nodes, Edges: edges}
	flow, err := svc.CreateFlow(context.Background(), "t1", "u1", req)
	if err != nil {
		t.Fatalf("setup: %v", err)
	}

	resp, err := svc.ExportWorkflow(context.Background(), "t1", flow.ID)
	if err != nil {
		t.Fatalf("ExportWorkflow error: %v", err)
	}
	if resp.Name != "exp-test" {
		t.Errorf("Name = %q, want exp-test", resp.Name)
	}
	if resp.Definition.Nodes != nodes {
		t.Errorf("Nodes mismatch")
	}
}

func TestService_ExecuteFlow_notEnabled(t *testing.T) {
	repo := newFakeRepo()
	svc := NewService(repo)

	req := &models.CreateFlowRequest{Name: "exec-test"}
	flow, err := svc.CreateFlow(context.Background(), "t1", "u1", req)
	if err != nil {
		t.Fatalf("setup: %v", err)
	}

	_, err = svc.ExecuteFlow(context.Background(), "t1", "u1", flow.ID, `{}`)
	if !errors.Is(err, ErrFlowNotEnabled) {
		t.Errorf("ExecuteFlow error = %v, want ErrFlowNotEnabled", err)
	}
}

func TestService_ExecuteFlow_emptyDAG(t *testing.T) {
	repo := newFakeRepo()
	svc := NewService(repo)

	req := &models.CreateFlowRequest{Name: "exec-empty", Nodes: `[]`, Edges: `[]`}
	flow, err := svc.CreateFlow(context.Background(), "t1", "u1", req)
	if err != nil {
		t.Fatalf("setup: %v", err)
	}
	// CreateFlow creates disabled flows; manually enable in fake repo
	flow.Enabled = true
	repo.flows[flow.ID] = flow

	inst, err := svc.ExecuteFlow(context.Background(), "t1", "u1", flow.ID, `{}`)
	if err != nil {
		t.Fatalf("ExecuteFlow error: %v", err)
	}
	if inst.Status != "empty_dag" {
		t.Errorf("Status = %q, want empty_dag", inst.Status)
	}
}

func Test_bumpPatchVersion(t *testing.T) {
	tests := []struct {
		in    string
		want  string
	}{
		{"1.2.3", "1.2.4"},
		{"0.0.0", "0.0.1"},
		{"2.10.5", "2.10.6"},
		{"invalid", "invalid.0.1"},
		{"1.2", "1.2.0.1"},
	}
	for _, tt := range tests {
		got := bumpPatchVersion(tt.in)
		if got != tt.want {
			t.Errorf("bumpPatchVersion(%q) = %q, want %q", tt.in, got, tt.want)
		}
	}
}