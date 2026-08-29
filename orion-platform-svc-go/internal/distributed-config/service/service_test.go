package service

import (
	"context"
	"testing"

	"orion/platform-svc-go/internal/distributed-config/models"
)

// --- Fake Repository ---

type fakeDCRepo struct {
	namespaces map[string]*models.ConfigNamespace
	groups     map[string]*models.ConfigGroup
	items      map[string]*models.ConfigItem
	snaps      map[string]*models.ConfigSnapshot
	releases   []models.ConfigRelease
	audits     []models.ConfigAudit
	history    map[string][]models.ConfigItemHistory
}

func newFakeDCRepo() *fakeDCRepo {
	return &fakeDCRepo{
		namespaces: make(map[string]*models.ConfigNamespace),
		groups:     make(map[string]*models.ConfigGroup),
		items:      make(map[string]*models.ConfigItem),
		snaps:      make(map[string]*models.ConfigSnapshot),
		history:    make(map[string][]models.ConfigItemHistory),
	}
}

func (f *fakeDCRepo) CreateNamespace(ctx context.Context, ns *models.ConfigNamespace) error {
	f.namespaces[ns.ID] = ns
	return nil
}

func (f *fakeDCRepo) GetNamespace(ctx context.Context, id, tenantID string) (*models.ConfigNamespace, error) {
	ns, ok := f.namespaces[id]
	if !ok {
		return nil, nil
	}
	return ns, nil
}

func (f *fakeDCRepo) ListNamespaces(ctx context.Context, tenantID string) ([]models.ConfigNamespace, error) {
	var items []models.ConfigNamespace
	for _, ns := range f.namespaces {
		if ns.TenantID == tenantID {
			items = append(items, *ns)
		}
	}
	return items, nil
}

func (f *fakeDCRepo) CreateGroup(ctx context.Context, g *models.ConfigGroup) error {
	f.groups[g.ID] = g
	return nil
}

func (f *fakeDCRepo) GetGroup(ctx context.Context, id, tenantID string) (*models.ConfigGroup, error) {
	g, ok := f.groups[id]
	if !ok {
		return nil, nil
	}
	return g, nil
}

func (f *fakeDCRepo) ListGroups(ctx context.Context, tenantID, namespaceID string) ([]models.ConfigGroup, error) {
	var items []models.ConfigGroup
	for _, g := range f.groups {
		if g.NamespaceID == namespaceID && g.TenantID == tenantID {
			items = append(items, *g)
		}
	}
	return items, nil
}

func (f *fakeDCRepo) CreateItem(ctx context.Context, item *models.ConfigItem) error {
	f.items[item.ID] = item
	return nil
}

func (f *fakeDCRepo) GetItem(ctx context.Context, id, tenantID string) (*models.ConfigItem, error) {
	item, ok := f.items[id]
	if !ok {
		return nil, nil
	}
	return item, nil
}

func (f *fakeDCRepo) ListItems(ctx context.Context, tenantID, groupID, namespaceID string) ([]models.ConfigItem, error) {
	var items []models.ConfigItem
	for _, item := range f.items {
		if item.TenantID != tenantID {
			continue
		}
		if groupID != "" && item.GroupID != groupID {
			continue
		}
		items = append(items, *item)
	}
	return items, nil
}

func (f *fakeDCRepo) UpdateItemValue(ctx context.Context, id, tenantID string, attrs map[string]interface{}) (*models.ConfigItem, error) {
	item, ok := f.items[id]
	if !ok {
		return nil, nil
	}
	if v, ok := attrs["value"]; ok {
		item.Value = v.(string)
	}
	if v, ok := attrs["value_type"]; ok {
		item.ValueType = models.ConfigValueType(v.(string))
	}
	return item, nil
}

func (f *fakeDCRepo) DeleteItem(ctx context.Context, id, tenantID string) (bool, error) {
	if _, ok := f.items[id]; !ok {
		return false, nil
	}
	delete(f.items, id)
	return true, nil
}

func (f *fakeDCRepo) GetItemLatestVersion(ctx context.Context, itemID string) (int, error) {
	return len(f.history[itemID]), nil
}

func (f *fakeDCRepo) CreateHistory(ctx context.Context, h *models.ConfigItemHistory) error {
	f.history[h.ItemID] = append(f.history[h.ItemID], *h)
	return nil
}

func (f *fakeDCRepo) GetItemHistory(ctx context.Context, itemID, tenantID string, limit int) ([]models.ConfigItemHistory, error) {
	return f.history[itemID], nil
}

func (f *fakeDCRepo) CreateSnapshot(ctx context.Context, snap *models.ConfigSnapshot) error {
	f.snaps[snap.ID] = snap
	return nil
}

func (f *fakeDCRepo) ListSnapshots(ctx context.Context, tenantID, groupID, env string) ([]models.ConfigSnapshot, error) {
	var items []models.ConfigSnapshot
	for _, snap := range f.snaps {
		if snap.GroupID == groupID {
			items = append(items, *snap)
		}
	}
	return items, nil
}

func (f *fakeDCRepo) GetSnapshot(ctx context.Context, id string) (*models.ConfigSnapshot, error) {
	snap, ok := f.snaps[id]
	if !ok {
		return nil, nil
	}
	return snap, nil
}

func (f *fakeDCRepo) GetLatestSnapshot(ctx context.Context, tenantID, groupID, env string) (*models.ConfigSnapshot, error) {
	var latest *models.ConfigSnapshot
	for _, snap := range f.snaps {
		if snap.GroupID == groupID && (latest == nil || snap.Version > latest.Version) {
			latest = snap
		}
	}
	return latest, nil
}

func (f *fakeDCRepo) GetSnapshotData(ctx context.Context, id string) (map[string]interface{}, error) {
	return nil, nil
}

func (f *fakeDCRepo) CreateRelease(ctx context.Context, r *models.ConfigRelease) error {
	f.releases = append(f.releases, *r)
	return nil
}

func (f *fakeDCRepo) GetRelease(ctx context.Context, id, tenantID string) (*models.ConfigRelease, error) {
	for _, r := range f.releases {
		if r.ID == id {
			return &r, nil
		}
	}
	return nil, nil
}

func (f *fakeDCRepo) ListReleases(ctx context.Context, tenantID, groupID, env string) ([]models.ConfigRelease, error) {
	return f.releases, nil
}

func (f *fakeDCRepo) UpdateRelease(ctx context.Context, id, tenantID string, attrs map[string]interface{}) (*models.ConfigRelease, error) {
	return nil, nil
}

func (f *fakeDCRepo) CreateReleaseHistory(ctx context.Context, h *models.ConfigReleaseHistory) error {
	return nil
}

func (f *fakeDCRepo) ListReleaseHistory(ctx context.Context, releaseID, tenantID string) ([]models.ConfigReleaseHistory, error) {
	return nil, nil
}

func (f *fakeDCRepo) CreateAudit(ctx context.Context, a *models.ConfigAudit) error {
	f.audits = append(f.audits, *a)
	return nil
}

func (f *fakeDCRepo) ListAudit(ctx context.Context, tenantID string, limit int) ([]models.ConfigAudit, error) {
	return f.audits, nil
}

// --- Tests ---

func TestDC_CreateNamespace(t *testing.T) {
	repo := newFakeDCRepo()
	svc := NewService(repo)

	ns, err := svc.CreateNamespace(context.Background(), &models.CreateNamespaceRequest{
		Name:        "production",
		Description: "prod configs",
	}, "t1")
	if err != nil {
		t.Fatalf("error: %v", err)
	}
	if ns.Name != "production" {
		t.Errorf("Name = %q", ns.Name)
	}
	if ns.Status != models.NamespaceActive {
		t.Errorf("Status = %q", ns.Status)
	}
}

func TestDC_CreateGroup_requiresNamespace(t *testing.T) {
	repo := newFakeDCRepo()
	svc := NewService(repo)

	ns, _ := svc.CreateNamespace(context.Background(), &models.CreateNamespaceRequest{Name: "ns1"}, "t1")

	g, err := svc.CreateGroup(context.Background(), &models.CreateGroupRequest{
		NamespaceID: ns.ID,
		Name:        "app-config",
	}, "t1")
	if err != nil {
		t.Fatalf("error: %v", err)
	}
	if g.NamespaceID != ns.ID {
		t.Errorf("NamespaceID mismatch")
	}
}

func TestDC_CreateGroup_rejectsArchivedNamespace(t *testing.T) {
	repo := newFakeDCRepo()
	svc := NewService(repo)

	ns, _ := svc.CreateNamespace(context.Background(), &models.CreateNamespaceRequest{Name: "old"}, "t1")
	repo.namespaces[ns.ID].Status = models.NamespaceArchived

	_, err := svc.CreateGroup(context.Background(), &models.CreateGroupRequest{
		NamespaceID: ns.ID,
		Name:        "grp",
	}, "t1")
	if err == nil {
		t.Error("CreateGroup on archived namespace should error")
	}
}

func TestDC_CreateItem_createsHistory(t *testing.T) {
	repo := newFakeDCRepo()
	svc := NewService(repo)

	ns, _ := svc.CreateNamespace(context.Background(), &models.CreateNamespaceRequest{Name: "ns"}, "t1")
	g, _ := svc.CreateGroup(context.Background(), &models.CreateGroupRequest{NamespaceID: ns.ID, Name: "grp"}, "t1")

	item, err := svc.CreateItem(context.Background(), &models.CreateItemRequest{
		GroupID:     g.ID,
		NamespaceID: ns.ID,
		KeyName:     "db.host",
		Value:       "localhost:5432",
		ValueType:   "string",
	}, "t1")
	if err != nil {
		t.Fatalf("error: %v", err)
	}
	if item.KeyName != "db.host" {
		t.Errorf("KeyName = %q", item.KeyName)
	}
	if len(repo.history[item.ID]) != 1 {
		t.Errorf("history count = %d, want 1", len(repo.history[item.ID]))
	}
}

func TestDC_CreateItem_defaultsValueType(t *testing.T) {
	repo := newFakeDCRepo()
	svc := NewService(repo)

	ns, _ := svc.CreateNamespace(context.Background(), &models.CreateNamespaceRequest{Name: "ns"}, "t1")
	g, _ := svc.CreateGroup(context.Background(), &models.CreateGroupRequest{NamespaceID: ns.ID, Name: "grp"}, "t1")

	item, _ := svc.CreateItem(context.Background(), &models.CreateItemRequest{
		GroupID:   g.ID,
		KeyName:   "key",
		Value:     "val",
		ValueType: "",
	}, "t1")
	if item.ValueType != models.ValueTypeString {
		t.Errorf("ValueType = %q, want %q", item.ValueType, models.ValueTypeString)
	}
}

func TestDC_UpdateItem_tracksHistory(t *testing.T) {
	repo := newFakeDCRepo()
	svc := NewService(repo)

	ns, _ := svc.CreateNamespace(context.Background(), &models.CreateNamespaceRequest{Name: "ns"}, "t1")
	g, _ := svc.CreateGroup(context.Background(), &models.CreateGroupRequest{NamespaceID: ns.ID, Name: "grp"}, "t1")
	item, _ := svc.CreateItem(context.Background(), &models.CreateItemRequest{
		GroupID: g.ID, KeyName: "k", Value: "v1",
	}, "t1")

	val := "v2"
	updated, err := svc.UpdateItem(context.Background(), item.ID, "t1", "admin", &models.UpdateItemRequest{Value: &val})
	if err != nil {
		t.Fatalf("error: %v", err)
	}
	if updated.Value != "v2" {
		t.Errorf("Value = %q, want v2", updated.Value)
	}
	if len(repo.history[item.ID]) != 2 {
		t.Errorf("history count = %d, want 2 (initial + update)", len(repo.history[item.ID]))
	}
}

func TestDC_PublishSnapshot_collectsItems(t *testing.T) {
	repo := newFakeDCRepo()
	svc := NewService(repo)

	ns, _ := svc.CreateNamespace(context.Background(), &models.CreateNamespaceRequest{Name: "ns"}, "t1")
	g, _ := svc.CreateGroup(context.Background(), &models.CreateGroupRequest{NamespaceID: ns.ID, Name: "grp"}, "t1")
	svc.CreateItem(context.Background(), &models.CreateItemRequest{
		GroupID: g.ID, KeyName: "a", Value: "1",
	}, "t1")
	svc.CreateItem(context.Background(), &models.CreateItemRequest{
		GroupID: g.ID, KeyName: "b", Value: "2",
	}, "t1")

	snap, err := svc.PublishSnapshot(context.Background(), g.ID, "staging", "admin", "t1")
	if err != nil {
		t.Fatalf("error: %v", err)
	}
	if snap.Environment != "staging" {
		t.Errorf("Environment = %q", snap.Environment)
	}
	if snap.Checksum == "" {
		t.Error("Checksum should not be empty")
	}
}

func TestDC_PublishRelease_incrementsVersion(t *testing.T) {
	repo := newFakeDCRepo()
	svc := NewService(repo)

	ns, _ := svc.CreateNamespace(context.Background(), &models.CreateNamespaceRequest{Name: "ns"}, "t1")
	g, _ := svc.CreateGroup(context.Background(), &models.CreateGroupRequest{NamespaceID: ns.ID, Name: "grp"}, "t1")
	svc.CreateItem(context.Background(), &models.CreateItemRequest{
		GroupID: g.ID, KeyName: "k", Value: "v",
	}, "t1")
	snap, _ := svc.PublishSnapshot(context.Background(), g.ID, "prod", "admin", "t1")

	rel, err := svc.PublishRelease(context.Background(), &models.PublishReleaseRequest{
		SnapshotID:  snap.ID,
		Environment: "prod",
		Operator:    "release-manager",
	}, "t1")
	if err != nil {
		t.Fatalf("error: %v", err)
	}
	if rel.ReleaseVersion != 1 {
		t.Errorf("ReleaseVersion = %d, want 1", rel.ReleaseVersion)
	}
	if rel.Status != models.ReleaseReleased {
		t.Errorf("Status = %q", rel.Status)
	}
}

func TestDC_ListAudit(t *testing.T) {
	repo := newFakeDCRepo()
	svc := NewService(repo)

	ns, _ := svc.CreateNamespace(context.Background(), &models.CreateNamespaceRequest{Name: "ns"}, "t1")

	audits, err := svc.ListAudit(context.Background(), "t1", 10)
	if err != nil {
		t.Fatalf("error: %v", err)
	}
	if len(audits) == 0 {
		t.Error("audit should have entry for namespace creation")
	}
	if audits[0].Action != "create" {
		t.Errorf("Action = %q, want create", audits[0].Action)
	}
	_ = ns
}
