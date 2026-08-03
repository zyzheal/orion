package service

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"orion/platform-svc-go/internal/identity/role/models"
)

type RoleService struct {
	roles map[string]*models.Role
}

func NewRoleService() *RoleService {
	return &RoleService{roles: make(map[string]*models.Role)}
}

func (s *RoleService) CreateRole(ctx context.Context, tenantID string, req *models.CreateRoleRequest) (*models.Role, error) {
	now := time.Now()
	id := uuid.New().String()
	role := &models.Role{
		ID:          id,
		TenantID:    tenantID,
		Name:        req.Name,
		Description: req.Description,
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	s.roles[id] = role
	return role, nil
}

func (s *RoleService) GetRole(ctx context.Context, tenantID, id string) (*models.Role, error) {
	r, ok := s.roles[id]
	if !ok {
		return nil, fmt.Errorf("role not found: %s", id)
	}
	if r.TenantID != tenantID {
		return nil, fmt.Errorf("role not accessible: %s", id)
	}
	return r, nil
}

func (s *RoleService) ListRoles(ctx context.Context, tenantID string) ([]models.Role, error) {
	var out []models.Role
	for _, r := range s.roles {
		if r.TenantID == tenantID {
			out = append(out, *r)
		}
	}
	return out, nil
}

func (s *RoleService) UpdateRole(ctx context.Context, tenantID, id string, req *models.UpdateRoleRequest) (*models.Role, error) {
	r, err := s.GetRole(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	r.Name = req.Name
	r.Description = req.Description
	r.UpdatedAt = time.Now()
	s.roles[id] = r
	return r, nil
}

func (s *RoleService) DeleteRole(ctx context.Context, tenantID, id string) error {
	_, err := s.GetRole(ctx, tenantID, id)
	if err != nil {
		return err
	}
	delete(s.roles, id)
	return nil
}
