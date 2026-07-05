package service

import (
	"context"
	"errors"
	"time"

	"orion/community-svc-go/internal/models"
	"orion/community-svc-go/internal/repository"

	"github.com/google/uuid"
)

var (
	ErrContributionNotFound = errors.New("contribution not found")
	ErrBestPracticeNotFound = errors.New("best practice not found")
	ErrPluginNotFound       = errors.New("plugin not found")
	ErrBadgeNotFound        = errors.New("badge not found")
	ErrProgramNotFound      = errors.New("incentive program not found")
	ErrMentorshipNotFound   = errors.New("mentorship pair not found")
	ErrInvalidAction        = errors.New("invalid action")
)

type Service struct {
	repo *repository.Repository
}

func NewService(repo *repository.Repository) *Service {
	return &Service{repo: repo}
}

// ============================================================
// Contribution Management
// ============================================================

func (s *Service) CreateContribution(ctx context.Context, tenantID string, req *models.CreateContributionRequest) (*models.Contribution, error) {
	now := time.Now().UTC()
	c := &models.Contribution{
		ID:          uuid.New().String(),
		TenantID:    tenantID,
		UserID:      req.UserID,
		Type:        req.Type,
		Title:       req.Title,
		Description: req.Description,
		Repository:  req.Repository,
		URL:         req.URL,
		Tags:        req.Tags,
		Status:      "pending",
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	if err := s.repo.CreateContribution(ctx, c); err != nil {
		return nil, err
	}
	return c, nil
}

func (s *Service) ListContributions(ctx context.Context, tenantID string, filters *models.ContributionFilters, offset, limit int) ([]models.Contribution, int, error) {
	items, err := s.repo.ListContributions(ctx, tenantID, filters, offset, limit)
	if err != nil {
		return nil, 0, err
	}
	total, err := s.repo.CountContributions(ctx, tenantID, filters)
	if err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

func (s *Service) GetContribution(ctx context.Context, tenantID, id string) (*models.Contribution, error) {
	return s.repo.GetContributionByID(ctx, tenantID, id)
}

func (s *Service) DeleteContribution(ctx context.Context, tenantID, id string) error {
	return s.repo.DeleteContribution(ctx, tenantID, id)
}

// ============================================================
// Best Practice Management
// ============================================================

func (s *Service) CreateBestPractice(ctx context.Context, tenantID string, req *models.CreateBestPracticeRequest) (*models.BestPractice, error) {
	now := time.Now().UTC()
	authorName := req.AuthorName
	if authorName == "" {
		authorName = "user-" + req.AuthorID[:min(8, len(req.AuthorID))]
	}
	bp := &models.BestPractice{
		ID:          uuid.New().String(),
		TenantID:    tenantID,
		Title:       req.Title,
		Description: req.Description,
		Category:    req.Category,
		Tags:        req.Tags,
		Content:     req.Content,
		AuthorID:    req.AuthorID,
		AuthorName:  authorName,
		Status:      "published",
		Votes:       0,
		Views:       0,
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	if err := s.repo.CreateBestPractice(ctx, bp); err != nil {
		return nil, err
	}
	return bp, nil
}

func (s *Service) ListBestPractices(ctx context.Context, tenantID string, filters *models.BestPracticeFilters, offset, limit int) ([]models.BestPractice, int, error) {
	items, err := s.repo.ListBestPractices(ctx, tenantID, filters, offset, limit)
	if err != nil {
		return nil, 0, err
	}
	total, err := s.repo.CountBestPractices(ctx, tenantID, filters)
	if err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

func (s *Service) GetBestPractice(ctx context.Context, tenantID, id string) (*models.BestPractice, error) {
	bp, err := s.repo.GetBestPracticeByID(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	// Increment views (fire-and-forget, ignore error)
	_ = s.repo.IncrementBestPracticeViews(ctx, id)
	bp.Views++
	return bp, nil
}

func (s *Service) VoteBestPractice(ctx context.Context, tenantID, id, direction string) (*models.BestPractice, error) {
	// Verify it exists first
	_, err := s.repo.GetBestPracticeByID(ctx, tenantID, id)
	if err != nil {
		return nil, ErrBestPracticeNotFound
	}
	delta := 1
	if direction == "down" {
		delta = -1
	}
	return s.repo.VoteBestPractice(ctx, id, delta)
}

func (s *Service) DeleteBestPractice(ctx context.Context, tenantID, id string) error {
	return s.repo.DeleteBestPractice(ctx, tenantID, id)
}

// ============================================================
// Contributor Management
// ============================================================

func (s *Service) ListContributors(ctx context.Context, tenantID string, limit int) ([]models.Contributor, error) {
	if limit <= 0 {
		limit = 50
	}
	return s.repo.ListContributors(ctx, tenantID, limit)
}

func (s *Service) GetContributor(ctx context.Context, tenantID, userID string) (*models.Contributor, error) {
	return s.repo.GetContributor(ctx, tenantID, userID)
}

// ============================================================
// Plugin Management
// ============================================================

func (s *Service) SubmitPlugin(ctx context.Context, tenantID string, req *models.CreatePluginRequest) (*models.CommunityPlugin, error) {
	p := &models.CommunityPlugin{
		ID:            uuid.New().String(),
		TenantID:      tenantID,
		Name:          req.Name,
		Version:       req.Version,
		Description:   req.Description,
		Author:        req.Author,
		Category:      req.Category,
		Repository:    req.Repository,
		Compatibility: req.Compatibility,
		Status:        "pending",
		SubmittedAt:   time.Now().UTC(),
	}
	if err := s.repo.CreatePlugin(ctx, p); err != nil {
		return nil, err
	}
	return p, nil
}

func (s *Service) ListPlugins(ctx context.Context, tenantID string, filters *models.PluginFilters, offset, limit int) ([]models.CommunityPlugin, int, error) {
	items, err := s.repo.ListPlugins(ctx, tenantID, filters, offset, limit)
	if err != nil {
		return nil, 0, err
	}
	total, err := s.repo.CountPlugins(ctx, tenantID, filters)
	if err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

func (s *Service) ReviewPlugin(ctx context.Context, tenantID, pluginID string, req *models.ReviewPluginRequest) (*models.CommunityPlugin, error) {
	// Verify plugin exists and belongs to tenant
	_, err := s.repo.GetPluginByID(ctx, tenantID, pluginID)
	if err != nil {
		return nil, ErrPluginNotFound
	}
	if req.Action != "approve" && req.Action != "reject" {
		return nil, ErrInvalidAction
	}
	return s.repo.ReviewPlugin(ctx, pluginID, req.Action, req.Comment)
}

// ============================================================
// Badge Management
// ============================================================

var badgeDefinitions = map[string]models.BadgeDefinition{
	"top-contributor":     {Type: "top-contributor", Name: "Top Contributor", Description: "Outstanding community contributions", Criteria: "10+ approved contributions"},
	"code-reviewer":       {Type: "code-reviewer", Name: "Code Reviewer", Description: "Excellent code review participation", Criteria: "50+ code reviews completed"},
	"bug-hunter":          {Type: "bug-hunter", Name: "Bug Hunter", Description: "Found and fixed critical bugs", Criteria: "5+ critical bugs identified"},
	"mentor":              {Type: "mentor", Name: "Mentor", Description: "Successfully mentored team members", Criteria: "3+ successful mentorships"},
	"doc-master":          {Type: "doc-master", Name: "Doc Master", Description: "Outstanding documentation contributions", Criteria: "20+ documentation contributions"},
	"early-adopter":       {Type: "early-adopter", Name: "Early Adopter", Description: "Early adoption of new features", Criteria: "First to use 3+ new features"},
	"best-practice-author": {Type: "best-practice-author", Name: "Best Practice Author", Description: "Created highly-voted best practices", Criteria: "Best practice with 50+ votes"},
	"community-champion":  {Type: "community-champion", Name: "Community Champion", Description: "Overall community excellence", Criteria: "5+ badges earned"},
}

func (s *Service) AwardBadge(ctx context.Context, tenantID, userID, badgeType string) (*models.Badge, error) {
	def, ok := badgeDefinitions[badgeType]
	if !ok {
		def = models.BadgeDefinition{
			Type:        badgeType,
			Name:        badgeType,
			Description: badgeType + " badge",
		}
	}
	badge := &models.Badge{
		ID:          uuid.New().String(),
		TenantID:    tenantID,
		UserID:      userID,
		Type:        badgeType,
		Name:        def.Name,
		Description: def.Description,
		AwardedAt:   time.Now().UTC(),
	}
	if err := s.repo.CreateBadge(ctx, badge); err != nil {
		return nil, err
	}
	return badge, nil
}

func (s *Service) ListUserBadges(ctx context.Context, userID string) ([]models.Badge, error) {
	return s.repo.ListUserBadges(ctx, userID)
}

func (s *Service) ListUserBadgesByTenant(ctx context.Context, tenantID, userID string) ([]models.Badge, error) {
	return s.repo.ListUserBadgesByTenant(ctx, tenantID, userID)
}

func (s *Service) GetBadgeDefinitions() []models.BadgeDefinition {
	defs := make([]models.BadgeDefinition, 0, len(badgeDefinitions))
	for _, d := range badgeDefinitions {
		defs = append(defs, d)
	}
	return defs
}

// ============================================================
// Incentive Program Management
// ============================================================

func (s *Service) SetupIncentiveProgram(ctx context.Context, tenantID string, req *models.CreateIncentiveProgramRequest) (*models.IncentiveProgram, error) {
	now := time.Now().UTC()
	p := &models.IncentiveProgram{
		ID:          uuid.New().String(),
		TenantID:    tenantID,
		Name:        req.Name,
		Description: req.Description,
		Config:      req.Config,
		Status:      "active",
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	if err := s.repo.CreateIncentiveProgram(ctx, p); err != nil {
		return nil, err
	}
	return p, nil
}

func (s *Service) GetIncentivePrograms(ctx context.Context, tenantID string) ([]models.IncentiveProgram, error) {
	return s.repo.ListIncentivePrograms(ctx, tenantID)
}

func (s *Service) UpdateIncentiveProgramStatus(ctx context.Context, tenantID, id, status string) (*models.IncentiveProgram, error) {
	return s.repo.UpdateIncentiveProgramStatus(ctx, tenantID, id, status)
}

// ============================================================
// Mentorship Management
// ============================================================

func (s *Service) AssignMentor(ctx context.Context, tenantID string, req *models.AssignMentorRequest) (*models.MentorshipPair, error) {
	pair := &models.MentorshipPair{
		ID:         uuid.New().String(),
		TenantID:   tenantID,
		MentorID:   req.MentorID,
		MenteeID:   req.MenteeID,
		Status:     "active",
		AssignedAt: time.Now().UTC(),
		Goals:      req.Goals,
	}
	if err := s.repo.CreateMentorshipPair(ctx, pair); err != nil {
		return nil, err
	}
	return pair, nil
}

func (s *Service) GetMentorshipPairs(ctx context.Context, tenantID string) ([]models.MentorshipPair, error) {
	return s.repo.ListMentorshipPairs(ctx, tenantID)
}

func (s *Service) UpdateMentorshipPairStatus(ctx context.Context, tenantID, id, status string) (*models.MentorshipPair, error) {
	return s.repo.UpdateMentorshipPairStatus(ctx, tenantID, id, status)
}

// min returns the smaller of a or b.
func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
