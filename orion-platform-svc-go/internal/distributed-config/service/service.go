package service

import (
	"context"
	"encoding/json"
	"fmt"
	"hash/fnv"
	"sort"
	"strings"
	"time"

	"orion/platform-svc-go/internal/distributed-config/models"
)

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
	GetItemLatestVersion(ctx context.Context, itemID string) (int, error)

	CreateHistory(ctx context.Context, h *models.ConfigItemHistory) error
	GetItemHistory(ctx context.Context, itemID, tenantID string, limit int) ([]models.ConfigItemHistory, error)

	CreateSnapshot(ctx context.Context, snap *models.ConfigSnapshot) error
	ListSnapshots(ctx context.Context, tenantID, groupID, env string) ([]models.ConfigSnapshot, error)
	GetSnapshot(ctx context.Context, id string) (*models.ConfigSnapshot, error)
	GetLatestSnapshot(ctx context.Context, tenantID, groupID, env string) (*models.ConfigSnapshot, error)
	GetSnapshotData(ctx context.Context, id string) (map[string]interface{}, error)

	CreateRelease(ctx context.Context, r *models.ConfigRelease) error
	GetRelease(ctx context.Context, id, tenantID string) (*models.ConfigRelease, error)
	ListReleases(ctx context.Context, tenantID, groupID, env string) ([]models.ConfigRelease, error)
	UpdateRelease(ctx context.Context, id, tenantID string, attrs map[string]interface{}) (*models.ConfigRelease, error)

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
		ID:          generateID("ns"),
		TenantID:    tenantID,
		Name:        req.Name,
		Description: req.Description,
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
		ID:          generateID("grp"),
		TenantID:    tenantID,
		NamespaceID: req.NamespaceID,
		Name:        req.Name,
		Description: req.Description,
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
	_, err := s.repo.GetGroup(ctx, req.GroupID, tenantID)
	if err != nil {
		return nil, fmt.Errorf("group not found: %w", err)
	}

	// Phase 302: Level 归一化与校验
	level := models.NormalizeLevel(req.Level)
	if !req.Level.IsValid() && req.Level != "" {
		return nil, fmt.Errorf("invalid config level: %q (must be platform/tenant/user)", req.Level)
	}

	labelsJSON, _ := json.Marshal(req.Labels)
	item := &models.ConfigItem{
		ID:          generateID("ci"),
		TenantID:    tenantID,
		GroupID:     req.GroupID,
		NamespaceID: req.NamespaceID,
		KeyName:     req.KeyName,
		Value:       req.Value,
		ValueType:   req.ValueType,
		Encrypted:   req.Encrypted,
		Description: req.Description,
		Labels:      string(labelsJSON),
		Level:       level,
		OverrideOf:  req.OverrideOf,
		Priority:    level.Priority(),
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}
	if item.ValueType == "" {
		item.ValueType = models.ValueTypeString
	}

	if err := s.repo.CreateItem(ctx, item); err != nil {
		return nil, err
	}

	h := &models.ConfigItemHistory{
		ID:        generateID("ch"),
		TenantID:  tenantID,
		ItemID:    item.ID,
		Version:   1,
		NewValue:  item.Value,
		CreatedAt: time.Now(),
	}
	s.repo.CreateHistory(ctx, h)
	s.createAudit(ctx, tenantID, "create", "item", item.ID, map[string]interface{}{"key": item.KeyName, "groupId": item.GroupID})
	return item, nil
}

func (s *Service) GetItem(ctx context.Context, id, tenantID string) (*models.ConfigItem, error) {
	return s.repo.GetItem(ctx, id, tenantID)
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
		if items[i].Labels != "" {
			json.Unmarshal([]byte(items[i].Labels), &items[i].LabelsMap)
		}
		// 兼容旧数据：Level 为空时归一化为 tenant
		if items[i].Level == "" {
			items[i].Level = models.ConfigLevelTenant
			items[i].Priority = models.ConfigLevelTenant.Priority()
		}
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
		labelsJSON, _ := json.Marshal(req.Labels)
		attrs["labels"] = string(labelsJSON)
	}
	// Phase 302: Level / OverrideOf 更新
	if req.Level != nil {
		if !req.Level.IsValid() {
			return nil, fmt.Errorf("invalid config level: %q (must be platform/tenant/user)", *req.Level)
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
		latestVer, _ := s.repo.GetItemLatestVersion(ctx, id)
		h := &models.ConfigItemHistory{
			ID:        generateID("ch"),
			TenantID:  tenantID,
			ItemID:    id,
			Version:   latestVer + 1,
			NewValue:  *req.Value,
			Operator:  operator,
			CreatedAt: time.Now(),
		}
		s.repo.CreateHistory(ctx, h)
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
	type bucket struct {
		items []models.ConfigItem
	}
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
		if items[i].Labels != "" {
			json.Unmarshal([]byte(items[i].Labels), &items[i].LabelsMap)
		}
		if items[i].Level == "" {
			items[i].Level = models.ConfigLevelTenant
			items[i].Priority = models.ConfigLevelTenant.Priority()
		}
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
	dataJSON, _ := json.Marshal(data)
	checksum := computeChecksum(string(dataJSON))

	snap := &models.ConfigSnapshot{
		ID:          generateID("snap"),
		TenantID:    tenantID,
		GroupID:     groupID,
		NamespaceID: "",
		Environment: environment,
		Version:     0,
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

func (s *Service) GetSnapshotData(ctx context.Context, id string) (map[string]interface{}, error) {
	return s.repo.GetSnapshotData(ctx, id)
}

// --- Release ---

func (s *Service) PublishRelease(ctx context.Context, req *models.PublishReleaseRequest, tenantID string) (*models.ConfigRelease, error) {
	snap, err := s.repo.GetSnapshot(ctx, req.SnapshotID)
	if err != nil {
		return nil, fmt.Errorf("snapshot not found: %w", err)
	}
	if snap.GroupID == "" {
		return nil, fmt.Errorf("snapshot group missing")
	}

	latest, _ := s.repo.GetLatestSnapshot(ctx, tenantID, snap.GroupID, req.Environment)
	nextVer := 1
	if latest != nil {
		nextVer = latest.Version + 1
	}

	release := &models.ConfigRelease{
		ID:             generateID("rel"),
		TenantID:       tenantID,
		SnapshotID:     req.SnapshotID,
		GroupID:        snap.GroupID,
		Environment:    req.Environment,
		ReleaseVersion: nextVer,
		Status:         models.ReleaseReleased,
		ReleaseNote:    req.ReleaseNote,
		ReleasedBy:     req.Operator,
		CreatedAt:      time.Now(),
	}
	now := time.Now()
	release.ReleasedAt = &now
	if err := s.repo.CreateRelease(ctx, release); err != nil {
		return nil, err
	}

	s.repo.CreateReleaseHistory(ctx, &models.ConfigReleaseHistory{
		ID:          generateID("rh"),
		TenantID:    tenantID,
		ReleaseID:   release.ID,
		GroupID:     snap.GroupID,
		Environment: req.Environment,
		Version:     nextVer,
		Operator:    req.Operator,
		Action:      "publish",
		Detail:      req.ReleaseNote,
		CreatedAt:   time.Now(),
	})

	s.createAudit(ctx, tenantID, "release", "group", snap.GroupID, map[string]interface{}{
		"environment":    req.Environment,
		"releaseVersion": nextVer,
		"snapshotId":     req.SnapshotID,
	})

	return release, nil
}

func (s *Service) RollbackRelease(ctx context.Context, req *models.RollbackReleaseRequest, tenantID string) (*models.ConfigRelease, error) {
	snap, err := s.repo.GetSnapshot(ctx, req.SnapshotID)
	if err != nil {
		return nil, fmt.Errorf("snapshot not found: %w", err)
	}

	latest, _ := s.repo.GetLatestSnapshot(ctx, tenantID, snap.GroupID, "")
	if latest == nil {
		return nil, fmt.Errorf("no current release found")
	}

	release := &models.ConfigRelease{
		ID:                   generateID("rel"),
		TenantID:             tenantID,
		SnapshotID:           req.SnapshotID,
		GroupID:              latest.GroupID,
		Environment:          latest.Environment,
		ReleaseVersion:       latest.Version + 1,
		Status:               models.ReleaseRollback,
		RollbackToSnapshotID: req.SnapshotID,
		ReleasedBy:           req.Operator,
		ReleaseNote:          req.Reason,
		CreatedAt:            time.Now(),
	}
	now := time.Now()
	release.ReleasedAt = &now
	if err := s.repo.CreateRelease(ctx, release); err != nil {
		return nil, err
	}

	s.repo.CreateReleaseHistory(ctx, &models.ConfigReleaseHistory{
		ID:          generateID("rh"),
		TenantID:    tenantID,
		ReleaseID:   release.ID,
		GroupID:     latest.GroupID,
		Environment: latest.Environment,
		Version:     latest.Version + 1,
		Operator:    req.Operator,
		Action:      "rollback",
		Detail:      fmt.Sprintf("Rollback to snapshot %s: %s", req.SnapshotID, req.Reason),
		CreatedAt:   time.Now(),
	})

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

func (s *Service) createAudit(ctx context.Context, tenantID, action, targetType, targetID string, detail map[string]interface{}) {
	if detail == nil {
		detail = map[string]interface{}{}
	}
	detailJSON, _ := json.Marshal(detail)
	s.repo.CreateAudit(ctx, &models.ConfigAudit{
		ID:         generateID("aud"),
		TenantID:   tenantID,
		Action:     action,
		TargetType: targetType,
		TargetID:   targetID,
		Detail:     string(detailJSON),
		CreatedAt:  time.Now(),
	})
}

func generateID(prefix string) string {
	h := fnv.New64a()
	h.Write([]byte(prefix + "-" + time.Now().Format("20060102150405") + "-" + fmt.Sprintf("%d", time.Now().UnixNano()%100000)))
	return fmt.Sprintf("%s-%x", prefix, h.Sum(nil)[:8])
}

func computeChecksum(data string) string {
	h := fnv.New64a()
	h.Write([]byte(data))
	return fmt.Sprintf("%x", h.Sum(nil))
}

func getChangedFields(attrs map[string]interface{}) string {
	var fields []string
	for k := range attrs {
		fields = append(fields, k)
	}
	return strings.Join(fields, ",")
}
