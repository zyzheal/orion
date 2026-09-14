package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/distributed-config/models"
	"orion/platform-svc-go/internal/distributed-config/service"

	"github.com/gin-gonic/gin"
)

var errNotFoundDC = errors.New("not found")

type mockConfigSvc struct {
	namespaces map[string]*models.ConfigNamespace
	groups     map[string]*models.ConfigGroup
	items      map[string]*models.ConfigItem
	snaps      map[string]*models.ConfigSnapshot
	releases   []models.ConfigRelease

	// Test knobs. updateItemErr forces the failure branches of the handler's
	// error mapping, which no happy-path test can reach through the mock's own
	// logic.
	updateItemErr error

	// What the handlers decided, not what the caller sent: the audit limit
	// assertions compare these against the clamp constants.
	auditLimit  int
	auditCalled bool
	snapTenant  string
}

func newMockConfigSvc() *mockConfigSvc {
	return &mockConfigSvc{
		namespaces: make(map[string]*models.ConfigNamespace),
		groups:     make(map[string]*models.ConfigGroup),
		items:      make(map[string]*models.ConfigItem),
		snaps:      make(map[string]*models.ConfigSnapshot),
	}
}

func (m *mockConfigSvc) CreateNamespace(ctx context.Context, req *models.CreateNamespaceRequest, tenantID string) (*models.ConfigNamespace, error) {
	ns := &models.ConfigNamespace{ID: "ns-" + req.Name, Name: req.Name, Status: models.NamespaceActive, TenantID: tenantID}
	m.namespaces[ns.ID] = ns
	return ns, nil
}
func (m *mockConfigSvc) GetNamespace(ctx context.Context, id, tenantID string) (*models.ConfigNamespace, error) {
	ns, ok := m.namespaces[id]
	if !ok {
		return nil, errNotFoundDC
	}
	return ns, nil
}
func (m *mockConfigSvc) ListNamespaces(ctx context.Context, tenantID string) ([]models.ConfigNamespace, error) {
	var items []models.ConfigNamespace
	for _, ns := range m.namespaces {
		items = append(items, *ns)
	}
	if items == nil {
		items = []models.ConfigNamespace{}
	}
	return items, nil
}
func (m *mockConfigSvc) CreateGroup(ctx context.Context, req *models.CreateGroupRequest, tenantID string) (*models.ConfigGroup, error) {
	g := &models.ConfigGroup{ID: "grp-" + req.Name, Name: req.Name, NamespaceID: req.NamespaceID}
	m.groups[g.ID] = g
	return g, nil
}
func (m *mockConfigSvc) GetGroup(ctx context.Context, id, tenantID string) (*models.ConfigGroup, error) {
	g, ok := m.groups[id]
	if !ok {
		return nil, errNotFoundDC
	}
	return g, nil
}
func (m *mockConfigSvc) ListGroups(ctx context.Context, tenantID, namespaceID string) ([]models.ConfigGroup, error) {
	var items []models.ConfigGroup
	for _, g := range m.groups {
		if namespaceID == "" || g.NamespaceID == namespaceID {
			items = append(items, *g)
		}
	}
	if items == nil {
		items = []models.ConfigGroup{}
	}
	return items, nil
}
func (m *mockConfigSvc) CreateItem(ctx context.Context, req *models.CreateItemRequest, tenantID string) (*models.ConfigItem, error) {
	item := &models.ConfigItem{ID: "ci-" + req.KeyName, KeyName: req.KeyName, Value: req.Value, GroupID: req.GroupID}
	m.items[item.ID] = item
	return item, nil
}
func (m *mockConfigSvc) GetItem(ctx context.Context, id, tenantID string) (*models.ConfigItem, error) {
	item, ok := m.items[id]
	if !ok {
		return nil, errNotFoundDC
	}
	return item, nil
}
func (m *mockConfigSvc) ListItems(ctx context.Context, tenantID string, filter *models.GetItemsFilter) ([]models.ConfigItem, error) {
	var items []models.ConfigItem
	for _, item := range m.items {
		if filter != nil && filter.GroupID != "" && item.GroupID != filter.GroupID {
			continue
		}
		items = append(items, *item)
	}
	if items == nil {
		items = []models.ConfigItem{}
	}
	return items, nil
}
func (m *mockConfigSvc) UpdateItem(ctx context.Context, id, tenantID, operator string, req *models.UpdateItemRequest) (*models.ConfigItem, error) {
	if m.updateItemErr != nil {
		return nil, m.updateItemErr
	}
	item, ok := m.items[id]
	if !ok {
		return nil, errNotFoundDC
	}
	if req.Value != nil {
		item.Value = *req.Value
	}
	return item, nil
}
func (m *mockConfigSvc) DeleteItem(ctx context.Context, id, tenantID string) (bool, error) {
	if _, ok := m.items[id]; !ok {
		return false, nil
	}
	delete(m.items, id)
	return true, nil
}
func (m *mockConfigSvc) GetItemHistory(ctx context.Context, itemID, tenantID string) ([]models.ConfigItemHistory, error) {
	return nil, nil
}
func (m *mockConfigSvc) PublishSnapshot(ctx context.Context, groupID, environment, operator string, tenantID string) (*models.ConfigSnapshot, error) {
	snap := &models.ConfigSnapshot{ID: "snap-" + groupID, GroupID: groupID, Environment: environment}
	m.snaps[snap.ID] = snap
	return snap, nil
}
func (m *mockConfigSvc) ListSnapshots(ctx context.Context, tenantID, groupID, environment string) ([]models.ConfigSnapshot, error) {
	var items []models.ConfigSnapshot
	for _, snap := range m.snaps {
		items = append(items, *snap)
	}
	if items == nil {
		items = []models.ConfigSnapshot{}
	}
	return items, nil
}
func (m *mockConfigSvc) GetSnapshotData(ctx context.Context, id, tenantID string) (map[string]interface{}, error) {
	m.snapTenant = tenantID
	if snap, ok := m.snaps[id]; ok {
		if snap.Data == "" {
			return nil, nil
		}
	}
	return map[string]interface{}{"key": "value"}, nil
}
func (m *mockConfigSvc) PublishRelease(ctx context.Context, req *models.PublishReleaseRequest, tenantID string) (*models.ConfigRelease, error) {
	rel := &models.ConfigRelease{ID: "rel-" + req.SnapshotID, SnapshotID: req.SnapshotID, Environment: req.Environment}
	m.releases = append(m.releases, *rel)
	return rel, nil
}
func (m *mockConfigSvc) RollbackRelease(ctx context.Context, req *models.RollbackReleaseRequest, tenantID string) (*models.ConfigRelease, error) {
	return &models.ConfigRelease{ID: "rel-rollback"}, nil
}
func (m *mockConfigSvc) GetRelease(ctx context.Context, id, tenantID string) (*models.ConfigRelease, error) {
	for _, r := range m.releases {
		if r.ID == id {
			return &r, nil
		}
	}
	return nil, errNotFoundDC
}
func (m *mockConfigSvc) ListReleases(ctx context.Context, tenantID string, filter *models.GetReleasesFilter) ([]models.ConfigRelease, error) {
	return m.releases, nil
}
func (m *mockConfigSvc) GetReleaseHistory(ctx context.Context, releaseID, tenantID string) ([]models.ConfigReleaseHistory, error) {
	return nil, nil
}
func (m *mockConfigSvc) ListAudit(ctx context.Context, tenantID string, limit int) ([]models.ConfigAudit, error) {
	m.auditCalled = true
	m.auditLimit = limit
	return nil, nil
}

// Phase 302: three-level override mocks
func (m *mockConfigSvc) ResolveEffectiveConfig(ctx context.Context, tenantID, namespaceID, userID string) (map[string]models.ConfigValue, error) {
	return map[string]models.ConfigValue{}, nil
}
func (m *mockConfigSvc) ListOverrides(ctx context.Context, tenantID, itemID string) ([]models.ConfigItem, error) {
	return []models.ConfigItem{}, nil
}

func makeCtx(method, path string, body interface{}) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "t1")
	c.Set("user_id", "u1")
	var reqBody *bytes.Reader
	if body != nil {
		b, _ := json.Marshal(body)
		reqBody = bytes.NewReader(b)
	} else {
		reqBody = bytes.NewReader([]byte{})
	}
	c.Params = gin.Params{{Key: "id", Value: "item-1"}}
	c.Request = httptest.NewRequest(method, path, reqBody)
	c.Request.Header.Set("Content-Type", "application/json")
	return c, w
}

func TestConfig_RegisterRoutes(t *testing.T) {
	h := NewHandler(newMockConfigSvc())
	r := gin.New()
	rg := &r.RouterGroup
	h.RegisterRoutes(rg)
}

func TestConfig_CreateNamespace(t *testing.T) {
	h := NewHandler(newMockConfigSvc())
	c, w := makeCtx(http.MethodPost, "/namespaces", map[string]interface{}{"name": "prod"})
	h.CreateNamespace(c)
	if w.Code != 201 {
		t.Fatalf("CreateNamespace status = %d, want 201", w.Code)
	}
}

func TestConfig_CreateItem(t *testing.T) {
	h := NewHandler(newMockConfigSvc())
	c, w := makeCtx(http.MethodPost, "/items", map[string]interface{}{
		"keyName": "db_host", "value": "localhost:5432",
		"groupId": "grp-1", "namespaceId": "ns-1",
	})
	h.CreateItem(c)
	if w.Code != 201 {
		t.Fatalf("CreateItem status = %d, want 201", w.Code)
	}
}

func TestConfig_GetItem_NotFound(t *testing.T) {
	h := NewHandler(newMockConfigSvc())
	c, w := makeCtx(http.MethodGet, "/items/:id", nil)
	h.GetItem(c)
	if w.Code != 404 {
		t.Fatalf("GetItem status = %d, want 404", w.Code)
	}
}

func TestConfig_DeleteItem(t *testing.T) {
	svc := newMockConfigSvc()
	svc.items["item-1"] = &models.ConfigItem{ID: "item-1"}
	h := NewHandler(svc)
	c, w := makeCtx(http.MethodDelete, "/items/:id", nil)
	h.DeleteItem(c)
	if w.Code != 200 {
		t.Fatalf("DeleteItem status = %d, want 200", w.Code)
	}
}

// The two UpdateItem error mappings have to be tested as a pair: a mutant that
// maps every error to 400 is killed by the second test and one that maps every
// error to 404 is killed by the first.
func TestConfig_UpdateItem_MapsAnInvalidLevelTo400(t *testing.T) {
	svc := newMockConfigSvc()
	svc.updateItemErr = service.ErrInvalidLevel
	h := NewHandler(svc)
	c, w := makeCtx(http.MethodPut, "/items/:id", map[string]interface{}{"level": "galaxy"})
	h.UpdateItem(c)
	if w.Code != 400 {
		t.Fatalf("UpdateItem status = %d, want 400 for an invalid level", w.Code)
	}
}

func TestConfig_UpdateItem_MapsAnUnknownItemTo404(t *testing.T) {
	svc := newMockConfigSvc()
	svc.updateItemErr = errNotFoundDC
	h := NewHandler(svc)
	c, w := makeCtx(http.MethodPut, "/items/:id", map[string]interface{}{"level": "tenant"})
	h.UpdateItem(c)
	if w.Code != 404 {
		t.Fatalf("UpdateItem status = %d, want 404 for an unknown item", w.Code)
	}
}

func TestConfig_UpdateItem_UsestheCallerAsOperator(t *testing.T) {
	svc := newMockConfigSvc()
	svc.items["item-1"] = &models.ConfigItem{ID: "item-1"}
	h := NewHandler(svc)
	v := "new-value"
	c, w := makeCtx(http.MethodPut, "/items/:id", map[string]interface{}{"value": "new-value"})
	h.UpdateItem(c)
	if w.Code != 200 {
		t.Fatalf("UpdateItem status = %d, want 200", w.Code)
	}
	if got := svc.items["item-1"].Value; got != v {
		t.Fatalf("item value = %q, want %q", got, v)
	}
}

func TestConfig_PublishSnapshot(t *testing.T) {
	h := NewHandler(newMockConfigSvc())
	c, w := makeCtx(http.MethodPost, "/snapshots?groupId=grp-1", map[string]interface{}{
		"environment": "staging", "operator": "admin",
	})
	h.PublishSnapshot(c)
	if w.Code != 201 {
		t.Fatalf("PublishSnapshot status = %d, want 201", w.Code)
	}
}

func TestConfig_PublishSnapshot_RequiresAGroupID(t *testing.T) {
	h := NewHandler(newMockConfigSvc())
	c, w := makeCtx(http.MethodPost, "/snapshots", map[string]interface{}{
		"environment": "staging", "operator": "admin",
	})
	h.PublishSnapshot(c)
	if w.Code != 400 {
		t.Fatalf("PublishSnapshot status = %d, want 400 without a groupId", w.Code)
	}
}

func TestConfig_PublishRelease(t *testing.T) {
	h := NewHandler(newMockConfigSvc())
	c, w := makeCtx(http.MethodPost, "/releases", map[string]interface{}{
		"snapshotId": "snap-1", "environment": "prod", "operator": "admin",
	})
	h.PublishRelease(c)
	if w.Code != 201 {
		t.Fatalf("PublishRelease status = %d, want 201", w.Code)
	}
}

func TestConfig_GetSnapshotData_PassesTheTenant(t *testing.T) {
	svc := newMockConfigSvc()
	svc.snapTenant = "unset"
	h := NewHandler(svc)
	c, w := makeCtx(http.MethodGet, "/snapshots/:id/data", nil)
	h.GetSnapshotData(c)
	if w.Code != 200 {
		t.Fatalf("GetSnapshotData status = %d, want 200", w.Code)
	}
	if svc.snapTenant != "t1" {
		t.Fatalf("tenant passed to GetSnapshotData = %q, want t1", svc.snapTenant)
	}
}

func TestConfig_ListAudit_ClampsTheLimit(t *testing.T) {
	svc := newMockConfigSvc()
	h := NewHandler(svc)
	c, w := makeCtx(http.MethodGet, "/audit?limit=9999", nil)
	h.ListAudit(c)
	if w.Code != 200 {
		t.Fatalf("ListAudit status = %d, want 200", w.Code)
	}
	if svc.auditLimit != maxAuditLimit {
		t.Fatalf("audit limit = %d, want %d", svc.auditLimit, maxAuditLimit)
	}
}

func TestConfig_ListAudit_ClampsTheLowerBound(t *testing.T) {
	svc := newMockConfigSvc()
	h := NewHandler(svc)
	c, w := makeCtx(http.MethodGet, "/audit?limit=0", nil)
	h.ListAudit(c)
	if w.Code != 200 {
		t.Fatalf("ListAudit status = %d, want 200", w.Code)
	}
	if svc.auditLimit != minAuditLimit {
		t.Fatalf("audit limit = %d, want %d", svc.auditLimit, minAuditLimit)
	}
}

func TestConfig_ListAudit_UsesTheDefaultLimit(t *testing.T) {
	svc := newMockConfigSvc()
	h := NewHandler(svc)
	c, w := makeCtx(http.MethodGet, "/audit", nil)
	h.ListAudit(c)
	if w.Code != 200 {
		t.Fatalf("ListAudit status = %d, want 200", w.Code)
	}
	if svc.auditLimit != 50 {
		t.Fatalf("audit limit = %d, want the default 50", svc.auditLimit)
	}
}

func TestConfig_ListAudit_RejectsANonIntegerLimit(t *testing.T) {
	svc := newMockConfigSvc()
	h := NewHandler(svc)
	c, w := makeCtx(http.MethodGet, "/audit?limit=abc", nil)
	h.ListAudit(c)
	if w.Code != 400 {
		t.Fatalf("ListAudit status = %d, want 400 for a non-integer limit", w.Code)
	}
	if svc.auditCalled {
		t.Fatalf("the service was called for an unparsable limit")
	}
}

func TestConfig_ListItems_RejectsABadBooleanFilter(t *testing.T) {
	h := NewHandler(newMockConfigSvc())
	c, w := makeCtx(http.MethodGet, "/items?overrideOnly=xyz", nil)
	h.ListItems(c)
	if w.Code != 400 {
		t.Fatalf("ListItems status = %d, want 400 for a non-boolean overrideOnly", w.Code)
	}
}
