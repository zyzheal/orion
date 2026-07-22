package service

//go:generate mockgen -destination=mock_service.go -package=service . ServiceInterface

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/google/uuid"

	"orion/platform-svc-go/internal/skill/models"
)

type Service struct {
	mu sync.RWMutex

	skills        map[string]*models.Skill
	versions      map[string][]*models.SkillVersion
	ratings       map[string][]int
	instances     map[string]*models.SkillInstance
	executions    map[string]*models.SkillExecution
	reviews       map[string]*models.SkillReview
	auditLogs     []*models.SkillAuditLog
	auditLogIDSeq int
}

func NewService() *Service {
	return &Service{
		skills:     make(map[string]*models.Skill),
		versions:   make(map[string][]*models.SkillVersion),
		ratings:    make(map[string][]int),
		instances:  make(map[string]*models.SkillInstance),
		executions: make(map[string]*models.SkillExecution),
		reviews:    make(map[string]*models.SkillReview),
	}
}

// ==================== Skill CRUD ====================

func (s *Service) ListSkills(ctx context.Context, tenantID string, category, status string, page, limit int) ([]models.Skill, int64) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var result []models.Skill
	for _, skill := range s.skills {
		if tenantID != "" && skill.TenantID != tenantID {
			continue
		}
		if category != "" && skill.Category != category {
			_ = skill.Category
			continue
		}
		if status != "" && skill.Status != status {
			continue
		}
		result = append(result, *skill)
	}
	return result, int64(len(result))
}

func (s *Service) GetSkill(ctx context.Context, tenantID, id string) (*models.Skill, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	skill, ok := s.skills[id]
	if !ok {
		return nil, ErrSkillNotFound
	}
	if tenantID != "" && skill.TenantID != tenantID {
		return nil, ErrSkillNotFound
	}
	return skill, nil
}

func (s *Service) CreateSkill(ctx context.Context, tenantID string, req models.CreateSkillRequest) (*models.Skill, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	id := uuid.New().String()
	now := time.Now().UTC()
	skill := &models.Skill{
		ID:           id,
		TenantID:     tenantID,
		Name:         req.Name,
		Description:  req.Description,
		Category:     req.Category,
		Status:       "draft",
		InstallCount: 0,
		AvgRating:    0,
		RatingCount:  0,
		CreatedAt:    now,
		UpdatedAt:    now,
	}
	s.skills[id] = skill
	s.appendAuditLog(skill, "create", tenantID, "")
	return skill, nil
}

func (s *Service) UpdateSkill(ctx context.Context, tenantID, id string, req models.UpdateSkillRequest) (*models.Skill, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	skill, ok := s.skills[id]
	if !ok {
		return nil, ErrSkillNotFound
	}
	if tenantID != "" && skill.TenantID != tenantID {
		return nil, ErrSkillNotFound
	}
	if req.Name != nil {
		skill.Name = *req.Name
	}
	if req.Description != nil {
		skill.Description = *req.Description
	}
	if req.Category != nil {
		skill.Category = *req.Category
	}
	skill.UpdatedAt = time.Now().UTC()
	s.appendAuditLog(skill, "update", tenantID, "")
	return skill, nil
}

func (s *Service) DeleteSkill(ctx context.Context, tenantID, id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	skill, ok := s.skills[id]
	if !ok {
		return ErrSkillNotFound
	}
	if tenantID != "" && skill.TenantID != tenantID {
		return ErrSkillNotFound
	}
	skill.Status = "archived"
	skill.UpdatedAt = time.Now().UTC()
	s.appendAuditLog(skill, "delete", tenantID, "")
	return nil
}

// ==================== Version management ====================

func (s *Service) ListVersions(ctx context.Context, tenantID, skillID string) ([]models.SkillVersion, error) {
	_, err := s.GetSkill(ctx, tenantID, skillID)
	if err != nil {
		return nil, err
	}
	s.mu.RLock()
	defer s.mu.RUnlock()

	ptrVersions := s.versions[skillID]
	versions := make([]models.SkillVersion, len(ptrVersions))
	for i, v := range ptrVersions {
		versions[i] = *v
	}
	return versions, nil
}

func (s *Service) AddVersion(ctx context.Context, tenantID, skillID string, req models.AddVersionRequest) (*models.SkillVersion, error) {
	skill, err := s.GetSkill(ctx, tenantID, skillID)
	if err != nil {
		return nil, err
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	// Check duplicate version
	for _, v := range s.versions[skillID] {
		if v.Version == req.Version {
			return nil, ErrDuplicateVersion
		}
	}

	id := uuid.New().String()
	now := time.Now().UTC()
	version := &models.SkillVersion{
		ID:        id,
		SkillID:   skillID,
		Version:   req.Version,
		Changes:   req.Changes,
		CreatedAt: now,
	}
	s.versions[skillID] = append(s.versions[skillID], version)
	s.appendAuditLog(skill, "version", tenantID, req.Version)
	return version, nil
}

// ==================== Rating ====================

func (s *Service) RateSkill(ctx context.Context, tenantID, skillID, userID string, req models.RateSkillRequest) (*models.Skill, error) {
	skill, err := s.GetSkill(ctx, tenantID, skillID)
	if err != nil {
		return nil, err
	}
	if req.Rating < 1 || req.Rating > 5 {
		return nil, errors.New("rating must be between 1 and 5")
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	s.ratings[skillID] = append(s.ratings[skillID], req.Rating)
	ratingList := s.ratings[skillID]
	total := 0
	for _, r := range ratingList {
		total += r
	}
	skill.AvgRating = float64(total) / float64(len(ratingList))
	skill.RatingCount = len(ratingList)
	skill.UpdatedAt = time.Now().UTC()
	s.appendAuditLog(skill, "rate", tenantID, fmt.Sprintf("%d by %s", req.Rating, userID))
	return skill, nil
}

func (s *Service) GetRatingStats(ctx context.Context, tenantID, skillID string) (*map[string]any, error) {
	skill, err := s.GetSkill(ctx, tenantID, skillID)
	if err != nil {
		return nil, err
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	// skill is already loaded via GetSkill
	ratingList := s.ratings[skillID]
	stats := make(map[string]int)
	for _, r := range ratingList {
		stats[fmt.Sprintf("%d", r)]++
	}
	result := make(map[string]any)
	result["avg_rating"] = skill.AvgRating
	result["rating_count"] = skill.RatingCount
	result["distribution"] = stats
	return &result, nil
}

// ==================== Skill instances ====================

func (s *Service) ListInstances(ctx context.Context, tenantID string) ([]models.SkillInstance, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var result []models.SkillInstance
	for _, inst := range s.instances {
		if inst.TenantID == tenantID {
			result = append(result, *inst)
		}
	}
	return result, nil
}

func (s *Service) GetInstance(ctx context.Context, tenantID, id string) (*models.SkillInstance, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	inst, ok := s.instances[id]
	if !ok {
		return nil, ErrInstanceNotFound
	}
	if inst.TenantID != tenantID {
		return nil, ErrInstanceNotFound
	}
	return inst, nil
}

func (s *Service) CreateInstance(ctx context.Context, tenantID, skillID string, req models.CreateInstanceRequest) (*models.SkillInstance, error) {
	_, err := s.GetSkill(ctx, tenantID, skillID)
	if err != nil {
		return nil, err
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	id := uuid.New().String()
	now := time.Now().UTC()
	inst := &models.SkillInstance{
		ID:           id,
		SkillID:      skillID,
		TenantID:     tenantID,
		InstanceName: req.InstanceName,
		Config:       req.Config,
		Status:       "active",
		CreatedAt:    now,
		UpdatedAt:    now,
	}
	s.instances[id] = inst

	// Increment install count
	if skill, ok := s.skills[skillID]; ok {
		skill.InstallCount++
		skill.UpdatedAt = now
	}
	s.appendAuditLog(&models.Skill{ID: skillID, TenantID: tenantID}, "install", tenantID, id)
	return inst, nil
}

func (s *Service) UpdateInstance(ctx context.Context, tenantID, id string, req models.UpdateInstanceRequest) (*models.SkillInstance, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	inst, ok := s.instances[id]
	if !ok {
		return nil, ErrInstanceNotFound
	}
	if inst.TenantID != tenantID {
		return nil, ErrInstanceNotFound
	}
	if req.InstanceName != nil {
		inst.InstanceName = *req.InstanceName
	}
	if req.Config != nil {
		inst.Config = *req.Config
	}
	if req.Status != nil {
		inst.Status = *req.Status
	}
	inst.UpdatedAt = time.Now().UTC()
	s.appendAuditLog(&models.Skill{ID: inst.SkillID, TenantID: tenantID}, "update_instance", tenantID, id)
	return inst, nil
}

func (s *Service) DeleteInstance(ctx context.Context, tenantID, id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	inst, ok := s.instances[id]
	if !ok {
		return ErrInstanceNotFound
	}
	if inst.TenantID != tenantID {
		return ErrInstanceNotFound
	}
	delete(s.instances, id)

	// Decrement install count
	if skill, ok := s.skills[inst.SkillID]; ok {
		if skill.InstallCount > 0 {
			skill.InstallCount--
		}
	}
	s.appendAuditLog(&models.Skill{ID: inst.SkillID, TenantID: tenantID}, "uninstall", tenantID, id)
	return nil
}

// ==================== Execution ====================

func (s *Service) ExecuteSkill(ctx context.Context, tenantID, skillID, userID string, req models.ExecuteSkillRequest) (*models.SkillExecution, error) {
	_, err := s.GetSkill(ctx, tenantID, skillID)
	if err != nil {
		return nil, err
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	id := uuid.New().String()
	now := time.Now().UTC()
	execution := &models.SkillExecution{
		ID:         id,
		SkillID:    skillID,
		TenantID:   tenantID,
		UserID:     userID,
		Status:     "completed",
		DurationMs: 120,
		CreatedAt:  now,
	}
	s.executions[id] = execution
	s.appendAuditLog(&models.Skill{ID: skillID, TenantID: tenantID}, "execute", tenantID, userID)
	return execution, nil
}

func (s *Service) ListExecutions(ctx context.Context, tenantID, skillID string, page, limit int) ([]models.SkillExecution, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var result []models.SkillExecution
	for _, exec := range s.executions {
		if exec.TenantID == tenantID && (skillID == "" || exec.SkillID == skillID) {
			result = append(result, *exec)
		}
	}
	_ = page
	_ = limit
	return result, nil
}

// ==================== Review workflow ====================

func (s *Service) GetReview(ctx context.Context, tenantID, skillID string) (*models.SkillReview, error) {
	_, err := s.GetSkill(ctx, tenantID, skillID)
	if err != nil {
		return nil, err
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	review := s.reviews[skillID]
	if review == nil {
		return nil, nil
	}
	return review, nil
}

func (s *Service) ReviewAction(ctx context.Context, tenantID, skillID, userID, action string, req models.ReviewActionRequest) (*models.SkillReview, error) {
	skill, err := s.GetSkill(ctx, tenantID, skillID)
	if err != nil {
		return nil, err
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	now := time.Now().UTC()
	review := s.reviews[skillID]
	switch action {
	case "submit":
		if review != nil && review.Status == "submitted" {
			return nil, ErrAlreadySubmitted
		}
		review = &models.SkillReview{
			ID:          uuid.New().String(),
			SkillID:     skillID,
			TenantID:    tenantID,
			Status:      "submitted",
			SubmittedBy: userID,
			CreatedAt:   now,
			UpdatedAt:   now,
		}
		s.reviews[skillID] = review
		skill.Status = "submitted"
	case "approve":
		if review == nil || review.Status != "submitted" {
			return nil, ErrNotSubmitted
		}
		review.Status = "approved"
		review.ReviewedBy = userID
		review.ReviewNote = req.Note
		review.UpdatedAt = now
		s.reviews[skillID] = review
		skill.Status = "approved"
	case "reject":
		if review == nil || review.Status != "submitted" {
			return nil, ErrNotSubmitted
		}
		review.Status = "rejected"
		review.ReviewedBy = userID
		review.ReviewNote = req.Note
		review.UpdatedAt = now
		s.reviews[skillID] = review
		skill.Status = "draft"
	case "archive":
		skill.Status = "archived"
		if review != nil {
			review.Status = "archived"
			review.UpdatedAt = now
		}
	default:
		return nil, errors.New("invalid review action: " + action)
	}
	skill.UpdatedAt = now
	s.appendAuditLog(skill, "review_"+action, tenantID, req.Note)
	return review, nil
}

func (s *Service) ListReviews(ctx context.Context, tenantID string, status string) ([]models.SkillReview, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var result []models.SkillReview
	for _, review := range s.reviews {
		if review.TenantID == tenantID {
			if status == "" || review.Status == status {
				result = append(result, *review)
			}
		}
	}
	return result, nil
}

// ==================== Audit log ====================

func (s *Service) ListAuditLogs(ctx context.Context, tenantID, skillID string, page, limit int) ([]models.SkillAuditLog, int64) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var result []models.SkillAuditLog
	for _, log := range s.auditLogs {
		if log.TenantID == tenantID && (skillID == "" || log.SkillID == skillID) {
			result = append(result, *log)
		}
	}
	return result, int64(len(result))
}

// ==================== Stats ====================

func (s *Service) GetStats(ctx context.Context, tenantID string) (*map[string]any, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	total := 0
	byStatus := make(map[string]int)
	byCategory := make(map[string]int)
	totalInstalls := 0
	for _, skill := range s.skills {
		if skill.TenantID == tenantID {
			total++
			byStatus[skill.Status]++
			byCategory[skill.Category]++
			totalInstalls += skill.InstallCount
		}
	}

	result := make(map[string]any)
	result["total_skills"] = total
	result["total_installs"] = totalInstalls
	result["by_status"] = byStatus
	result["by_category"] = byCategory
	return &result, nil
}

// ==================== Helpers ====================

func (s *Service) appendAuditLog(skill *models.Skill, action, tenantID, userID string) {
	s.auditLogIDSeq++
	s.auditLogs = append(s.auditLogs, &models.SkillAuditLog{
		ID:        s.auditLogIDSeq,
		SkillID:   skill.ID,
		TenantID:  tenantID,
		Action:    action,
		UserID:    userID,
		CreatedAt: time.Now().UTC(),
	})
}

// Errors

var (
	ErrSkillNotFound    = errors.New("skill not found")
	ErrInstanceNotFound = errors.New("skill instance not found")
	ErrDuplicateVersion = errors.New("version already exists")
	ErrAlreadySubmitted = errors.New("skill already submitted for review")
	ErrNotSubmitted     = errors.New("skill not submitted for review")
)
