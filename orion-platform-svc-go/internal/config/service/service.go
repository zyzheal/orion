package service

import (
	"context"
	"errors"
	"time"

	"orion/platform-svc-go/internal/config/models"
	"orion/platform-svc-go/internal/config/repository"
)

type Service struct {
	repo *repository.Repository
}

func NewService(repo *repository.Repository) *Service {
	return &Service{repo: repo}
}

// ---------- Config CRUD ----------

func (s *Service) Create(ctx context.Context, tenantID, userID string, req models.CreateConfigRequest) (*models.Config, error) {
	status := "active"
	dataType := req.DataType
	if dataType == "" {
		dataType = "string"
	}
	c := &models.Config{
		TenantID:    tenantID,
		Name:        req.Name,
		Description: req.Description,
		Key:         req.Key,
		Value:       req.Value,
		Environment: req.Environment,
		DataType:    dataType,
		Status:      status,
		CreatedBy:   userID,
	}
	if err := s.repo.Create(ctx, c); err != nil {
		return nil, err
	}
	s.repo.CreateAuditEntry(ctx, &models.AuditEntry{
		ConfigID: c.ID,
		Action:   "create",
		UserID:   userID,
	})
	return c, nil
}

func (s *Service) Get(ctx context.Context, tenantID, id string) (*models.Config, error) {
	c, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, errors.New("config not found")
	}
	return c, nil
}

func (s *Service) List(ctx context.Context, tenantID string, filter models.ConfigFilter) (*models.ListResult[models.Config], error) {
	rFilter := repository.ConfigFilter{
		Environment: filter.Environment,
		Status:      filter.Status,
		Search:      filter.Search,
		Page:        filter.Page,
		PageSize:    filter.PageSize,
	}
	items, total, err := s.repo.List(ctx, tenantID, rFilter)
	if err != nil {
		return nil, err
	}
	return &models.ListResult[models.Config]{
		Data:     items,
		Total:    total,
		Page:     filter.Page,
		PageSize: filter.PageSize,
	}, nil
}

func (s *Service) Update(ctx context.Context, tenantID, id string, req models.UpdateConfigRequest) (*models.Config, error) {
	existing, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, errors.New("config not found")
	}
	updates := make(map[string]any)
	if req.Description != nil {
		existing.Description = *req.Description
		updates["description"] = *req.Description
	}
	if req.Key != nil {
		existing.Key = *req.Key
		updates["key"] = *req.Key
	}
	if req.Value != nil {
		existing.Value = *req.Value
		updates["value"] = *req.Value
	}
	if req.Environment != nil {
		existing.Environment = *req.Environment
		updates["environment"] = *req.Environment
	}
	if req.DataType != nil {
		existing.DataType = *req.DataType
		updates["data_type"] = *req.DataType
	}
	if req.Status != nil {
		existing.Status = *req.Status
		updates["status"] = *req.Status
	}
	if err := s.repo.Update(ctx, tenantID, id, updates); err != nil {
		return nil, err
	}
	return existing, nil
}

func (s *Service) Delete(ctx context.Context, tenantID, id string) error {
	return s.repo.SoftDelete(ctx, tenantID, id)
}

// ---------- Versions ----------

func (s *Service) GetVersions(ctx context.Context, tenantID, configID string) ([]models.ConfigVersion, error) {
	_, err := s.repo.GetByID(ctx, tenantID, configID)
	if err != nil {
		return nil, errors.New("config not found")
	}
	return s.repo.GetVersions(ctx, configID)
}

func (s *Service) Rollback(ctx context.Context, tenantID, configID, version, userID string) (*models.Config, error) {
	c, err := s.repo.GetByID(ctx, tenantID, configID)
	if err != nil {
		return nil, errors.New("config not found")
	}
	ver, err := s.repo.GetVersion(ctx, configID, version)
	if err != nil {
		return nil, errors.New("version not found")
	}
	c.Value = ver.Value
	updates := map[string]any{"value": ver.Value}
	if err := s.repo.Update(ctx, tenantID, configID, updates); err != nil {
		return nil, err
	}
	s.repo.CreateAuditEntry(ctx, &models.AuditEntry{
		ConfigID: configID,
		Action:   "rollback",
		Details:  map[string]any{"version": version},
		UserID:   userID,
	})
	return c, nil
}

func (s *Service) Clone(ctx context.Context, tenantID, configID, userID string, req models.CloneConfigRequest) (*models.Config, error) {
	src, err := s.repo.GetByID(ctx, tenantID, configID)
	if err != nil {
		return nil, errors.New("config not found")
	}
	newConfig := &models.Config{
		TenantID:    tenantID,
		Name:        src.Name + " (cloned)",
		Description: src.Description,
		Key:         src.Key,
		Value:       src.Value,
		Environment: req.TargetEnvironment,
		DataType:    src.DataType,
		Status:      "active",
		CreatedBy:   userID,
	}
	if err := s.repo.Create(ctx, newConfig); err != nil {
		return nil, err
	}
	return newConfig, nil
}

// ---------- GitOps ----------

func (s *Service) EnableGitOps(ctx context.Context, tenantID string, req models.CreateGitOpsRequest) (*models.GitOpsConfig, error) {
	m := &models.GitOpsConfig{
		TenantID:      tenantID,
		RepositoryURL: req.RepositoryURL,
		Branch:        req.Branch,
		Path:          req.Path,
	}
	if m.Branch == "" {
		m.Branch = "main"
	}
	if m.Path == "" {
		m.Path = "/configs"
	}
	if err := s.repo.CreateGitOps(ctx, m); err != nil {
		return nil, err
	}
	return m, nil
}

func (s *Service) ListGitOpsConfigs(ctx context.Context, tenantID string) ([]models.GitOpsConfig, error) {
	return s.repo.ListGitOpsConfigs(ctx, tenantID)
}

func (s *Service) SyncFromGit(ctx context.Context, tenantID, gitOpsConfigID string) (*models.GitOpsSyncStatus, error) {
	_, err := s.repo.GetGitOpsConfig(ctx, tenantID, gitOpsConfigID)
	if err != nil {
		return nil, errors.New("gitops config not found")
	}
	sync := &models.GitOpsSyncStatus{
		ConfigID: gitOpsConfigID,
		Status:   "synced",
	}
	if err := s.repo.RecordSyncStatus(ctx, sync); err != nil {
		return nil, err
	}
	return sync, nil
}

func (s *Service) DisableGitOps(ctx context.Context, tenantID, gitOpsConfigID string) (*models.GitOpsConfig, error) {
	if err := s.repo.UpdateGitOpsStatus(ctx, tenantID, gitOpsConfigID, "disabled"); err != nil {
		return nil, err
	}
	return s.repo.GetGitOpsConfig(ctx, tenantID, gitOpsConfigID)
}

func (s *Service) DetectDrift(ctx context.Context, tenantID string) (any, error) {
	// Simulated drift detection — returns no drift for now
	return models.ListResult[models.ConfigDiff]{
		Data:  []models.ConfigDiff{},
		Total: 0,
	}, nil
}

func (s *Service) GetSyncStatus(ctx context.Context, tenantID string) ([]models.GitOpsSyncStatus, error) {
	return s.repo.GetSyncStatus(ctx, tenantID, 20)
}

// ---------- Change Request ----------

func (s *Service) CreateChangeRequest(ctx context.Context, tenantID, userID string, req models.CreateChangeRequestRequest) (*models.ChangeRequest, error) {
	m := &models.ChangeRequest{
		TenantID:    tenantID,
		ConfigID:    req.ConfigID,
		Description: req.Description,
		RequestedBy: userID,
	}
	if err := s.repo.CreateChangeRequest(ctx, m); err != nil {
		return nil, err
	}
	return m, nil
}

func (s *Service) ListChangeRequests(ctx context.Context, tenantID string, status string, page, pageSize int) (*models.ListResult[models.ChangeRequest], error) {
	items, total, err := s.repo.ListChangeRequests(ctx, tenantID, status, pageSize, page*pageSize)
	if err != nil {
		return nil, err
	}
	return &models.ListResult[models.ChangeRequest]{
		Data:     items,
		Total:    total,
		Page:     page,
		PageSize: pageSize,
	}, nil
}

func (s *Service) GetChangeRequest(ctx context.Context, tenantID, id string) (*models.ChangeRequest, error) {
	cr, err := s.repo.GetChangeRequest(ctx, tenantID, id)
	if err != nil {
		return nil, errors.New("change request not found")
	}
	return cr, nil
}

func (s *Service) ApproveChange(ctx context.Context, tenantID, id, approvedBy string) (*models.ChangeRequest, error) {
	if err := s.repo.UpdateChangeRequestStatus(ctx, tenantID, id, "approved", approvedBy, ""); err != nil {
		return nil, err
	}
	return s.repo.GetChangeRequest(ctx, tenantID, id)
}

func (s *Service) RejectChange(ctx context.Context, tenantID, id, approvedBy, reason string) (*models.ChangeRequest, error) {
	if err := s.repo.UpdateChangeRequestStatus(ctx, tenantID, id, "rejected", approvedBy, reason); err != nil {
		return nil, err
	}
	return s.repo.GetChangeRequest(ctx, tenantID, id)
}

// ---------- Audit ----------

func (s *Service) GetAuditTrail(ctx context.Context, tenantID, configID string) ([]models.AuditEntry, error) {
	_, err := s.repo.GetByID(ctx, tenantID, configID)
	if err != nil {
		return nil, errors.New("config not found")
	}
	return s.repo.GetAuditTrail(ctx, configID, 50)
}

// ---------- Template ----------

func (s *Service) CreateTemplate(ctx context.Context, tenantID, userID string, req models.CreateTemplateRequest) (*models.ConfigTemplate, error) {
	t := &models.ConfigTemplate{
		TenantID:    tenantID,
		Name:        req.Name,
		Description: req.Description,
		Schema:      req.Schema,
		CreatedBy:   userID,
	}
	if err := s.repo.CreateTemplate(ctx, t); err != nil {
		return nil, err
	}
	return t, nil
}

func (s *Service) ListTemplates(ctx context.Context, tenantID string) ([]models.ConfigTemplate, error) {
	return s.repo.ListTemplates(ctx, tenantID)
}

func (s *Service) GetTemplate(ctx context.Context, tenantID, id string) (*models.ConfigTemplate, error) {
	t, err := s.repo.GetTemplate(ctx, tenantID, id)
	if err != nil {
		return nil, errors.New("template not found")
	}
	return t, nil
}

func (s *Service) UpdateTemplate(ctx context.Context, tenantID, id string, req models.UpdateTemplateRequest) (*models.ConfigTemplate, error) {
	existing, err := s.repo.GetTemplate(ctx, tenantID, id)
	if err != nil {
		return nil, errors.New("template not found")
	}
	if req.Name != nil {
		existing.Name = *req.Name
	}
	if req.Description != nil {
		existing.Description = *req.Description
	}
	if req.Schema != nil {
		existing.Schema = req.Schema
	}
	if err := s.repo.UpdateTemplate(ctx, tenantID, existing); err != nil {
		return nil, err
	}
	return existing, nil
}

func (s *Service) DeleteTemplate(ctx context.Context, tenantID, id string) error {
	return s.repo.DeleteTemplate(ctx, tenantID, id)
}

func (s *Service) CreateTemplateVersion(ctx context.Context, tenantID, templateID, userID string, version string) (*models.ConfigTemplateVersion, error) {
	tmpl, err := s.repo.GetTemplate(ctx, tenantID, templateID)
	if err != nil {
		return nil, errors.New("template not found")
	}
	v := &models.ConfigTemplateVersion{
		TemplateID: templateID,
		Version:    version,
		Schema:     tmpl.Schema,
		CreatedBy:  userID,
	}
	if err := s.repo.CreateTemplateVersion(ctx, v); err != nil {
		return nil, err
	}
	return v, nil
}

func (s *Service) ListTemplateVersions(ctx context.Context, tenantID, templateID string) ([]models.ConfigTemplateVersion, error) {
	_, err := s.repo.GetTemplate(ctx, tenantID, templateID)
	if err != nil {
		return nil, errors.New("template not found")
	}
	return s.repo.ListTemplateVersions(ctx, templateID)
}

// ---------- Canary ----------

func (s *Service) CreateCanary(ctx context.Context, tenantID, userID string, req models.CreateCanaryRequest) (*models.CanaryDeployment, error) {
	traffic := req.TrafficPercent
	if traffic <= 0 {
		traffic = 10
	}
	m := &models.CanaryDeployment{
		TenantID:       tenantID,
		ConfigID:       req.ConfigID,
		TrafficPercent: traffic,
	}
	if err := s.repo.CreateCanary(ctx, m); err != nil {
		return nil, err
	}
	return m, nil
}

func (s *Service) PromoteCanary(ctx context.Context, tenantID, id string) (*models.CanaryDeployment, error) {
	if err := s.repo.UpdateCanaryStatus(ctx, tenantID, id, "promoted"); err != nil {
		return nil, err
	}
	return s.repo.GetCanary(ctx, tenantID, id)
}

func (s *Service) RollbackCanary(ctx context.Context, tenantID, id string) (*models.CanaryDeployment, error) {
	if err := s.repo.UpdateCanaryStatus(ctx, tenantID, id, "rolled_back"); err != nil {
		return nil, err
	}
	return s.repo.GetCanary(ctx, tenantID, id)
}

// ---------- Snapshot ----------

func (s *Service) CreateSnapshot(ctx context.Context, tenantID, configID, userID string) (*models.ConfigSnapshot, error) {
	cfg, err := s.repo.GetByID(ctx, tenantID, configID)
	if err != nil {
		return nil, errors.New("config not found")
	}
	snapshot := &models.ConfigSnapshot{
		TenantID: tenantID,
		ConfigID: configID,
		Data:     cfg,
		CreatedBy: userID,
	}
	if err := s.repo.CreateSnapshot(ctx, snapshot); err != nil {
		return nil, err
	}
	return snapshot, nil
}

func (s *Service) ListSnapshots(ctx context.Context, tenantID, configID string) ([]models.ConfigSnapshot, error) {
	_, err := s.repo.GetByID(ctx, tenantID, configID)
	if err != nil {
		return nil, errors.New("config not found")
	}
	return s.repo.ListSnapshots(ctx, tenantID, configID)
}

func (s *Service) GetSnapshot(ctx context.Context, tenantID, configID, snapshotID string) (*models.ConfigSnapshot, error) {
	snap, err := s.repo.GetSnapshot(ctx, tenantID, snapshotID)
	if err != nil {
		return nil, errors.New("snapshot not found")
	}
	if snap.ConfigID != configID {
		return nil, errors.New("snapshot does not belong to config")
	}
	return snap, nil
}

func (s *Service) RestoreSnapshot(ctx context.Context, tenantID, configID, snapshotID, userID string) (*models.Config, error) {
	snap, err := s.repo.GetSnapshot(ctx, tenantID, snapshotID)
	if err != nil {
		return nil, errors.New("snapshot not found")
	}
	if snap.ConfigID != configID {
		return nil, errors.New("snapshot does not belong to config")
	}
	c, err := s.repo.GetByID(ctx, tenantID, configID)
	if err != nil {
		return nil, errors.New("config not found")
	}
	// Save current state as a backup snapshot
	backup := &models.ConfigSnapshot{
		TenantID: tenantID,
		ConfigID: configID,
		Data:     c,
		CreatedBy: userID,
	}
	if err := s.repo.CreateSnapshot(ctx, backup); err != nil {
		return nil, err
	}
	// Restore value from original snapshot
	restored, ok := snap.Data.(*models.Config)
	if !ok {
		return nil, errors.New("invalid snapshot data")
	}
	updates := map[string]any{"value": restored.Value}
	if err := s.repo.Update(ctx, tenantID, configID, updates); err != nil {
		return nil, err
	}
	c.Value = restored.Value
	return c, nil
}

func (s *Service) DeleteSnapshot(ctx context.Context, tenantID, snapshotID string) error {
	return s.repo.DeleteSnapshot(ctx, tenantID, snapshotID)
}

// ---------- Diff ----------

func (s *Service) CompareEnvironments(ctx context.Context, tenantID, sourceEnv, targetEnv string) (*models.EnvironmentDiffResult, error) {
	diff := &models.EnvironmentDiffResult{
		SourceEnv:   sourceEnv,
		TargetEnv:   targetEnv,
		Differences: []models.ConfigDiff{},
	}
	// In a real implementation, fetch both environments and compute diff
	return diff, nil
}

func (s *Service) CompareVersions(ctx context.Context, tenantID, configID, versionFrom, versionTo string) (*models.VersionDiffResult, error) {
	_, err := s.repo.GetByID(ctx, tenantID, configID)
	if err != nil {
		return nil, errors.New("config not found")
	}
	result := &models.VersionDiffResult{
		ConfigID:    configID,
		VersionFrom: versionFrom,
		VersionTo:   versionTo,
		Differences: []models.ConfigDiff{},
	}
	return result, nil
}

func (s *Service) GetDependencyGraph(ctx context.Context, tenantID, configID string) ([]models.DependencyNode, error) {
	// Simulated dependency graph
	return []models.DependencyNode{
		{ID: configID, Name: "config", Type: "config", Deps: []string{}},
	}, nil
}

// ---------- Webhook ----------

func (s *Service) CreateWebhook(ctx context.Context, tenantID, userID string, req models.CreateWebhookRequest) (*models.ConfigWebhook, error) {
	enabled := true
	if req.Enabled != nil {
		enabled = *req.Enabled
	}
	m := &models.ConfigWebhook{
		TenantID: tenantID,
		Name:     req.Name,
		URL:      req.URL,
		Secret:   req.Secret,
		Events:   req.Events,
		Enabled:  enabled,
	}
	if err := s.repo.CreateWebhook(ctx, m); err != nil {
		return nil, err
	}
	return m, nil
}

func (s *Service) ListWebhooks(ctx context.Context, tenantID string) ([]models.ConfigWebhook, error) {
	return s.repo.ListWebhooks(ctx, tenantID)
}

func (s *Service) GetWebhook(ctx context.Context, tenantID, id string) (*models.ConfigWebhook, error) {
	w, err := s.repo.GetWebhook(ctx, tenantID, id)
	if err != nil {
		return nil, errors.New("webhook not found")
	}
	return w, nil
}

func (s *Service) UpdateWebhook(ctx context.Context, tenantID, id string, req models.UpdateWebhookRequest) (*models.ConfigWebhook, error) {
	existing, err := s.repo.GetWebhook(ctx, tenantID, id)
	if err != nil {
		return nil, errors.New("webhook not found")
	}
	if req.Name != nil {
		existing.Name = *req.Name
	}
	if req.URL != nil {
		existing.URL = *req.URL
	}
	if req.Secret != nil {
		existing.Secret = *req.Secret
	}
	if req.Events != nil {
		existing.Events = req.Events
	}
	if req.Enabled != nil {
		existing.Enabled = *req.Enabled
	}
	if err := s.repo.UpdateWebhook(ctx, tenantID, existing); err != nil {
		return nil, err
	}
	return existing, nil
}

func (s *Service) DeleteWebhook(ctx context.Context, tenantID, id string) error {
	return s.repo.DeleteWebhook(ctx, tenantID, id)
}

// ---------- Timer helper (unused by service, kept for build) ----------

func (s *Service) getTime() time.Time {
	return time.Now().UTC()
}

