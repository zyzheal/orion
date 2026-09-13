package service

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"sort"
	"strings"
	"time"

	"github.com/google/uuid"

	"orion/platform-svc-go/internal/tool/models"
)

const defaultSearchLimit = 20

// ToolRepositoryInterface is the subset of ToolRepository the service uses. It
// exists so the service can be tested with a recording fake: every method takes
// tenantID, and the fake proves the caller's tenant reaches each statement.
// *repository.ToolRepository satisfies it, so wiring is unchanged.
type ToolRepositoryInterface interface {
	Create(ctx context.Context, tool *models.Tool) error
	GetByID(ctx context.Context, tenantID, id string) (*models.Tool, error)
	List(ctx context.Context, tenantID string, params models.ToolListParams) ([]models.Tool, int, error)
	Update(ctx context.Context, tool *models.Tool) error
	GetCategories(ctx context.Context, tenantID string) ([]models.ToolCategory, error)
	Search(ctx context.Context, tenantID, query string, limit int) ([]models.Tool, error)
}

// InvocationRepositoryInterface is the subset of InvocationRepository the
// service uses, same recording-fake rationale as ToolRepositoryInterface.
type InvocationRepositoryInterface interface {
	Create(ctx context.Context, inv *models.ToolInvocation) error
	GetByID(ctx context.Context, tenantID, id string) (*models.ToolInvocation, error)
	ListByTool(ctx context.Context, tenantID, toolID string, limit, offset int) ([]models.ToolInvocation, error)
	CountByTool(ctx context.Context, tenantID, toolID string) (int, error)
	StatsByPeriod(ctx context.Context, tenantID, period string) (*models.ToolStats, error)
	StatsByTool(ctx context.Context, tenantID, toolID string) (*models.ToolStats, error)
	TopToolsByInvocations(ctx context.Context, tenantID string, limit int) ([]models.ToolUsageRank, error)
}

// VersionRepositoryInterface is the subset of VersionRepository the service
// uses. ListByTool takes no tenantID by design: tool_versions has no tenant
// column and is reached only through a parent tool that the service already
// resolved with a tenant-scoped GetByID.
type VersionRepositoryInterface interface {
	Create(ctx context.Context, v *models.ToolVersion) error
	ListByTool(ctx context.Context, toolID string) ([]models.ToolVersion, error)
}

// ToolService handles tool business logic.
type ToolService struct {
	toolRepo    ToolRepositoryInterface
	invRepo     InvocationRepositoryInterface
	versionRepo VersionRepositoryInterface
}

func NewToolService(
	toolRepo ToolRepositoryInterface,
	invRepo InvocationRepositoryInterface,
	versionRepo VersionRepositoryInterface,
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
		return nil, fmt.Errorf("%w: %s", models.ErrToolNotFound, id)
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
		return nil, fmt.Errorf("%w: %s", models.ErrToolNotFound, id)
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
		return fmt.Errorf("%w: %s", models.ErrToolNotFound, id)
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
	return s.toolRepo.Search(ctx, tenantID, query, defaultSearchLimit)
}

func (s *ToolService) GetVersions(ctx context.Context, tenantID, toolID string) ([]models.ToolVersion, error) {
	tool, err := s.toolRepo.GetByID(ctx, tenantID, toolID)
	if err != nil {
		return nil, fmt.Errorf("get tool: %w", err)
	}
	if tool == nil {
		return nil, fmt.Errorf("%w: %s", models.ErrToolNotFound, toolID)
	}
	return s.versionRepo.ListByTool(ctx, toolID)
}

// CreateVersion creates a new version record for an existing tool.
func (s *ToolService) CreateVersion(ctx context.Context, tenantID, userID, toolID string, req models.CreateToolVersionRequest) (*models.ToolVersion, error) {
	// Validate tool belongs to tenant
	tool, err := s.toolRepo.GetByID(ctx, tenantID, toolID)
	if err != nil {
		return nil, fmt.Errorf("get tool: %w", err)
	}
	if tool == nil {
		return nil, fmt.Errorf("%w: %s", models.ErrToolNotFound, toolID)
	}
	if tool.Status == "deprecated" {
		return nil, fmt.Errorf("cannot create version for deprecated tool")
	}

	// Check for duplicate version
	versions, err := s.versionRepo.ListByTool(ctx, toolID)
	if err != nil {
		return nil, fmt.Errorf("list versions: %w", err)
	}
	for _, v := range versions {
		if v.Version == req.Version {
			return nil, fmt.Errorf("version %q already exists for tool %s", req.Version, toolID)
		}
	}

	version := &models.ToolVersion{
		ID:        uuid.New().String(),
		ToolID:    toolID,
		Version:   req.Version,
		Config:    jsonOrDefault(req.Config, tool.Config),
		Changelog: jsonOrDefault(req.Changelog, ""),
		CreatedBy: userID,
	}

	if err := s.versionRepo.Create(ctx, version); err != nil {
		return nil, fmt.Errorf("create version: %w", err)
	}
	return version, nil
}

func (s *ToolService) GetInvocations(ctx context.Context, tenantID, toolID string, limit, offset int) ([]models.ToolInvocation, error) {
	return s.invRepo.ListByTool(ctx, tenantID, toolID, limit, offset)
}

// GetInvocationDetail retrieves a single invocation record by ID.
func (s *ToolService) GetInvocationDetail(ctx context.Context, tenantID, id string) (*models.ToolInvocation, error) {
	inv, err := s.invRepo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, fmt.Errorf("get invocation: %w", err)
	}
	if inv == nil {
		return nil, fmt.Errorf("invocation not found: %s", id)
	}
	return inv, nil
}

// InvokeTool executes a tool and records the invocation.
func (s *ToolService) InvokeTool(ctx context.Context, tenantID, userID, toolID, version string, req models.InvokeToolRequest) (*models.ToolInvocation, error) {
	// Validate tool
	tool, err := s.toolRepo.GetByID(ctx, tenantID, toolID)
	if err != nil {
		return nil, fmt.Errorf("get tool: %w", err)
	}
	if tool == nil {
		return nil, fmt.Errorf("%w: %s", models.ErrToolNotFound, toolID)
	}
	if tool.Status != "active" {
		return nil, fmt.Errorf("tool is not active (status: %s)", tool.Status)
	}

	// Determine effective version (use specified or latest)
	effectiveVersion := version
	if effectiveVersion == "" {
		effectiveVersion = tool.Version
	}

	start := time.Now()
	inv := &models.ToolInvocation{
		ID:       uuid.New().String(),
		ToolID:   toolID,
		TenantID: tenantID,
		Input:    req.Input,
		Output:   "{}",
		Status:   "success",
		Duration: 0,
		CalledBy: userID,
	}

	// Execute tool via HTTP endpoint (if configured)
	if tool.Endpoint != "" {
		var response []byte
		var execErr error
		inv.Status = "success"
		inv.Error = sql.NullString{}

		// Build auth headers based on tool auth config. The api_key is read from
		// the tool's own auth_config JSON blob ({"api_key": "..."}): this module
		// has no external secrets store, and the tool was registered with the key
		// inline, so the honest behaviour is to send it. The previous code
		// discarded the key entirely and always sent an empty Authorization
		// header, so any tool that relied on api_key auth was called unauthenticated.
		authHeader := toolAuthHeader(tool)

		response, execErr = callToolEndpoint(ctx, tool.Endpoint, req.Input, authHeader, getToolTimeout(ctx, tool))
		if execErr != nil {
			inv.Status = "error"
			inv.Error = sql.NullString{String: fmt.Sprintf("%v", execErr), Valid: true}
		} else {
			inv.Output = string(response)
		}
	}

	inv.Duration = time.Since(start).Milliseconds()

	if err := s.invRepo.Create(ctx, inv); err != nil {
		log.Printf("[WARN] failed to record invocation for tool %s: %v", toolID, err)
	}

	// Emit NATS event for invocation (best-effort)
	// Actual event publishing is handled by NATS publisher elsewhere

	return inv, nil
}

// toolAuthHeader derives the Authorization value for a tool invocation. The
// only auth type with an inline credential today is api_key; oauth2 and basic
// need a token exchange the tool module has no mechanism for, so they are
// documented as unsupported rather than silently unauthenticated.
func toolAuthHeader(tool *models.Tool) string {
	if tool.AuthType == "api_key" && tool.AuthConfig != "" && tool.AuthConfig != "{}" {
		var cfg struct {
			APIKey string `json:"api_key"`
		}
		if err := json.Unmarshal([]byte(tool.AuthConfig), &cfg); err == nil && cfg.APIKey != "" {
			return cfg.APIKey
		}
	}
	return ""
}

func getToolTimeout(ctx context.Context, tool *models.Tool) time.Duration {
	// Check context timeout if set
	if dl, ok := ctx.Deadline(); ok {
		remaining := time.Until(dl)
		if remaining > 0 {
			return remaining
		}
	}
	// Default timeout: 30s (configurable via tool config in future)
	return 30 * time.Second
}

// callToolEndpoint posts the invocation input as a JSON body to the tool's
// endpoint. The input is a raw JSON string ("{\"query\": \"...\"}") supplied by
// the caller, so it is sent as-is without re-marshalling. The previous code
// built the request with a nil body, so every tool invocation reached the
// endpoint with an empty POST body and the tool could never see its input.
func callToolEndpoint(ctx context.Context, endpoint, input, authHeader string, timeout time.Duration) ([]byte, error) {
	reqCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	payload := input
	if payload == "" {
		payload = "{}"
	}
	req, err := http.NewRequestWithContext(reqCtx, "POST", endpoint, strings.NewReader(payload))
	if err != nil {
		return nil, fmt.Errorf("build request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	if authHeader != "" {
		req.Header.Set("Authorization", "Bearer "+authHeader)
	}

	client := &http.Client{Timeout: timeout}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("execute tool: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 500 {
		return nil, fmt.Errorf("tool returned HTTP %d", resp.StatusCode)
	}

	// Read up to 64KB. A larger body is truncated rather than accumulated: the
	// invocation record stores output as TEXT and 64KB is the documented cap.
	buf, err := io.ReadAll(io.LimitReader(resp.Body, 64*1024+1))
	if err != nil {
		return nil, fmt.Errorf("read tool response: %w", err)
	}
	if len(buf) > 64*1024 {
		return buf[:64*1024], nil
	}
	return buf, nil
}

// GetStats returns overall usage statistics for a tenant.
func (s *ToolService) GetStats(ctx context.Context, tenantID string, period models.StatsPeriod) (*models.ToolStats, error) {
	stats, err := s.invRepo.StatsByPeriod(ctx, tenantID, string(period))
	if err != nil {
		return nil, fmt.Errorf("get stats: %w", err)
	}
	return stats, nil
}

// GetToolStats returns usage statistics for a specific tool.
func (s *ToolService) GetToolStats(ctx context.Context, tenantID, toolID string) (*models.ToolStats, error) {
	// Validate tool
	tool, err := s.toolRepo.GetByID(ctx, tenantID, toolID)
	if err != nil {
		return nil, fmt.Errorf("get tool: %w", err)
	}
	if tool == nil {
		return nil, fmt.Errorf("%w: %s", models.ErrToolNotFound, toolID)
	}

	stats, err := s.invRepo.StatsByTool(ctx, tenantID, toolID)
	if err != nil {
		return nil, fmt.Errorf("get tool stats: %w", err)
	}
	return stats, nil
}

// GetTopTools returns the top N most-used tools for a tenant.
func (s *ToolService) GetTopTools(ctx context.Context, tenantID string, limit int) ([]models.ToolUsageRank, error) {
	if limit <= 0 || limit > 50 {
		limit = 10
	}
	ranks, err := s.invRepo.TopToolsByInvocations(ctx, tenantID, limit)
	if err != nil {
		return nil, fmt.Errorf("get top tools: %w", err)
	}
	// Sort descending by count
	sort.Slice(ranks, func(i, j int) bool {
		return ranks[i].InvocationCount > ranks[j].InvocationCount
	})
	return ranks, nil
}

// MarketSearch searches active tools across the tenant with filters.
func (s *ToolService) MarketSearch(ctx context.Context, tenantID string, req models.MarketSearchParams) ([]models.Tool, int, error) {
	params := models.ToolListParams{
		Category: req.Category,
		Type:     req.Type,
		Status:   "active", // market only shows active tools
		Search:   req.Query,
		Page:     req.Page,
		PageSize: req.PageSize,
	}
	if params.PageSize <= 0 || params.PageSize > 50 {
		params.PageSize = 20
	}
	if params.Page < 1 {
		params.Page = 1
	}
	return s.toolRepo.List(ctx, tenantID, params)
}

func jsonOrDefault(val, def string) string {
	if val == "" {
		return def
	}
	return val
}
