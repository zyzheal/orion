package service

import (
	"context"
	"regexp"
	"strconv"
	"strings"

	"orion/platform-svc-go/internal/product-line/models"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	Create(ctx context.Context, m *models.ProductLine) error
	CreateHotfixChannel(ctx context.Context, tenantID string, hc *models.HotfixChannel) error
	CreateReleaseTrain(ctx context.Context, tenantID string, rt *models.ReleaseTrain) error
	Delete(ctx context.Context, tenantID, id string) error
	GetByID(ctx context.Context, tenantID, id string) (*models.ProductLine, error)
	GetByName(ctx context.Context, tenantID, name string) (*models.ProductLine, error)
	GetEnabledHotfixChannel(ctx context.Context, tenantID, productLineID string) (*models.HotfixChannel, error)
	GetHotfixChannels(ctx context.Context, tenantID, productLineID string) ([]models.HotfixChannel, error)
	GetReleaseTrains(ctx context.Context, tenantID, productLineID string) ([]models.ReleaseTrain, error)
	List(ctx context.Context, tenantID string, limit, offset int) ([]models.ProductLine, error)
	Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) error
	UpdatePhase(ctx context.Context, tenantID, id string, phase models.Phase) (*models.ProductLine, error)
}

type Service struct {
	repo RepositoryInterface
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

// ==================== ProductLine CRUD ====================

func (s *Service) Create(ctx context.Context, tenantID string, req models.CreateProductLineRequest) (*models.ProductLine, error) {
	m := &models.ProductLine{
		TenantID: tenantID,
		Name:     req.Name,
	}
	if err := s.repo.Create(ctx, m); err != nil {
		return nil, err
	}
	return m, nil
}

func (s *Service) Get(ctx context.Context, tenantID, id string) (*models.ProductLine, error) {
	return s.repo.GetByID(ctx, tenantID, id)
}

func (s *Service) GetByName(ctx context.Context, tenantID, name string) (*models.ProductLine, error) {
	return s.repo.GetByName(ctx, tenantID, name)
}

func (s *Service) List(ctx context.Context, tenantID string, limit, offset int) ([]models.ProductLine, error) {
	return s.repo.List(ctx, tenantID, limit, offset)
}

func (s *Service) Update(ctx context.Context, tenantID, id string, req models.UpdateProductLineRequest) (*models.ProductLine, error) {
	updates := make(map[string]interface{})
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if err := s.repo.Update(ctx, tenantID, id, updates); err != nil {
		return nil, err
	}
	return s.repo.GetByID(ctx, tenantID, id)
}

func (s *Service) Delete(ctx context.Context, tenantID, id string) error {
	return s.repo.Delete(ctx, tenantID, id)
}

// Activate sets the product line phase to Active.
func (s *Service) Activate(ctx context.Context, tenantID, id string) (*models.ProductLine, error) {
	return s.repo.UpdatePhase(ctx, tenantID, id, models.PhaseActive)
}

// Suspend sets the product line phase to Suspended.
func (s *Service) Suspend(ctx context.Context, tenantID, id string) (*models.ProductLine, error) {
	return s.repo.UpdatePhase(ctx, tenantID, id, models.PhaseSuspended)
}

// ==================== ReleaseTrain ====================

func (s *Service) CreateReleaseTrain(ctx context.Context, tenantID, productLineID string, req models.CreateReleaseTrainRequest) (*models.ReleaseTrain, error) {
	approvalRequired := true
	if req.ApprovalRequired != nil {
		approvalRequired = *req.ApprovalRequired
	}
	approvers := ""
	if len(req.Approvers) > 0 {
		approvers = strings.Join(req.Approvers, ",")
	}
	if req.TargetBranch == "" {
		req.TargetBranch = "production"
	}
	if req.SourceBranch == "" {
		req.SourceBranch = "main"
	}
	rt := &models.ReleaseTrain{
		ProductLineID:    productLineID,
		Name:             req.Name,
		Schedule:         req.Schedule,
		TargetBranch:     req.TargetBranch,
		SourceBranch:     req.SourceBranch,
		AutoPromote:      req.AutoPromote,
		ApprovalRequired: approvalRequired,
		Approvers:        approvers,
	}
	if err := s.repo.CreateReleaseTrain(ctx, tenantID, rt); err != nil {
		return nil, err
	}
	return rt, nil
}

func (s *Service) GetReleaseTrains(ctx context.Context, tenantID, productLineID string) ([]models.ReleaseTrain, error) {
	return s.repo.GetReleaseTrains(ctx, tenantID, productLineID)
}

// ==================== HotfixChannel ====================

func (s *Service) CreateHotfixChannel(ctx context.Context, tenantID, productLineID string, req models.CreateHotfixChannelRequest) (*models.HotfixChannel, error) {
	enabled := true
	if req.Enabled != nil {
		enabled = *req.Enabled
	}
	branchPattern := "^hotfix/.*$"
	if req.BranchPattern != "" {
		branchPattern = req.BranchPattern
	}
	approvalRequired := true
	if req.ApprovalRequired != nil {
		approvalRequired = *req.ApprovalRequired
	}
	approvalTimeout := 30
	if req.ApprovalTimeout != nil {
		approvalTimeout = *req.ApprovalTimeout
	}
	autoMerge := false
	if req.AutoMerge != nil {
		autoMerge = *req.AutoMerge
	}
	notifyOnCall := true
	if req.NotifyOnCall != nil {
		notifyOnCall = *req.NotifyOnCall
	}
	maxDuration := 60
	if req.MaxDuration != nil {
		maxDuration = *req.MaxDuration
	}
	hc := &models.HotfixChannel{
		ProductLineID:    productLineID,
		Name:             req.Name,
		Enabled:          enabled,
		BranchPattern:    branchPattern,
		ApprovalRequired: approvalRequired,
		ApprovalTimeout:  approvalTimeout,
		AutoMerge:        autoMerge,
		NotifyOnCall:     notifyOnCall,
		MaxDuration:      maxDuration,
	}
	if err := s.repo.CreateHotfixChannel(ctx, tenantID, hc); err != nil {
		return nil, err
	}
	return hc, nil
}

func (s *Service) GetHotfixChannels(ctx context.Context, tenantID, productLineID string) ([]models.HotfixChannel, error) {
	return s.repo.GetHotfixChannels(ctx, tenantID, productLineID)
}

// IsHotfixBranch checks if a branch matches the pattern of an enabled hotfix channel.
func (s *Service) IsHotfixBranch(ctx context.Context, tenantID, productLineID, branchName string) (bool, error) {
	hc, err := s.repo.GetEnabledHotfixChannel(ctx, tenantID, productLineID)
	if err != nil {
		return false, err
	}
	if hc == nil || !hc.Enabled {
		return false, nil
	}
	matched, err := regexp.MatchString(hc.BranchPattern, branchName)
	if err != nil {
		return false, err
	}
	return matched, nil
}

// ==================== Branch helpers ====================

// parsePagination extracts limit/offset from the pagination helper, returning safe defaults.
func parsePagination(limit, offset string) (int, int) {
	l, _ := strconv.Atoi(limit)
	if l <= 0 {
		l = 50
	}
	o, _ := strconv.Atoi(offset)
	if o < 0 {
		o = 0
	}
	return l, o
}
