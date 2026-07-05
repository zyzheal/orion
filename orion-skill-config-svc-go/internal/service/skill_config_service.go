package service

import (
	"context"
	"errors"
	"fmt"
	"math"

	"orion/skill-config-svc-go/internal/models"
	"orion/skill-config-svc-go/internal/repository"
)

var (
	ErrNotFound       = errors.New("not found")
	ErrDuplicateName  = errors.New("skill name already exists")
	ErrInvalidInput   = errors.New("invalid input")
	ErrInvalidState   = errors.New("invalid state transition")
	ErrVersionLocked  = errors.New("skill version is locked")
	ErrTenantMismatch = errors.New("skill not available for this tenant")
)

// Service provides business logic for the skill-config domain.
type Service struct {
	repo *repository.Repository
}

func NewService(repo *repository.Repository) *Service {
	return &Service{repo: repo}
}

// ==================== Skill CRUD ====================

// GetSkill returns a skill package by ID.
func (s *Service) GetSkill(ctx context.Context, id string) (*models.SkillPackage, error) {
	return s.repo.FindByID(ctx, id)
}

// ListSkills returns paginated skill packages with optional filters.
func (s *Service) ListSkills(ctx context.Context, status, category string, tags []string, page, limit int) (*models.PaginatedResponse, error) {
	if page <= 0 {
		page = 1
	}
	if limit <= 0 {
		limit = 20
	}
	offset := (page - 1) * limit

	items, err := s.repo.FindAll(ctx, status, category, tags, limit, offset)
	if err != nil {
		return nil, err
	}

	total, err := s.repo.Count(ctx, status, category)
	if err != nil {
		return nil, err
	}

	return &models.PaginatedResponse{
		Data:       items,
		Total:      total,
		Page:       page,
		Limit:      limit,
		TotalPages: int(math.Ceil(float64(total) / float64(limit))),
	}, nil
}

// CreateSkill creates a new skill package and its initial version.
func (s *Service) CreateSkill(ctx context.Context, req *models.CreateSkillRequest) (*models.SkillPackage, error) {
	if req.Name == "" || req.Description == "" || req.Author == "" {
		return nil, fmt.Errorf("%w: name, description, and author are required", ErrInvalidInput)
	}

	// Check for duplicate name
	existing, _ := s.repo.FindByName(ctx, req.Name)
	if existing != nil {
		return nil, ErrDuplicateName
	}

	sp := &models.SkillPackage{
		Name:        req.Name,
		Version:     req.Version,
		Description: req.Description,
		Category:    req.Category,
		Tags:        req.Tags,
		Author:      req.Author,
		Schema:      req.Schema,
	}

	if sp.Version == "" {
		sp.Version = "1.0.0"
	}
	if sp.Category == "" {
		sp.Category = "general"
	}
	if sp.Tags == nil {
		sp.Tags = []string{}
	}
	if sp.Schema == nil {
		sp.Schema = models.JSONB{}
	}

	if err := s.repo.Create(ctx, sp); err != nil {
		return nil, err
	}

	// Create initial version
	sv := &models.SkillVersion{
		SkillID: sp.ID,
		Version: sp.Version,
		Schema:  sp.Schema,
	}
	if err := s.repo.CreateVersion(ctx, sv); err != nil {
		return nil, err
	}

	return sp, nil
}

// UpdateSkill modifies a skill package.
func (s *Service) UpdateSkill(ctx context.Context, id string, req *models.UpdateSkillRequest) (*models.SkillPackage, error) {
	_, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return nil, ErrNotFound
	}
	return s.repo.Update(ctx, id, req)
}

// PublishSkill transitions a skill to published status.
func (s *Service) PublishSkill(ctx context.Context, id string) (*models.SkillPackage, error) {
	sp, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return nil, ErrNotFound
	}
	if sp.Status != "draft" && sp.Status != "review" {
		return nil, fmt.Errorf("%w: can only publish draft or review skills", ErrInvalidState)
	}
	status := "published"
	return s.repo.Update(ctx, id, &models.UpdateSkillRequest{Status: &status})
}

// UninstallSkill soft-deletes a skill.
func (s *Service) UninstallSkill(ctx context.Context, id string) error {
	_, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return ErrNotFound
	}
	return s.repo.Delete(ctx, id)
}

// InstallSkill increments the install count for a published skill.
func (s *Service) InstallSkill(ctx context.Context, id string) error {
	sp, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return ErrNotFound
	}
	if sp.Status != "published" {
		return fmt.Errorf("%w: can only install published skills", ErrInvalidState)
	}
	return s.repo.IncrementInstallCount(ctx, id)
}

// ==================== Versions ====================

// GetVersions returns all versions for a skill.
func (s *Service) GetVersions(ctx context.Context, skillID string) ([]models.SkillVersion, error) {
	_, err := s.repo.FindByID(ctx, skillID)
	if err != nil {
		return nil, ErrNotFound
	}
	return s.repo.FindVersions(ctx, skillID)
}

// GetLatestVersion returns the latest version for a skill.
func (s *Service) GetLatestVersion(ctx context.Context, skillID string) (*models.SkillVersion, error) {
	return s.repo.FindLatestVersion(ctx, skillID)
}

// CreateVersion creates a new version for a skill.
func (s *Service) CreateVersion(ctx context.Context, skillID string, req *models.CreateVersionRequest) (*models.SkillVersion, error) {
	sp, err := s.repo.FindByID(ctx, skillID)
	if err != nil {
		return nil, ErrNotFound
	}
	if sp.IsVersionLocked {
		return nil, ErrVersionLocked
	}

	sv := &models.SkillVersion{
		SkillID:   skillID,
		Version:   req.Version,
		Changelog: &req.Changelog,
		Schema:    req.Schema,
		IsLocked:  req.IsLocked,
	}
	if sv.Schema == nil {
		sv.Schema = sp.Schema
	}

	if err := s.repo.CreateVersion(ctx, sv); err != nil {
		return nil, err
	}
	return sv, nil
}

// LockVersion locks a skill version.
func (s *Service) LockVersion(ctx context.Context, versionID string) (*models.SkillVersion, error) {
	sv, err := s.repo.LockVersion(ctx, versionID)
	if err != nil {
		return nil, ErrNotFound
	}
	return sv, nil
}

// UnlockVersion unlocks a skill version.
func (s *Service) UnlockVersion(ctx context.Context, versionID string) (*models.SkillVersion, error) {
	sv, err := s.repo.UnlockVersion(ctx, versionID)
	if err != nil {
		return nil, ErrNotFound
	}
	return sv, nil
}

// RecordVersion creates a version snapshot for a skill.
func (s *Service) RecordVersion(ctx context.Context, skillID, version, changelog string) (*models.SkillVersion, error) {
	sp, err := s.repo.FindByID(ctx, skillID)
	if err != nil {
		return nil, ErrNotFound
	}

	sv := &models.SkillVersion{
		SkillID:   skillID,
		Version:   version,
		Changelog: &changelog,
		Schema:    sp.Schema,
	}
	if err := s.repo.CreateVersion(ctx, sv); err != nil {
		return nil, err
	}
	return sv, nil
}

// ==================== Reviews ====================

// GetReviews returns all reviews for a skill.
func (s *Service) GetReviews(ctx context.Context, skillID string) ([]models.SkillReview, error) {
	_, err := s.repo.FindByID(ctx, skillID)
	if err != nil {
		return nil, ErrNotFound
	}
	return s.repo.FindReviews(ctx, skillID)
}

// AddReview adds or updates a review for a skill.
func (s *Service) AddReview(ctx context.Context, skillID string, req *models.CreateReviewRequest) (*models.SkillReview, error) {
	_, err := s.repo.FindByID(ctx, skillID)
	if err != nil {
		return nil, ErrNotFound
	}
	if req.Rating < 1 || req.Rating > 5 {
		return nil, fmt.Errorf("%w: rating must be between 1 and 5", ErrInvalidInput)
	}

	rev := &models.SkillReview{
		SkillID: skillID,
		UserID:  req.UserID,
		Rating:  req.Rating,
		Comment: req.Comment,
	}
	if err := s.repo.CreateReview(ctx, rev); err != nil {
		return nil, err
	}
	return rev, nil
}

// ==================== Instance Management ====================

// CreateInstance creates a new skill instance for a tenant.
func (s *Service) CreateInstance(ctx context.Context, tenantID string, req *models.CreateInstanceRequest) (*models.SkillInstance, error) {
	if req.Name == "" {
		return nil, fmt.Errorf("%w: instance name is required", ErrInvalidInput)
	}

	sp, err := s.repo.FindByID(ctx, req.SkillID)
	if err != nil {
		return nil, ErrNotFound
	}

	// Tenant check: if skill has a tenant association and it doesn't match, reject
	if sp.Status != "published" && sp.Status != "draft" {
		return nil, fmt.Errorf("%w: skill is not available", ErrInvalidState)
	}

	// If setting as default, unset existing defaults
	if req.IsDefault {
		instances, _ := s.repo.FindInstancesBySkillID(ctx, req.SkillID, tenantID)
		for _, inst := range instances {
			if inst.IsDefault {
				isDefault := false
				s.repo.UpdateInstance(ctx, inst.ID, &models.UpdateInstanceRequest{IsDefault: &isDefault})
			}
		}
	}

	var projectID *string
	if req.ProjectID != "" {
		projectID = &req.ProjectID
	}

	inst := &models.SkillInstance{
		SkillID:   req.SkillID,
		TenantID:  tenantID,
		ProjectID: projectID,
		Name:      req.Name,
		Config:    req.Config,
		IsDefault: req.IsDefault,
		Version:   sp.Version,
	}
	if inst.Config == nil {
		inst.Config = models.JSONB{}
	}

	if err := s.repo.CreateInstance(ctx, inst); err != nil {
		return nil, err
	}
	return inst, nil
}

// GetInstance returns an instance by ID, optionally scoped to a tenant.
func (s *Service) GetInstance(ctx context.Context, id, tenantID string) (*models.SkillInstance, error) {
	if tenantID != "" {
		return s.repo.FindInstanceByIDAndTenant(ctx, id, tenantID)
	}
	return s.repo.FindInstanceByID(ctx, id)
}

// ListInstances returns all instances for a skill within a tenant.
func (s *Service) ListInstances(ctx context.Context, skillID, tenantID string) ([]models.SkillInstance, error) {
	_, err := s.repo.FindByID(ctx, skillID)
	if err != nil {
		return nil, ErrNotFound
	}
	return s.repo.FindInstancesBySkillID(ctx, skillID, tenantID)
}

// ListInstancesByTenant returns paginated instances for a tenant.
func (s *Service) ListInstancesByTenant(ctx context.Context, tenantID string, limit, offset int) ([]models.SkillInstance, int, error) {
	return s.repo.FindInstancesByTenant(ctx, tenantID, limit, offset)
}

// UpdateInstance modifies a skill instance.
func (s *Service) UpdateInstance(ctx context.Context, id, tenantID string, req *models.UpdateInstanceRequest) (*models.SkillInstance, error) {
	existing, err := s.GetInstance(ctx, id, tenantID)
	if err != nil {
		return nil, ErrNotFound
	}

	// If setting as default, unset other defaults
	if req.IsDefault != nil && *req.IsDefault {
		instances, _ := s.repo.FindInstancesBySkillID(ctx, existing.SkillID, existing.TenantID)
		for _, inst := range instances {
			if inst.ID != id && inst.IsDefault {
				isDefault := false
				s.repo.UpdateInstance(ctx, inst.ID, &models.UpdateInstanceRequest{IsDefault: &isDefault})
			}
		}
	}

	return s.repo.UpdateInstance(ctx, id, req)
}

// DeleteInstance removes a skill instance.
func (s *Service) DeleteInstance(ctx context.Context, id, tenantID string) error {
	_, err := s.GetInstance(ctx, id, tenantID)
	if err != nil {
		return ErrNotFound
	}
	return s.repo.DeleteInstance(ctx, id)
}

// ==================== Execution ====================

// ExecuteSkill creates an execution record and marks it completed.
func (s *Service) ExecuteSkill(ctx context.Context, skillID, tenantID string, req *models.CreateExecutionRequest) (*models.SkillExecution, error) {
	_, err := s.repo.FindByID(ctx, skillID)
	if err != nil {
		return nil, ErrNotFound
	}

	// Verify instance belongs to tenant if provided
	if req.InstanceID != nil {
		_, err := s.repo.FindInstanceByIDAndTenant(ctx, *req.InstanceID, tenantID)
		if err != nil {
			return nil, ErrNotFound
		}
	}

	triggerMode := "manual"
	if req.TriggerMode != nil {
		triggerMode = *req.TriggerMode
	}

	exec := &models.SkillExecution{
		TenantID:    tenantID,
		SkillID:     skillID,
		InstanceID:  req.InstanceID,
		Capability:  req.Capability,
		Input:       req.Input,
		TriggeredBy: req.TriggeredBy,
		TriggerMode: triggerMode,
		Metadata:    req.Metadata,
	}
	if exec.Input == nil {
		exec.Input = models.JSONB{}
	}
	if exec.Metadata == nil {
		exec.Metadata = models.JSONB{}
	}

	if err := s.repo.CreateExecution(ctx, exec); err != nil {
		return nil, err
	}

	// Record audit log
	actorID := ""
	if req.TriggeredBy != nil {
		actorID = *req.TriggeredBy
	}
	s.repo.CreateAuditLog(ctx, &models.SkillAuditLog{
		SkillID: skillID,
		Action:  "executed",
		ActorID: &actorID,
	})

	// Mark as completed
	status := "completed"
	completed := exec.StartedAt
	updated, err := s.repo.UpdateExecution(ctx, exec.ID, &models.UpdateExecutionRequest{
		Status:      &status,
		CompletedAt: &completed,
	})
	if err != nil {
		return exec, nil
	}
	return updated, nil
}

// GetExecutions returns paginated executions for a skill within a tenant.
func (s *Service) GetExecutions(ctx context.Context, skillID, tenantID string, page, limit int) ([]models.SkillExecution, int, int, error) {
	if page <= 0 {
		page = 1
	}
	if limit <= 0 {
		limit = 20
	}
	offset := (page - 1) * limit
	items, total, err := s.repo.FindExecutionsBySkill(ctx, skillID, tenantID, limit, offset)
	totalPages := int(math.Ceil(float64(total) / float64(limit)))
	return items, total, totalPages, err
}

// GetAllExecutions returns paginated executions for a tenant.
func (s *Service) GetAllExecutions(ctx context.Context, tenantID string, page, limit int, skillID *string) ([]models.SkillExecution, int, int, error) {
	if page <= 0 {
		page = 1
	}
	if limit <= 0 {
		limit = 20
	}
	offset := (page - 1) * limit
	items, total, err := s.repo.FindExecutionsByTenant(ctx, tenantID, limit, offset, skillID)
	totalPages := int(math.Ceil(float64(total) / float64(limit)))
	return items, total, totalPages, err
}

// UpdateExecution modifies an execution record.
func (s *Service) UpdateExecution(ctx context.Context, id string, req *models.UpdateExecutionRequest) (*models.SkillExecution, error) {
	_, err := s.repo.FindExecutionByID(ctx, id)
	if err != nil {
		return nil, ErrNotFound
	}
	return s.repo.UpdateExecution(ctx, id, req)
}

// ==================== Review Workflow ====================

// SubmitForReview transitions a draft skill to review status.
func (s *Service) SubmitForReview(ctx context.Context, id, userID string) (*models.SkillPackage, error) {
	sp, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return nil, ErrNotFound
	}
	if sp.Status != "draft" {
		return nil, fmt.Errorf("%w: only draft skills can be submitted for review", ErrInvalidState)
	}

	status := "review"
	updated, err := s.repo.Update(ctx, id, &models.UpdateSkillRequest{Status: &status})
	if err != nil {
		return nil, err
	}

	s.repo.CreateAuditLog(ctx, &models.SkillAuditLog{
		SkillID:   id,
		Action:    "submitted",
		ActorID:   &userID,
		OldStatus: strPtr("draft"),
		NewStatus: strPtr("review"),
		Reason:    strPtr("Submitted for review"),
	})

	return updated, nil
}

// ApproveSkill transitions a skill to published status.
func (s *Service) ApproveSkill(ctx context.Context, id, userID, reason string) (*models.SkillPackage, error) {
	sp, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return nil, ErrNotFound
	}
	if sp.Status != "review" && sp.Status != "rejected" {
		return nil, fmt.Errorf("%w: only skills under review or rejected can be approved", ErrInvalidState)
	}

	status := "published"
	updated, err := s.repo.Update(ctx, id, &models.UpdateSkillRequest{Status: &status})
	if err != nil {
		return nil, err
	}

	s.repo.CreateAuditLog(ctx, &models.SkillAuditLog{
		SkillID:   id,
		Action:    "approved",
		ActorID:   &userID,
		OldStatus: &sp.Status,
		NewStatus: strPtr("published"),
		Reason:    &reason,
	})

	return updated, nil
}

// RejectSkill transitions a skill back to draft with a rejection reason.
func (s *Service) RejectSkill(ctx context.Context, id, userID, reason string) (*models.SkillPackage, error) {
	if reason == "" {
		return nil, fmt.Errorf("%w: rejection reason is required", ErrInvalidInput)
	}

	sp, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return nil, ErrNotFound
	}
	if sp.Status != "review" {
		return nil, fmt.Errorf("%w: only skills under review can be rejected", ErrInvalidState)
	}

	status := "draft"
	updated, err := s.repo.Update(ctx, id, &models.UpdateSkillRequest{Status: &status})
	if err != nil {
		return nil, err
	}

	s.repo.CreateAuditLog(ctx, &models.SkillAuditLog{
		SkillID:   id,
		Action:    "rejected",
		ActorID:   &userID,
		OldStatus: strPtr("review"),
		NewStatus: strPtr("draft"),
		Reason:    &reason,
	})

	return updated, nil
}

// ArchiveSkill transitions a skill to uninstalled status.
func (s *Service) ArchiveSkill(ctx context.Context, id, userID, reason string) (*models.SkillPackage, error) {
	sp, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return nil, ErrNotFound
	}
	if sp.Status == "uninstalled" {
		return nil, fmt.Errorf("%w: skill is already archived", ErrInvalidState)
	}

	status := "uninstalled"
	updated, err := s.repo.Update(ctx, id, &models.UpdateSkillRequest{Status: &status})
	if err != nil {
		return nil, err
	}

	if reason == "" {
		reason = "Archived"
	}
	s.repo.CreateAuditLog(ctx, &models.SkillAuditLog{
		SkillID:   id,
		Action:    "archived",
		ActorID:   &userID,
		OldStatus: &sp.Status,
		NewStatus: strPtr("uninstalled"),
		Reason:    &reason,
	})

	return updated, nil
}

// GetPendingReview returns skills pending review.
func (s *Service) GetPendingReview(ctx context.Context, category string, page, limit int) ([]models.SkillPackage, int, int, error) {
	if page <= 0 {
		page = 1
	}
	if limit <= 0 {
		limit = 20
	}
	offset := (page - 1) * limit

	items, total, err := s.repo.FindPendingReview(ctx, category, limit, offset)
	totalPages := int(math.Ceil(float64(total) / float64(limit)))
	return items, total, totalPages, err
}

// ==================== Search & Marketplace ====================

// SearchSkills searches published skills by query string.
func (s *Service) SearchSkills(ctx context.Context, query string, limit int) ([]models.SkillPackage, error) {
	if limit <= 0 {
		limit = 20
	}
	return s.repo.Search(ctx, query, limit)
}

// GetCategories returns published skill categories with counts.
func (s *Service) GetCategories(ctx context.Context) ([]models.CategoryCount, error) {
	return s.repo.GetCategories(ctx)
}

// GetMarketplace returns published skills with pagination.
func (s *Service) GetMarketplace(ctx context.Context, category string, tags []string, page, limit int) (*models.PaginatedResponse, error) {
	return s.ListSkills(ctx, "published", category, tags, page, limit)
}

// GetFeaturedSkills returns top published skills.
func (s *Service) GetFeaturedSkills(ctx context.Context, limit int) ([]models.SkillPackage, error) {
	if limit <= 0 {
		limit = 10
	}
	return s.repo.FindAll(ctx, "published", "", nil, limit, 0)
}

// ==================== Audit Logs ====================

// GetAuditLog returns paginated audit logs for a skill.
func (s *Service) GetAuditLog(ctx context.Context, skillID string, page, limit int) ([]models.SkillAuditLog, int, int, error) {
	if page <= 0 {
		page = 1
	}
	if limit <= 0 {
		limit = 50
	}
	offset := (page - 1) * limit

	items, total, err := s.repo.FindAuditLogs(ctx, skillID, limit, offset)
	totalPages := int(math.Ceil(float64(total) / float64(limit)))
	return items, total, totalPages, err
}

// GetAllAuditLogs returns paginated audit logs across all skills.
func (s *Service) GetAllAuditLogs(ctx context.Context, page, limit int, action *string) ([]models.SkillAuditLog, int, int, error) {
	if page <= 0 {
		page = 1
	}
	if limit <= 0 {
		limit = 50
	}
	offset := (page - 1) * limit

	items, total, err := s.repo.FindAllAuditLogs(ctx, limit, offset, action)
	totalPages := int(math.Ceil(float64(total) / float64(limit)))
	return items, total, totalPages, err
}

// ==================== Backward Compatibility ====================

// Create creates a skill config (backward compatibility).
func (s *Service) Create(ctx context.Context, tenantID string, req *models.CreateSkillConfigRequest) (*models.SkillConfig, error) {
	// Delegate to CreateSkill
	sp, err := s.CreateSkill(ctx, &models.CreateSkillRequest{
		Name:        req.Name,
		Version:     "1.0.0",
		Description: req.ConfigValue,
		Author:      tenantID,
	})
	if err != nil {
		return nil, err
	}
	return &models.SkillConfig{
		ID:       sp.ID,
		TenantID: tenantID,
		Name:     sp.Name,
		SkillID:  req.SkillID,
	}, nil
}

// List returns skill configs (backward compatibility).
func (s *Service) List(ctx context.Context, tenantID string, offset, limit int) ([]models.SkillConfig, error) {
	items, _, err := s.repo.FindInstancesByTenant(ctx, tenantID, limit, offset)
	if err != nil {
		return nil, err
	}
	var configs []models.SkillConfig
	for _, item := range items {
		configs = append(configs, models.SkillConfig{
			ID:       item.ID,
			TenantID: item.TenantID,
			Name:     item.Name,
			SkillID:  item.SkillID,
		})
	}
	return configs, nil
}

// GetByID returns a skill config (backward compatibility).
func (s *Service) GetByID(ctx context.Context, tenantID, id string) (*models.SkillConfig, error) {
	sp, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return nil, ErrNotFound
	}
	return &models.SkillConfig{
		ID:       sp.ID,
		TenantID: tenantID,
		Name:     sp.Name,
	}, nil
}

// Delete deletes a skill (backward compatibility).
func (s *Service) Delete(ctx context.Context, tenantID, id string) error {
	return s.UninstallSkill(ctx, id)
}

// Count returns skill count (backward compatibility).
func (s *Service) Count(ctx context.Context, tenantID string) (int, error) {
	return s.repo.Count(ctx, "", "")
}

func strPtr(s string) *string {
	return &s
}
