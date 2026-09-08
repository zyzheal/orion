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
				if other.TenantID == tenantID && other.OverrideOf == item.ID {
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
		if item.TenantID == tenantID && item.OverrideOf == itemID {
			items = append(items, *item)
		}
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

	_, err := svc.CreateItem(context.Background(), &models.CreateItemRequest{
		GroupID:     g.ID,
		NamespaceID: ns.ID,
		KeyName:     "app.timeout",
		Value:       "60",
		Level:       "invalid",
	}, "t1")
	if err == nil {
		t.Error("expected error for invalid level, got nil")
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
		OverrideOf: parent.ID,
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
