package service

import (
	"context"
	"fmt"
	"sync"
	"time"

	"orion/platform-svc-go/internal/chatops/models"
	"orion/go-common/pkg/otel"

	"github.com/google/uuid"
)

// AdminService manages admin entities (capability mappings, approval configs,
// approvers, roles, permissions, command versions).
type AdminService struct {
	mu sync.RWMutex

	capabilityMappings   map[string]*models.CapabilityMapping
	approvalConfigs      map[string]*models.ApprovalConfig
	approvers            map[string]*models.Approver
	approverSchedules    map[string]*models.ApproverSchedule
	approvalGlobalConfig map[string]*models.ApprovalGlobalConfig
	roles                map[string]*models.AdminRole
	commandPermissions   map[string]*models.CommandPermission
	envPermissions       map[string]*models.EnvironmentPermission
	commandVersions      map[string]*models.CommandVersion
}

var (
	adminServiceInstance *AdminService
	adminServiceOnce     sync.Once
)

// NewAdminService creates the singleton AdminService with in-memory storage.
func NewAdminService() *AdminService {
	adminServiceOnce.Do(func() {
		adminServiceInstance = &AdminService{
			capabilityMappings:   make(map[string]*models.CapabilityMapping),
			approvalConfigs:      make(map[string]*models.ApprovalConfig),
			approvers:            make(map[string]*models.Approver),
			approverSchedules:    make(map[string]*models.ApproverSchedule),
			approvalGlobalConfig: make(map[string]*models.ApprovalGlobalConfig),
			roles:                make(map[string]*models.AdminRole),
			commandPermissions:   make(map[string]*models.CommandPermission),
			envPermissions:       make(map[string]*models.EnvironmentPermission),
			commandVersions:      make(map[string]*models.CommandVersion),
		}
	})
	return adminServiceInstance
}

// ==================== Capability Mapping ====================

func (s *AdminService) CreateCapabilityMapping(ctx context.Context, tenantID string, req models.CreateCapabilityMappingRequest) (*models.CapabilityMapping, error) {
	_, span := otel.Tracer("admin-service").Start(ctx, "CreateCapabilityMapping")
	defer span.End()

	s.mu.Lock()
	defer s.mu.Unlock()

	enabled := true
	if req.Enabled != nil {
		enabled = *req.Enabled
	}

	m := &models.CapabilityMapping{
		ID:          uuid.New().String(),
		TenantID:    tenantID,
		Capability:  req.Capability,
		CommandName: req.CommandName,
		Enabled:     enabled,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}
	s.capabilityMappings[m.ID] = m
	return m, nil
}

func (s *AdminService) ListCapabilityMappings(ctx context.Context, tenantID string) ([]models.CapabilityMapping, error) {
	_, span := otel.Tracer("admin-service").Start(ctx, "ListCapabilityMappings")
	defer span.End()

	s.mu.RLock()
	defer s.mu.RUnlock()

	var result []models.CapabilityMapping
	for _, m := range s.capabilityMappings {
		if m.TenantID == tenantID {
			result = append(result, *m)
		}
	}
	return result, nil
}

func (s *AdminService) UpdateCapabilityMapping(ctx context.Context, tenantID, id string, req models.UpdateCapabilityMappingRequest) (*models.CapabilityMapping, error) {
	_, span := otel.Tracer("admin-service").Start(ctx, "UpdateCapabilityMapping")
	defer span.End()

	s.mu.Lock()
	defer s.mu.Unlock()

	m, ok := s.capabilityMappings[id]
	if !ok || m.TenantID != tenantID {
		return nil, fmt.Errorf("capability mapping not found: %s", id)
	}
	if req.Capability != nil {
		m.Capability = *req.Capability
	}
	if req.CommandName != nil {
		m.CommandName = *req.CommandName
	}
	if req.Enabled != nil {
		m.Enabled = *req.Enabled
	}
	m.UpdatedAt = time.Now()
	return m, nil
}

func (s *AdminService) DeleteCapabilityMapping(ctx context.Context, tenantID, id string) error {
	_, span := otel.Tracer("admin-service").Start(ctx, "DeleteCapabilityMapping")
	defer span.End()

	s.mu.Lock()
	defer s.mu.Unlock()

	m, ok := s.capabilityMappings[id]
	if !ok || m.TenantID != tenantID {
		return fmt.Errorf("capability mapping not found: %s", id)
	}
	delete(s.capabilityMappings, id)
	return nil
}

// ==================== Approval Config ====================

func (s *AdminService) GetApprovalConfigs(ctx context.Context, tenantID string) ([]models.ApprovalConfig, error) {
	_, span := otel.Tracer("admin-service").Start(ctx, "GetApprovalConfigs")
	defer span.End()

	s.mu.RLock()
	defer s.mu.RUnlock()

	var result []models.ApprovalConfig
	for _, c := range s.approvalConfigs {
		if c.TenantID == tenantID {
			result = append(result, *c)
		}
	}
	return result, nil
}

func (s *AdminService) BulkUpdateApprovalConfigs(ctx context.Context, tenantID string, configs []models.UpdateApprovalConfigRequest) ([]models.ApprovalConfig, error) {
	_, span := otel.Tracer("admin-service").Start(ctx, "BulkUpdateApprovalConfigs")
	defer span.End()

	s.mu.Lock()
	defer s.mu.Unlock()

	var result []models.ApprovalConfig
	for _, req := range configs {
		cfg := &models.ApprovalConfig{
			ID:        uuid.New().String(),
			TenantID:  tenantID,
			Enabled:   true,
			MinApprovers: 1,
			TimeoutSec: 3600,
		}
		if req.Enabled != nil {
			cfg.Enabled = *req.Enabled
		}
		if req.MinApprovers != nil {
			cfg.MinApprovers = *req.MinApprovers
		}
		if req.TimeoutSec != nil {
			cfg.TimeoutSec = *req.TimeoutSec
		}
		cfg.CreatedAt = time.Now()
		cfg.UpdatedAt = time.Now()
		s.approvalConfigs[cfg.ID] = cfg
		result = append(result, *cfg)
	}
	return result, nil
}

func (s *AdminService) GetApprovalConfigByCapability(ctx context.Context, tenantID, capability string) (*models.ApprovalConfig, error) {
	_, span := otel.Tracer("admin-service").Start(ctx, "GetApprovalConfigByCapability")
	defer span.End()

	s.mu.RLock()
	defer s.mu.RUnlock()

	for _, c := range s.approvalConfigs {
		if c.TenantID == tenantID && c.Capability == capability {
			return c, nil
		}
	}
	return nil, fmt.Errorf("approval config not found for capability: %s", capability)
}

func (s *AdminService) UpdateApprovalConfigByCapability(ctx context.Context, tenantID, capability string, req models.UpdateApprovalConfigRequest) (*models.ApprovalConfig, error) {
	_, span := otel.Tracer("admin-service").Start(ctx, "UpdateApprovalConfigByCapability")
	defer span.End()

	s.mu.Lock()
	defer s.mu.Unlock()

	for _, c := range s.approvalConfigs {
		if c.TenantID == tenantID && c.Capability == capability {
			if req.Enabled != nil {
				c.Enabled = *req.Enabled
			}
			if req.MinApprovers != nil {
				c.MinApprovers = *req.MinApprovers
			}
			if req.TimeoutSec != nil {
				c.TimeoutSec = *req.TimeoutSec
			}
			c.UpdatedAt = time.Now()
			return c, nil
		}
	}
	// Create if not exists
	cfg := &models.ApprovalConfig{
		ID:        uuid.New().String(),
		TenantID:  tenantID,
		Capability: capability,
		Enabled:   true,
		MinApprovers: 1,
		TimeoutSec: 3600,
	}
	if req.Enabled != nil {
		cfg.Enabled = *req.Enabled
	}
	if req.MinApprovers != nil {
		cfg.MinApprovers = *req.MinApprovers
	}
	if req.TimeoutSec != nil {
		cfg.TimeoutSec = *req.TimeoutSec
	}
	cfg.CreatedAt = time.Now()
	cfg.UpdatedAt = time.Now()
	s.approvalConfigs[cfg.ID] = cfg
	return cfg, nil
}

// ==================== Approver ====================

func (s *AdminService) ListApprovers(ctx context.Context, tenantID string) ([]models.Approver, error) {
	_, span := otel.Tracer("admin-service").Start(ctx, "ListApprovers")
	defer span.End()

	s.mu.RLock()
	defer s.mu.RUnlock()

	var result []models.Approver
	for _, a := range s.approvers {
		if a.TenantID == tenantID {
			result = append(result, *a)
		}
	}
	return result, nil
}

func (s *AdminService) GetApproverSchedule(ctx context.Context, tenantID string) ([]models.ApproverSchedule, error) {
	_, span := otel.Tracer("admin-service").Start(ctx, "GetApproverSchedule")
	defer span.End()

	s.mu.RLock()
	defer s.mu.RUnlock()

	var result []models.ApproverSchedule
	for _, sc := range s.approverSchedules {
		if sc.TenantID == tenantID {
			result = append(result, *sc)
		}
	}
	return result, nil
}

func (s *AdminService) UpdateApproverSchedule(ctx context.Context, tenantID string, schedules []models.UpdateApproverScheduleRequest) ([]models.ApproverSchedule, error) {
	_, span := otel.Tracer("admin-service").Start(ctx, "UpdateApproverSchedule")
	defer span.End()

	s.mu.Lock()
	defer s.mu.Unlock()

	// Remove existing schedules for this tenant
	for k, sc := range s.approverSchedules {
		if sc.TenantID == tenantID {
			delete(s.approverSchedules, k)
		}
	}

	var result []models.ApproverSchedule
	for _, req := range schedules {
		sc := &models.ApproverSchedule{
			ID:        uuid.New().String(),
			TenantID:  tenantID,
			UserID:    req.UserID,
			DayOfWeek: req.DayOfWeek,
			StartTime: req.StartTime,
			EndTime:   req.EndTime,
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
		}
		s.approverSchedules[sc.ID] = sc
		result = append(result, *sc)
	}
	return result, nil
}

// ==================== Approval Global Config ====================

func (s *AdminService) GetApprovalGlobalConfig(ctx context.Context, tenantID string) (*models.ApprovalGlobalConfig, error) {
	_, span := otel.Tracer("admin-service").Start(ctx, "GetApprovalGlobalConfig")
	defer span.End()

	s.mu.RLock()
	defer s.mu.RUnlock()

	if cfg, ok := s.approvalGlobalConfig[tenantID]; ok {
		return cfg, nil
	}
	// Return defaults
	return &models.ApprovalGlobalConfig{
		TenantID:              tenantID,
		DefaultMinApprovers:   1,
		DefaultTimeoutSec:     3600,
		RequireApprovalForAll: false,
	}, nil
}

func (s *AdminService) UpdateApprovalGlobalConfig(ctx context.Context, tenantID string, req models.UpdateApprovalGlobalConfigRequest) (*models.ApprovalGlobalConfig, error) {
	_, span := otel.Tracer("admin-service").Start(ctx, "UpdateApprovalGlobalConfig")
	defer span.End()

	s.mu.Lock()
	defer s.mu.Unlock()

	cfg, ok := s.approvalGlobalConfig[tenantID]
	if !ok {
		cfg = &models.ApprovalGlobalConfig{
			TenantID:              tenantID,
			DefaultMinApprovers:   1,
			DefaultTimeoutSec:     3600,
			RequireApprovalForAll: false,
		}
		s.approvalGlobalConfig[tenantID] = cfg
	}
	if req.DefaultMinApprovers != nil {
		cfg.DefaultMinApprovers = *req.DefaultMinApprovers
	}
	if req.DefaultTimeoutSec != nil {
		cfg.DefaultTimeoutSec = *req.DefaultTimeoutSec
	}
	if req.RequireApprovalForAll != nil {
		cfg.RequireApprovalForAll = *req.RequireApprovalForAll
	}
	cfg.UpdatedAt = time.Now()
	return cfg, nil
}

// ==================== Role ====================

func (s *AdminService) CreateRole(ctx context.Context, tenantID string, req models.CreateAdminRoleRequest) (*models.AdminRole, error) {
	_, span := otel.Tracer("admin-service").Start(ctx, "CreateRole")
	defer span.End()

	s.mu.Lock()
	defer s.mu.Unlock()

	role := &models.AdminRole{
		ID:          uuid.New().String(),
		TenantID:    tenantID,
		Name:        req.Name,
		Description: req.Description,
		Permissions: req.Permissions,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}
	s.roles[role.ID] = role
	return role, nil
}

func (s *AdminService) ListRoles(ctx context.Context, tenantID string) ([]models.AdminRole, error) {
	_, span := otel.Tracer("admin-service").Start(ctx, "ListRoles")
	defer span.End()

	s.mu.RLock()
	defer s.mu.RUnlock()

	var result []models.AdminRole
	for _, r := range s.roles {
		if r.TenantID == tenantID {
			result = append(result, *r)
		}
	}
	return result, nil
}

func (s *AdminService) UpdateRole(ctx context.Context, tenantID, id string, req models.UpdateAdminRoleRequest) (*models.AdminRole, error) {
	_, span := otel.Tracer("admin-service").Start(ctx, "UpdateRole")
	defer span.End()

	s.mu.Lock()
	defer s.mu.Unlock()

	r, ok := s.roles[id]
	if !ok || r.TenantID != tenantID {
		return nil, fmt.Errorf("role not found: %s", id)
	}
	if req.Name != nil {
		r.Name = *req.Name
	}
	if req.Description != nil {
		r.Description = *req.Description
	}
	if req.Permissions != nil {
		r.Permissions = *req.Permissions
	}
	r.UpdatedAt = time.Now()
	return r, nil
}

func (s *AdminService) DeleteRole(ctx context.Context, tenantID, id string) error {
	_, span := otel.Tracer("admin-service").Start(ctx, "DeleteRole")
	defer span.End()

	s.mu.Lock()
	defer s.mu.Unlock()

	r, ok := s.roles[id]
	if !ok || r.TenantID != tenantID {
		return fmt.Errorf("role not found: %s", id)
	}
	delete(s.roles, id)
	return nil
}

// ==================== Command Permission ====================

func (s *AdminService) CreateCommandPermission(ctx context.Context, tenantID string, req models.CreateCommandPermissionRequest) (*models.CommandPermission, error) {
	_, span := otel.Tracer("admin-service").Start(ctx, "CreateCommandPermission")
	defer span.End()

	s.mu.Lock()
	defer s.mu.Unlock()

	allow := true
	if req.Allow != nil {
		allow = *req.Allow
	}

	p := &models.CommandPermission{
		ID:          uuid.New().String(),
		TenantID:    tenantID,
		CommandName: req.CommandName,
		RoleName:    req.RoleName,
		Allow:       allow,
		Priority:    req.Priority,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}
	s.commandPermissions[p.ID] = p
	return p, nil
}

func (s *AdminService) ListCommandPermissions(ctx context.Context, tenantID string) ([]models.CommandPermission, error) {
	_, span := otel.Tracer("admin-service").Start(ctx, "ListCommandPermissions")
	defer span.End()

	s.mu.RLock()
	defer s.mu.RUnlock()

	var result []models.CommandPermission
	for _, p := range s.commandPermissions {
		if p.TenantID == tenantID {
			result = append(result, *p)
		}
	}
	return result, nil
}

func (s *AdminService) UpdateCommandPermission(ctx context.Context, tenantID, id string, req models.UpdateCommandPermissionRequest) (*models.CommandPermission, error) {
	_, span := otel.Tracer("admin-service").Start(ctx, "UpdateCommandPermission")
	defer span.End()

	s.mu.Lock()
	defer s.mu.Unlock()

	p, ok := s.commandPermissions[id]
	if !ok || p.TenantID != tenantID {
		return nil, fmt.Errorf("command permission not found: %s", id)
	}
	if req.CommandName != nil {
		p.CommandName = *req.CommandName
	}
	if req.RoleName != nil {
		p.RoleName = *req.RoleName
	}
	if req.Allow != nil {
		p.Allow = *req.Allow
	}
	if req.Priority != nil {
		p.Priority = *req.Priority
	}
	p.UpdatedAt = time.Now()
	return p, nil
}

func (s *AdminService) DeleteCommandPermission(ctx context.Context, tenantID, id string) error {
	_, span := otel.Tracer("admin-service").Start(ctx, "DeleteCommandPermission")
	defer span.End()

	s.mu.Lock()
	defer s.mu.Unlock()

	p, ok := s.commandPermissions[id]
	if !ok || p.TenantID != tenantID {
		return fmt.Errorf("command permission not found: %s", id)
	}
	delete(s.commandPermissions, id)
	return nil
}

// ==================== Environment Permission ====================

func (s *AdminService) CreateEnvironmentPermission(ctx context.Context, tenantID string, req models.CreateEnvironmentPermissionRequest) (*models.EnvironmentPermission, error) {
	_, span := otel.Tracer("admin-service").Start(ctx, "CreateEnvironmentPermission")
	defer span.End()

	s.mu.Lock()
	defer s.mu.Unlock()

	allow := true
	if req.Allow != nil {
		allow = *req.Allow
	}

	p := &models.EnvironmentPermission{
		ID:          uuid.New().String(),
		TenantID:    tenantID,
		Environment: req.Environment,
		RoleName:    req.RoleName,
		Allow:       allow,
		Priority:    req.Priority,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}
	s.envPermissions[p.ID] = p
	return p, nil
}

func (s *AdminService) ListEnvironmentPermissions(ctx context.Context, tenantID string) ([]models.EnvironmentPermission, error) {
	_, span := otel.Tracer("admin-service").Start(ctx, "ListEnvironmentPermissions")
	defer span.End()

	s.mu.RLock()
	defer s.mu.RUnlock()

	var result []models.EnvironmentPermission
	for _, p := range s.envPermissions {
		if p.TenantID == tenantID {
			result = append(result, *p)
		}
	}
	return result, nil
}

func (s *AdminService) UpdateEnvironmentPermission(ctx context.Context, tenantID, id string, req models.UpdateEnvironmentPermissionRequest) (*models.EnvironmentPermission, error) {
	_, span := otel.Tracer("admin-service").Start(ctx, "UpdateEnvironmentPermission")
	defer span.End()

	s.mu.Lock()
	defer s.mu.Unlock()

	p, ok := s.envPermissions[id]
	if !ok || p.TenantID != tenantID {
		return nil, fmt.Errorf("environment permission not found: %s", id)
	}
	if req.Environment != nil {
		p.Environment = *req.Environment
	}
	if req.RoleName != nil {
		p.RoleName = *req.RoleName
	}
	if req.Allow != nil {
		p.Allow = *req.Allow
	}
	if req.Priority != nil {
		p.Priority = *req.Priority
	}
	p.UpdatedAt = time.Now()
	return p, nil
}

func (s *AdminService) DeleteEnvironmentPermission(ctx context.Context, tenantID, id string) error {
	_, span := otel.Tracer("admin-service").Start(ctx, "DeleteEnvironmentPermission")
	defer span.End()

	s.mu.Lock()
	defer s.mu.Unlock()

	p, ok := s.envPermissions[id]
	if !ok || p.TenantID != tenantID {
		return fmt.Errorf("environment permission not found: %s", id)
	}
	delete(s.envPermissions, id)
	return nil
}

// ==================== Command Version ====================

func (s *AdminService) ListCommandVersions(ctx context.Context, tenantID string) ([]models.CommandVersion, error) {
	_, span := otel.Tracer("admin-service").Start(ctx, "ListCommandVersions")
	defer span.End()

	s.mu.RLock()
	defer s.mu.RUnlock()

	var result []models.CommandVersion
	for _, v := range s.commandVersions {
		if v.TenantID == tenantID {
			result = append(result, *v)
		}
	}
	return result, nil
}

func (s *AdminService) ListCommandVersionsByCommand(ctx context.Context, tenantID, commandID string) ([]models.CommandVersion, error) {
	_, span := otel.Tracer("admin-service").Start(ctx, "ListCommandVersionsByCommand")
	defer span.End()

	s.mu.RLock()
	defer s.mu.RUnlock()

	var result []models.CommandVersion
	for _, v := range s.commandVersions {
		if v.TenantID == tenantID && v.CommandID == commandID {
			result = append(result, *v)
		}
	}
	return result, nil
}

func (s *AdminService) CreateCommandVersion(ctx context.Context, tenantID string, req models.CreateCommandVersionRequest) (*models.CommandVersion, error) {
	_, span := otel.Tracer("admin-service").Start(ctx, "CreateCommandVersion")
	defer span.End()

	s.mu.Lock()
	defer s.mu.Unlock()

	// Determine next version number
	maxVersion := 0
	for _, v := range s.commandVersions {
		if v.TenantID == tenantID && v.CommandID == req.CommandID && v.Version > maxVersion {
			maxVersion = v.Version
		}
	}

	ver := &models.CommandVersion{
		ID:        uuid.New().String(),
		TenantID:  tenantID,
		CommandID: req.CommandID,
		Version:   maxVersion + 1,
		SchemaDef: req.SchemaDef,
		Aliases:   req.Aliases,
		Examples:  req.Examples,
		CreatedBy: req.CreatedBy,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	s.commandVersions[ver.ID] = ver
	return ver, nil
}

func (s *AdminService) RollbackCommandVersion(ctx context.Context, tenantID, id string) (*models.CommandVersion, error) {
	_, span := otel.Tracer("admin-service").Start(ctx, "RollbackCommandVersion")
	defer span.End()

	s.mu.Lock()
	defer s.mu.Unlock()

	v, ok := s.commandVersions[id]
	if !ok || v.TenantID != tenantID {
		return nil, fmt.Errorf("command version not found: %s", id)
	}

	// Create a new version that copies this version's data
	newVer := &models.CommandVersion{
		ID:        uuid.New().String(),
		TenantID:  tenantID,
		CommandID: v.CommandID,
		Version:   v.Version + 1,
		SchemaDef: v.SchemaDef,
		Aliases:   v.Aliases,
		Examples:  v.Examples,
		CreatedBy: "rollback",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	s.commandVersions[newVer.ID] = newVer
	return newVer, nil
}

func (s *AdminService) AddCommandVersionTag(ctx context.Context, tenantID, id, tag string) (*models.CommandVersion, error) {
	_, span := otel.Tracer("admin-service").Start(ctx, "AddCommandVersionTag")
	defer span.End()

	s.mu.Lock()
	defer s.mu.Unlock()

	v, ok := s.commandVersions[id]
	if !ok || v.TenantID != tenantID {
		return nil, fmt.Errorf("command version not found: %s", id)
	}
	v.Tags = append(v.Tags, tag)
	v.UpdatedAt = time.Now()
	return v, nil
}

func (s *AdminService) DeleteCommandVersionTag(ctx context.Context, tenantID, id, tag string) error {
	_, span := otel.Tracer("admin-service").Start(ctx, "DeleteCommandVersionTag")
	defer span.End()

	s.mu.Lock()
	defer s.mu.Unlock()

	v, ok := s.commandVersions[id]
	if !ok || v.TenantID != tenantID {
		return fmt.Errorf("command version not found: %s", id)
	}
	var newTags []string
	for _, t := range v.Tags {
		if t != tag {
			newTags = append(newTags, t)
		}
	}
	v.Tags = newTags
	v.UpdatedAt = time.Now()
	return nil
}

func (s *AdminService) DeleteCommandVersion(ctx context.Context, tenantID, id string) error {
	_, span := otel.Tracer("admin-service").Start(ctx, "DeleteCommandVersion")
	defer span.End()

	s.mu.Lock()
	defer s.mu.Unlock()

	v, ok := s.commandVersions[id]
	if !ok || v.TenantID != tenantID {
		return fmt.Errorf("command version not found: %s", id)
	}
	delete(s.commandVersions, id)
	return nil
}