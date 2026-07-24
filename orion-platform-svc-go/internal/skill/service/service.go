package service

//go:generate mockgen -destination=mock_service.go -package=service . ServiceInterface

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"orion/go-common/pkg/sentinel"
	"orion/platform-svc-go/internal/skill/models"
	"orion/platform-svc-go/internal/skill/repository"

	_ "github.com/lib/pq"
)

// Service provides business logic for the skill module.
// It delegates all data persistence to RepositoryInterface.
type Service struct {
	repo repository.RepositoryInterface
}

// NewService creates a new Service backed by the given repository.
func NewService(repo repository.RepositoryInterface) *Service {
	return &Service{repo: repo}
}

// ==================== Skill CRUD ====================

func (s *Service) ListSkills(ctx context.Context, tenantID string, category, status string, page, limit int) ([]models.Skill, int64) {
	skills, err := s.repo.ListSkills(ctx, tenantID, category, status)
	if err != nil {
		return nil, 0
	}
	return skills, int64(len(skills))
}

func (s *Service) GetSkill(ctx context.Context, tenantID, id string) (*models.Skill, error) {
	skill, err := s.repo.GetSkill(ctx, tenantID, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) || errors.Is(err, sentinel.NotFound) {
			return nil, ErrSkillNotFound
		}
		return nil, err
	}
	return skill, nil
}

func (s *Service) CreateSkill(ctx context.Context, tenantID string, req models.CreateSkillRequest) (*models.Skill, error) {
	skill := &models.Skill{
		Name:        req.Name,
		Description: req.Description,
		Category:    req.Category,
	}
	err := s.repo.CreateSkill(ctx, tenantID, skill)
	if err != nil {
		return nil, err
	}
	return skill, nil
}

func (s *Service) UpdateSkill(ctx context.Context, tenantID, id string, req models.UpdateSkillRequest) (*models.Skill, error) {
	updates := make(map[string]interface{})
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.Description != nil {
		updates["description"] = *req.Description
	}
	if req.Category != nil {
		updates["category"] = *req.Category
	}

	err := s.repo.UpdateSkill(ctx, tenantID, id, updates)
	if err != nil {
		if errors.Is(err, sentinel.NotFound) {
			return nil, ErrSkillNotFound
		}
		return nil, err
	}

	skill, err := s.repo.GetSkill(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	return skill, nil
}

func (s *Service) DeleteSkill(ctx context.Context, tenantID, id string) error {
	err := s.repo.DeleteSkill(ctx, tenantID, id)
	if err != nil {
		if errors.Is(err, sentinel.NotFound) {
			return ErrSkillNotFound
		}
		return err
	}
	return nil
}

// ==================== Version management ====================

func (s *Service) ListVersions(ctx context.Context, tenantID, skillID string) ([]models.SkillVersion, error) {
	_, err := s.GetSkill(ctx, tenantID, skillID)
	if err != nil {
		return nil, err
	}
	versions, err := s.repo.ListVersions(ctx, skillID)
	return versions, err
}

func (s *Service) AddVersion(ctx context.Context, tenantID, skillID string, req models.AddVersionRequest) (*models.SkillVersion, error) {
	_, err := s.GetSkill(ctx, tenantID, skillID)
	if err != nil {
		return nil, err
	}

	// Check duplicate version
	exists, err := s.repo.VersionExists(ctx, skillID, req.Version)
	if err != nil {
		return nil, err
	}
	if exists {
		return nil, ErrDuplicateVersion
	}

	version := &models.SkillVersion{
		SkillID: skillID,
		Version: req.Version,
		Changes: req.Changes,
	}
	err = s.repo.CreateVersion(ctx, version)
	if err != nil {
		return nil, err
	}
	return version, nil
}

// ==================== Rating ====================

func (s *Service) RateSkill(ctx context.Context, tenantID, skillID, userID string, req models.RateSkillRequest) (*models.Skill, error) {
	_, err := s.GetSkill(ctx, tenantID, skillID)
	if err != nil {
		return nil, err
	}
	if req.Rating < 1 || req.Rating > 5 {
		return nil, errors.New("rating must be between 1 and 5")
	}

	err = s.repo.RateSkill(ctx, skillID, req.Rating)
	if err != nil {
		return nil, err
	}

	// Reload the updated skill
	skill, err := s.repo.GetSkill(ctx, tenantID, skillID)
	return skill, err
}

func (s *Service) GetRatingStats(ctx context.Context, tenantID, skillID string) (*map[string]any, error) {
	_, err := s.GetSkill(ctx, tenantID, skillID)
	if err != nil {
		return nil, err
	}
	stats, err := s.repo.GetRatingStats(ctx, skillID)
	return stats, err
}

// ==================== Skill instances ====================

func (s *Service) ListInstances(ctx context.Context, tenantID string) ([]models.SkillInstance, error) {
	return s.repo.ListInstances(ctx, tenantID)
}

func (s *Service) GetInstance(ctx context.Context, tenantID, id string) (*models.SkillInstance, error) {
	inst, err := s.repo.GetInstance(ctx, tenantID, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) || errors.Is(err, sentinel.NotFound) {
			return nil, ErrInstanceNotFound
		}
		return nil, err
	}
	return inst, nil
}

func (s *Service) CreateInstance(ctx context.Context, tenantID, skillID string, req models.CreateInstanceRequest) (*models.SkillInstance, error) {
	_, err := s.GetSkill(ctx, tenantID, skillID)
	if err != nil {
		return nil, err
	}

	inst := &models.SkillInstance{
		SkillID:      skillID,
		TenantID:     tenantID,
		InstanceName: req.InstanceName,
		Config:       req.Config,
	}
	err = s.repo.CreateInstance(ctx, inst)
	if err != nil {
		return nil, err
	}

	// Increment install count
	_ = s.repo.UpdateInstallCount(ctx, skillID, 1)

	return inst, nil
}

func (s *Service) UpdateInstance(ctx context.Context, tenantID, id string, req models.UpdateInstanceRequest) (*models.SkillInstance, error) {
	updates := make(map[string]interface{})
	if req.InstanceName != nil {
		updates["instance_name"] = *req.InstanceName
	}
	if req.Config != nil {
		updates["config"] = *req.Config
	}
	if req.Status != nil {
		updates["status"] = *req.Status
	}
	if len(updates) == 0 {
		return s.GetInstance(ctx, tenantID, id)
	}

	err := s.repo.UpdateInstance(ctx, tenantID, id, updates)
	if err != nil {
		if errors.Is(err, sentinel.NotFound) {
			return nil, ErrInstanceNotFound
		}
		return nil, err
	}

	return s.GetInstance(ctx, tenantID, id)
}

func (s *Service) DeleteInstance(ctx context.Context, tenantID, id string) error {
	inst, err := s.GetInstance(ctx, tenantID, id)
	if err != nil {
		return err
	}

	err = s.repo.DeleteInstance(ctx, tenantID, id)
	if err != nil {
		return err
	}

	// Decrement install count
	_ = s.repo.UpdateInstallCount(ctx, inst.SkillID, -1)

	return nil
}

// ==================== Execution ====================

func (s *Service) ExecuteSkill(ctx context.Context, tenantID, skillID, userID string, req models.ExecuteSkillRequest) (*models.SkillExecution, error) {
	_, err := s.GetSkill(ctx, tenantID, skillID)
	if err != nil {
		return nil, err
	}

	execution := &models.SkillExecution{
		SkillID:    skillID,
		TenantID:   tenantID,
		UserID:     userID,
		Status:     "completed",
		DurationMs: 120,
	}
	err = s.repo.CreateExecution(ctx, execution)
	return execution, err
}

func (s *Service) ListExecutions(ctx context.Context, tenantID, skillID string, page, limit int) ([]models.SkillExecution, error) {
	executions, err := s.repo.ListExecutions(ctx, tenantID, skillID)
	return executions, err
}

// ==================== Review workflow ====================

func (s *Service) GetReview(ctx context.Context, tenantID, skillID string) (*models.SkillReview, error) {
	_, err := s.GetSkill(ctx, tenantID, skillID)
	if err != nil {
		return nil, err
	}
	review, err := s.repo.GetReview(ctx, skillID)
	return review, err
}

func (s *Service) ReviewAction(ctx context.Context, tenantID, skillID, userID, action string, req models.ReviewActionRequest) (*models.SkillReview, error) {
	skill, err := s.GetSkill(ctx, tenantID, skillID)
	if err != nil {
		return nil, err
	}

	now := time.Now().UTC()

	switch action {
	case "submit":
		review, err := s.repo.GetReview(ctx, skillID)
		if err != nil {
			return nil, err
		}
		if review != nil && review.Status == "submitted" {
			return nil, ErrAlreadySubmitted
		}

		newReview := &models.SkillReview{
			SkillID:     skillID,
			TenantID:    tenantID,
			Status:      "submitted",
			SubmittedBy: userID,
			CreatedAt:   now,
			UpdatedAt:   now,
		}
		err = s.repo.CreateReview(ctx, newReview)
		if err != nil {
			return nil, err
		}

		// Update skill status
		_ = s.repo.UpdateSkill(ctx, tenantID, skillID, map[string]interface{}{
			"status":     "submitted",
			"updated_at": now,
		})

		s.appendAuditLog(ctx, skill, "review_submit", userID, "")
		return newReview, nil

	case "approve":
		review, err := s.repo.GetReview(ctx, skillID)
		if err != nil {
			return nil, err
		}
		if review == nil || review.Status != "submitted" {
			return nil, ErrNotSubmitted
		}

		err = s.repo.UpdateReview(ctx, tenantID, skillID, map[string]interface{}{
			"status":       "approved",
			"reviewed_by":  userID,
			"review_note":  req.Note,
			"updated_at":   now,
		})
		if err != nil {
			return nil, err
		}

		// Update skill status
		_ = s.repo.UpdateSkill(ctx, tenantID, skillID, map[string]interface{}{
			"status":     "approved",
			"updated_at": now,
		})

		review.Status = "approved"
		review.ReviewedBy = userID
		review.ReviewNote = req.Note
		review.UpdatedAt = now

		s.appendAuditLog(ctx, skill, "review_approve", userID, req.Note)
		return review, nil

	case "reject":
		review, err := s.repo.GetReview(ctx, skillID)
		if err != nil {
			return nil, err
		}
		if review == nil || review.Status != "submitted" {
			return nil, ErrNotSubmitted
		}

		err = s.repo.UpdateReview(ctx, tenantID, skillID, map[string]interface{}{
			"status":       "rejected",
			"reviewed_by":  userID,
			"review_note":  req.Note,
			"updated_at":   now,
		})
		if err != nil {
			return nil, err
		}

		// Update skill status back to draft
		_ = s.repo.UpdateSkill(ctx, tenantID, skillID, map[string]interface{}{
			"status":     "draft",
			"updated_at": now,
		})

		review.Status = "rejected"
		review.ReviewedBy = userID
		review.ReviewNote = req.Note
		review.UpdatedAt = now

		s.appendAuditLog(ctx, skill, "review_reject", userID, req.Note)
		return review, nil

	case "archive":
		review, err := s.repo.GetReview(ctx, skillID)
		if err != nil {
			return nil, err
		}

		// Update skill status
		_ = s.repo.UpdateSkill(ctx, tenantID, skillID, map[string]interface{}{
			"status":     "archived",
			"updated_at": now,
		})

		// Update review status if exists
		if review != nil {
			_ = s.repo.UpdateReview(ctx, tenantID, skillID, map[string]interface{}{
				"status":     "archived",
				"updated_at": now,
			})
			review.Status = "archived"
			review.UpdatedAt = now
		} else {
			review = &models.SkillReview{
				SkillID:   skillID,
				TenantID:  tenantID,
				Status:    "archived",
				ReviewedBy: userID,
				CreatedAt: now,
				UpdatedAt: now,
			}
		}

		s.appendAuditLog(ctx, skill, "review_archive", userID, "")
		return review, nil

	default:
		return nil, errors.New("invalid review action: " + action)
	}
}

func (s *Service) ListReviews(ctx context.Context, tenantID string, status string) ([]models.SkillReview, error) {
	return s.repo.ListReviews(ctx, tenantID, status)
}

// ==================== Audit log ====================

func (s *Service) ListAuditLogs(ctx context.Context, tenantID, skillID string, page, limit int) ([]models.SkillAuditLog, int64) {
	logs, err := s.repo.ListAuditLogs(ctx, tenantID, skillID)
	if err != nil {
		return nil, 0
	}
	return logs, int64(len(logs))
}

// ==================== Stats ====================

func (s *Service) GetStats(ctx context.Context, tenantID string) (*map[string]any, error) {
	return s.repo.GetStats(ctx, tenantID)
}

// ==================== Helpers ====================

// appendAuditLog appends an audit log entry via the repository.
func (s *Service) appendAuditLog(ctx context.Context, skill *models.Skill, action, userID, details string) {
	log := &models.SkillAuditLog{
		SkillID:   skill.ID,
		TenantID:  skill.TenantID,
		Action:    action,
		UserID:    userID,
		CreatedAt: time.Now().UTC(),
		Details:   fmt.Sprintf("%s", details),
	}
	_ = s.repo.CreateAuditLog(ctx, log)
}

// Errors

var (
	ErrSkillNotFound    = errors.New("skill not found")
	ErrInstanceNotFound = errors.New("skill instance not found")
	ErrDuplicateVersion = errors.New("version already exists")
	ErrAlreadySubmitted = errors.New("skill already submitted for review")
	ErrNotSubmitted     = errors.New("skill not submitted for review")
)
