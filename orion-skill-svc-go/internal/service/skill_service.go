package service

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"math"
	"strings"
	"time"

	"orion/skill-svc-go/internal/models"
	"orion/skill-svc-go/internal/repository"

	"github.com/google/uuid"
)

// Sentinel errors returned by the service layer.
var (
	ErrSkillNotFound      = errors.New("skill not found")
	ErrInstanceNotFound   = errors.New("skill instance not found")
	ErrExecutionNotFound  = errors.New("execution not found")
	ErrVersionNotFound    = errors.New("version not found")
	ErrDuplicateName      = errors.New("skill name already exists")
	ErrInvalidInput       = errors.New("invalid input")
	ErrInvalidState       = errors.New("invalid state for this operation")
	ErrInvalidRating      = errors.New("rating must be between 1 and 5")
	ErrVersionLocked      = errors.New("skill version is locked")
	ErrTenantMismatch     = errors.New("skill not available for this tenant")
	ErrRejectionReasonReq = errors.New("rejection reason is required")
)

// Service implements all business logic for the skill domain.
type Service struct {
	repo *repository.Repository
}

// NewService creates a new Service.
func NewService(repo *repository.Repository) *Service {
	return &Service{repo: repo}
}

// =====================================================================
// Skill Package CRUD
// =====================================================================

// CreateSkill validates input, checks for duplicate name, creates package + initial version.
func (s *Service) CreateSkill(ctx context.Context, req *models.CreateSkillRequest) (*models.SkillPackage, error) {
	if strings.TrimSpace(req.Name) == "" {
		return nil, fmt.Errorf("%w: skill name is required", ErrInvalidInput)
	}
	if strings.TrimSpace(req.Author) == "" {
		return nil, fmt.Errorf("%w: author is required", ErrInvalidInput)
	}

	// Duplicate name check
	if existing, _ := s.repo.FindSkillByName(ctx, req.Name); existing != nil {
		return nil, ErrDuplicateName
	}

	now := time.Now()
	skill := &models.SkillPackage{
		ID:           uuid.New().String(),
		Name:         strings.TrimSpace(req.Name),
		Version:      req.Version,
		Description:  req.Description,
		Category:     orDefault(req.Category, "general"),
		Tags:         req.Tags,
		Author:       strings.TrimSpace(req.Author),
		Status:       "draft",
		Schema:       orDefaultJSONB(req.Schema),
		Capabilities: req.Capabilities,
		Schemas:      req.Schemas,
		InstallCount: 0,
		Rating:       0,
		RatingCount:  0,
		CreatedAt:    now,
		UpdatedAt:    now,
	}
	if skill.Tags == nil {
		skill.Tags = models.StringArray{}
	}

	if err := s.repo.CreateSkill(ctx, skill); err != nil {
		return nil, fmt.Errorf("create skill: %w", err)
	}

	// Create initial version record
	v := &models.SkillVersion{
		ID:      uuid.New().String(),
		SkillID: skill.ID,
		Version: skill.Version,
		Schema:  orDefaultJSONB(req.Schema),
	}
	if err := s.repo.CreateVersion(ctx, v); err != nil {
		return nil, fmt.Errorf("create initial version: %w", err)
	}

	return skill, nil
}

// GetSkill returns a skill by ID or ErrSkillNotFound.
func (s *Service) GetSkill(ctx context.Context, id string) (*models.SkillPackage, error) {
	skill, err := s.repo.FindSkillByID(ctx, id)
	if err != nil {
		return nil, ErrSkillNotFound
	}
	return skill, nil
}

// ListSkills returns a paginated, filtered list of skill packages.
func (s *Service) ListSkills(ctx context.Context, opts ListSkillsOptions) (*models.PaginatedResponse, error) {
	if opts.Page <= 0 {
		opts.Page = 1
	}
	if opts.Limit <= 0 || opts.Limit > 100 {
		opts.Limit = 20
	}
	offset := (opts.Page - 1) * opts.Limit

	skills, err := s.repo.ListSkills(ctx, repository.ListSkillsOpts{
		Status:   opts.Status,
		Category: opts.Category,
		Tags:     opts.Tags,
		Limit:    opts.Limit,
		Offset:   offset,
	})
	if err != nil {
		return nil, fmt.Errorf("list skills: %w", err)
	}

	total, err := s.repo.CountSkills(ctx, opts.Status, opts.Category)
	if err != nil {
		return nil, fmt.Errorf("count skills: %w", err)
	}

	return &models.PaginatedResponse{
		Data:       skills,
		Total:      total,
		Page:       opts.Page,
		PageSize:   opts.Limit,
		TotalPages: int(math.Ceil(float64(total) / float64(opts.Limit))),
	}, nil
}

// UpdateSkill applies a partial update to a skill package.
func (s *Service) UpdateSkill(ctx context.Context, id string, req *models.UpdateSkillRequest) (*models.SkillPackage, error) {
	if _, err := s.repo.FindSkillByID(ctx, id); err != nil {
		return nil, ErrSkillNotFound
	}
	skill, err := s.repo.UpdateSkill(ctx, id, req)
	if err != nil {
		return nil, fmt.Errorf("update skill: %w", err)
	}
	return skill, nil
}

// PublishSkill transitions a skill from draft/review to published.
func (s *Service) PublishSkill(ctx context.Context, id string) (*models.SkillPackage, error) {
	existing, err := s.repo.FindSkillByID(ctx, id)
	if err != nil {
		return nil, ErrSkillNotFound
	}
	if existing.Status != "draft" && existing.Status != "review" {
		return nil, ErrInvalidState
	}
	status := "published"
	return s.repo.UpdateSkill(ctx, id, &models.UpdateSkillRequest{Status: &status})
}

// UninstallSkill soft-deletes a skill (sets status='uninstalled').
func (s *Service) UninstallSkill(ctx context.Context, id string) error {
	if _, err := s.repo.FindSkillByID(ctx, id); err != nil {
		return ErrSkillNotFound
	}
	return s.repo.DeleteSkill(ctx, id)
}

// InstallSkill increments install_count for a published skill.
func (s *Service) InstallSkill(ctx context.Context, id string) error {
	skill, err := s.repo.FindSkillByID(ctx, id)
	if err != nil {
		return ErrSkillNotFound
	}
	if skill.Status != "published" {
		return ErrInvalidState
	}
	return s.repo.IncrementInstallCount(ctx, id)
}

// SearchSkills returns published skills matching a query string.
func (s *Service) SearchSkills(ctx context.Context, query string, limit int) ([]models.SkillPackage, error) {
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	return s.repo.SearchSkills(ctx, query, limit)
}

// GetCategories returns published skill category counts.
func (s *Service) GetCategories(ctx context.Context) ([]models.CategoryCount, error) {
	return s.repo.GetCategories(ctx)
}

// GetMarketplace returns published skills (convenience wrapper around ListSkills).
func (s *Service) GetMarketplace(ctx context.Context, opts ListSkillsOptions) (*models.PaginatedResponse, error) {
	opts.Status = "published"
	return s.ListSkills(ctx, opts)
}

// GetFeaturedSkills returns top published skills by install count.
func (s *Service) GetFeaturedSkills(ctx context.Context, limit int) ([]models.SkillPackage, error) {
	if limit <= 0 || limit > 100 {
		limit = 10
	}
	return s.repo.ListSkills(ctx, repository.ListSkillsOpts{
		Status: "published",
		Limit:  limit,
	})
}

// =====================================================================
// Version Management
// =====================================================================

// GetVersions returns all versions for a skill.
func (s *Service) GetVersions(ctx context.Context, skillID string) ([]models.SkillVersion, error) {
	if _, err := s.repo.FindSkillByID(ctx, skillID); err != nil {
		return nil, ErrSkillNotFound
	}
	return s.repo.FindVersionsBySkill(ctx, skillID)
}

// GetLatestVersion returns the latest version for a skill.
func (s *Service) GetLatestVersion(ctx context.Context, skillID string) (*models.SkillVersion, error) {
	return s.repo.FindLatestVersion(ctx, skillID)
}

// CreateVersion creates a new version for a skill.
func (s *Service) CreateVersion(ctx context.Context, skillID string, req *models.CreateVersionRequest) (*models.SkillVersion, error) {
	skill, err := s.repo.FindSkillByID(ctx, skillID)
	if err != nil {
		return nil, ErrSkillNotFound
	}
	if skill.IsVersionLocked {
		return nil, ErrVersionLocked
	}

	v := &models.SkillVersion{
		ID:             uuid.New().String(),
		SkillID:        skillID,
		Version:        req.Version,
		Schema:         orDefaultJSONB(req.Schema),
		SchemaSnapshot: req.SchemaSnapshot,
		IsLocked:       req.IsLocked,
	}
	if req.Changelog != "" {
		v.Changelog.String = req.Changelog
		v.Changelog.Valid = true
	}
	if v.Schema == nil {
		v.Schema = skill.Schema
	}

	if err := s.repo.CreateVersion(ctx, v); err != nil {
		return nil, fmt.Errorf("create version: %w", err)
	}
	return v, nil
}

// LockVersion locks a version to prevent modifications.
func (s *Service) LockVersion(ctx context.Context, versionID string) (*models.SkillVersion, error) {
	v, err := s.repo.LockVersion(ctx, versionID)
	if err != nil {
		return nil, ErrVersionNotFound
	}
	return v, nil
}

// UnlockVersion unlocks a version.
func (s *Service) UnlockVersion(ctx context.Context, versionID string) (*models.SkillVersion, error) {
	v, err := s.repo.UnlockVersion(ctx, versionID)
	if err != nil {
		return nil, ErrVersionNotFound
	}
	return v, nil
}

// RecordVersion is a convenience method to snapshot the current skill state as a new version.
func (s *Service) RecordVersion(ctx context.Context, skillID, version, changelog string) (*models.SkillVersion, error) {
	skill, err := s.repo.FindSkillByID(ctx, skillID)
	if err != nil {
		return nil, ErrSkillNotFound
	}
	v := &models.SkillVersion{
		ID:      uuid.New().String(),
		SkillID: skillID,
		Version: version,
		Schema:  skill.Schema,
	}
	if changelog != "" {
		v.Changelog.String = changelog
		v.Changelog.Valid = true
	}
	if err := s.repo.CreateVersion(ctx, v); err != nil {
		return nil, fmt.Errorf("record version: %w", err)
	}
	return v, nil
}

// =====================================================================
// Reviews
// =====================================================================

// GetReviews returns all reviews for a skill.
func (s *Service) GetReviews(ctx context.Context, skillID string) ([]models.SkillReview, error) {
	if _, err := s.repo.FindSkillByID(ctx, skillID); err != nil {
		return nil, ErrSkillNotFound
	}
	return s.repo.FindReviewsBySkill(ctx, skillID)
}

// AddReview upserts a review and recalculates the skill's aggregate rating.
func (s *Service) AddReview(ctx context.Context, skillID string, req *models.CreateReviewRequest) (*models.SkillReview, error) {
	if _, err := s.repo.FindSkillByID(ctx, skillID); err != nil {
		return nil, ErrSkillNotFound
	}
	if req.Rating < 1 || req.Rating > 5 {
		return nil, ErrInvalidRating
	}

	review := &models.SkillReview{
		ID:      uuid.New().String(),
		SkillID: skillID,
		UserID:  req.UserID,
		Rating:  req.Rating,
	}
	if req.Comment != "" {
		review.Comment.String = req.Comment
		review.Comment.Valid = true
	}

	if err := s.repo.UpsertReview(ctx, review); err != nil {
		return nil, fmt.Errorf("upsert review: %w", err)
	}
	// Recalculate aggregate rating
	if err := s.repo.UpdateSkillRating(ctx, skillID); err != nil {
		return nil, fmt.Errorf("update rating: %w", err)
	}
	return review, nil
}

// =====================================================================
// Instance Management
// =====================================================================

// CreateInstance creates a new tenant-scoped skill instance.
func (s *Service) CreateInstance(ctx context.Context, req *models.CreateInstanceRequest) (*models.SkillInstance, error) {
	if strings.TrimSpace(req.Name) == "" {
		return nil, fmt.Errorf("%w: instance name is required", ErrInvalidInput)
	}

	skill, err := s.repo.FindSkillByID(ctx, req.SkillID)
	if err != nil {
		return nil, ErrSkillNotFound
	}
	_ = skill // skill existence verified

	// If setting as default, unset existing defaults for this skill+tenant
	if req.IsDefault {
		if err := s.clearDefaultInstances(ctx, req.SkillID, req.TenantID, ""); err != nil {
			return nil, err
		}
	}

	now := time.Now()
	inst := &models.SkillInstance{
		ID:        uuid.New().String(),
		SkillID:   req.SkillID,
		TenantID:  req.TenantID,
		Name:      strings.TrimSpace(req.Name),
		Status:    orDefault(req.Status, "inactive"),
		Config:    orDefaultJSONB(req.Config),
		Bindings:  orDefaultJSONB(req.Bindings),
		Metadata:  orDefaultJSONB(req.Metadata),
		IsDefault: req.IsDefault,
		Version:   orDefault(req.Version, "1.0.0"),
		CreatedAt: now,
		UpdatedAt: now,
	}
	if req.ProjectID != "" {
		inst.ProjectID.String = req.ProjectID
		inst.ProjectID.Valid = true
	}
	if req.Description != "" {
		inst.Description.String = req.Description
		inst.Description.Valid = true
	}
	if req.CreatedBy != "" {
		inst.CreatedBy.String = req.CreatedBy
		inst.CreatedBy.Valid = true
	}

	if err := s.repo.CreateInstance(ctx, inst); err != nil {
		return nil, fmt.Errorf("create instance: %w", err)
	}
	return inst, nil
}

// GetInstance returns an instance by ID, scoped to a tenant.
func (s *Service) GetInstance(ctx context.Context, id, tenantID string) (*models.SkillInstance, error) {
	inst, err := s.repo.FindInstanceByIDAndTenant(ctx, id, tenantID)
	if err != nil {
		return nil, ErrInstanceNotFound
	}
	return inst, nil
}

// ListInstances returns all instances for a skill within a tenant.
func (s *Service) ListInstances(ctx context.Context, skillID, tenantID string) ([]models.SkillInstance, error) {
	if _, err := s.repo.FindSkillByID(ctx, skillID); err != nil {
		return nil, ErrSkillNotFound
	}
	return s.repo.FindInstancesBySkill(ctx, skillID, tenantID)
}

// ListInstancesByTenant returns paginated instances for a tenant.
func (s *Service) ListInstancesByTenant(ctx context.Context, tenantID string, limit, offset int) ([]models.SkillInstance, int, error) {
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	return s.repo.FindInstancesByTenant(ctx, tenantID, limit, offset)
}

// UpdateInstance applies a partial update to a skill instance.
func (s *Service) UpdateInstance(ctx context.Context, id, tenantID string, req *models.UpdateInstanceRequest) (*models.SkillInstance, error) {
	existing, err := s.getInstanceChecked(ctx, id, tenantID)
	if err != nil {
		return nil, err
	}

	// If setting as default, unset other defaults
	if req.IsDefault != nil && *req.IsDefault {
		if err := s.clearDefaultInstances(ctx, existing.SkillID, existing.TenantID, id); err != nil {
			return nil, err
		}
	}

	updated, err := s.repo.UpdateInstance(ctx, tenantID, id, req)
	if err != nil {
		return nil, fmt.Errorf("update instance: %w", err)
	}
	return updated, nil
}

// DeleteInstance removes a skill instance.
func (s *Service) DeleteInstance(ctx context.Context, id, tenantID string) error {
	if _, err := s.getInstanceChecked(ctx, id, tenantID); err != nil {
		return err
	}
	return s.repo.DeleteInstance(ctx, tenantID, id)
}

// =====================================================================
// Execution
// =====================================================================

// ExecuteSkill creates an execution record, logs audit, and marks completed (sync mode).
func (s *Service) ExecuteSkill(ctx context.Context, skillID string, req *models.CreateExecutionRequest) (*models.SkillExecution, error) {
	skill, err := s.repo.FindSkillByID(ctx, skillID)
	if err != nil {
		return nil, ErrSkillNotFound
	}

	// Verify instance belongs to tenant if provided
	if req.InstanceID != "" {
		if _, err := s.repo.FindInstanceByIDAndTenant(ctx, req.InstanceID, req.TenantID); err != nil {
			return nil, ErrInstanceNotFound
		}
	}

	exec := &models.SkillExecution{
		ID:          uuid.New().String(),
		TenantID:    req.TenantID,
		SkillID:     skillID,
		Status:      "pending",
		Input:       orDefaultJSONB(req.Input),
		TriggerMode: orDefault(req.TriggerMode, "manual"),
		Metadata:    orDefaultJSONB(req.Metadata),
		StartedAt:   time.Now(),
	}
	if req.InstanceID != "" {
		exec.InstanceID.String = req.InstanceID
		exec.InstanceID.Valid = true
	}
	if req.Capability != "" {
		exec.Capability.String = req.Capability
		exec.Capability.Valid = true
	}
	if req.TriggeredBy != "" {
		exec.TriggeredBy.String = req.TriggeredBy
		exec.TriggeredBy.Valid = true
	}

	if err := s.repo.CreateExecution(ctx, exec); err != nil {
		return nil, fmt.Errorf("create execution: %w", err)
	}

	// Audit log
	audit := &models.SkillAuditLog{
		ID:        uuid.New().String(),
		SkillID:   skillID,
		Action:    "executed",
		OldStatus: toSQLNullString(skill.Status),
		NewStatus: toSQLNullString(skill.Status),
	}
	if req.TriggeredBy != "" {
		audit.ActorID.String = req.TriggeredBy
		audit.ActorID.Valid = true
	}
	reason := fmt.Sprintf("Direct execution via capability: %s", req.Capability)
	audit.Reason.String = reason
	audit.Reason.Valid = true
	_ = s.repo.CreateAuditLog(ctx, audit) // best-effort

	// Mark as completed (sync mode — real execution delegated to Pipeline TaskRunner)
	status := "completed"
	completedExec, err := s.repo.UpdateExecution(ctx, exec.TenantID, exec.ID, &models.UpdateExecutionRequest{
		Status: &status,
	})
	if err != nil {
		return exec, nil // return pending if update fails
	}
	return completedExec, nil
}

// GetExecutions returns paginated executions for a skill within a tenant.
func (s *Service) GetExecutions(ctx context.Context, skillID, tenantID string, page, limit int) ([]models.SkillExecution, int, int, error) {
	if page <= 0 {
		page = 1
	}
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	offset := (page - 1) * limit
	execs, total, err := s.repo.FindExecutionsBySkill(ctx, skillID, tenantID, limit, offset)
	if err != nil {
		return nil, 0, 0, fmt.Errorf("list executions: %w", err)
	}
	totalPages := int(math.Ceil(float64(total) / float64(limit)))
	return execs, total, totalPages, nil
}

// GetAllExecutions returns paginated executions for a tenant (admin view).
func (s *Service) GetAllExecutions(ctx context.Context, tenantID string, page, limit int, skillID string) ([]models.SkillExecution, int, int, error) {
	if page <= 0 {
		page = 1
	}
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	offset := (page - 1) * limit
	execs, total, err := s.repo.FindExecutionsByTenant(ctx, tenantID, limit, offset, skillID)
	if err != nil {
		return nil, 0, 0, fmt.Errorf("list all executions: %w", err)
	}
	totalPages := int(math.Ceil(float64(total) / float64(limit)))
	return execs, total, totalPages, nil
}

// UpdateExecution updates an execution record.
func (s *Service) UpdateExecution(ctx context.Context, tenantID, id string, req *models.UpdateExecutionRequest) (*models.SkillExecution, error) {
	if _, err := s.repo.FindExecutionByID(ctx, tenantID, id); err != nil {
		return nil, ErrExecutionNotFound
	}
	updated, err := s.repo.UpdateExecution(ctx, tenantID, id, req)
	if err != nil {
		return nil, fmt.Errorf("update execution: %w", err)
	}
	return updated, nil
}

// =====================================================================
// Review Workflow
// =====================================================================

// SubmitForReview transitions a skill from draft to review.
func (s *Service) SubmitForReview(ctx context.Context, id, userID string) (*models.SkillPackage, error) {
	existing, err := s.repo.FindSkillByID(ctx, id)
	if err != nil {
		return nil, ErrSkillNotFound
	}
	if existing.Status != "draft" {
		return nil, ErrInvalidState
	}

	reviewStatus := "review"
	updated, err := s.repo.UpdateSkill(ctx, id, &models.UpdateSkillRequest{Status: &reviewStatus})
	if err != nil {
		return nil, fmt.Errorf("submit for review: %w", err)
	}

	_ = s.createAudit(ctx, id, userID, "submitted", "draft", "review", "Submitted for review")
	return updated, nil
}

// ApproveSkill transitions a skill to published.
func (s *Service) ApproveSkill(ctx context.Context, id, userID, reason string) (*models.SkillPackage, error) {
	existing, err := s.repo.FindSkillByID(ctx, id)
	if err != nil {
		return nil, ErrSkillNotFound
	}
	if existing.Status != "review" && existing.Status != "rejected" {
		return nil, ErrInvalidState
	}

	pubStatus := "published"
	updated, err := s.repo.UpdateSkill(ctx, id, &models.UpdateSkillRequest{Status: &pubStatus})
	if err != nil {
		return nil, fmt.Errorf("approve skill: %w", err)
	}

	r := orDefault(reason, "Approved")
	_ = s.createAudit(ctx, id, userID, "approved", existing.Status, "published", r)
	return updated, nil
}

// RejectSkill transitions a skill from review back to draft.
func (s *Service) RejectSkill(ctx context.Context, id, userID, reason string) (*models.SkillPackage, error) {
	if strings.TrimSpace(reason) == "" {
		return nil, ErrRejectionReasonReq
	}
	existing, err := s.repo.FindSkillByID(ctx, id)
	if err != nil {
		return nil, ErrSkillNotFound
	}
	if existing.Status != "review" {
		return nil, ErrInvalidState
	}

	draftStatus := "draft"
	updated, err := s.repo.UpdateSkill(ctx, id, &models.UpdateSkillRequest{Status: &draftStatus})
	if err != nil {
		return nil, fmt.Errorf("reject skill: %w", err)
	}

	_ = s.createAudit(ctx, id, userID, "rejected", "review", "draft", strings.TrimSpace(reason))
	return updated, nil
}

// ArchiveSkill moves a skill to uninstalled status.
func (s *Service) ArchiveSkill(ctx context.Context, id, userID, reason string) (*models.SkillPackage, error) {
	existing, err := s.repo.FindSkillByID(ctx, id)
	if err != nil {
		return nil, ErrSkillNotFound
	}
	if existing.Status == "uninstalled" {
		return nil, ErrInvalidState
	}

	uninstStatus := "uninstalled"
	updated, err := s.repo.UpdateSkill(ctx, id, &models.UpdateSkillRequest{Status: &uninstStatus})
	if err != nil {
		return nil, fmt.Errorf("archive skill: %w", err)
	}

	r := orDefault(reason, "Archived")
	_ = s.createAudit(ctx, id, userID, "archived", existing.Status, "uninstalled", r)
	return updated, nil
}

// GetPendingReview returns skills pending review.
func (s *Service) GetPendingReview(ctx context.Context, page, limit int, category string) ([]models.SkillPackage, int, int, error) {
	if page <= 0 {
		page = 1
	}
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	offset := (page - 1) * limit
	skills, total, err := s.repo.FindPendingReview(ctx, limit, offset, category)
	if err != nil {
		return nil, 0, 0, fmt.Errorf("pending review: %w", err)
	}
	totalPages := int(math.Ceil(float64(total) / float64(limit)))
	return skills, total, totalPages, nil
}

// =====================================================================
// Audit Logs
// =====================================================================

// GetAuditLog returns paginated audit logs for a skill.
func (s *Service) GetAuditLog(ctx context.Context, skillID string, page, limit int) ([]models.SkillAuditLog, int, int, error) {
	if _, err := s.repo.FindSkillByID(ctx, skillID); err != nil {
		return nil, 0, 0, ErrSkillNotFound
	}
	if page <= 0 {
		page = 1
	}
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	offset := (page - 1) * limit
	logs, total, err := s.repo.FindAuditLogsBySkill(ctx, skillID, limit, offset)
	if err != nil {
		return nil, 0, 0, fmt.Errorf("audit log: %w", err)
	}
	totalPages := int(math.Ceil(float64(total) / float64(limit)))
	return logs, total, totalPages, nil
}

// GetAllAuditLogs returns paginated audit logs across all skills (admin).
func (s *Service) GetAllAuditLogs(ctx context.Context, page, limit int, action string) ([]models.SkillAuditLog, int, int, error) {
	if page <= 0 {
		page = 1
	}
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	offset := (page - 1) * limit
	logs, total, err := s.repo.FindAllAuditLogs(ctx, limit, offset, action)
	if err != nil {
		return nil, 0, 0, fmt.Errorf("all audit logs: %w", err)
	}
	totalPages := int(math.Ceil(float64(total) / float64(limit)))
	return logs, total, totalPages, nil
}

// =====================================================================
// Internal helpers
// =====================================================================

// ListSkillsOptions carries optional filters for ListSkills.
type ListSkillsOptions struct {
	Page     int
	Limit    int
	Status   string
	Category string
	Tags     []string
}

func (s *Service) getInstanceChecked(ctx context.Context, id, tenantID string) (*models.SkillInstance, error) {
	inst, err := s.repo.FindInstanceByIDAndTenant(ctx, id, tenantID)
	if err != nil {
		return nil, ErrInstanceNotFound
	}
	return inst, nil
}

func (s *Service) clearDefaultInstances(ctx context.Context, skillID, tenantID, excludeID string) error {
	instances, err := s.repo.FindInstancesBySkill(ctx, skillID, tenantID)
	if err != nil {
		return fmt.Errorf("list instances: %w", err)
	}
	for _, inst := range instances {
		if inst.ID != excludeID && inst.IsDefault {
			isDefault := false
			if _, err := s.repo.UpdateInstance(ctx, inst.TenantID, inst.ID, &models.UpdateInstanceRequest{IsDefault: &isDefault}); err != nil {
				return fmt.Errorf("clear default: %w", err)
			}
		}
	}
	return nil
}

func (s *Service) createAudit(ctx context.Context, skillID, actorID, action, oldStatus, newStatus, reason string) error {
	audit := &models.SkillAuditLog{
		ID:      uuid.New().String(),
		SkillID: skillID,
		Action:  action,
	}
	if actorID != "" {
		audit.ActorID.String = actorID
		audit.ActorID.Valid = true
	}
	if oldStatus != "" {
		audit.OldStatus.String = oldStatus
		audit.OldStatus.Valid = true
	}
	if newStatus != "" {
		audit.NewStatus.String = newStatus
		audit.NewStatus.Valid = true
	}
	if reason != "" {
		audit.Reason.String = reason
		audit.Reason.Valid = true
	}
	return s.repo.CreateAuditLog(ctx, audit)
}

func orDefault(v, def string) string {
	if v == "" {
		return def
	}
	return v
}

func orDefaultJSONB(j models.JSONB) models.JSONB {
	if j == nil {
		return models.JSONB{}
	}
	return j
}

func toSQLNullString(s string) sql.NullString {
	if s == "" {
		return sql.NullString{}
	}
	return sql.NullString{String: s, Valid: true}
}
