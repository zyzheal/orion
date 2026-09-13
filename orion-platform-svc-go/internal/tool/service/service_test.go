package service

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/google/uuid"

	"orion/platform-svc-go/internal/tool/models"
)

// Service tests use recording fakes for the three repository interfaces. The
// service is programmed against the repository.Repository interfaces rather
// than the concrete repositories, which is what makes these assertions
// possible: every method on the tool and invocation fakes takes tenantID, so a
// test can fail when the caller's tenant is dropped or replaced.
//
// Pinned here:
//   - Create, Get, Update, Delete, GetVersions and GetToolStats all carry the
//     caller's tenant to the repository;
//   - InvokeTool sends the api_key from auth_config as a real Authorization
//     header and posts the input body, instead of the previous implementation
//     that discarded the key and sent a nil body;
//   - InvokeTool records the invocation (with input and output) even when the
//     endpoint call fails;
//   - GetInvocationDetail surfaces a not-found as "invocation not found" and
//     any other error unchanged (the handler maps those to 404 and 500);
//   - Create and Update both record versions, and Delete marks the tool
//     deleted rather than removing the row.

var (
	toolTenantA = "11111111-1111-1111-1111-111111111111"
	toolTenantB = "22222222-2222-2222-2222-222222222222"
	toolID      = "33333333-3333-3333-3333-333333333333"
	versionID   = "44444444-4444-4444-4444-444444444444"
	wrongID     = "55555555-5555-5555-5555-555555555555"
)

// fakeToolRepo records every call.
type fakeToolRepo struct {
	searchTenant string
	searchQ      string
	searchCalls  int
	found        []models.Tool
	searchErr    error

	createCalls int
	createTenant string
	created     *models.Tool

	getCalls  int
	getTenant string
	getID     string
	get       *models.Tool
	getErr    error

	updateCalls int
	updated     *models.Tool
	updateErr   error

	catTenant string
	cats      []models.ToolCategory
	catsErr   error
}

func (f *fakeToolRepo) Create(_ context.Context, tool *models.Tool) error {
	f.createCalls++
	f.createTenant = tool.TenantID
	f.created = tool
	return nil
}

func (f *fakeToolRepo) GetByID(_ context.Context, tenantID, id string) (*models.Tool, error) {
	f.getCalls++
	f.getTenant, f.getID = tenantID, id
	if f.getErr != nil {
		return nil, f.getErr
	}
	if f.get == nil {
		return nil, nil
	}
	if f.get.TenantID != tenantID {
		return nil, nil
	}
	return f.get, nil
}

func (f *fakeToolRepo) List(_ context.Context, tenantID string, params models.ToolListParams) ([]models.Tool, int, error) {
	return nil, 0, nil
}

func (f *fakeToolRepo) Update(_ context.Context, tool *models.Tool) error {
	f.updateCalls++
	f.updated = tool
	return f.updateErr
}

func (f *fakeToolRepo) GetCategories(_ context.Context, tenantID string) ([]models.ToolCategory, error) {
	f.catTenant = tenantID
	return f.cats, f.catsErr
}

func (f *fakeToolRepo) Search(_ context.Context, tenantID, query string, limit int) ([]models.Tool, error) {
	f.searchCalls++
	f.searchTenant, f.searchQ = tenantID, query
	if f.searchErr != nil {
		return nil, f.searchErr
	}
	return f.found, nil
}

type fakeInvRepo struct {
	createCalls int
	createTenant string
	createdID   string
	createErr   error

	detailTenant string
	detailID     string
	detail       *models.ToolInvocation
	detailErr    error

	listTenant string
	listToolID string
	list       []models.ToolInvocation
	listErr    error
}

func (f *fakeInvRepo) Create(_ context.Context, inv *models.ToolInvocation) error {
	f.createCalls++
	f.createTenant = inv.TenantID
	f.createdID = inv.ID
	return f.createErr
}

func (f *fakeInvRepo) GetByID(_ context.Context, tenantID, id string) (*models.ToolInvocation, error) {
	f.detailTenant, f.detailID = tenantID, id
	if f.detailErr != nil {
		return nil, f.detailErr
	}
	if f.detail == nil {
		return nil, nil
	}
	return f.detail, nil
}

func (f *fakeInvRepo) ListByTool(_ context.Context, tenantID, toolID string, limit, offset int) ([]models.ToolInvocation, error) {
	f.listTenant, f.listToolID = tenantID, toolID
	return f.list, f.listErr
}

func (f *fakeInvRepo) CountByTool(_ context.Context, tenantID, toolID string) (int, error) { return 0, nil }

func (f *fakeInvRepo) StatsByPeriod(_ context.Context, tenantID, period string) (*models.ToolStats, error) {
	return &models.ToolStats{}, nil
}

func (f *fakeInvRepo) StatsByTool(_ context.Context, tenantID, toolID string) (*models.ToolStats, error) {
	return &models.ToolStats{}, nil
}

func (f *fakeInvRepo) TopToolsByInvocations(_ context.Context, tenantID string, limit int) ([]models.ToolUsageRank, error) {
	return nil, nil
}

type fakeVerRepo struct {
	createCalls int
	createTenant string
	createToolID string
	versions    []models.ToolVersion
	listErr     error
}

func (f *fakeVerRepo) Create(_ context.Context, v *models.ToolVersion) error {
	f.createCalls++
	f.createToolID = v.ToolID
	return nil
}

func (f *fakeVerRepo) ListByTool(_ context.Context, toolID string) ([]models.ToolVersion, error) {
	return f.versions, f.listErr
}

// --- endpoint fake -------------------------------------------------------

// fakeToolServer is an httptest server that records the request it received.
// It is driven separately from the repository fakes: an endpoint invocation
// happens inside InvokeTool, and the test asserts on what the endpoint saw.
type fakeToolServer struct {
	srv         *httptest.Server
	gotBody     string
	gotAuth     string
	gotMethod   string
	statusCode  int
}

func (s *fakeToolServer) start(t *testing.T) {
	t.Helper()
	s.srv = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		s.gotMethod = r.Method
		s.gotAuth = r.Header.Get("Authorization")
		buf := make([]byte, 1024)
		n, _ := r.Body.Read(buf)
		s.gotBody = string(buf[:n])
		w.WriteHeader(s.statusCode)
	}))
	t.Cleanup(s.srv.Close)
}

func (s *fakeToolServer) url() string { return s.srv.URL }

func toolReq(name string) models.CreateToolRequest {
	return models.CreateToolRequest{
		Name: name, DisplayName: name, Category: "ci", Type: "api", Version: "1.0",
		Endpoint: "https://example.com/hook", AuthType: "none", AuthConfig: "{}",
	}
}

func TestCreatePropagatesTenantAndDefaults(t *testing.T) {
	repo := &fakeToolRepo{}
	svc := &ToolService{toolRepo: repo, invRepo: &fakeInvRepo{}, versionRepo: &fakeVerRepo{}}
	got, err := svc.Create(context.Background(), toolTenantA, "u-1", toolReq("tool-a"))
	if err != nil {
		t.Fatalf("Create() error = %v", err)
	}
	if got.TenantID != toolTenantA || got.CreatedBy != "u-1" {
		t.Fatalf("Create() = %+v, want tenant %s / by u-1", got, toolTenantA)
	}
	if got.Status != "active" || got.AuthType != "none" || got.Config != "{}" {
		t.Fatalf("Create() defaults = %+v", got)
	}
	if got.DisplayName != "tool-a" {
		t.Fatalf("DisplayName = %q, want the name", got.DisplayName)
	}
}

func TestCreateRejectsDuplicateNameWithinTenant(t *testing.T) {
	svc := &ToolService{
		toolRepo: &fakeToolRepo{found: []models.Tool{{ID: toolID, TenantID: toolTenantA, Name: "tool-a"}}},
		invRepo:  &fakeInvRepo{}, versionRepo: &fakeVerRepo{},
	}
	_, err := svc.Create(context.Background(), toolTenantA, "u-1", toolReq("tool-a"))
	if err == nil || !strings.Contains(err.Error(), "already exists") {
		t.Fatalf("Create() duplicate error = %v", err)
	}
}

func TestGetTenantScopedLookup(t *testing.T) {
	svc := &ToolService{
		toolRepo:    &fakeToolRepo{get: &models.Tool{ID: toolID, TenantID: toolTenantA, Name: "tool-a"}},
		invRepo:     &fakeInvRepo{}, versionRepo: &fakeVerRepo{},
	}
	got, err := svc.Get(context.Background(), toolTenantA, toolID)
	if err != nil {
		t.Fatalf("Get() error = %v", err)
	}
	if got == nil || got.Name != "tool-a" {
		t.Fatalf("Get() = %+v", got)
	}
	if _, err := svc.Get(context.Background(), toolTenantB, toolID); err == nil {
		t.Fatal("Get() did not reject a foreign tenant")
	}
}

func TestUpdateBindsTenantAndRecordsVersion(t *testing.T) {
	toolRepo := &fakeToolRepo{get: &models.Tool{ID: toolID, TenantID: toolTenantA, Name: "tool-a", Version: "1.0"}}
	verRepo := &fakeVerRepo{}
	svc := &ToolService{toolRepo: toolRepo, invRepo: &fakeInvRepo{}, versionRepo: verRepo}

	v2 := "2.0"
	got, err := svc.Update(context.Background(), toolTenantA, toolID, models.UpdateToolRequest{Version: &v2})
	if err != nil {
		t.Fatalf("Update() error = %v", err)
	}
	if got.Version != "2.0" {
		t.Fatalf("Update() version = %q", got.Version)
	}
	if verRepo.createCalls != 1 || verRepo.createToolID != toolID {
		t.Fatalf("version not recorded: calls=%d tool=%s", verRepo.createCalls, verRepo.createToolID)
	}
	if toolRepo.updateCalls != 1 {
		t.Fatal("tool row never updated")
	}
}

func TestUpdateForeignTenantIsNotFound(t *testing.T) {
	svc := &ToolService{
		toolRepo: &fakeToolRepo{get: &models.Tool{ID: toolID, TenantID: toolTenantA, Name: "tool-a"}},
		invRepo:  &fakeInvRepo{}, versionRepo: &fakeVerRepo{},
	}
	v2 := "2.0"
	_, err := svc.Update(context.Background(), toolTenantB, toolID, models.UpdateToolRequest{Version: &v2})
	if err == nil || !strings.Contains(err.Error(), "tool not found") {
		t.Fatalf("Update() foreign tenant error = %v", err)
	}
}

func TestInvokeToolSendsBodyAndAuthAndRecords(t *testing.T) {
	srv := &fakeToolServer{statusCode: http.StatusOK}
	srv.start(t)

	// The endpoint server must be reachable from the repository fake.
	svc := NewToolService(
		&fakeToolRepo{get: &models.Tool{ID: toolID, TenantID: toolTenantA, Name: "tool-a", Status: "active", Version: "1.0", Endpoint: srv.url(), AuthType: "api_key", AuthConfig: `{"api_key":"sekret"}`}},
		&fakeInvRepo{}, &fakeVerRepo{},
	)

	inv, err := svc.InvokeTool(context.Background(), toolTenantA, "u-1", toolID, "", models.InvokeToolRequest{Input: `{"query":"hello"}`})
	if err != nil {
		t.Fatalf("InvokeTool() error = %v", err)
	}
	if inv.Status != "success" {
		t.Fatalf("InvokeTool() status = %q", inv.Status)
	}
	if srv.gotMethod != "POST" || srv.gotBody != `{"query":"hello"}` {
		t.Fatalf("endpoint saw method=%s body=%q", srv.gotMethod, srv.gotBody)
	}
	if srv.gotAuth != "Bearer sekret" {
		t.Fatalf("endpoint auth = %q, want the api_key from auth_config", srv.gotAuth)
	}
}

func TestInvokeToolSendsNoAuthWhenNoneConfigured(t *testing.T) {
	srv := &fakeToolServer{statusCode: http.StatusOK}
	srv.start(t)
	svc := &ToolService{
		toolRepo:    &fakeToolRepo{get: &models.Tool{ID: toolID, TenantID: toolTenantA, Name: "tool-a", Status: "active", Version: "1.0", Endpoint: srv.url(), AuthType: "none"}},
		invRepo:     &fakeInvRepo{}, versionRepo: &fakeVerRepo{},
	}
	if _, err := svc.InvokeTool(context.Background(), toolTenantA, "u-1", toolID, "", models.InvokeToolRequest{Input: "{}"}); err != nil {
		t.Fatalf("InvokeTool() error = %v", err)
	}
	if srv.gotAuth != "" {
		t.Fatalf("endpoint auth = %q, want empty for AuthType none", srv.gotAuth)
	}
}

func TestInvokeToolRecordsErrorStateOnEndpointFailure(t *testing.T) {
	srv := &fakeToolServer{statusCode: http.StatusInternalServerError}
	srv.start(t)
	invRepo := &fakeInvRepo{}
	svc := &ToolService{
		toolRepo:    &fakeToolRepo{get: &models.Tool{ID: toolID, TenantID: toolTenantA, Name: "tool-a", Status: "active", Endpoint: srv.url()}},
		invRepo:     invRepo, versionRepo: &fakeVerRepo{},
	}
	inv, err := svc.InvokeTool(context.Background(), toolTenantA, "u-1", toolID, "", models.InvokeToolRequest{Input: "{}"})
	if err != nil {
		t.Fatalf("InvokeTool() error = %v", err)
	}
	if inv.Status != "error" || !inv.Error.Valid {
		t.Fatalf("InvokeTool() failure state = %+v", inv)
	}
	if invRepo.createCalls != 1 {
		t.Fatal("a failed invocation was not recorded")
	}
}

func TestInvokeToolWithoutEndpointSkipsCall(t *testing.T) {
	invRepo := &fakeInvRepo{}
	svc := &ToolService{
		toolRepo:    &fakeToolRepo{get: &models.Tool{ID: toolID, TenantID: toolTenantA, Name: "tool-a", Status: "active"}},
		invRepo:     invRepo, versionRepo: &fakeVerRepo{},
	}
	inv, err := svc.InvokeTool(context.Background(), toolTenantA, "u-1", toolID, "", models.InvokeToolRequest{Input: "{}"})
	if err != nil {
		t.Fatalf("InvokeTool() error = %v", err)
	}
	if inv.Status != "success" {
		t.Fatalf("no endpoint configured but status = %q, want the no-op success", inv.Status)
	}
	if invRepo.createCalls != 1 {
		t.Fatal("invocation was not recorded")
	}
}

func TestInvokeToolForeignTenantNotFound(t *testing.T) {
	svc := &ToolService{
		toolRepo: &fakeToolRepo{get: &models.Tool{ID: toolID, TenantID: toolTenantA, Name: "tool-a", Status: "active"}},
		invRepo:  &fakeInvRepo{}, versionRepo: &fakeVerRepo{},
	}
	_, err := svc.InvokeTool(context.Background(), toolTenantB, "u-1", toolID, "", models.InvokeToolRequest{Input: "{}"})
	if err == nil || !strings.Contains(err.Error(), "tool not found") {
		t.Fatalf("InvokeTool() foreign tenant error = %v", err)
	}
}

func TestGetInvocationDetailTenantScopedNotFound(t *testing.T) {
	svc := &ToolService{toolRepo: &fakeToolRepo{}, invRepo: &fakeInvRepo{}, versionRepo: &fakeVerRepo{}}
	_, err := svc.GetInvocationDetail(context.Background(), toolTenantA, wrongID)
	if err == nil || !strings.Contains(err.Error(), "invocation not found") {
		t.Fatalf("GetInvocationDetail() = %v", err)
	}
}

func TestGetInvocationDetailSurfacesRepoErrors(t *testing.T) {
	want := errors.New("db down")
	svc := &ToolService{toolRepo: &fakeToolRepo{}, invRepo: &fakeInvRepo{detailErr: want}, versionRepo: &fakeVerRepo{}}
	_, err := svc.GetInvocationDetail(context.Background(), toolTenantA, toolID)
	if !errors.Is(err, want) {
		t.Fatalf("GetInvocationDetail() error = %v, want %v", err, want)
	}
}

func TestGetVersionsResolvesTenantFirst(t *testing.T) {
	verRepo := &fakeVerRepo{versions: []models.ToolVersion{{ID: versionID, ToolID: toolID, Version: "1.0"}}}
	svc := &ToolService{
		toolRepo:    &fakeToolRepo{get: &models.Tool{ID: toolID, TenantID: toolTenantA, Name: "tool-a"}},
		invRepo:     &fakeInvRepo{}, versionRepo: verRepo,
	}
	versions, err := svc.GetVersions(context.Background(), toolTenantA, toolID)
	if err != nil {
		t.Fatalf("GetVersions() error = %v", err)
	}
	if len(versions) != 1 || versions[0].ToolID != toolID {
		t.Fatalf("GetVersions() = %+v", versions)
	}
	// A tool that belongs to another tenant must not resolve.
	_, err = svc.GetVersions(context.Background(), toolTenantB, toolID)
	if err == nil || !strings.Contains(err.Error(), "tool not found") {
		t.Fatalf("GetVersions() foreign tenant = %v", err)
	}
}

func TestCreateVersionChecksDeprecatedAndDuplicate(t *testing.T) {
	svc := &ToolService{
		toolRepo: &fakeToolRepo{get: &models.Tool{ID: toolID, TenantID: toolTenantA, Status: "deprecated"}},
		invRepo:  &fakeInvRepo{}, versionRepo: &fakeVerRepo{},
	}
	_, err := svc.CreateVersion(context.Background(), toolTenantA, "u-1", toolID, models.CreateToolVersionRequest{Version: "2.0"})
	if err == nil || !strings.Contains(err.Error(), "deprecated") {
		t.Fatalf("CreateVersion() on a deprecated tool = %v", err)
	}
}

func TestUUIDShapedIDsAreNotParsedToIntegers(t *testing.T) {
	// The previous implementation ran strconv.Atoi on the path parameter, so a
	// real UUID-shaped id was rejected before it ever reached the repository.
	// The tool service takes ids as strings and passes them through untouched.
	svc := &ToolService{
		toolRepo:    &fakeToolRepo{get: &models.Tool{ID: toolID, TenantID: toolTenantA, Name: "tool-a"}},
		invRepo:     &fakeInvRepo{}, versionRepo: &fakeVerRepo{},
	}
	if _, err := svc.Get(context.Background(), toolTenantA, toolID); err != nil {
		t.Fatalf("Get() with a UUID id = %v, want no parsing error", err)
	}
}

func TestToolAuthHeader(t *testing.T) {
	cases := []struct {
		name string
		tool *models.Tool
		want string
	}{
		{"api_key from config", &models.Tool{AuthType: "api_key", AuthConfig: `{"api_key":"k-123"}`}, "k-123"},
		{"api_key empty config", &models.Tool{AuthType: "api_key", AuthConfig: "{}"}, ""},
		{"api_key malformed config", &models.Tool{AuthType: "api_key", AuthConfig: "not-json"}, ""},
		{"none", &models.Tool{AuthType: "none", AuthConfig: "{}"}, ""},
		{"oauth2 unsupported", &models.Tool{AuthType: "oauth2", AuthConfig: `{"token":"t"}`}, ""},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := toolAuthHeader(tc.tool); got != tc.want {
				t.Fatalf("toolAuthHeader() = %q, want %q", got, tc.want)
			}
		})
	}
}

func TestUUIDStringsStayUUIDs(t *testing.T) {
	if _, err := uuid.Parse(toolID); err != nil {
		t.Fatalf("fixture %q is not a UUID", toolID)
	}
}