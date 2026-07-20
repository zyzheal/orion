package service

import (
	"context"
	"errors"

	"orion/platform-svc-go/internal/project-member/models"
	"orion/go-common/pkg/sentinel"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	CountByProject(ctx context.Context, tenantID, projectID string) (int, error)
	Create(ctx context.Context, tenantID string, m *models.ProjectMember) (*models.ProjectMember, error)
	Delete(ctx context.Context, tenantID, id string) error
	DeleteByProject(ctx context.Context, tenantID, projectID string) error
	GetByID(ctx context.Context, tenantID, id string) (*models.ProjectMember, error)
	GetByProject(ctx context.Context, tenantID, projectID string) ([]models.ProjectMember, error)
	GetByProjectUser(ctx context.Context, tenantID, projectID, userID string) (*models.ProjectMember, error)
	HasRole(ctx context.Context, tenantID, projectID, userID, role string) (bool, error)
	List(ctx context.Context, tenantID string, q models.ListMembersQuery) ([]models.ProjectMember, int, error)
	Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.ProjectMember, error)
}

var (

	ErrBadRequest      = errors.New("invalid request")
	ErrInvalidRole     = errors.New("invalid role")
	ErrDuplicateMember = errors.New("user is already a member of this project")
)

type Service struct {
	repo RepositoryInterface
}

func NewService(repo RepositoryInterface) *Service { return &Service{repo: repo} }

func (s *Service) CreateMember(ctx context.Context, tenantID string, req models.CreateProjectMemberRequest) (*models.ProjectMember, error) {
	if req.ProjectID == "" || req.UserID == "" {
		return nil, ErrBadRequest
	}
	if !isValidRole(req.Role) {
		return nil, ErrInvalidRole
	}
	if _, err := s.repo.GetByProjectUser(ctx, tenantID, req.ProjectID, req.UserID); err == nil {
		return nil, ErrDuplicateMember
	}
	m := &models.ProjectMember{
		ProjectID:   req.ProjectID,
		UserID:      req.UserID,
		Role:        req.Role,
		Permissions: req.Permissions,
		InvitedBy:   req.InvitedBy,
		Status:      "active",
	}
	return s.repo.Create(ctx, tenantID, m)
}

func (s *Service) GetMember(ctx context.Context, tenantID, id string) (*models.ProjectMember, error) {
	return s.repo.GetByID(ctx, tenantID, id)
}

func (s *Service) GetMemberByProjectUser(ctx context.Context, tenantID, projectID, userID string) (*models.ProjectMember, error) {
	return s.repo.GetByProjectUser(ctx, tenantID, projectID, userID)
}

func (s *Service) ListMembers(ctx context.Context, tenantID string, q models.ListMembersQuery) ([]models.ProjectMember, int, error) {
	return s.repo.List(ctx, tenantID, q)
}

func (s *Service) ListByProject(ctx context.Context, tenantID, projectID string) ([]models.ProjectMember, error) {
	return s.repo.GetByProject(ctx, tenantID, projectID)
}

func (s *Service) UpdateMember(ctx context.Context, tenantID, id string, req models.UpdateProjectMemberRequest) (*models.ProjectMember, error) {
	updates := make(map[string]interface{})
	if req.Role != nil {
		if !isValidRole(*req.Role) {
			return nil, ErrInvalidRole
		}
		updates["role"] = *req.Role
	}
	if req.Status != nil {
		updates["status"] = *req.Status
	}
	if req.Permissions != nil {
		updates["permissions"] = req.Permissions
	}
	return s.repo.Update(ctx, tenantID, id, updates)
}

func (s *Service) DeleteMember(ctx context.Context, tenantID, id string) error {
	return s.repo.Delete(ctx, tenantID, id)
}

func (s *Service) DeleteByProject(ctx context.Context, tenantID, projectID string) error {
	return s.repo.DeleteByProject(ctx, tenantID, projectID)
}

func (s *Service) CheckRole(ctx context.Context, tenantID, projectID, userID, role string) (bool, error) {
	return s.repo.HasRole(ctx, tenantID, projectID, userID, role)
}

func (s *Service) CountByProject(ctx context.Context, tenantID, projectID string) (int, error) {
	return s.repo.CountByProject(ctx, tenantID, projectID)
}

func isValidRole(role string) bool {
	switch role {
	case "owner", "admin", "developer", "viewer":
		return true
	}
	return false
}
