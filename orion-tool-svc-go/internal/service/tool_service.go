package service

import (
	"context"
	"fmt"
	"log"
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
	// Check for duplicate name within tenant
	existing, err := s.toolRepo.Search(ctx, tenantID, req.Name, 1)
	if err != nil {
		return nil, fmt.Errorf("check duplicate: %w", err)
	}
	for _, t := range existing {
		if t.Name == req.Name {
			return nil, fmt.Errorf("tool with name %q already exists", req.Name)
		}
	}

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
	if err := s.versionRepo.Create(ctx, &models.ToolVersion{
		ID:        uuid.New().String(),
		ToolID:    tool.ID,
		Version:   tool.Version,
		Config:    tool.Config,
		Changelog: "Initial version",
		CreatedBy: userID,
	}); err != nil {
		log.Printf("[WARN] failed to record initial version for tool %s: %v", tool.ID, err)
	}

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
		if err := s.versionRepo.Create(ctx, &models.ToolVersion{
			ID:      uuid.New().String(),
			ToolID:  tool.ID,
			Version: *req.Version,
			Config:  tool.Config,
		}); err != nil {
			log.Printf("[WARN] failed to record version change for tool %s: %v", tool.ID, err)
		}
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
	tool, err := s.toolRepo.GetByID(ctx, tenantID, id)
	if err != nil {
		return fmt.Errorf("get tool: %w", err)
	}
	if tool == nil {
		return fmt.Errorf("tool not found: %s", id)
	}
	now := time.Now()
	tool.Status = "deleted"
	tool.DeprecatedAt.Scan(now)
	return s.toolRepo.Update(ctx, tool)
}

func (s *ToolService) GetCategories(ctx context.Context, tenantID string) ([]models.ToolCategory, error) {
	return s.toolRepo.GetCategories(ctx, tenantID)
}

func (s *ToolService) Search(ctx context.Context, tenantID, query string) ([]models.Tool, error) {
	return s.toolRepo.Search(ctx, tenantID, query, 20)
}

func (s *ToolService) GetVersions(ctx context.Context, tenantID, toolID string) ([]models.ToolVersion, error) {
	tool, err := s.toolRepo.GetByID(ctx, tenantID, toolID)
	if err != nil {
		return nil, fmt.Errorf("get tool: %w", err)
	}
	if tool == nil {
		return nil, fmt.Errorf("tool not found: %s", toolID)
	}
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
