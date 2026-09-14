package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"hash/fnv"
	"sort"
	"strings"
	"time"

	"orion/platform-svc-go/internal/distributed-config/models"

	"github.com/google/uuid"
)

// ErrInvalidLevel is returned when a request carries a level that is neither
// platform, tenant nor user. The handler maps it to 400 so it is not confused
// with the 404 the same PUT route returns for an item that does not exist.
var ErrInvalidLevel = errors.New("invalid config level")

type RepositoryInterface interface {
	CreateNamespace(ctx context.Context, ns *models.ConfigNamespace) error
	GetNamespace(ctx context.Context, id, tenantID string) (*models.ConfigNamespace, error)
	ListNamespaces(ctx context.Context, tenantID string) ([]models.ConfigNamespace, error)

	CreateGroup(ctx context.Context, g *models.ConfigGroup) error
	GetGroup(ctx context.Context, id, tenantID string) (*models.ConfigGroup, error)
	ListGroups(ctx context.Context, tenantID, namespaceID string) ([]models.ConfigGroup, error)

	CreateItem(ctx context.Context, item *models.ConfigItem) error
	GetItem(ctx context.Context, id, tenantID string) (*models.ConfigItem, error)
	ListItems(ctx context.Context, tenantID, groupID, namespaceID string) ([]models.ConfigItem, error)
	ListItemsFiltered(ctx context.Context, tenantID string, filter *models.GetItemsFilter) ([]models.ConfigItem, error)
	ListOverrides(ctx context.Context, tenantID, itemID string) ([]models.ConfigItem, error)
	UpdateItemValue(ctx context.Context, id, tenantID string, attrs map[string]interface{}) (*models.ConfigItem, error)
	DeleteItem(ctx context.Context, id, tenantID string) (bool, error)
	GetItemLatestVersion(ctx context.Context, tenantID, itemID string) (int, error)

	CreateHistory(ctx context.Context, h *models.ConfigItemHistory) error
	GetItemHistory(ctx context.Context, itemID, tenantID string, limit int) ([]models.ConfigItemHistory, error)

	CreateSnapshot(ctx context.Context, snap *models.ConfigSnapshot) error
	ListSnapshots(ctx context.Context, tenantID, groupID, env string) ([]models.ConfigSnapshot, error)
	GetSnapshot(ctx context.Context, id, tenantID string) (*models.ConfigSnapshot, error)
	GetLatestSnapshotVersion(ctx context.Context, tenantID, groupID, env string) (int, error)
	GetSnapshotData(ctx context.Context, id, tenantID string) (map[string]interface{}, error)

	CreateRelease(ctx context.Context, r *models.ConfigRelease) error
	GetRelease(ctx context.Context, id, tenantID string) (*models.ConfigRelease, error)
	ListReleases(ctx context.Context, tenantID, groupID, env string) ([]models.ConfigRelease, error)
	UpdateRelease(ctx context.Context, id, tenantID string, attrs map[string]interface{}) (*models.ConfigRelease, error)
	GetLatestReleaseVersion(ctx context.Context, tenantID, groupID, env string) (int, error)

	CreateReleaseHistory(ctx context.Context, h *models.ConfigReleaseHistory) error
	ListReleaseHistory(ctx context.Context, releaseID, tenantID string) ([]models.ConfigReleaseHistory, error)

	CreateAudit(ctx context.Context, a *models.ConfigAudit) error
	ListAudit(ctx context.Context, tenantID string, limit int) ([]models.ConfigAudit, error)
}

type Service struct {
	repo RepositoryInterface
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

// --- Namespace ---

func (s *Service) CreateNamespace(ctx context.Context, req *models.CreateNamespaceRequest, tenantID string) (*models.ConfigNamespace, error) {
	ns := &models.ConfigNamespace{
		ID:          newID(),
		TenantID:    tenantID,
		Name:        req.Name,
		Description: models.Text(req.Description),
		Status:      models.NamespaceActive,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}
	if err := s.repo.CreateNamespace(ctx, ns); err != nil {
		return nil, err
	}
	s.createAudit(ctx, tenantID, "create", "namespace", ns.ID, map[string]interface{}{"name": ns.Name})
	return ns, nil
}

func (s *Service) GetNamespace(ctx context.Context, id, tenantID string) (*models.ConfigNamespace, error) {
	return s.repo.GetNamespace(ctx, id, tenantID)
}

func (s *Service) ListNamespaces(ctx context.Context, tenantID string) ([]models.ConfigNamespace, error) {
	namespaces, err := s.repo.ListNamespaces(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	if namespaces == nil {
		return []models.ConfigNamespace{}, nil
	}
	return namespaces, nil
}

// --- Group ---

func (s *Service) CreateGroup(ctx context.Context, req *models.CreateGroupRequest, tenantID string) (*models.ConfigGroup, error) {
	ns, err := s.repo.GetNamespace(ctx, req.NamespaceID, tenantID)
	if err != nil {
		return nil, fmt.Errorf("namespace not found: %w", err)
	}
	if ns.Status == models.NamespaceArchived {
		return nil, fmt.Errorf("namespace %s is archived", ns.ID)
	}

	g := &models.ConfigGroup{
		ID:          newID(),
		TenantID:    tenantID,
		NamespaceID: req.NamespaceID,
		Name:        req.Name,
		Description: models.Text(req.Description),
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}
	if err := s.repo.CreateGroup(ctx, g); err != nil {
		return nil, err
	}
	s.createAudit(ctx, tenantID, "create", "group", g.ID, map[string]interface{}{"name": g.Name, "namespaceId": ns.ID})
	return g, nil
}

func (s *Service) GetGroup(ctx context.Context, id, tenantID string) (*models.ConfigGroup, error) {
	return s.repo.GetGroup(ctx, id, tenantID)
}

func (s *Service) ListGroups(ctx context.Context, tenantID, namespaceID string) ([]models.ConfigGroup, error) {
	groups, err := s.repo.ListGroups(ctx, tenantID, namespaceID)
	if err != nil {
		return nil, err
	}
	if groups == nil {
		return []models.ConfigGroup{}, nil
	}
	return groups, nil
}

// --- Item ---

func (s *Service) CreateItem(ctx context.Context, req *models.CreateItemRequest, tenantID string) (*models.ConfigItem, error) {
	group, err := s.repo.GetGroup(ctx, req.GroupID, tenantID)
	if err != nil {
		return nil, fmt.Errorf("group not found: %w", err)
	}
	// config_item.namespace_id is a denormalised copy of the group's namespace.
	// Trusting the caller to repeat it correctly produced items that listed
	// under a namespace they did not belong to, and that the namespace-scoped
	// resolver then picked up.
	ns, err := s.repo.GetNamespace(ctx, req.NamespaceID, tenantID)
	if err != nil {
		return nil, fmt.Errorf("namespace not found: %w", err)
	}
	if group.NamespaceID != req.NamespaceID {
		return nil, fmt.Errorf("group %s does not belong to namespace %s", req.GroupID, req.NamespaceID)
	}

	// Phase 302: Level 归一化与校验
	level := models.NormalizeLevel(req.Level)
	if !req.Level.IsValid() && req.Level != "" {
		return nil, fmt.Errorf("%w: %q (must be platform/tenant/user)", ErrInvalidLevel, req.Level)
	}

	item := &models.ConfigItem{
		ID:          newID(),
		TenantID:    tenantID,
		GroupID:     req.GroupID,
		NamespaceID: ns.ID,
		KeyName:     req.KeyName,
		Value:       req.Value,
		ValueType:   req.ValueType,
		Encrypted:   req.Encrypted,
		Description: models.Text(req.Description),
		Labels:      encodeJSON(req.Labels),
		Level:       level,
		OverrideOf:  models.Text(req.OverrideOf),
		Priority:    level.Priority(),
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
		LabelsMap:   req.Labels,
	}
	if item.ValueType == "" {
		item.ValueType = models.ValueTypeString
	}

	if err := s.repo.CreateItem(ctx, item); err != nil {
		return nil, err
	}

	if err := s.repo.CreateHistory(ctx, &models.ConfigItemHistory{
		ID:        newID(),
		TenantID:  tenantID,
		ItemID:    item.ID,
		Version:   1,
		NewValue:  item.Value,
		CreatedAt: time.Now(),
	}); err != nil {
		return nil, fmt.Errorf("writing create history for item %s: %w", item.ID, err)
	}
	s.createAudit(ctx, tenantID, "create", "item", item.ID, map[string]interface{}{"key": item.KeyName, "groupId": item.GroupID})
	return item, nil
}

// GetItem decodes the labels payload and normalises the level, exactly like
// ListItems and ListOverrides do. Returning the raw row meant the labels of a
// single item came back empty while the same item listed under labels filled in.
func (s *Service) GetItem(ctx context.Context, id, tenantID string) (*models.ConfigItem, error) {
	item, err := s.repo.GetItem(ctx, id, tenantID)
	if err != nil {
		return nil, err
	}
	return decodeItem(item), nil
}

func decodeItem(item *models.ConfigItem) *models.ConfigItem {
	if item == nil {
		return nil
	}
	if item.Labels != "" {
		json.Unmarshal([]byte(item.Labels), &item.LabelsMap)
	}
	// 兼容旧数据：Level 为空时归一化为 tenant
	if item.Level == "" {
		item.Level = models.ConfigLevelTenant
		item.Priority = models.ConfigLevelTenant.Priority()
	}
	return item
}

func (s *Service) ListItems(ctx context.Context, tenantID string, filter *models.GetItemsFilter) ([]models.ConfigItem, error) {
	items, err := s.repo.ListItemsFiltered(ctx, tenantID, filter)
	if err != nil {
		return nil, err
	}
	if items == nil {
		return []models.ConfigItem{}, nil
	}
	for i := range items {
		decodeItem(&items[i])
	}
	return items, nil
}

func (s *Service) UpdateItem(ctx context.Context, id, tenantID, operator string, req *models.UpdateItemRequest) (*models.ConfigItem, error) {
	attrs := make(map[string]interface{})
	if req.Value != nil {
		attrs["value"] = *req.Value
	}
	if req.ValueType != nil {
		attrs["value_type"] = string(*req.ValueType)
	}
	if req.Encrypted != nil {
		attrs["encrypted"] = *req.Encrypted
	}
	if req.Description != nil {
		attrs["description"] = *req.Description
	}
	if req.Labels != nil {
		attrs["labels"] = string(encodeJSON(req.Labels))
	}
	// Phase 302: Level / OverrideOf 更新
	if req.Level != nil {
		if !req.Level.IsValid() {
			return nil, fmt.Errorf("%w: %q (must be platform/tenant/user)", ErrInvalidLevel, *req.Level)
		}
		attrs["level"] = string(*req.Level)
		attrs["priority"] = (*req.Level).Priority()
	}
	if req.OverrideOf != nil {
		attrs["override_of"] = *req.OverrideOf
	}

	updated, err := s.repo.UpdateItemValue(ctx, id, tenantID, attrs)
	if err != nil {
		return nil, err
	}

	if req.Value != nil {
		// A discarded lookup error reset the history counter to one on every
		// failed query, so the next row's version collided with the create row.
		latestVer, err := s.repo.GetItemLatestVersion(ctx, tenantID, id)
		if err != nil {
			return nil, fmt.Errorf("looking up the latest version of item %s: %w", id, err)
		}
		if err := s.repo.CreateHistory(ctx, &models.ConfigItemHistory{
			ID:        newID(),
			TenantID:  tenantID,
			ItemID:    id,
			Version:   latestVer + 1,
			NewValue:  *req.Value,
			Operator:  operator,
			CreatedAt: time.Now(),
		}); err != nil {
			return nil, fmt.Errorf("writing update history for item %s: %w", id, err)
		}
	}

	s.createAudit(ctx, tenantID, "update", "item", id, map[string]interface{}{
		"operator": operator,
		"fields":   getChangedFields(attrs),
	})
	return updated, nil
}

func (s *Service) DeleteItem(ctx context.Context, id, tenantID string) (bool, error) {
	deleted, err := s.repo.DeleteItem(ctx, id, tenantID)
	if err != nil || !deleted {
		return false, err
	}
	s.createAudit(ctx, tenantID, "delete", "item", id, nil)
	return true, nil
}

func (s *Service) GetItemHistory(ctx context.Context, itemID, tenantID string) ([]models.ConfigItemHistory, error) {
	history, err := s.repo.GetItemHistory(ctx, itemID, tenantID, 50)
	if err != nil {
		return nil, err
	}
	if history == nil {
		return []models.ConfigItemHistory{}, nil
	}
	return history, nil
}

// --- Phase 302: 三层 Level 覆盖 ---

// ResolveEffectiveConfig 按 Level 优先级合并配置项（platform → tenant → user）。
// 优先级：platform(100) > tenant(50) > user(10)，同 KeyName 下取 Priority 最高的。
// namespaceID 为空时不限制 namespace；userID 参数当前未使用（保留扩展）。
func (s *Service) ResolveEffectiveConfig(ctx context.Context, tenantID, namespaceID, userID string) (map[string]models.ConfigValue, error) {
	_ = userID // 保留扩展：未来可用于过滤 user-specific override
	filter := &models.GetItemsFilter{
		NamespaceID: namespaceID,
	}
	items, err := s.repo.ListItemsFiltered(ctx, tenantID, filter)
	if err != nil {
		return nil, err
	}

	// 按 KeyName 分组，每组内按 Priority DESC 排序，取第一个作为生效值
	buckets := make(map[string][]models.ConfigItem)
	for _, it := range items {
		// 归一化 Level（兼容旧数据）
		if it.Level == "" {
			it.Level = models.ConfigLevelTenant
			it.Priority = models.ConfigLevelTenant.Priority()
		}
		buckets[it.KeyName] = append(buckets[it.KeyName], it)
	}

	effective := make(map[string]models.ConfigValue, len(buckets))
	for key, list := range buckets {
		// 按 Priority DESC 排序，同 Priority 按 CreatedAt DESC
		sort.Slice(list, func(i, j int) bool {
			if list[i].Priority != list[j].Priority {
				return list[i].Priority > list[j].Priority
			}
			return list[i].CreatedAt.After(list[j].CreatedAt)
		})
		top := list[0]
		effective[key] = models.ConfigValue{
			ItemID:    top.ID,
			KeyName:   top.KeyName,
			Value:     top.Value,
			ValueType: top.ValueType,
			Level:     top.Level,
			Priority:  top.Priority,
		}
	}
	return effective, nil
}

// ListOverrides 返回所有下层覆盖某个 item 的 records（override_of = itemID）。
func (s *Service) ListOverrides(ctx context.Context, tenantID, itemID string) ([]models.ConfigItem, error) {
	items, err := s.repo.ListOverrides(ctx, tenantID, itemID)
	if err != nil {
		return nil, err
	}
	if items == nil {
		return []models.ConfigItem{}, nil
	}
	for i := range items {
		decodeItem(&items[i])
	}
	return items, nil
}

// --- Snapshot ---

func (s *Service) PublishSnapshot(ctx context.Context, groupID, environment, operator string, tenantID string) (*models.ConfigSnapshot, error) {
	items, err := s.repo.ListItems(ctx, tenantID, groupID, "")
	if err != nil {
		return nil, err
	}

	data := make(map[string]interface{})
	for _, item := range items {
		data[item.KeyName] = item.Value
	}
	dataJSON := encodeJSON(data)
	checksum := computeChecksum(string(dataJSON))

	// config_snapshot.version is NOT NULL with no default, so the insert supplies
	// it, and it used to be hardcoded zero: every snapshot in a group shared
	// version one and the version index could not distinguish them.
	latestVer, err := s.repo.GetLatestSnapshotVersion(ctx, tenantID, groupID, environment)
	if err != nil {
		return nil, err
	}

	snap := &models.ConfigSnapshot{
		ID:          newID(),
		TenantID:    tenantID,
		GroupID:     groupID,
		NamespaceID: "",
		Environment: environment,
		Version:     latestVer + 1,
		Data:        string(dataJSON),
		Checksum:    checksum,
		CreatedAt:   time.Now(),
		CreatedBy:   operator,
	}
	if err := s.repo.CreateSnapshot(ctx, snap); err != nil {
		return nil, err
	}

	s.createAudit(ctx, tenantID, "snapshot", "group", groupID, map[string]interface{}{
		"environment": environment,
		"checksum":    checksum,
	})
	return snap, nil
}

func (s *Service) ListSnapshots(ctx context.Context, tenantID, groupID, environment string) ([]models.ConfigSnapshot, error) {
	snaps, err := s.repo.ListSnapshots(ctx, tenantID, groupID, environment)
	if err != nil {
		return nil, err
	}
	if snaps == nil {
		return []models.ConfigSnapshot{}, nil
	}
	return snaps, nil
}

func (s *Service) GetSnapshotData(ctx context.Context, id, tenantID string) (map[string]interface{}, error) {
	return s.repo.GetSnapshotData(ctx, id, tenantID)
}

// --- Release ---

func (s *Service) PublishRelease(ctx context.Context, req *models.PublishReleaseRequest, tenantID string) (*models.ConfigRelease, error) {
	snap, err := s.repo.GetSnapshot(ctx, req.SnapshotID, tenantID)
	if err != nil {
		return nil, fmt.Errorf("snapshot not found: %w", err)
	}
	if snap.GroupID == "" {
		return nil, fmt.Errorf("snapshot group missing")
	}

	latestVer, err := s.repo.GetLatestReleaseVersion(ctx, tenantID, snap.GroupID, req.Environment)
	if err != nil {
		return nil, err
	}
	nextVer := latestVer + 1

	release := &models.ConfigRelease{
		ID:             newID(),
		TenantID:       tenantID,
		SnapshotID:     req.SnapshotID,
		GroupID:        snap.GroupID,
		Environment:    req.Environment,
		ReleaseVersion: nextVer,
		Status:         models.ReleaseReleased,
		ReleaseNote:    models.Text(req.ReleaseNote),
		ReleasedBy:     models.Text(req.Operator),
		CreatedAt:      time.Now(),
	}
	now := time.Now()
	release.ReleasedAt = &now
	if err := s.repo.CreateRelease(ctx, release); err != nil {
		return nil, err
	}

	if err := s.repo.CreateReleaseHistory(ctx, &models.ConfigReleaseHistory{
		ID:          newID(),
		TenantID:    tenantID,
		ReleaseID:   release.ID,
		GroupID:     snap.GroupID,
		Environment: req.Environment,
		Version:     nextVer,
		Operator:    models.Text(req.Operator),
		Action:      "publish",
		Detail:      models.Text(req.ReleaseNote),
		CreatedAt:   time.Now(),
	}); err != nil {
		return nil, fmt.Errorf("writing release history for %s: %w", release.ID, err)
	}

	s.createAudit(ctx, tenantID, "release", "group", snap.GroupID, map[string]interface{}{
		"environment":    req.Environment,
		"releaseVersion": nextVer,
		"snapshotId":     req.SnapshotID,
	})

	return release, nil
}

func (s *Service) RollbackRelease(ctx context.Context, req *models.RollbackReleaseRequest, tenantID string) (*models.ConfigRelease, error) {
	snap, err := s.repo.GetSnapshot(ctx, req.SnapshotID, tenantID)
	if err != nil {
		return nil, fmt.Errorf("snapshot not found: %w", err)
	}
	if snap.GroupID == "" {
		return nil, fmt.Errorf("snapshot group missing")
	}

	// The rollback used to read config_snapshot to number the new release row,
	// so group, environment and version all came out of a different relation.
	latestVer, err := s.repo.GetLatestReleaseVersion(ctx, tenantID, snap.GroupID, snap.Environment)
	if err != nil {
		return nil, err
	}

	release := &models.ConfigRelease{
		ID:                   newID(),
		TenantID:             tenantID,
		SnapshotID:           req.SnapshotID,
		GroupID:              snap.GroupID,
		Environment:          snap.Environment,
		ReleaseVersion:       latestVer + 1,
		Status:               models.ReleaseRollback,
		RollbackToSnapshotID: models.Text(req.SnapshotID),
		ReleasedBy:           models.Text(req.Operator),
		ReleaseNote:          models.Text(req.Reason),
		CreatedAt:            time.Now(),
	}
	now := time.Now()
	release.ReleasedAt = &now
	if err := s.repo.CreateRelease(ctx, release); err != nil {
		return nil, err
	}

	if err := s.repo.CreateReleaseHistory(ctx, &models.ConfigReleaseHistory{
		ID:          newID(),
		TenantID:    tenantID,
		ReleaseID:   release.ID,
		GroupID:     snap.GroupID,
		Environment: snap.Environment,
		Version:     latestVer + 1,
		Operator:    models.Text(req.Operator),
		Action:      "rollback",
		Detail:      models.Text(fmt.Sprintf("Rollback to snapshot %s: %s", req.SnapshotID, req.Reason)),
		CreatedAt:   time.Now(),
	}); err != nil {
		return nil, fmt.Errorf("writing rollback history for %s: %w", release.ID, err)
	}

	s.createAudit(ctx, tenantID, "rollback", "release", release.ID, map[string]interface{}{
		"snapshotId": req.SnapshotID,
		"reason":     req.Reason,
	})

	return release, nil
}

func (s *Service) GetRelease(ctx context.Context, id, tenantID string) (*models.ConfigRelease, error) {
	return s.repo.GetRelease(ctx, id, tenantID)
}

func (s *Service) ListReleases(ctx context.Context, tenantID string, filter *models.GetReleasesFilter) ([]models.ConfigRelease, error) {
	env := ""
	if filter != nil && filter.Environment != nil {
		env = *filter.Environment
	}
	releases, err := s.repo.ListReleases(ctx, tenantID, "", env)
	if err != nil {
		return nil, err
	}
	if releases == nil {
		return []models.ConfigRelease{}, nil
	}
	return releases, nil
}

func (s *Service) GetReleaseHistory(ctx context.Context, releaseID, tenantID string) ([]models.ConfigReleaseHistory, error) {
	history, err := s.repo.ListReleaseHistory(ctx, releaseID, tenantID)
	if err != nil {
		return nil, err
	}
	if history == nil {
		return []models.ConfigReleaseHistory{}, nil
	}
	return history, nil
}

// --- Audit ---

func (s *Service) ListAudit(ctx context.Context, tenantID string, limit int) ([]models.ConfigAudit, error) {
	audits, err := s.repo.ListAudit(ctx, tenantID, limit)
	if err != nil {
		return nil, err
	}
	if audits == nil {
		return []models.ConfigAudit{}, nil
	}
	for i := range audits {
		if audits[i].Detail != "" {
			json.Unmarshal([]byte(audits[i].Detail), &audits[i].DetailMap)
		}
	}
	return audits, nil
}

// --- Helper ---

// encodeJSON renders a value for a JSON column. Every caller passes a map or a
// slice whose fields all carry json tags, so Marshal cannot fail; the helper
// exists so no call site repeats the discarded-error pattern.
func encodeJSON(v interface{}) models.Text {
	return models.Text(mustJSON(v))
}

func mustJSON(v interface{}) string {
	b, _ := json.Marshal(v)
	return string(b)
}

func (s *Service) createAudit(ctx context.Context, tenantID, action, targetType, targetID string, detail map[string]interface{}) {
	if detail == nil {
		detail = map[string]interface{}{}
	}
	s.repo.CreateAudit(ctx, &models.ConfigAudit{
		ID:         newID(),
		TenantID:   tenantID,
		Action:     action,
		TargetType: targetType,
		TargetID:   targetID,
		Detail:     encodeJSON(detail),
		CreatedAt:  time.Now(),
	})
}

// newID is a UUID rendered as a string, which is exactly the 36 characters the
// VARCHAR(36) primary keys allow. The previous implementation mixed a prefix, a
// per-second timestamp and four random bytes through FNV and kept eight hex
// characters of the digest, so the entropy was capped at 32 bits within any one
// second and two entities created in the same second collided with probability
// about one in six hundred thousand.
func newID() string {
	return uuid.New().String()
}

func computeChecksum(data string) string {
	h := fnv.New64a()
	h.Write([]byte(data))
	return fmt.Sprintf("%x", h.Sum(nil))
}

// getChangedFields names the attributes that were set, in a stable order. The
// audit detail went through a Go map, so the same request logged a different
// field string on every call and the audit log was not diffable.
func getChangedFields(attrs map[string]interface{}) string {
	fields := make([]string, 0, len(attrs))
	for k := range attrs {
		fields = append(fields, k)
	}
	sort.Strings(fields)
	return strings.Join(fields, ",")
}
