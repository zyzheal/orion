package service

import (
	"context"
	"strings"

	"orion/platform-svc-go/internal/project-member/models"
	"orion/platform-svc-go/internal/project-member/repository"
)

type Service struct {
	repo *repository.Repository
}

func NewService(repo *repository.Repository) *Service {
	return &Service{repo: repo}
}

// GetProjectMembers retrieves all members for a project.
func (s *Service) GetProjectMembers(ctx context.Context, tenantID, projectID string) ([]models.ProjectMember, error) {
	return s.repo.GetProjectMembers(ctx, tenantID, projectID)
}

// AddProjectMember adds a user to a project with the given role.
// Returns (created bool, err) — created indicates whether a new row was inserted.
func (s *Service) AddProjectMember(ctx context.Context, tenantID, projectID, userID, role string) (bool, error) {
	role = strings.TrimSpace(role)
	return s.repo.AddProjectMember(ctx, tenantID, projectID, userID, role)
}

// IsProjectMember checks whether a user is a member of a project.
func (s *Service) IsProjectMember(ctx context.Context, tenantID, projectID, userID string) (bool, error) {
	return s.repo.IsProjectMember(ctx, tenantID, projectID, userID)
}

// RemoveProjectMember removes a user from a project.
func (s *Service) RemoveProjectMember(ctx context.Context, tenantID, projectID, userID string) error {
	return s.repo.RemoveProjectMember(ctx, tenantID, projectID, userID)
}
