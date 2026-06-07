package service

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"

	"orion-tool-svc-go/internal/models"
	"orion-tool-svc-go/internal/repository"
)

// ToolService handles tool business logic.
type ToolService struct {
	toolRepo   *repository.ToolRepository
	invRepo    *repository.InvocationRepository
	versionRepo *repository.VersionRepository
}

func NewToolService(
	toolRepo *repository.ToolRepository,
	invRepo *repository.InvocationRepository,
	versionRepo *repository.VersionRepository,
) *ToolService {
	return &ToolService{
		toolRepo:    toolRepo,
		invRepo:     invRepo,
		versionRepo: versionRepo,
	}
}

func (s *ToolService) Create(ctx context.Context, tenantID, userID string, req models.CreateToolRequest) (*models.Tool, error) {
	tool := &models.Tool{
		ID:          uuid.New().String(),
		TenantID:    tenantID,
		Name:        req.Name,
		DisplayName: req.DisplayName,
		Description: req.Description,
		Category:    req.Category,
		Type:        req.Type,
		Version:     req.Version,
		Config:      jsonOrDefault(req.Config, "{}"),
		Endpoint:    req.Endpoint,
		AuthType:    jsonOrDefault(req.AuthType, "none"),
		AuthConfig:  jsonOrDefault(req.AuthConfig, "{}"),
		Tags:        jsonOrDefault(req.Tags, "[]"),
		Status:      "active",
		CreatedBy:   userID,
	}

	if tool.DisplayName == "" {
		tool.DisplayName = tool.Name
	}

	if err := s.toolRepo.Create(ctx, tool); err != nil {
		return nil, fmt.Errorf("create tool: %w", err)
	}

	// Record initial version
	_ = s.versionRepo.Create(ctx, &models.ToolVersion{
		ID:        uuid.New().String(),
		ToolID:    tool.ID,
		Version:   tool.Version,
		Config:    tool.Config,
		Changelog: "Initial version",
		CreatedBy: userID,
	})

	return tool, nil
}

func (s *ToolService) Get(ctx context.Context, tenantID, id string) (*models.Tool, error) {
	tool, err := s.toolRepo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, fmt.Errorf("get tool: %w", err)
	}
	if tool == nil {
		return nil, fmt.Errorf("tool not found: %s", id)
	}
	return tool, nil
}

func (s *ToolService) List(ctx context.Context, tenantID string, params models.ToolListParams) ([]models.Tool, int, error) {
	return s.toolRepo.List(ctx, tenantID, params)
}

func (s *ToolService) Update(ctx context.Context, tenantID, id string, req models.UpdateToolRequest) (*models.Tool, error) {
	tool, err := s.toolRepo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, fmt.Errorf("get tool: %w", err)
	}
	if tool == nil {
		return nil, fmt.Errorf("tool not found: %s", id)
	}

	if req.DisplayName != nil {
		tool.DisplayName = *req.DisplayName
	}
	if req.Description != nil {
		tool.Description = *req.Description
	}
	if req.Category != nil {
		tool.Category = *req.Category
	}
	if req.Version != nil {
		// Record version change
		_ = s.versionRepo.Create(ctx, &models.ToolVersion{
			ID:      uuid.New().String(),
			ToolID:  tool.ID,
			Version: *req.Version,
			Config:  tool.Config,
		})
		tool.Version = *req.Version
	}
	if req.Config != nil {
		tool.Config = *req.Config
	}
	if req.Endpoint != nil {
		tool.Endpoint = *req.Endpoint
	}
	if req.AuthType != nil {
		tool.AuthType = *req.AuthType
	}
	if req.AuthConfig != nil {
		tool.AuthConfig = *req.AuthConfig
	}
	if req.Tags != nil {
		tool.Tags = *req.Tags
	}
	if req.Status != nil {
		tool.Status = *req.Status
		if *req.Status == "deprecated" {
			now := time.Now()
			tool.DeprecatedAt.Scan(now)
		}
	}

	if err := s.toolRepo.Update(ctx, tool); err != nil {
		return nil, fmt.Errorf("update tool: %w", err)
	}
	return tool, nil
}

func (s *ToolService) Delete(ctx context.Context, tenantID, id string) error {
	return s.toolRepo.Delete(ctx, tenantID, id)
}

func (s *ToolService) GetCategories(ctx context.Context, tenantID string) ([]models.ToolCategory, error) {
	return s.toolRepo.GetCategories(ctx, tenantID)
}

func (s *ToolService) Search(ctx context.Context, tenantID, query string) ([]models.Tool, error) {
	return s.toolRepo.Search(ctx, tenantID, query, 20)
}

func (s *ToolService) GetVersions(ctx context.Context, toolID string) ([]models.ToolVersion, error) {
	return s.versionRepo.ListByTool(ctx, toolID)
}

func (s *ToolService) GetInvocations(ctx context.Context, tenantID, toolID string, limit, offset int) ([]models.ToolInvocation, error) {
	return s.invRepo.ListByTool(ctx, tenantID, toolID, limit, offset)
}

func jsonOrDefault(val, def string) string {
	if val == "" {
		return def
	}
	return val
}
