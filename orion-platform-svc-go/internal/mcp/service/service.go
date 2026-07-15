package service

import (
	"context"
	"errors"

	"orion/platform-svc-go/internal/mcp/models"
	"orion/platform-svc-go/internal/mcp/repository"
)

var ErrNotFound = errors.New("MCP resource not found")

type Service struct {
	repo *repository.Repository
}

func NewService(repo *repository.Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) CreateServer(ctx context.Context, tenantID string, req models.CreateMCPServerRequest) (*models.MCPServer, error) {
	m := &models.MCPServer{TenantID: tenantID, Name: req.Name, URL: req.URL, Enabled: req.Enabled}
	if err := s.repo.CreateServer(ctx, m); err != nil {
		return nil, err
	}
	return m, nil
}

func (s *Service) GetServer(ctx context.Context, tenantID, id string) (*models.MCPServer, error) {
	return s.repo.GetServer(ctx, tenantID, id)
}

func (s *Service) ListServers(ctx context.Context, tenantID string, q models.ListMCPServersQuery) (*models.MCPServerListResponse, error) {
	servers, err := s.repo.ListServers(ctx, tenantID, q)
	if err != nil {
		return nil, err
	}
	total, err := s.repo.CountServers(ctx, tenantID, q)
	if err != nil {
		return nil, err
	}
	if servers == nil {
		servers = []models.MCPServer{}
	}
	return &models.MCPServerListResponse{Servers: servers, Total: total}, nil
}

func (s *Service) UpdateServer(ctx context.Context, tenantID, id string, req models.UpdateMCPServerRequest) (*models.MCPServer, error) {
	updates := make(map[string]interface{})
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.URL != nil {
		updates["url"] = *req.URL
	}
	if req.Enabled != nil {
		updates["enabled"] = *req.Enabled
	}
	if err := s.repo.UpdateServer(ctx, tenantID, id, updates); err != nil {
		return nil, err
	}
	return s.repo.GetServer(ctx, tenantID, id)
}

func (s *Service) DeleteServer(ctx context.Context, tenantID, id string) error {
	return s.repo.SoftDeleteServer(ctx, tenantID, id)
}

func (s *Service) ListTools(ctx context.Context, q models.ListMCPToolsQuery) (*models.MCPToolListResponse, error) {
	tools, err := s.repo.ListTools(ctx, q)
	if err != nil {
		return nil, err
	}
	toolCount, err := s.repo.CountTools(ctx, q)
	if err != nil {
		return nil, err
	}
	if tools == nil {
		tools = []models.MCPTool{}
	}
	return &models.MCPToolListResponse{Tools: tools, Total: toolCount}, nil
}
