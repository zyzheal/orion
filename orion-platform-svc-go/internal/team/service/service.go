package service
//go:generate mockgen -destination=mock_service.go -package=service . ServiceInterface
//go:generate mockgen -destination=mock_repository.go -package=service . RepositoryInterface

import (
	"context"
	"fmt"
	"regexp"
	"time"

	"orion/platform-svc-go/internal/team/models"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	AddMember(ctx context.Context, m *models.TeamMember) error
	AssignRole(ctx context.Context, teamID, roleName string, grantedBy *string) error
	Create(ctx context.Context, m *models.Team) error
	Delete(ctx context.Context, tenantID, id string) error
	GetByID(ctx context.Context, tenantID, id string) (*models.Team, error)
	GetBySlug(ctx context.Context, tenantID, slug string) (*models.Team, error)
	GetMembers(ctx context.Context, teamID string) ([]models.TeamMember, error)
	GetOrphanedChildrenCount(ctx context.Context, tenantID, parentID string) (int64, error)
	GetRoles(ctx context.Context, teamID string) ([]models.TeamRole, error)
	GetUserTeams(ctx context.Context, userID, tenantID string) ([]models.Team, error)
	List(ctx context.Context, tenantID string, typeFilter *string, limit, offset int) ([]models.Team, error)
	RemoveMember(ctx context.Context, teamID, userID string) (bool, error)
	RemoveRole(ctx context.Context, teamID, roleName string) (bool, error)
	Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) error
	UpdateMemberRole(ctx context.Context, teamID, userID, newRole string) error
}

type Service struct {
	repo RepositoryInterface
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

// Valid member roles
var ValidMemberRoles = []string{"member", "lead", "admin"}

func isValidMemberRole(role string) bool {
	for _, r := range ValidMemberRoles {
		if r == role {
			return true
		}
	}
	return false
}

// ==================== Team CRUD ====================

// Create creates a new team
func (s *Service) Create(ctx context.Context, tenantID string, req models.CreateTeamRequest) (*models.Team, error) {
	// Validate slug
	slugRegex := regexp.MustCompile(`^[a-z0-9]+(-[a-z0-9]+)*$`)
	if !slugRegex.MatchString(req.Slug) {
		return nil, fmt.Errorf("invalid slug format: must be lowercase alphanumeric with hyphens")
	}

	// Check for duplicate slug
	_, err := s.repo.GetBySlug(ctx, tenantID, req.Slug)
	if err == nil {
		return nil, fmt.Errorf("duplicate slug: team with slug %q already exists", req.Slug)
	}

	// Validate parent_team_id belongs to same tenant
	if req.ParentTeamID != nil && *req.ParentTeamID != "" {
		_, err := s.repo.GetByID(ctx, tenantID, *req.ParentTeamID)
		if err != nil {
			return nil, fmt.Errorf("invalid parent team: parent team not found")
		}
	}

	m := &models.Team{
		TenantID:     tenantID,
		Name:         req.Name,
		Slug:         req.Slug,
		Description:  req.Description,
		TeamType:     "functional",
		ParentTeamID: req.ParentTeamID,
		ExternalID:   req.ExternalID,
		Metadata:     req.Metadata,
	}
	if req.TeamType != nil && *req.TeamType != "" {
		m.TeamType = *req.TeamType
	}

	if err := s.repo.Create(ctx, m); err != nil {
		return nil, err
	}
	return m, nil
}

// Get retrieves a team by ID
func (s *Service) Get(ctx context.Context, tenantID, id string) (*models.Team, error) {
	return s.repo.GetByID(ctx, tenantID, id)
}

// List retrieves teams for a tenant with pagination
func (s *Service) List(ctx context.Context, tenantID string, limit, offset int) ([]models.Team, error) {
	return s.repo.List(ctx, tenantID, nil, limit, offset)
}

// ListByType retrieves teams filtered by type
func (s *Service) ListByType(ctx context.Context, tenantID, teamType string, limit, offset int) ([]models.Team, error) {
	return s.repo.List(ctx, tenantID, &teamType, limit, offset)
}

// Update updates a team
func (s *Service) Update(ctx context.Context, tenantID, id string, req models.UpdateTeamRequest) (*models.Team, error) {
	// Verify team exists
	team, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, fmt.Errorf("team not found: %s", id)
	}

	updates := make(map[string]interface{})
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.Description != nil {
		updates["description"] = *req.Description
	}
	if req.TeamType != nil {
		updates["team_type"] = *req.TeamType
	}
	if req.ParentTeamID != nil {
		updates["parent_team_id"] = *req.ParentTeamID
	}
	if req.Metadata != nil {
		updates["metadata"] = req.Metadata
	}

	if len(updates) == 0 {
		return team, nil
	}

	if err := s.repo.Update(ctx, tenantID, id, updates); err != nil {
		return nil, err
	}

	return s.repo.GetByID(ctx, tenantID, id)
}

// DeleteResult holds the result of a delete operation
type DeleteResult struct {
	Deleted          bool `json:"deleted"`
	OrphanedChildren int  `json:"orphanedChildren,omitempty"`
}

// Delete deletes a team
func (s *Service) Delete(ctx context.Context, tenantID, id string) (*DeleteResult, error) {
	_, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, fmt.Errorf("team not found: %s", id)
	}

	// Count orphaned children
	orphanedChildren, err := s.repo.GetOrphanedChildrenCount(ctx, tenantID, id)
	if err != nil {
		orphanedChildren = 0
	}

	if err := s.repo.Delete(ctx, tenantID, id); err != nil {
		return nil, fmt.Errorf("failed to delete team: %w", err)
	}

	return &DeleteResult{
		Deleted:          true,
		OrphanedChildren: int(orphanedChildren),
	}, nil
}

// GetUserTeams retrieves all teams a user belongs to
func (s *Service) GetUserTeams(ctx context.Context, userID, tenantID string) ([]models.Team, error) {
	return s.repo.GetUserTeams(ctx, userID, tenantID)
}

// ==================== Team Members ====================

// AddMember adds a member to a team
func (s *Service) AddMember(ctx context.Context, teamID, userID, tenantID, role, addedBy string) error {
	_, err := s.repo.GetByID(ctx, tenantID, teamID)
	if err != nil {
		return fmt.Errorf("team not found: %s", teamID)
	}

	if role == "" {
		role = "member"
	}
	if !isValidMemberRole(role) {
		return fmt.Errorf("invalid member role: %s", role)
	}

	member := &models.TeamMember{
		TeamID:   teamID,
		UserID:   userID,
		Role:     role,
		AddedBy:  &addedBy,
		JoinedAt: time.Now().UTC(),
	}

	return s.repo.AddMember(ctx, member)
}

// RemoveMember removes a member from a team
func (s *Service) RemoveMember(ctx context.Context, teamID, userID, tenantID string) (bool, error) {
	_, err := s.repo.GetByID(ctx, tenantID, teamID)
	if err != nil {
		return false, fmt.Errorf("team not found: %s", teamID)
	}

	return s.repo.RemoveMember(ctx, teamID, userID)
}

// GetMembers retrieves all members of a team
func (s *Service) GetMembers(ctx context.Context, teamID, tenantID string) ([]models.TeamMember, error) {
	_, err := s.repo.GetByID(ctx, tenantID, teamID)
	if err != nil {
		return nil, fmt.Errorf("team not found: %s", teamID)
	}

	return s.repo.GetMembers(ctx, teamID)
}

// UpdateMemberRole updates a member's role in a team
func (s *Service) UpdateMemberRole(ctx context.Context, teamID, userID, tenantID, newRole string) error {
	if !isValidMemberRole(newRole) {
		return fmt.Errorf("invalid member role: %s", newRole)
	}

	_, err := s.repo.GetByID(ctx, tenantID, teamID)
	if err != nil {
		return fmt.Errorf("team not found: %s", teamID)
	}

	return s.repo.UpdateMemberRole(ctx, teamID, userID, newRole)
}

// ==================== Team Roles ====================

// AssignRole assigns a role to a team
func (s *Service) AssignRole(ctx context.Context, teamID, roleName, tenantID, grantedBy string) error {
	_, err := s.repo.GetByID(ctx, tenantID, teamID)
	if err != nil {
		return fmt.Errorf("team not found: %s", teamID)
	}

	if roleName == "" {
		return fmt.Errorf("invalid role name")
	}

	var grantedByPtr *string
	if grantedBy != "" {
		grantedByPtr = &grantedBy
	}

	return s.repo.AssignRole(ctx, teamID, roleName, grantedByPtr)
}

// RemoveRole removes a role assignment from a team
func (s *Service) RemoveRole(ctx context.Context, teamID, roleName, tenantID string) (bool, error) {
	_, err := s.repo.GetByID(ctx, tenantID, teamID)
	if err != nil {
		return false, fmt.Errorf("team not found: %s", teamID)
	}

	if roleName == "" {
		return false, fmt.Errorf("invalid role name")
	}

	return s.repo.RemoveRole(ctx, teamID, roleName)
}

// GetRoles retrieves all role assignments for a team
func (s *Service) GetRoles(ctx context.Context, teamID, tenantID string) ([]models.TeamRole, error) {
	_, err := s.repo.GetByID(ctx, tenantID, teamID)
	if err != nil {
		return nil, fmt.Errorf("team not found: %s", teamID)
	}

	return s.repo.GetRoles(ctx, teamID)
}
