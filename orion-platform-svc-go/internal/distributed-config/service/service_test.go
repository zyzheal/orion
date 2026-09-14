package service

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"testing"

	"orion/platform-svc-go/internal/distributed-config/models"
)

// --- Fake Repository ---

// errRepoNotFound stands in for the sql.ErrNoRows the real repository returns
// when a tenant-scoped lookup misses. Returning a nil pair instead would let a
// service dereference the missing row and panic on a 200-shaped path.
var errRepoNotFound = errors.New("row not found")

type fakeDCRepo struct {
	namespaces map[string]*models.ConfigNamespace
	groups     map[string]*models.ConfigGroup
	items      map[string]*models.ConfigItem
	snaps      map[string]*models.ConfigSnapshot
	releases   []models.ConfigRelease
	audits     []models.ConfigAudit
	history    map[string][]models.ConfigItemHistory

	// releaseHistory is recorded so a test can prove the failure was reported
	// before the history row was written.
	releaseHistory []models.ConfigReleaseHistory

	// Injected failures, all defaulting to nil.
	itemVersionErr     error
	snapshotVersionErr error
	createHistoryErr   error
	releaseHistoryErr  error
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
	if !ok || ns.TenantID != tenantID {
		return nil, errRepoNotFound
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
	if !ok || g.TenantID != tenantID {
		return nil, errRepoNotFound
	}
	return g, nil
}

func (f *fakeDCRepo) ListGroups(ctx context.Context, tenantID, namespaceID string) ([]models.ConfigGroup, error) {
	var items []models.ConfigGroup
	for _, g := range f.groups {
		if g.TenantID != tenantID {
			continue
		}
		if namespaceID != "" && g.NamespaceID != namespaceID {
			continue
		}
		items = append(items, *g)
	}
	return items, nil
}

func (f *fakeDCRepo) CreateItem(ctx context.Context, item *models.ConfigItem) error {
	f.items[item.ID] = item
	return nil
}

func (f *fakeDCRepo) GetItem(ctx context.Context, id, tenantID string) (*models.ConfigItem, error) {
	item, ok := f.items[id]
	if !ok || item.TenantID != tenantID {
		return nil, errRepoNotFound
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
		if namespaceID != "" && item.NamespaceID != namespaceID {
			continue
		}
		items = append(items, *item)
	}
	return items, nil
}

// Phase 302: 支持 Level 过滤和 OverrideOnly 过滤
func (f *fakeDCRepo) ListItemsFiltered(ctx context.Context, tenantID string, filter *models.GetItemsFilter) ([]models.ConfigItem, error) {
	if filter == nil {
		return f.ListItems(ctx, tenantID, "", "")
	}
	var items []models.ConfigItem
	for _, item := range f.items {
		if item.TenantID != tenantID {
			continue
		}
		if filter.GroupID != "" && item.GroupID != filter.GroupID {
			continue
		}
		if filter.NamespaceID != "" && item.NamespaceID != filter.NamespaceID {
			continue
		}
		if filter.Level.IsValid() && item.Level != filter.Level {
			continue
		}
		if filter.OverrideOnly {
			// 检查是否存在下层 override_of = item.ID
			found := false
			for _, other := range f.items {
				if other.TenantID == tenantID && string(other.OverrideOf) == item.ID {
					found = true
					break
				}
			}
			if !found {
				continue
			}
		}
		items = append(items, *item)
	}
	return items, nil
}

// Phase 302: 列出被下层覆盖的 item
func (f *fakeDCRepo) ListOverrides(ctx context.Context, tenantID, itemID string) ([]models.ConfigItem, error) {
	var items []models.ConfigItem
	for _, item := range f.items {
		if item.TenantID == tenantID && string(item.OverrideOf) == itemID {
			items = append(items, *item)
		}
	}
	return items, nil
}

func (f *fakeDCRepo) UpdateItemValue(ctx context.Context, id, tenantID string, attrs map[string]interface{}) (*models.ConfigItem, error) {
	item, ok := f.items[id]
	if !ok || item.TenantID != tenantID {
		return nil, errRepoNotFound
	}
	if v, ok := attrs["value"]; ok {
		item.Value = v.(string)
	}
	if v, ok := attrs["value_type"]; ok {
		item.ValueType = models.ConfigValueType(v.(string))
	}
	if v, ok := attrs["encrypted"]; ok {
		item.Encrypted = v.(bool)
	}
	if v, ok := attrs["description"]; ok {
		item.Description = models.Text(v.(string))
	}
	if v, ok := attrs["labels"]; ok {
		item.Labels = models.Text(v.(string))
	}
	if v, ok := attrs["level"]; ok {
		item.Level = models.ConfigLevel(v.(string))
	}
	if v, ok := attrs["priority"]; ok {
		item.Priority = v.(int)
	}
	if v, ok := attrs["override_of"]; ok {
		item.OverrideOf = models.Text(v.(string))
	}
	return item, nil
}

func (f *fakeDCRepo) DeleteItem(ctx context.Context, id, tenantID string) (bool, error) {
	item, ok := f.items[id]
	if !ok || item.TenantID != tenantID {
		return false, nil
	}
	delete(f.items, id)
	return true, nil
}

func (f *fakeDCRepo) GetItemLatestVersion(ctx context.Context, tenantID, itemID string) (int, error) {
	if f.itemVersionErr != nil {
		return 0, f.itemVersionErr
	}
	latest := 0
	for _, h := range f.history[itemID] {
		if h.TenantID == tenantID && h.Version > latest {
			latest = h.Version
		}
	}
	return latest, nil
}

func (f *fakeDCRepo) CreateHistory(ctx context.Context, h *models.ConfigItemHistory) error {
	if f.createHistoryErr != nil {
		return f.createHistoryErr
	}
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
		if snap.TenantID != tenantID {
			continue
		}
		if groupID != "" && snap.GroupID != groupID {
			continue
		}
		if env != "" && snap.Environment != env {
			continue
		}
		items = append(items, *snap)
	}
	return items, nil
}

func (f *fakeDCRepo) GetSnapshot(ctx context.Context, id, tenantID string) (*models.ConfigSnapshot, error) {
	snap, ok := f.snaps[id]
	if !ok || snap.TenantID != tenantID {
		return nil, errRepoNotFound
	}
	return snap, nil
}

func (f *fakeDCRepo) GetLatestSnapshotVersion(ctx context.Context, tenantID, groupID, env string) (int, error) {
	if f.snapshotVersionErr != nil {
		return 0, f.snapshotVersionErr
	}
	latest := 0
	for _, snap := range f.snaps {
		if snap.TenantID == tenantID && snap.GroupID == groupID && snap.Environment == env && snap.Version > latest {
			latest = snap.Version
		}
	}
	return latest, nil
}

func (f *fakeDCRepo) GetSnapshotData(ctx context.Context, id, tenantID string) (map[string]interface{}, error) {
	snap, err := f.GetSnapshot(ctx, id, tenantID)
	if err != nil {
		return nil, err
	}
	if snap.Data == "" {
		return nil, nil
	}
	var data map[string]interface{}
	if err := json.Unmarshal([]byte(snap.Data), &data); err != nil {
		return nil, err
	}
	return data, nil
}

func (f *fakeDCRepo) CreateRelease(ctx context.Context, r *models.ConfigRelease) error {
	f.releases = append(f.releases, *r)
	return nil
}

func (f *fakeDCRepo) GetRelease(ctx context.Context, id, tenantID string) (*models.ConfigRelease, error) {
	for _, r := range f.releases {
		if r.ID == id && r.TenantID == tenantID {
			return &r, nil
		}
	}
	return nil, errRepoNotFound
}

func (f *fakeDCRepo) ListReleases(ctx context.Context, tenantID, groupID, env string) ([]models.ConfigRelease, error) {
	var items []models.ConfigRelease
	for _, r := range f.releases {
		if r.TenantID != tenantID {
			continue
		}
		if groupID != "" && r.GroupID != groupID {
			continue
		}
		if env != "" && r.Environment != env {
			continue
		}
		items = append(items, r)
	}
	return items, nil
}

func (f *fakeDCRepo) UpdateRelease(ctx context.Context, id, tenantID string, attrs map[string]interface{}) (*models.ConfigRelease, error) {
	for i := range f.releases {
		if f.releases[i].ID == id && f.releases[i].TenantID == tenantID {
			if v, ok := attrs["release_version"]; ok {
				f.releases[i].ReleaseVersion = v.(int)
			}
			if v, ok := attrs["status"]; ok {
				f.releases[i].Status = models.ReleaseStatus(v.(string))
			}
			if v, ok := attrs["release_note"]; ok {
				f.releases[i].ReleaseNote = models.Text(v.(string))
			}
			if v, ok := attrs["released_by"]; ok {
				f.releases[i].ReleasedBy = models.Text(v.(string))
			}
			if v, ok := attrs["rollback_to_snapshot_id"]; ok {
				f.releases[i].RollbackToSnapshotID = models.Text(v.(string))
			}
			return &f.releases[i], nil
		}
	}
	return nil, errRepoNotFound
}

func (f *fakeDCRepo) GetLatestReleaseVersion(ctx context.Context, tenantID, groupID, env string) (int, error) {
	latest := 0
	for _, r := range f.releases {
		if r.TenantID == tenantID && r.GroupID == groupID && r.Environment == env && r.ReleaseVersion > latest {
			latest = r.ReleaseVersion
		}
	}
	return latest, nil
}

func (f *fakeDCRepo) CreateReleaseHistory(ctx context.Context, h *models.ConfigReleaseHistory) error {
	if f.releaseHistoryErr != nil {
		return f.releaseHistoryErr
	}
	f.releaseHistory = append(f.releaseHistory, *h)
	return nil
}

func (f *fakeDCRepo) ListReleaseHistory(ctx context.Context, releaseID, tenantID string) ([]models.ConfigReleaseHistory, error) {
	var items []models.ConfigReleaseHistory
	for _, h := range f.releaseHistory {
		if h.TenantID == tenantID && h.ReleaseID == releaseID {
			items = append(items, h)
		}
	}
	return items, nil
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

	item, err := svc.CreateItem(context.Background(), &models.CreateItemRequest{
		GroupID:     g.ID,
		NamespaceID: ns.ID,
		KeyName:     "key",
		Value:       "val",
		ValueType:   "",
	}, "t1")
	if err != nil {
		t.Fatalf("error: %v", err)
	}
	if item.ValueType != models.ValueTypeString {
		t.Errorf("ValueType = %q, want %q", item.ValueType, models.ValueTypeString)
	}
}

func TestDC_CreateItem_rejectsANamespaceTheGroupIsNotIn(t *testing.T) {
	repo := newFakeDCRepo()
	svc := NewService(repo)

	ns, _ := svc.CreateNamespace(context.Background(), &models.CreateNamespaceRequest{Name: "ns"}, "t1")
	g, _ := svc.CreateGroup(context.Background(), &models.CreateGroupRequest{NamespaceID: ns.ID, Name: "grp"}, "t1")
	other, _ := svc.CreateNamespace(context.Background(), &models.CreateNamespaceRequest{Name: "other"}, "t1")

	item, err := svc.CreateItem(context.Background(), &models.CreateItemRequest{
		GroupID:     g.ID,
		NamespaceID: other.ID,
		KeyName:     "app.timeout",
		Value:       "60",
	}, "t1")
	if err == nil {
		t.Fatalf("expected an error, got item %v", item)
	}
	if !strings.Contains(err.Error(), "does not belong to namespace") {
		t.Fatalf("error = %q", err.Error())
	}
	if len(repo.items) != 0 {
		t.Errorf("items written = %d, want 0", len(repo.items))
	}
	if len(repo.history) != 0 {
		t.Errorf("history rows written = %d, want 0", len(repo.history))
	}
}

func TestDC_CreateItem_rejectsANUnknownNamespace(t *testing.T) {
	repo := newFakeDCRepo()
	svc := NewService(repo)

	ns, _ := svc.CreateNamespace(context.Background(), &models.CreateNamespaceRequest{Name: "ns"}, "t1")
	g, _ := svc.CreateGroup(context.Background(), &models.CreateGroupRequest{NamespaceID: ns.ID, Name: "grp"}, "t1")

	item, err := svc.CreateItem(context.Background(), &models.CreateItemRequest{
		GroupID:     g.ID,
		NamespaceID: "missing-namespace",
		KeyName:     "app.timeout",
		Value:       "60",
	}, "t1")
	if err == nil {
		t.Fatalf("expected an error, got item %v", item)
	}
	if !strings.Contains(err.Error(), "namespace not found") {
		t.Fatalf("error = %q", err.Error())
	}
	if len(repo.items) != 0 {
		t.Errorf("items written = %d, want 0", len(repo.items))
	}
}

func TestDC_CreateItem_ReportsAHistoryInsertFailure(t *testing.T) {
	repo := newFakeDCRepo()
	repo.createHistoryErr = errors.New("history insert failed")
	svc := NewService(repo)

	ns, _ := svc.CreateNamespace(context.Background(), &models.CreateNamespaceRequest{Name: "ns"}, "t1")
	g, _ := svc.CreateGroup(context.Background(), &models.CreateGroupRequest{NamespaceID: ns.ID, Name: "grp"}, "t1")

	item, err := svc.CreateItem(context.Background(), &models.CreateItemRequest{
		GroupID:     g.ID,
		NamespaceID: ns.ID,
		KeyName:     "app.timeout",
		Value:       "60",
	}, "t1")
	if err == nil {
		t.Fatalf("expected an error, got item %v", item)
	}
	if !strings.Contains(err.Error(), "writing create history") {
		t.Fatalf("error = %q", err.Error())
	}
	if len(repo.history) != 0 {
		t.Errorf("history rows written = %d, want 0", len(repo.history))
	}
}

func TestDC_UpdateItem_tracksHistory(t *testing.T) {
	repo := newFakeDCRepo()
	svc := NewService(repo)

	ns, _ := svc.CreateNamespace(context.Background(), &models.CreateNamespaceRequest{Name: "ns"}, "t1")
	g, _ := svc.CreateGroup(context.Background(), &models.CreateGroupRequest{NamespaceID: ns.ID, Name: "grp"}, "t1")
	item, err := svc.CreateItem(context.Background(), &models.CreateItemRequest{
		GroupID: g.ID, NamespaceID: ns.ID, KeyName: "k", Value: "v1",
	}, "t1")
	if err != nil {
		t.Fatalf("error: %v", err)
	}

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
	if repo.history[item.ID][1].Version != 2 {
		t.Errorf("history version = %d, want 2", repo.history[item.ID][1].Version)
	}
	if repo.history[item.ID][1].Operator != "admin" {
		t.Errorf("history operator = %q, want admin", repo.history[item.ID][1].Operator)
	}
}

func TestDC_UpdateItem_RejectsAnInvalidLevel(t *testing.T) {
	repo := newFakeDCRepo()
	svc := NewService(repo)

	ns, _ := svc.CreateNamespace(context.Background(), &models.CreateNamespaceRequest{Name: "ns"}, "t1")
	g, _ := svc.CreateGroup(context.Background(), &models.CreateGroupRequest{NamespaceID: ns.ID, Name: "grp"}, "t1")
	item, err := svc.CreateItem(context.Background(), &models.CreateItemRequest{
		GroupID: g.ID, NamespaceID: ns.ID, KeyName: "k", Value: "v1",
	}, "t1")
	if err != nil {
		t.Fatalf("error: %v", err)
	}

	level := models.ConfigLevel("bogus")
	got, err := svc.UpdateItem(context.Background(), item.ID, "t1", "admin", &models.UpdateItemRequest{Level: &level})
	if err == nil {
		t.Fatalf("expected an error, got %v", got)
	}
	if got != nil {
		t.Errorf("got = %v, want nil", got)
	}
	if !errors.Is(err, ErrInvalidLevel) {
		t.Errorf("error = %q, want ErrInvalidLevel", err.Error())
	}
	if repo.items[item.ID].Level != models.ConfigLevelTenant {
		t.Errorf("Level = %q, want tenant (unchanged)", repo.items[item.ID].Level)
	}
	if len(repo.history[item.ID]) != 1 {
		t.Errorf("history count = %d, want 1 (create only)", len(repo.history[item.ID]))
	}
}

func TestDC_UpdateItem_ReportsAHistoryLookupFailure(t *testing.T) {
	repo := newFakeDCRepo()
	repo.itemVersionErr = errors.New("history lookup failed")
	svc := NewService(repo)

	ns, _ := svc.CreateNamespace(context.Background(), &models.CreateNamespaceRequest{Name: "ns"}, "t1")
	g, _ := svc.CreateGroup(context.Background(), &models.CreateGroupRequest{NamespaceID: ns.ID, Name: "grp"}, "t1")
	item, err := svc.CreateItem(context.Background(), &models.CreateItemRequest{
		GroupID: g.ID, NamespaceID: ns.ID, KeyName: "k", Value: "v1",
	}, "t1")
	if err != nil {
		t.Fatalf("error: %v", err)
	}

	val := "v2"
	got, err := svc.UpdateItem(context.Background(), item.ID, "t1", "admin", &models.UpdateItemRequest{Value: &val})
	if err == nil {
		t.Fatalf("expected an error, got %v", got)
	}
	if got != nil {
		t.Errorf("got = %v, want nil", got)
	}
	if !strings.Contains(err.Error(), "looking up the latest version") {
		t.Fatalf("error = %q", err.Error())
	}
	if len(repo.history[item.ID]) != 1 {
		t.Errorf("history count = %d, want 1 (no update row written)", len(repo.history[item.ID]))
	}
}

func TestDC_UpdateItem_ReportsAHistoryInsertFailure(t *testing.T) {
	repo := newFakeDCRepo()
	svc := NewService(repo)

	ns, _ := svc.CreateNamespace(context.Background(), &models.CreateNamespaceRequest{Name: "ns"}, "t1")
	g, _ := svc.CreateGroup(context.Background(), &models.CreateGroupRequest{NamespaceID: ns.ID, Name: "grp"}, "t1")
	item, err := svc.CreateItem(context.Background(), &models.CreateItemRequest{
		GroupID: g.ID, NamespaceID: ns.ID, KeyName: "k", Value: "v1",
	}, "t1")
	if err != nil {
		t.Fatalf("error: %v", err)
	}

	// Armed only after the create: the create's own history row must succeed so
	// that the failure under test is unambiguously the update's.
	repo.createHistoryErr = errors.New("history insert failed")
	val := "v2"
	got, err := svc.UpdateItem(context.Background(), item.ID, "t1", "admin", &models.UpdateItemRequest{Value: &val})
	if err == nil {
		t.Fatalf("expected an error, got %v", got)
	}
	if got != nil {
		t.Errorf("got = %v, want nil", got)
	}
	if !strings.Contains(err.Error(), "writing update history") {
		t.Fatalf("error = %q", err.Error())
	}
	// The value itself did reach the item: only the history row failed.
	if repo.items[item.ID].Value != "v2" {
		t.Errorf("Value = %q, want v2", repo.items[item.ID].Value)
	}
}

func TestDC_GetItem_DecodesLabelsAndNormalisesTheLevel(t *testing.T) {
	repo := newFakeDCRepo()
	svc := NewService(repo)

	repo.items["it-1"] = &models.ConfigItem{
		ID:          "it-1",
		TenantID:    "t1",
		GroupID:     "g-1",
		NamespaceID: "ns-1",
		KeyName:     "db.host",
		Value:       "localhost:5432",
		ValueType:   models.ValueTypeString,
		Labels:      `{"env":"prod","tier":"core"}`,
		Level:       "",
		Priority:    0,
	}

	item, err := svc.GetItem(context.Background(), "it-1", "t1")
	if err != nil {
		t.Fatalf("error: %v", err)
	}
	if item.LabelsMap["env"] != "prod" {
		t.Errorf("LabelsMap[env] = %q, want prod", item.LabelsMap["env"])
	}
	if item.LabelsMap["tier"] != "core" {
		t.Errorf("LabelsMap[tier] = %q, want core", item.LabelsMap["tier"])
	}
	if item.Level != models.ConfigLevelTenant {
		t.Errorf("Level = %q, want tenant", item.Level)
	}
	if item.Priority != 50 {
		t.Errorf("Priority = %d, want 50", item.Priority)
	}
}

func TestDC_PublishSnapshot_collectsItems(t *testing.T) {
	repo := newFakeDCRepo()
	svc := NewService(repo)

	ns, _ := svc.CreateNamespace(context.Background(), &models.CreateNamespaceRequest{Name: "ns"}, "t1")
	g, _ := svc.CreateGroup(context.Background(), &models.CreateGroupRequest{NamespaceID: ns.ID, Name: "grp"}, "t1")
	_, err1 := svc.CreateItem(context.Background(), &models.CreateItemRequest{
		GroupID: g.ID, NamespaceID: ns.ID, KeyName: "a", Value: "1",
	}, "t1")
	_, err2 := svc.CreateItem(context.Background(), &models.CreateItemRequest{
		GroupID: g.ID, NamespaceID: ns.ID, KeyName: "b", Value: "2",
	}, "t1")
	if err1 != nil || err2 != nil {
		t.Fatalf("setup errors: %v %v", err1, err2)
	}

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
	if snap.Version != 1 {
		t.Errorf("Version = %d, want 1", snap.Version)
	}
	if snap.CreatedBy != "admin" {
		t.Errorf("CreatedBy = %q, want admin", snap.CreatedBy)
	}
}

func TestDC_PublishSnapshot_UsesTheSnapshotVersionCounter(t *testing.T) {
	repo := newFakeDCRepo()
	svc := NewService(repo)

	ns, _ := svc.CreateNamespace(context.Background(), &models.CreateNamespaceRequest{Name: "ns"}, "t1")
	g, _ := svc.CreateGroup(context.Background(), &models.CreateGroupRequest{NamespaceID: ns.ID, Name: "grp"}, "t1")
	_, err := svc.CreateItem(context.Background(), &models.CreateItemRequest{
		GroupID: g.ID, NamespaceID: ns.ID, KeyName: "k", Value: "v",
	}, "t1")
	if err != nil {
		t.Fatalf("error: %v", err)
	}

	first, err := svc.PublishSnapshot(context.Background(), g.ID, "prod", "admin", "t1")
	if err != nil {
		t.Fatalf("error: %v", err)
	}
	second, err := svc.PublishSnapshot(context.Background(), g.ID, "prod", "admin", "t1")
	if err != nil {
		t.Fatalf("error: %v", err)
	}
	third, err := svc.PublishSnapshot(context.Background(), g.ID, "staging", "admin", "t1")
	if err != nil {
		t.Fatalf("error: %v", err)
	}
	if first.Version != 1 || second.Version != 2 {
		t.Errorf("prod versions = %d, %d, want 1, 2", first.Version, second.Version)
	}
	// The counter is per group and environment, so a different environment
	// starts from one rather than continuing the other environment run.
	if third.Version != 1 {
		t.Errorf("staging version = %d, want 1", third.Version)
	}
}

func TestDC_PublishSnapshot_ReportsACounterFailure(t *testing.T) {
	repo := newFakeDCRepo()
	repo.snapshotVersionErr = errors.New("counter read failed")
	svc := NewService(repo)

	ns, _ := svc.CreateNamespace(context.Background(), &models.CreateNamespaceRequest{Name: "ns"}, "t1")
	g, _ := svc.CreateGroup(context.Background(), &models.CreateGroupRequest{NamespaceID: ns.ID, Name: "grp"}, "t1")

	snap, err := svc.PublishSnapshot(context.Background(), g.ID, "prod", "admin", "t1")
	if err == nil {
		t.Fatalf("expected an error, got %v", snap)
	}
	if snap != nil {
		t.Errorf("snap = %v, want nil", snap)
	}
	if !strings.Contains(err.Error(), "counter read failed") {
		t.Fatalf("error = %q", err.Error())
	}
	if len(repo.snaps) != 0 {
		t.Errorf("snapshots written = %d, want 0", len(repo.snaps))
	}
}

func TestDC_GetSnapshotData_DecodesTheStoredPayload(t *testing.T) {
	repo := newFakeDCRepo()
	svc := NewService(repo)

	ns, _ := svc.CreateNamespace(context.Background(), &models.CreateNamespaceRequest{Name: "ns"}, "t1")
	g, _ := svc.CreateGroup(context.Background(), &models.CreateGroupRequest{NamespaceID: ns.ID, Name: "grp"}, "t1")
	_, err := svc.CreateItem(context.Background(), &models.CreateItemRequest{
		GroupID: g.ID, NamespaceID: ns.ID, KeyName: "db.host", Value: "localhost:5432",
	}, "t1")
	if err != nil {
		t.Fatalf("error: %v", err)
	}
	snap, err := svc.PublishSnapshot(context.Background(), g.ID, "prod", "admin", "t1")
	if err != nil {
		t.Fatalf("error: %v", err)
	}

	data, err := svc.GetSnapshotData(context.Background(), snap.ID, "t1")
	if err != nil {
		t.Fatalf("error: %v", err)
	}
	if data["db.host"] != "localhost:5432" {
		t.Errorf("data[db.host] = %v, want localhost:5432", data["db.host"])
	}
	if _, err := svc.GetSnapshotData(context.Background(), snap.ID, "t2"); err == nil {
		t.Error("expected a cross-tenant read to fail")
	}
}

func TestDC_PublishRelease_incrementsVersion(t *testing.T) {
	repo := newFakeDCRepo()
	svc := NewService(repo)

	ns, _ := svc.CreateNamespace(context.Background(), &models.CreateNamespaceRequest{Name: "ns"}, "t1")
	g, _ := svc.CreateGroup(context.Background(), &models.CreateGroupRequest{NamespaceID: ns.ID, Name: "grp"}, "t1")
	_, err0 := svc.CreateItem(context.Background(), &models.CreateItemRequest{
		GroupID: g.ID, NamespaceID: ns.ID, KeyName: "k", Value: "v",
	}, "t1")
	if err0 != nil {
		t.Fatalf("error: %v", err0)
	}
	snap, err := svc.PublishSnapshot(context.Background(), g.ID, "prod", "admin", "t1")
	if err != nil {
		t.Fatalf("error: %v", err)
	}

	rel, err := svc.PublishRelease(context.Background(), &models.PublishReleaseRequest{
		SnapshotID:  snap.ID,
		Environment: "prod",
		Operator:    "release-manager",
		ReleaseNote: "n1",
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
	if rel.GroupID != g.ID {
		t.Errorf("GroupID = %q, want %q", rel.GroupID, g.ID)
	}
	if rel.ReleaseNote != models.Text("n1") {
		t.Errorf("ReleaseNote = %q", rel.ReleaseNote)
	}
	if rel.ReleasedAt == nil {
		t.Error("ReleasedAt should be set")
	}
}

func TestDC_PublishRelease_IncrementsOverAPreviousRelease(t *testing.T) {
	repo := newFakeDCRepo()
	svc := NewService(repo)

	ns, _ := svc.CreateNamespace(context.Background(), &models.CreateNamespaceRequest{Name: "ns"}, "t1")
	g, _ := svc.CreateGroup(context.Background(), &models.CreateGroupRequest{NamespaceID: ns.ID, Name: "grp"}, "t1")
	_, _ = svc.CreateItem(context.Background(), &models.CreateItemRequest{
		GroupID: g.ID, NamespaceID: ns.ID, KeyName: "k", Value: "v",
	}, "t1")
	snap, err := svc.PublishSnapshot(context.Background(), g.ID, "prod", "admin", "t1")
	if err != nil {
		t.Fatalf("error: %v", err)
	}

	first, err := svc.PublishRelease(context.Background(), &models.PublishReleaseRequest{
		SnapshotID:  snap.ID,
		Environment: "prod",
		Operator:    "release-manager",
	}, "t1")
	if err != nil {
		t.Fatalf("error: %v", err)
	}
	second, err := svc.PublishRelease(context.Background(), &models.PublishReleaseRequest{
		SnapshotID:  snap.ID,
		Environment: "prod",
		Operator:    "release-manager",
	}, "t1")
	if err != nil {
		t.Fatalf("error: %v", err)
	}
	if first.ReleaseVersion != 1 {
		t.Errorf("first ReleaseVersion = %d, want 1", first.ReleaseVersion)
	}
	if second.ReleaseVersion != 2 {
		t.Errorf("second ReleaseVersion = %d, want 2", second.ReleaseVersion)
	}
	if len(repo.releaseHistory) != 2 {
		t.Errorf("release history rows = %d, want 2", len(repo.releaseHistory))
	}
	if repo.releaseHistory[0].Action != "publish" {
		t.Errorf("release history action = %q, want publish", repo.releaseHistory[0].Action)
	}
	if repo.releaseHistory[1].Version != 2 {
		t.Errorf("release history version = %d, want 2", repo.releaseHistory[1].Version)
	}
}

func TestDC_PublishRelease_ReportsAHistoryInsertFailure(t *testing.T) {
	repo := newFakeDCRepo()
	repo.releaseHistoryErr = errors.New("release history insert failed")
	svc := NewService(repo)

	ns, _ := svc.CreateNamespace(context.Background(), &models.CreateNamespaceRequest{Name: "ns"}, "t1")
	g, _ := svc.CreateGroup(context.Background(), &models.CreateGroupRequest{NamespaceID: ns.ID, Name: "grp"}, "t1")
	_, _ = svc.CreateItem(context.Background(), &models.CreateItemRequest{
		GroupID: g.ID, NamespaceID: ns.ID, KeyName: "k", Value: "v",
	}, "t1")
	snap, err := svc.PublishSnapshot(context.Background(), g.ID, "prod", "admin", "t1")
	if err != nil {
		t.Fatalf("error: %v", err)
	}

	rel, err := svc.PublishRelease(context.Background(), &models.PublishReleaseRequest{
		SnapshotID:  snap.ID,
		Environment: "prod",
		Operator:    "release-manager",
	}, "t1")
	if err == nil {
		t.Fatalf("expected an error, got %v", rel)
	}
	if rel != nil {
		t.Errorf("rel = %v, want nil", rel)
	}
	if !strings.Contains(err.Error(), "writing release history") {
		t.Fatalf("error = %q", err.Error())
	}
	if len(repo.releaseHistory) != 0 {
		t.Errorf("release history rows written = %d, want 0", len(repo.releaseHistory))
	}
}

func TestDC_RollbackRelease_UsesTheSnapshotGroupAndEnvironment(t *testing.T) {
	repo := newFakeDCRepo()
	svc := NewService(repo)

	ns, _ := svc.CreateNamespace(context.Background(), &models.CreateNamespaceRequest{Name: "ns"}, "t1")
	g, _ := svc.CreateGroup(context.Background(), &models.CreateGroupRequest{NamespaceID: ns.ID, Name: "grp"}, "t1")
	_, _ = svc.CreateItem(context.Background(), &models.CreateItemRequest{
		GroupID: g.ID, NamespaceID: ns.ID, KeyName: "k", Value: "v",
	}, "t1")
	snap, err := svc.PublishSnapshot(context.Background(), g.ID, "prod", "admin", "t1")
	if err != nil {
		t.Fatalf("error: %v", err)
	}
	published, err := svc.PublishRelease(context.Background(), &models.PublishReleaseRequest{
		SnapshotID: snap.ID, Environment: "prod", Operator: "release-manager",
	}, "t1")
	if err != nil {
		t.Fatalf("error: %v", err)
	}

	rel, err := svc.RollbackRelease(context.Background(), &models.RollbackReleaseRequest{
		SnapshotID: snap.ID,
		Operator:   "release-manager",
		Reason:     "bad release",
	}, "t1")
	if err != nil {
		t.Fatalf("error: %v", err)
	}
	if rel.GroupID != g.ID {
		t.Errorf("GroupID = %q, want %q", rel.GroupID, g.ID)
	}
	// The request has no environment field, so the rollback must inherit the
	// snapshot's: a rollback of a prod snapshot used to be filed as the empty
	// environment.
	if rel.Environment != "prod" {
		t.Errorf("Environment = %q, want prod", rel.Environment)
	}
	if rel.ReleaseVersion != published.ReleaseVersion+1 {
		t.Errorf("ReleaseVersion = %d, want %d", rel.ReleaseVersion, published.ReleaseVersion+1)
	}
	if rel.Status != models.ReleaseRollback {
		t.Errorf("Status = %q, want rollback", rel.Status)
	}
	if rel.RollbackToSnapshotID != models.Text(snap.ID) {
		t.Errorf("RollbackToSnapshotID = %q, want %q", rel.RollbackToSnapshotID, snap.ID)
	}
	if rel.ReleaseNote != models.Text("bad release") {
		t.Errorf("ReleaseNote = %q", rel.ReleaseNote)
	}
	if rel.ReleasedAt == nil {
		t.Error("ReleasedAt should be set")
	}
	// Both the publish and the rollback were recorded, so the rollback is the
	// second row rather than the only one.
	if len(repo.releaseHistory) != 2 {
		t.Fatalf("release history rows = %d, want 2", len(repo.releaseHistory))
	}
	if repo.releaseHistory[1].Action != "rollback" {
		t.Errorf("release history action = %q, want rollback", repo.releaseHistory[1].Action)
	}
	if repo.releaseHistory[1].Version != rel.ReleaseVersion {
		t.Errorf("release history version = %d, want %d", repo.releaseHistory[1].Version, rel.ReleaseVersion)
	}
	if repo.releaseHistory[1].Environment != "prod" {
		t.Errorf("release history environment = %q, want prod", repo.releaseHistory[1].Environment)
	}
	if repo.releaseHistory[1].Operator != models.Text("release-manager") {
		t.Errorf("release history operator = %q, want release-manager", repo.releaseHistory[1].Operator)
	}
}

func TestDC_RollbackRelease_ReportsAHistoryInsertFailure(t *testing.T) {
	repo := newFakeDCRepo()
	repo.releaseHistoryErr = errors.New("rollback history insert failed")
	svc := NewService(repo)

	ns, _ := svc.CreateNamespace(context.Background(), &models.CreateNamespaceRequest{Name: "ns"}, "t1")
	g, _ := svc.CreateGroup(context.Background(), &models.CreateGroupRequest{NamespaceID: ns.ID, Name: "grp"}, "t1")
	_, _ = svc.CreateItem(context.Background(), &models.CreateItemRequest{
		GroupID: g.ID, NamespaceID: ns.ID, KeyName: "k", Value: "v",
	}, "t1")
	snap, err := svc.PublishSnapshot(context.Background(), g.ID, "prod", "admin", "t1")
	if err != nil {
		t.Fatalf("error: %v", err)
	}

	rel, err := svc.RollbackRelease(context.Background(), &models.RollbackReleaseRequest{
		SnapshotID: snap.ID, Operator: "release-manager", Reason: "bad release",
	}, "t1")
	if err == nil {
		t.Fatalf("expected an error, got %v", rel)
	}
	if rel != nil {
		t.Errorf("rel = %v, want nil", rel)
	}
	if !strings.Contains(err.Error(), "writing rollback history") {
		t.Fatalf("error = %q", err.Error())
	}
	if len(repo.releaseHistory) != 0 {
		t.Errorf("release history rows written = %d, want 0", len(repo.releaseHistory))
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

// --- Phase 302: 三层 Level 覆盖测试 ---

func TestDC_ConfigLevel_IsValid(t *testing.T) {
	tests := []struct {
		level    models.ConfigLevel
		expected bool
	}{
		{models.ConfigLevelPlatform, true},
		{models.ConfigLevelTenant, true},
		{models.ConfigLevelUser, true},
		{"", false},
		{"invalid", false},
		{"PLATFORM", false}, // 大小写敏感
	}
	for _, tt := range tests {
		if got := tt.level.IsValid(); got != tt.expected {
			t.Errorf("Level(%q).IsValid() = %v, want %v", tt.level, got, tt.expected)
		}
	}
}

func TestDC_ConfigLevel_Priority(t *testing.T) {
	tests := []struct {
		level    models.ConfigLevel
		expected int
	}{
		{models.ConfigLevelPlatform, 100},
		{models.ConfigLevelTenant, 50},
		{models.ConfigLevelUser, 10},
		{"", 0},
		{"invalid", 0},
	}
	for _, tt := range tests {
		if got := tt.level.Priority(); got != tt.expected {
			t.Errorf("Level(%q).Priority() = %d, want %d", tt.level, got, tt.expected)
		}
	}
}

func TestDC_NormalizeLevel(t *testing.T) {
	if got := models.NormalizeLevel(models.ConfigLevelPlatform); got != models.ConfigLevelPlatform {
		t.Errorf("NormalizeLevel(platform) = %q, want platform", got)
	}
	if got := models.NormalizeLevel(""); got != models.ConfigLevelTenant {
		t.Errorf("NormalizeLevel(empty) = %q, want tenant", got)
	}
	if got := models.NormalizeLevel("invalid"); got != models.ConfigLevelTenant {
		t.Errorf("NormalizeLevel(invalid) = %q, want tenant", got)
	}
}

func TestDC_CreateItem_DefaultLevel(t *testing.T) {
	repo := newFakeDCRepo()
	svc := NewService(repo)

	// 先创建 namespace 和 group
	ns, _ := svc.CreateNamespace(context.Background(), &models.CreateNamespaceRequest{Name: "ns"}, "t1")
	g, _ := svc.CreateGroup(context.Background(), &models.CreateGroupRequest{NamespaceID: ns.ID, Name: "grp"}, "t1")

	// 不指定 Level，应默认为 tenant
	item, err := svc.CreateItem(context.Background(), &models.CreateItemRequest{
		GroupID:     g.ID,
		NamespaceID: ns.ID,
		KeyName:     "app.timeout",
		Value:       "30",
	}, "t1")
	if err != nil {
		t.Fatalf("CreateItem error: %v", err)
	}
	if item.Level != models.ConfigLevelTenant {
		t.Errorf("Level = %q, want tenant (default)", item.Level)
	}
	if item.Priority != 50 {
		t.Errorf("Priority = %d, want 50 (tenant)", item.Priority)
	}
}

func TestDC_CreateItem_ExplicitLevel(t *testing.T) {
	repo := newFakeDCRepo()
	svc := NewService(repo)
	ns, _ := svc.CreateNamespace(context.Background(), &models.CreateNamespaceRequest{Name: "ns"}, "t1")
	g, _ := svc.CreateGroup(context.Background(), &models.CreateGroupRequest{NamespaceID: ns.ID, Name: "grp"}, "t1")

	item, err := svc.CreateItem(context.Background(), &models.CreateItemRequest{
		GroupID:     g.ID,
		NamespaceID: ns.ID,
		KeyName:     "app.timeout",
		Value:       "60",
		Level:       models.ConfigLevelPlatform,
	}, "t1")
	if err != nil {
		t.Fatalf("CreateItem error: %v", err)
	}
	if item.Level != models.ConfigLevelPlatform {
		t.Errorf("Level = %q, want platform", item.Level)
	}
	if item.Priority != 100 {
		t.Errorf("Priority = %d, want 100 (platform)", item.Priority)
	}
}

func TestDC_CreateItem_InvalidLevel(t *testing.T) {
	repo := newFakeDCRepo()
	svc := NewService(repo)
	ns, _ := svc.CreateNamespace(context.Background(), &models.CreateNamespaceRequest{Name: "ns"}, "t1")
	g, _ := svc.CreateGroup(context.Background(), &models.CreateGroupRequest{NamespaceID: ns.ID, Name: "grp"}, "t1")

	got, err := svc.CreateItem(context.Background(), &models.CreateItemRequest{
		GroupID:     g.ID,
		NamespaceID: ns.ID,
		KeyName:     "app.timeout",
		Value:       "60",
		Level:       "invalid",
	}, "t1")
	if err == nil {
		t.Fatalf("expected an error, got %v", got)
	}
	if got != nil {
		t.Errorf("got = %v, want nil", got)
	}
	if !errors.Is(err, ErrInvalidLevel) {
		t.Errorf("error = %q, want ErrInvalidLevel", err.Error())
	}
}

func TestDC_ResolveEffectiveConfig_PlatformOnly(t *testing.T) {
	repo := newFakeDCRepo()
	svc := NewService(repo)
	ns, _ := svc.CreateNamespace(context.Background(), &models.CreateNamespaceRequest{Name: "ns"}, "t1")
	g, _ := svc.CreateGroup(context.Background(), &models.CreateGroupRequest{NamespaceID: ns.ID, Name: "grp"}, "t1")

	// 只有 platform 层配置
	_, _ = svc.CreateItem(context.Background(), &models.CreateItemRequest{
		GroupID:     g.ID,
		NamespaceID: ns.ID,
		KeyName:     "app.timeout",
		Value:       "30",
		Level:       models.ConfigLevelPlatform,
	}, "t1")

	result, err := svc.ResolveEffectiveConfig(context.Background(), "t1", ns.ID, "")
	if err != nil {
		t.Fatalf("ResolveEffectiveConfig error: %v", err)
	}
	cv, ok := result["app.timeout"]
	if !ok {
		t.Fatal("expected app.timeout in effective config")
	}
	if cv.Level != models.ConfigLevelPlatform {
		t.Errorf("Level = %q, want platform", cv.Level)
	}
	if cv.Value != "30" {
		t.Errorf("Value = %q, want 30", cv.Value)
	}
	if cv.Priority != 100 {
		t.Errorf("Priority = %d, want 100", cv.Priority)
	}
}

func TestDC_ResolveEffectiveConfig_TenantOverridePlatform(t *testing.T) {
	repo := newFakeDCRepo()
	svc := NewService(repo)
	ns, _ := svc.CreateNamespace(context.Background(), &models.CreateNamespaceRequest{Name: "ns"}, "t1")
	g, _ := svc.CreateGroup(context.Background(), &models.CreateGroupRequest{NamespaceID: ns.ID, Name: "grp"}, "t1")

	// platform 层（priority 100）
	_, _ = svc.CreateItem(context.Background(), &models.CreateItemRequest{
		GroupID:     g.ID,
		NamespaceID: ns.ID,
		KeyName:     "app.timeout",
		Value:       "30",
		Level:       models.ConfigLevelPlatform,
	}, "t1")
	// tenant 层（priority 50）——按新规则 platform 应优先
	_, _ = svc.CreateItem(context.Background(), &models.CreateItemRequest{
		GroupID:     g.ID,
		NamespaceID: ns.ID,
		KeyName:     "app.timeout",
		Value:       "60",
		Level:       models.ConfigLevelTenant,
	}, "t1")

	result, _ := svc.ResolveEffectiveConfig(context.Background(), "t1", ns.ID, "")
	cv := result["app.timeout"]
	// platform(100) > tenant(50)，所以 platform 优先
	if cv.Level != models.ConfigLevelPlatform {
		t.Errorf("Level = %q, want platform (higher priority)", cv.Level)
	}
	if cv.Value != "30" {
		t.Errorf("Value = %q, want 30 (from platform)", cv.Value)
	}
}

func TestDC_ResolveEffectiveConfig_UserOverrideTenant(t *testing.T) {
	repo := newFakeDCRepo()
	svc := NewService(repo)
	ns, _ := svc.CreateNamespace(context.Background(), &models.CreateNamespaceRequest{Name: "ns"}, "t1")
	g, _ := svc.CreateGroup(context.Background(), &models.CreateGroupRequest{NamespaceID: ns.ID, Name: "grp"}, "t1")

	// tenant 层
	_, _ = svc.CreateItem(context.Background(), &models.CreateItemRequest{
		GroupID:     g.ID,
		NamespaceID: ns.ID,
		KeyName:     "app.timeout",
		Value:       "60",
		Level:       models.ConfigLevelTenant,
	}, "t1")
	// user 层（priority 10）
	_, _ = svc.CreateItem(context.Background(), &models.CreateItemRequest{
		GroupID:     g.ID,
		NamespaceID: ns.ID,
		KeyName:     "app.timeout",
		Value:       "90",
		Level:       models.ConfigLevelUser,
	}, "t1")

	result, _ := svc.ResolveEffectiveConfig(context.Background(), "t1", ns.ID, "")
	cv := result["app.timeout"]
	// tenant(50) > user(10)，所以 tenant 优先
	if cv.Level != models.ConfigLevelTenant {
		t.Errorf("Level = %q, want tenant (higher than user)", cv.Level)
	}
	if cv.Value != "60" {
		t.Errorf("Value = %q, want 60 (from tenant)", cv.Value)
	}
}

func TestDC_ResolveEffectiveConfig_LegacyNoLevel(t *testing.T) {
	repo := newFakeDCRepo()
	svc := NewService(repo)
	ns, _ := svc.CreateNamespace(context.Background(), &models.CreateNamespaceRequest{Name: "ns"}, "t1")
	g, _ := svc.CreateGroup(context.Background(), &models.CreateGroupRequest{NamespaceID: ns.ID, Name: "grp"}, "t1")

	// 直接注入 Level="" 的旧数据（模拟旧表未加 level 列的情况）
	repo.items["legacy-1"] = &models.ConfigItem{
		ID:          "legacy-1",
		TenantID:    "t1",
		GroupID:     g.ID,
		NamespaceID: ns.ID,
		KeyName:     "app.timeout",
		Value:       "120",
		ValueType:   models.ValueTypeString,
		Level:       "", // 旧数据
		Priority:    0,
	}

	result, err := svc.ResolveEffectiveConfig(context.Background(), "t1", ns.ID, "")
	if err != nil {
		t.Fatalf("error: %v", err)
	}
	cv := result["app.timeout"]
	if cv.Level != models.ConfigLevelTenant {
		t.Errorf("Level = %q, want tenant (normalized from empty)", cv.Level)
	}
	if cv.Priority != 50 {
		t.Errorf("Priority = %d, want 50 (normalized)", cv.Priority)
	}
}

func TestDC_ListOverrides(t *testing.T) {
	repo := newFakeDCRepo()
	svc := NewService(repo)
	ns, _ := svc.CreateNamespace(context.Background(), &models.CreateNamespaceRequest{Name: "ns"}, "t1")
	g, _ := svc.CreateGroup(context.Background(), &models.CreateGroupRequest{NamespaceID: ns.ID, Name: "grp"}, "t1")

	// 创建 parent item（tenant 层）
	parent, _ := svc.CreateItem(context.Background(), &models.CreateItemRequest{
		GroupID:     g.ID,
		NamespaceID: ns.ID,
		KeyName:     "app.timeout",
		Value:       "60",
		Level:       models.ConfigLevelTenant,
	}, "t1")

	// 创建 user 层 override
	_, _ = svc.CreateItem(context.Background(), &models.CreateItemRequest{
		GroupID:     g.ID,
		NamespaceID: ns.ID,
		KeyName:     "app.timeout",
		Value:       "90",
		Level:       models.ConfigLevelUser,
		OverrideOf:  parent.ID,
	}, "t1")

	// 创建跨租户的 override（应被过滤掉）
	repo.items["cross-tenant-1"] = &models.ConfigItem{
		ID:         "cross-tenant-1",
		TenantID:   "t2", // 不同租户
		GroupID:    g.ID,
		KeyName:    "app.timeout",
		Value:      "999",
		Level:      models.ConfigLevelUser,
		OverrideOf: models.Text(parent.ID),
		Priority:   10,
	}

	overrides, err := svc.ListOverrides(context.Background(), "t1", parent.ID)
	if err != nil {
		t.Fatalf("error: %v", err)
	}
	if len(overrides) != 1 {
		t.Fatalf("overrides count = %d, want 1", len(overrides))
	}
	if overrides[0].TenantID != "t1" {
		t.Errorf("TenantID = %q, want t1 (cross-tenant should be filtered)", overrides[0].TenantID)
	}
	if overrides[0].Value != "90" {
		t.Errorf("Value = %q, want 90", overrides[0].Value)
	}
}

func TestDC_ListItems_FilterByLevel(t *testing.T) {
	repo := newFakeDCRepo()
	svc := NewService(repo)
	ns, _ := svc.CreateNamespace(context.Background(), &models.CreateNamespaceRequest{Name: "ns"}, "t1")
	g, _ := svc.CreateGroup(context.Background(), &models.CreateGroupRequest{NamespaceID: ns.ID, Name: "grp"}, "t1")

	// 创建 3 个不同 Level 的 item
	_, _ = svc.CreateItem(context.Background(), &models.CreateItemRequest{
		GroupID:     g.ID,
		NamespaceID: ns.ID,
		KeyName:     "k1",
		Value:       "v1",
		Level:       models.ConfigLevelPlatform,
	}, "t1")
	_, _ = svc.CreateItem(context.Background(), &models.CreateItemRequest{
		GroupID:     g.ID,
		NamespaceID: ns.ID,
		KeyName:     "k2",
		Value:       "v2",
		Level:       models.ConfigLevelTenant,
	}, "t1")
	_, _ = svc.CreateItem(context.Background(), &models.CreateItemRequest{
		GroupID:     g.ID,
		NamespaceID: ns.ID,
		KeyName:     "k3",
		Value:       "v3",
		Level:       models.ConfigLevelUser,
	}, "t1")

	items, err := svc.ListItems(context.Background(), "t1", &models.GetItemsFilter{
		GroupID: g.ID,
		Level:   models.ConfigLevelPlatform,
	})
	if err != nil {
		t.Fatalf("error: %v", err)
	}
	if len(items) != 1 {
		t.Fatalf("items count = %d, want 1", len(items))
	}
	if items[0].KeyName != "k1" {
		t.Errorf("KeyName = %q, want k1", items[0].KeyName)
	}
}

// --- Pure helpers ---

func TestDC_GetChangedFields_IsDeterministic(t *testing.T) {
	attrs := map[string]interface{}{
		"priority": 100,
		"level":    "platform",
		"labels":   "{}",
		"value":    "x",
	}
	const want = "labels,level,priority,value"
	for i := 0; i < 50; i++ {
		if got := getChangedFields(attrs); got != want {
			t.Fatalf("iteration %d: got %q, want %q", i, got, want)
		}
	}
	if got := getChangedFields(map[string]interface{}{}); got != "" {
		t.Errorf("empty attrs: got %q, want empty", got)
	}
}

func TestDC_NewIDFitsThePrimaryKeyAndDoesNotCollide(t *testing.T) {
	seen := make(map[string]bool, 10000)
	for i := 0; i < 10000; i++ {
		id := newID()
		if len(id) != 36 {
			t.Fatalf("id %q has %d chars, want 36 for a VARCHAR(36) key", id, len(id))
		}
		if seen[id] {
			t.Fatalf("duplicate id %q at iteration %d", id, i)
		}
		seen[id] = true
	}
}

func TestDC_EncodeJSONRendersNestedMaps(t *testing.T) {
	got := string(encodeJSON(map[string]string{"a": "1", "b": "2"}))
	if got == "" {
		t.Fatal("encodeJSON returned an empty string")
	}
	var back map[string]string
	if err := json.Unmarshal([]byte(got), &back); err != nil {
		t.Fatalf("encodeJSON produced invalid JSON %q: %v", got, err)
	}
	if back["a"] != "1" || back["b"] != "2" {
		t.Errorf("round trip = %v", back)
	}
}
