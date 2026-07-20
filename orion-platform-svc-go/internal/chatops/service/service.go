package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"time"

	"orion/platform-svc-go/internal/chatops/models"
	"orion/platform-svc-go/internal/chatops/repository"

	"github.com/google/uuid"
)

type Service struct {
	repo *repository.Repository
}

func NewService(repo *repository.Repository) *Service {
	return &Service{repo: repo}
}

// ---- Commands ----

func (s *Service) CreateCommand(ctx context.Context, tenantID string, req models.CreateCommandRequest) (*models.ChatOpsCommand, error) {
	m := &models.ChatOpsCommand{
		TenantID:        tenantID,
		Name:            req.Name,
		Subcommand:      req.Subcommand,
		Aliases:         req.Aliases,
		Description:     req.Description,
		PermissionLevel: req.PermissionLevel,
		Schema:          req.Schema,
		Examples:        req.Examples,
	}
	if err := s.repo.CreateCommand(ctx, m); err != nil {
		return nil, err
	}
	return m, nil
}

func (s *Service) GetCommand(ctx context.Context, tenantID, id string) (*models.ChatOpsCommand, error) {
	return s.repo.GetCommand(ctx, tenantID, id)
}

func (s *Service) GetCommandByName(ctx context.Context, tenantID, name string) (*models.ChatOpsCommand, error) {
	return s.repo.GetCommand(ctx, tenantID, name)
}

func (s *Service) ListCommands(ctx context.Context, tenantID string, permissionLevel, name *string, limit, offset int) ([]models.ChatOpsCommand, error) {
	return s.repo.ListCommands(ctx, tenantID, permissionLevel, name, limit, offset)
}

func (s *Service) UpdateCommand(ctx context.Context, tenantID, id string, req models.UpdateCommandRequest) (*models.ChatOpsCommand, error) {
	updates := make(map[string]interface{})
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.Subcommand != nil {
		updates["subcommand"] = *req.Subcommand
	}
	if req.Description != nil {
		updates["description"] = *req.Description
	}
	if req.PermissionLevel != nil {
		updates["permission_level"] = *req.PermissionLevel
	}
	if req.Schema != nil {
		updates["schema"] = *req.Schema
	}
	if req.Examples != nil {
		updates["examples"] = *req.Examples
	}
	if err := s.repo.UpdateCommand(ctx, tenantID, id, updates); err != nil {
		return nil, err
	}
	return s.repo.GetCommand(ctx, tenantID, id)
}

func (s *Service) DeleteCommand(ctx context.Context, tenantID, id string) error {
	return s.repo.DeleteCommand(ctx, tenantID, id)
}

func (s *Service) GetCommandHelp(ctx context.Context, tenantID, name string) (*models.ChatOpsCommand, error) {
	cmd, err := s.repo.GetCommand(ctx, tenantID, name)
	if err != nil {
		return nil, err
	}
	return cmd, nil
}

// ---- Executions ----

func (s *Service) ExecuteCommand(ctx context.Context, tenantID string, userID string, req models.ExecuteCommandRequest) (*models.Execution, error) {
	if req.Command == "" {
		return nil, errors.New("command is required")
	}
	paramsJSON, _ := json.Marshal(req.Params)
	ex := &models.Execution{
		TenantID:  tenantID,
		CommandID: req.Command,
		UserID:    userID,
		Status:    "running",
		Params:    string(paramsJSON),
	}
	if err := s.repo.CreateExecution(ctx, ex); err != nil {
		return nil, err
	}
	// Simulate completion
	status := "completed"
	s.repo.UpdateExecutionStatus(ctx, tenantID, ex.ID, status)
	ex.Status = status
	return ex, nil
}

func (s *Service) GetExecutionStatus(ctx context.Context, tenantID, id string) (*models.Execution, error) {
	return s.repo.GetExecution(ctx, tenantID, id)
}

func (s *Service) ListExecutions(ctx context.Context, tenantID string, commandID, userID, status *string, limit, offset int) ([]models.Execution, error) {
	return s.repo.ListExecutions(ctx, tenantID, commandID, userID, status, limit, offset)
}

// ---- Audit Logs ----

func (s *Service) CreateAuditLog(ctx context.Context, tenantID, userID, action, command, details string) error {
	m := &models.AuditLog{
		ID:        uuid.New().String(),
		TenantID:  tenantID,
		UserID:    userID,
		Action:    action,
		Command:   command,
		Details:   details,
	}
	return s.repo.CreateAuditLog(ctx, m)
}

func (s *Service) ListAuditLogs(ctx context.Context, tenantID string, q models.AuditLogQuery) ([]models.AuditLog, error) {
	return s.repo.ListAuditLogs(ctx, tenantID, &q)
}

func (s *Service) GetAuditStats(ctx context.Context, tenantID string) (map[string]interface{}, error) {
	return s.repo.AuditLogStats(ctx, tenantID)
}

func (s *Service) ExportAuditLogs(ctx context.Context, tenantID string, q models.AuditLogQuery) (map[string]interface{}, error) {
	logs, err := s.repo.ExportAuditLogs(ctx, tenantID, &q)
	if err != nil {
		return nil, err
	}
	return map[string]interface{}{
		"data":  logs,
		"total": len(logs),
	}, nil
}

// ---- Notification Preferences ----

func (s *Service) GetNotificationPreference(ctx context.Context, tenantID, userID string) (*models.NotificationPreference, error) {
	return s.repo.GetNotificationPreference(ctx, tenantID, userID)
}

func (s *Service) UpdateNotificationPreference(ctx context.Context, tenantID, userID string, req models.UpdateNotificationPreferenceRequest) (*models.NotificationPreference, error) {
	existing, err := s.repo.GetNotificationPreference(ctx, tenantID, userID)
	if err != nil {
		// Create new
		m := &models.NotificationPreference{
			ID:           uuid.New().String(),
			TenantID:     tenantID,
			UserID:       userID,
			AlertLevel:   req.AlertLevel,
			ChannelChatops: true,
			ChannelEmail:   true,
			ChannelSlack:   true,
			ChannelFeishu:  true,
			ChannelDingtalk: true,
		}
		if req.ChannelChatops != nil {
			m.ChannelChatops = *req.ChannelChatops
		}
		if req.ChannelEmail != nil {
			m.ChannelEmail = *req.ChannelEmail
		}
		if req.ChannelSlack != nil {
			m.ChannelSlack = *req.ChannelSlack
		}
		if req.ChannelFeishu != nil {
			m.ChannelFeishu = *req.ChannelFeishu
		}
		if req.ChannelDingtalk != nil {
			m.ChannelDingtalk = *req.ChannelDingtalk
		}
		if err := s.repo.UpsertNotificationPreference(ctx, m); err != nil {
			return nil, err
		}
		return m, nil
	}
	// Update existing
	if req.AlertLevel != "" {
		existing.AlertLevel = req.AlertLevel
	}
	if req.ChannelChatops != nil {
		existing.ChannelChatops = *req.ChannelChatops
	}
	if req.ChannelEmail != nil {
		existing.ChannelEmail = *req.ChannelEmail
	}
	if req.ChannelSlack != nil {
		existing.ChannelSlack = *req.ChannelSlack
	}
	if req.ChannelFeishu != nil {
		existing.ChannelFeishu = *req.ChannelFeishu
	}
	if req.ChannelDingtalk != nil {
		existing.ChannelDingtalk = *req.ChannelDingtalk
	}
	if err := s.repo.UpsertNotificationPreference(ctx, existing); err != nil {
		return nil, err
	}
	return existing, nil
}

// ---- DND Settings ----

func (s *Service) GetDNDSettings(ctx context.Context, tenantID, userID string) (*models.DNDSettings, error) {
	return s.repo.GetDNDSettings(ctx, tenantID, userID)
}

func (s *Service) UpdateDNDSettings(ctx context.Context, tenantID, userID string, req models.UpdateDNDRequest) (*models.DNDSettings, error) {
	existing, err := s.repo.GetDNDSettings(ctx, tenantID, userID)
	if err != nil {
		existing = &models.DNDSettings{
			ID:       uuid.New().String(),
			TenantID: tenantID,
			UserID:   userID,
		}
	}
	if req.Enabled != nil {
		existing.Enabled = *req.Enabled
	}
	if req.StartTime != "" {
		existing.StartTime = req.StartTime
	}
	if req.EndTime != "" {
		existing.EndTime = req.EndTime
	}
	if req.RepeatDays != "" {
		existing.RepeatDays = req.RepeatDays
	}
	if req.AllowCritical != nil {
		existing.AllowCritical = *req.AllowCritical
	}
	if err := s.repo.UpsertDNDSettings(ctx, existing); err != nil {
		return nil, err
	}
	return existing, nil
}

func (s *Service) ToggleDND(ctx context.Context, tenantID, userID string, enabled bool) (*models.DNDSettings, error) {
	existing, err := s.repo.GetDNDSettings(ctx, tenantID, userID)
	if err != nil {
		existing = &models.DNDSettings{
			ID:       uuid.New().String(),
			TenantID: tenantID,
			UserID:   userID,
		}
	}
	existing.Enabled = enabled
	if err := s.repo.UpsertDNDSettings(ctx, existing); err != nil {
		return nil, err
	}
	return existing, nil
}

// ---- Platform Configs ----

func (s *Service) GetPlatformConfigs(ctx context.Context, tenantID, userID string) ([]models.PlatformConfig, error) {
	return s.repo.GetPlatformConfigs(ctx, tenantID, userID)
}

func (s *Service) UpdatePlatformConfigs(ctx context.Context, tenantID, userID string, req models.UpdatePlatformConfigRequest) ([]models.PlatformConfig, error) {
	configs := make([]models.PlatformConfig, len(req.Platforms))
	for i, p := range req.Platforms {
		// Find existing
		existing, _ := s.repo.GetPlatformConfigs(ctx, tenantID, userID)
		found := false
		for _, e := range existing {
			if e.Platform == p.Platform {
				configs[i] = e
				found = true
				break
			}
		}
		if !found {
			configs[i] = models.PlatformConfig{
				ID: uuid.New().String(),
			}
		}
		configs[i].TenantID = tenantID
		configs[i].UserID = userID
		configs[i].Platform = p.Platform
		configs[i].Enabled = p.Enabled
		configs[i].Webhook = p.Webhook
		configs[i].Token = p.Token
	}
	if err := s.repo.UpsertPlatformConfigs(ctx, tenantID, userID, configs); err != nil {
		return nil, err
	}
	return configs, nil
}

// ---- Alert States ----

func (s *Service) GetAlertStates(ctx context.Context, tenantID, userID string) ([]models.AlertState, error) {
	return s.repo.GetAlertStates(ctx, tenantID, userID)
}

func (s *Service) UpdateAlertState(ctx context.Context, tenantID, userID, alertID, status string) error {
	return s.repo.UpdateAlertState(ctx, tenantID, userID, alertID, status)
}

func (s *Service) MarkAlertRead(ctx context.Context, tenantID, userID, alertID string) error {
	return s.UpdateAlertState(ctx, tenantID, userID, alertID, "read")
}

func (s *Service) MarkAlertAcknowledged(ctx context.Context, tenantID, userID, alertID string) error {
	return s.UpdateAlertState(ctx, tenantID, userID, alertID, "acknowledged")
}

func (s *Service) MarkAlertDismissed(ctx context.Context, tenantID, userID, alertID string) error {
	return s.UpdateAlertState(ctx, tenantID, userID, alertID, "dismissed")
}

// ---- Question / Command Configs ----

func (s *Service) GetQuestionConfigs(ctx context.Context, tenantID, userID string) ([]models.QuestionConfig, error) {
	return s.repo.GetQuestionConfigs(ctx, tenantID, userID)
}

func (s *Service) UpdateQuestionConfigs(ctx context.Context, tenantID, userID string, req models.UpdateQuestionConfigsRequest) ([]models.QuestionConfig, error) {
	configs := make([]models.QuestionConfig, len(req.QuestionConfigs))
	for i, q := range req.QuestionConfigs {
		c := models.QuestionConfig{
			ID:       q.ID,
			TenantID: tenantID,
			UserID:   userID,
			Title:    q.Title,
			Command:  q.Command,
			Enabled:  q.Enabled,
		}
		if c.ID == "" {
			c.ID = uuid.New().String()
		}
		configs[i] = c
	}
	if err := s.repo.UpsertQuestionConfigs(ctx, tenantID, userID, configs); err != nil {
		return nil, err
	}
	return configs, nil
}

func (s *Service) GetCommandConfigs(ctx context.Context, tenantID, userID string) ([]models.CommandConfig, error) {
	return s.repo.GetCommandConfigs(ctx, tenantID, userID)
}

func (s *Service) UpdateCommandConfigs(ctx context.Context, tenantID, userID string, req models.UpdateCommandConfigsRequest) ([]models.CommandConfig, error) {
	configs := make([]models.CommandConfig, len(req.CommandConfigs))
	for i, c := range req.CommandConfigs {
		cc := models.CommandConfig{
			ID:       c.ID,
			TenantID: tenantID,
			UserID:   userID,
			Command:  c.Command,
			Params:   c.Params,
			Enabled:  c.Enabled,
		}
		if cc.ID == "" {
			cc.ID = uuid.New().String()
		}
		configs[i] = cc
	}
	if err := s.repo.UpsertCommandConfigs(ctx, tenantID, userID, configs); err != nil {
		return nil, err
	}
	return configs, nil
}

// ---- Capability Mappings ----

func (s *Service) GetAllCapabilityMappings(ctx context.Context, tenantID string, environment *string) ([]models.CapabilityMapping, error) {
	return s.repo.GetAllCapabilityMappings(ctx, tenantID, environment)
}

func (s *Service) CreateCapabilityMapping(ctx context.Context, tenantID string, req models.CreateCapabilityMappingRequest) (*models.CapabilityMapping, error) {
	m := &models.CapabilityMapping{
		TenantID:         tenantID,
		CommandID:        req.CommandID,
		CapabilityID:     req.CapabilityID,
		Environment:      req.Environment,
		RiskLevel:        req.RiskLevel,
		RequiresApproval: req.RequiresApproval,
	}
	if err := s.repo.CreateCapabilityMapping(ctx, m); err != nil {
		return nil, err
	}
	return m, nil
}

func (s *Service) GetCapabilityMapping(ctx context.Context, tenantID, id string) (*models.CapabilityMapping, error) {
	return s.repo.GetCapabilityMapping(ctx, tenantID, id)
}

func (s *Service) UpdateCapabilityMapping(ctx context.Context, tenantID, id string, req models.UpdateCapabilityMappingRequest) (*models.CapabilityMapping, error) {
	updates := make(map[string]interface{})
	if req.CommandID != nil {
		updates["command_id"] = *req.CommandID
	}
	if req.CapabilityID != nil {
		updates["capability_id"] = *req.CapabilityID
	}
	if req.Environment != nil {
		updates["environment"] = *req.Environment
	}
	if req.RiskLevel != nil {
		updates["risk_level"] = *req.RiskLevel
	}
	if req.RequiresApproval != nil {
		updates["requires_approval"] = *req.RequiresApproval
	}
	if err := s.repo.UpdateCapabilityMapping(ctx, tenantID, id, updates); err != nil {
		return nil, err
	}
	return s.repo.GetCapabilityMapping(ctx, tenantID, id)
}

func (s *Service) DeleteCapabilityMapping(ctx context.Context, tenantID, id string) error {
	return s.repo.DeleteCapabilityMapping(ctx, tenantID, id)
}

// ---- Approval Configs ----

func (s *Service) GetAllApprovalConfigs(ctx context.Context, tenantID string) ([]models.ApprovalConfig, error) {
	return s.repo.GetAllApprovalConfigs(ctx, tenantID)
}

func (s *Service) GetApprovalConfigByCapability(ctx context.Context, tenantID, capability string) (*models.ApprovalConfig, error) {
	return s.repo.GetApprovalConfigByCapability(ctx, tenantID, capability)
}

func (s *Service) UpdateApprovalConfig(ctx context.Context, tenantID, capability string, req models.UpdateApprovalConfigRequest) (*models.ApprovalConfig, error) {
	if err := s.repo.UpsertApprovalConfig(ctx, tenantID, capability, req.Enabled, req.Approvers, req.Threshold); err != nil {
		return nil, err
	}
	return s.repo.GetApprovalConfigByCapability(ctx, tenantID, capability)
}

func (s *Service) UpdateApprovalConfigs(ctx context.Context, tenantID string, req models.UpdateApprovalConfigsRequest) ([]models.ApprovalConfig, error) {
	configs := make([]models.ApprovalConfig, len(req.Configs))
	for i, c := range req.Configs {
		approversJSON, _ := json.Marshal(c.Approvers)
		configs[i] = models.ApprovalConfig{
			ID:         uuid.New().String(),
			TenantID:   tenantID,
			Capability: c.Capability,
			Enabled:    c.Enabled,
			Approvers:  string(approversJSON),
			Threshold:  c.Threshold,
		}
	}
	if err := s.repo.BatchUpdateApprovalConfigs(ctx, tenantID, configs); err != nil {
		return nil, err
	}
	return configs, nil
}

func (s *Service) GetApprovers(ctx context.Context, tenantID string) ([]models.Approver, error) {
	return s.repo.GetApprovers(ctx, tenantID)
}

func (s *Service) GetApproverSchedule(ctx context.Context, tenantID string) ([]models.ApproverSchedule, error) {
	return s.repo.GetApproverSchedule(ctx, tenantID)
}

func (s *Service) UpdateApproverSchedule(ctx context.Context, tenantID string, schedule []models.ApproverSchedule) error {
	return s.repo.UpdateApproverSchedule(ctx, tenantID, schedule)
}

func (s *Service) GetGlobalApprovalConfig(ctx context.Context, tenantID string) (*models.GlobalApprovalConfig, error) {
	return s.repo.GetGlobalApprovalConfig(ctx, tenantID)
}

func (s *Service) UpdateGlobalApprovalConfig(ctx context.Context, tenantID string, config *models.GlobalApprovalConfig) error {
	return s.repo.UpsertGlobalApprovalConfig(ctx, tenantID, config)
}

// ---- Roles ----

func (s *Service) GetAllRoles(ctx context.Context, tenantID string) ([]models.PermissionRole, error) {
	return s.repo.GetAllRoles(ctx, tenantID)
}

func (s *Service) CreateRole(ctx context.Context, tenantID string, req models.CreateRoleRequest) (*models.PermissionRole, error) {
	permsJSON, _ := json.Marshal(req.Permissions)
	m := &models.PermissionRole{
		TenantID:    tenantID,
		Name:        req.Name,
		Description: req.Description,
		Permissions: string(permsJSON),
	}
	if err := s.repo.CreateRole(ctx, m); err != nil {
		return nil, err
	}
	return m, nil
}

func (s *Service) GetRole(ctx context.Context, tenantID, id string) (*models.PermissionRole, error) {
	return s.repo.GetRole(ctx, tenantID, id)
}

func (s *Service) UpdateRole(ctx context.Context, tenantID, id string, req models.UpdateRoleRequest) (*models.PermissionRole, error) {
	updates := make(map[string]interface{})
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.Description != nil {
		updates["description"] = *req.Description
	}
	if req.Permissions != nil {
		permsJSON, _ := json.Marshal(*req.Permissions)
		updates["permissions"] = string(permsJSON)
	}
	if err := s.repo.UpdateRole(ctx, tenantID, id, updates); err != nil {
		return nil, err
	}
	return s.repo.GetRole(ctx, tenantID, id)
}

func (s *Service) DeleteRole(ctx context.Context, tenantID, id string) error {
	return s.repo.DeleteRole(ctx, tenantID, id)
}

func (s *Service) GetUserAllowedCommands(ctx context.Context, tenantID, userID string) ([]string, error) {
	return s.repo.GetUserAllowedCommands(ctx, tenantID, userID)
}

// ---- Command Permissions ----

func (s *Service) GetAllCommandPermissions(ctx context.Context, tenantID string) ([]models.CommandPermission, error) {
	return s.repo.GetAllCommandPermissions(ctx, tenantID)
}

func (s *Service) CreateCommandPermission(ctx context.Context, tenantID string, req models.CreateCommandPermissionRequest) (*models.CommandPermission, error) {
	roleIDsJSON, _ := json.Marshal(req.RoleIDs)
	m := &models.CommandPermission{
		TenantID:         tenantID,
		Command:          req.Command,
		Description:      req.Description,
		Capability:       req.Capability,
		RiskLevel:        req.RiskLevel,
		RequiresApproval: req.RequiresApproval,
		RoleIDs:          string(roleIDsJSON),
	}
	if err := s.repo.CreateCommandPermission(ctx, m); err != nil {
		return nil, err
	}
	return m, nil
}

func (s *Service) GetCommandPermission(ctx context.Context, tenantID, id string) (*models.CommandPermission, error) {
	return s.repo.GetCommandPermission(ctx, tenantID, id)
}

func (s *Service) UpdateCommandPermission(ctx context.Context, tenantID, id string, req models.UpdateCommandPermissionRequest) (*models.CommandPermission, error) {
	updates := make(map[string]interface{})
	if req.Description != nil {
		updates["description"] = *req.Description
	}
	if req.Capability != nil {
		updates["capability"] = *req.Capability
	}
	if req.RiskLevel != nil {
		updates["risk_level"] = *req.RiskLevel
	}
	if req.RequiresApproval != nil {
		updates["requires_approval"] = *req.RequiresApproval
	}
	if req.RoleIDs != nil {
		roleIDsJSON, _ := json.Marshal(*req.RoleIDs)
		updates["role_ids"] = string(roleIDsJSON)
	}
	if err := s.repo.UpdateCommandPermission(ctx, tenantID, id, updates); err != nil {
		return nil, err
	}
	return s.repo.GetCommandPermission(ctx, tenantID, id)
}

func (s *Service) DeleteCommandPermission(ctx context.Context, tenantID, id string) error {
	return s.repo.DeleteCommandPermission(ctx, tenantID, id)
}

// ---- Environment Permissions ----

func (s *Service) GetAllEnvironmentPermissions(ctx context.Context, tenantID string) ([]models.EnvironmentPermission, error) {
	return s.repo.GetAllEnvironmentPermissions(ctx, tenantID)
}

func (s *Service) CreateEnvironmentPermission(ctx context.Context, tenantID string, req models.CreateEnvironmentPermissionRequest) (*models.EnvironmentPermission, error) {
	allowedJSON, _ := json.Marshal(req.AllowedCommands)
	deniedJSON, _ := json.Marshal(req.DeniedCommands)
	roleIDsJSON, _ := json.Marshal(req.RoleIDs)
	m := &models.EnvironmentPermission{
		TenantID:        tenantID,
		Environment:     req.Environment,
		Description:     req.Description,
		RateLimit:       req.RateLimit,
		RequireApproval: req.RequireApproval,
		AllowedCommands: string(allowedJSON),
		DeniedCommands:  string(deniedJSON),
		RoleIDs:         string(roleIDsJSON),
	}
	if err := s.repo.CreateEnvironmentPermission(ctx, m); err != nil {
		return nil, err
	}
	return m, nil
}

func (s *Service) GetEnvironmentPermission(ctx context.Context, tenantID, id string) (*models.EnvironmentPermission, error) {
	return s.repo.GetEnvironmentPermission(ctx, tenantID, id)
}

func (s *Service) UpdateEnvironmentPermission(ctx context.Context, tenantID, id string, req models.UpdateEnvironmentPermissionRequest) (*models.EnvironmentPermission, error) {
	updates := make(map[string]interface{})
	if req.Description != nil {
		updates["description"] = *req.Description
	}
	if req.RateLimit != nil {
		updates["rate_limit"] = *req.RateLimit
	}
	if req.RequireApproval != nil {
		updates["require_approval"] = *req.RequireApproval
	}
	if req.AllowedCommands != nil {
		allowedJSON, _ := json.Marshal(*req.AllowedCommands)
		updates["allowed_commands"] = string(allowedJSON)
	}
	if req.DeniedCommands != nil {
		deniedJSON, _ := json.Marshal(*req.DeniedCommands)
		updates["denied_commands"] = string(deniedJSON)
	}
	if req.RoleIDs != nil {
		roleIDsJSON, _ := json.Marshal(*req.RoleIDs)
		updates["role_ids"] = string(roleIDsJSON)
	}
	if err := s.repo.UpdateEnvironmentPermission(ctx, tenantID, id, updates); err != nil {
		return nil, err
	}
	return s.repo.GetEnvironmentPermission(ctx, tenantID, id)
}

func (s *Service) DeleteEnvironmentPermission(ctx context.Context, tenantID, id string) error {
	return s.repo.DeleteEnvironmentPermission(ctx, tenantID, id)
}

// ---- Command Versions ----

func (s *Service) GetAllCommandVersions(ctx context.Context, tenantID string, page, perPage int) (models.CommandVersionResult, error) {
	if page <= 0 {
		page = 1
	}
	if perPage <= 0 {
		perPage = 20
	}
	offset := (page - 1) * perPage
	versions, total, err := s.repo.GetAllCommandVersions(ctx, tenantID, perPage, offset)
	if err != nil {
		return models.CommandVersionResult{}, err
	}
	return models.CommandVersionResult{
		Versions: versions,
		Total:    total,
	}, nil
}

func (s *Service) GetVersionsByCommand(ctx context.Context, tenantID, commandID string) ([]models.CommandVersion, error) {
	return s.repo.GetVersionsByCommand(ctx, tenantID, commandID)
}

func (s *Service) CreateCommandVersion(ctx context.Context, tenantID string, req models.CreateCommandVersionRequest) (*models.CommandVersion, error) {
	paramsJSON, _ := json.Marshal(req.Parameters)
	m := &models.CommandVersion{
		TenantID:    tenantID,
		CommandID:   req.CommandID,
		CommandText: req.CommandText,
		Parameters:  string(paramsJSON),
		Description: req.Description,
		Changelog:   req.Changelog,
		CreatedBy:   req.CreatedBy,
	}
	if err := s.repo.CreateCommandVersion(ctx, m); err != nil {
		return nil, err
	}
	return m, nil
}

func (s *Service) AddTag(ctx context.Context, tenantID, versionID, tagName, createdBy string) error {
	return s.repo.AddTag(ctx, tenantID, versionID, tagName, createdBy)
}

func (s *Service) RemoveTag(ctx context.Context, tenantID, versionID, tagName string) error {
	return s.repo.RemoveTag(ctx, tenantID, versionID, tagName)
}

func (s *Service) DeleteCommandVersion(ctx context.Context, tenantID, id string) error {
	return s.repo.DeleteCommandVersion(ctx, tenantID, id)
}

// ---- Rate Limits ----

func (s *Service) GetAllRateLimits(ctx context.Context, tenantID string) ([]models.RateLimit, error) {
	return s.repo.GetAllRateLimits(ctx, tenantID)
}

func (s *Service) CreateRateLimit(ctx context.Context, tenantID string, req models.CreateRateLimitRequest) (*models.RateLimit, error) {
	m := &models.RateLimit{
		TenantID:      tenantID,
		TargetType:    req.TargetType,
		TargetID:      req.TargetID,
		CommandName:   req.CommandName,
		LimitType:     req.LimitType,
		LimitCount:    req.LimitCount,
		WindowSeconds: req.WindowSeconds,
		Description:   req.Description,
	}
	if err := s.repo.CreateRateLimit(ctx, m); err != nil {
		return nil, err
	}
	return m, nil
}

func (s *Service) GetRateLimit(ctx context.Context, tenantID, id string) (*models.RateLimit, error) {
	return s.repo.GetRateLimit(ctx, tenantID, id)
}

func (s *Service) UpdateRateLimit(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.RateLimit, error) {
	if err := s.repo.UpdateRateLimit(ctx, tenantID, id, updates); err != nil {
		return nil, err
	}
	return s.repo.GetRateLimit(ctx, tenantID, id)
}

func (s *Service) DeleteRateLimit(ctx context.Context, tenantID, id string) error {
	return s.repo.DeleteRateLimit(ctx, tenantID, id)
}

// ---- Webhooks ----

func (s *Service) GetAllWebhooks(ctx context.Context, tenantID string) ([]models.Webhook, error) {
	return s.repo.GetAllWebhooks(ctx, tenantID)
}

func (s *Service) CreateWebhook(ctx context.Context, tenantID string, req models.CreateWebhookRequest) (*models.Webhook, error) {
	eventsJSON, _ := json.Marshal(req.Events)
	headersJSON, _ := json.Marshal(req.Headers)
	m := &models.Webhook{
		TenantID:       tenantID,
		Name:           req.Name,
		URL:            req.URL,
		Events:         string(eventsJSON),
		SecretKey:      req.SecretKey,
		Enabled:        req.Enabled,
		RetryCount:     req.RetryCount,
		TimeoutSeconds: req.TimeoutSeconds,
		Headers:        string(headersJSON),
		Description:    req.Description,
		CreatedBy:      req.CreatedBy,
	}
	if err := s.repo.CreateWebhook(ctx, m); err != nil {
		return nil, err
	}
	return m, nil
}

func (s *Service) GetWebhook(ctx context.Context, tenantID, id string) (*models.Webhook, error) {
	return s.repo.GetWebhook(ctx, tenantID, id)
}

func (s *Service) UpdateWebhook(ctx context.Context, tenantID, id string, body map[string]interface{}) (*models.Webhook, error) {
	if err := s.repo.UpdateWebhook(ctx, tenantID, id, body); err != nil {
		return nil, err
	}
	return s.repo.GetWebhook(ctx, tenantID, id)
}

func (s *Service) DeleteWebhook(ctx context.Context, tenantID, id string) error {
	return s.repo.DeleteWebhook(ctx, tenantID, id)
}

func (s *Service) TestWebhook(ctx context.Context, tenantID, id string) (*models.TestWebhookResult, error) {
	return s.repo.TestWebhook(ctx, tenantID, id)
}

func (s *Service) GetWebhookLogs(ctx context.Context, tenantID, webhookID string, limit int) ([]map[string]interface{}, error) {
	return s.repo.GetWebhookLogs(ctx, tenantID, webhookID, limit)
}

// ---- Dashboard Stats ----

func (s *Service) GetDashboardStats(ctx context.Context, tenantID string, req models.DashboardStatsRequest) (*models.DashboardStatsResult, error) {
	days := 7
	if req.Range != "" {
		switch req.Range {
		case "1h":
			days = 0
		case "24h":
			days = 1
		case "7d":
			days = 7
		case "30d":
			days = 30
		default:
			if n, err := strconv.Atoi(req.Range); err == nil {
				days = n
			}
		}
	}
	if req.StartDate != "" && req.EndDate != "" {
		start, _ := time.Parse(time.RFC3339, req.StartDate)
		end, _ := time.Parse(time.RFC3339, req.EndDate)
		if !start.IsZero() && !end.IsZero() {
			days = int(end.Sub(start).Hours()/24)
		}
	}
	return s.repo.GetDashboardStats(ctx, tenantID, days)
}

// ---- Health Check ----

func (s *Service) HealthCheck(ctx context.Context) (*models.HealthCheckResult, error) {
	return s.repo.HealthCheck(ctx)
}

// ---- Knowledge Recommendations ----

func (s *Service) GetKnowledgeRecommendations(ctx context.Context, tenantID string, context string, limit int) ([]models.KnowledgeRecommendation, error) {
	if limit <= 0 || limit > 50 {
		limit = 10
	}
	return s.repo.GetKnowledgeRecommendations(ctx, tenantID, context, limit)
}

// ---- Recommendations ----

func (s *Service) GetRecommendations(ctx context.Context, tenantID, userID, currentPage, resourceID string) ([]map[string]interface{}, error) {
	return s.repo.GetRecommendations(ctx, tenantID, userID, currentPage, resourceID)
}

// ---- Messages / Sessions ----

func (s *Service) ReceiveMessage(ctx context.Context, tenantID string, userID string, req models.ReceiveMessageRequest) (map[string]interface{}, error) {
	if req.Text == "" && req.Message == "" {
		return nil, errors.New("text or message is required")
	}
	text := req.Text
	if text == "" {
		text = req.Message
	}
	session, err := s.repo.CreateSession(ctx, tenantID, userID)
	if err != nil {
		return nil, err
	}
	m := &models.ChatOpsMessage{
		TenantID:  tenantID,
		SessionID: session.ID,
		UserID:    userID,
		Text:      text,
		Platform:  req.Platform,
	}
	if err := s.repo.CreateMessage(ctx, m); err != nil {
		return nil, err
	}
	return map[string]interface{}{
		"session_id": session.ID,
		"message_id": m.ID,
		"command":    text,
	}, nil
}

func (s *Service) GetSessionMessages(ctx context.Context, tenantID, sessionID string, limit int, cursor *string) ([]models.ChatOpsMessage, error) {
	return s.repo.GetSessionMessages(ctx, tenantID, sessionID, limit, cursor)
}

// ---- Errors ----

var (
	ErrNotFound = errors.New("not found")
)

func IsNotFound(err error) bool {
	return errors.Is(err, ErrNotFound)
}

func ErrNotFoundMsg(id string) error {
	return fmt.Errorf("resource %q not found: %w", id, ErrNotFound)
}
