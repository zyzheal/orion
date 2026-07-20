package service

import (
	"context"
	"encoding/json"
	"net/url"

	"orion/platform-svc-go/internal/gateway-dynamic/models"
	"orion/platform-svc-go/internal/gateway-dynamic/repository"
	"orion/go-common/pkg/sentinel"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	Create(ctx context.Context, m *models.GatewayRoute) error
	Delete(ctx context.Context, tenantID, id string) error
	Exists(ctx context.Context, tenantID, id string) (bool, error)
	GetByID(ctx context.Context, tenantID, id string) (*models.GatewayRoute, error)
	GetStats(ctx context.Context, tenantID string) (*models.RouteStats, error)
	List(ctx context.Context, tenantID string, limit, offset int) ([]models.GatewayRoute, error)
	ListWithFilter(ctx context.Context, tenantID string, enabled *bool, q string, limit, offset int) ([]models.GatewayRoute, int, error)
	Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) error
}

type Service struct {
	repo RepositoryInterface
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

// Create creates a new gateway route from the TS-shaped request.
func (s *Service) Create(ctx context.Context, tenantID string, req models.CreateGatewayRouteRequest) (*models.GatewayRoute, error) {
	methodsJSON, err := repository.MarshalStringSlice(req.Methods)
	if err != nil {
		return nil, err
	}
	if req.Methods == nil || len(req.Methods) == 0 {
		methodsJSON = `["GET"]`
	}

	// Determine upstreamUrl: prefer explicit TargetURL, otherwise construct from TargetService.
	upstreamURL := req.TargetURL
	if upstreamURL == "" && req.TargetService != "" {
		// Default: assume service name -> http://<targetService>
		upstreamURL = "http://" + req.TargetService
	}

	metadataJSON, err := json.Marshal(&models.RouteMetadata{
		Description:    req.Description,
		AuthRequired:   true, // default per TS: body.authRequired ?? true
		AllowedRoles:   req.AllowedRoles,
		AllowedTenants: req.AllowedTenants,
		RateLimit:      req.RateLimit,
		TimeoutMs:      req.TimeoutMs,
		RetryPolicy:    req.RetryPolicy,
	})
	if err != nil {
		return nil, err
	}

	m := &models.GatewayRoute{
		TenantID:    tenantID,
		Path:        req.Path,
		Methods:     methodsJSON,
		UpstreamURL: upstreamURL,
		Enabled:     req.Enabled, // default true per TS: body.enabled ?? true
		Metadata:    metadataJSON,
	}

	if err := s.repo.Create(ctx, m); err != nil {
		return nil, err
	}
	return m, nil
}

func (s *Service) Get(ctx context.Context, tenantID, id string) (*models.GatewayRoute, error) {
	return s.repo.GetByID(ctx, tenantID, id)
}

func (s *Service) List(ctx context.Context, tenantID string, limit, offset int) ([]models.GatewayRoute, error) {
	return s.repo.List(ctx, tenantID, limit, offset)
}

// ListWithFilter paginates with optional enabled and q filters, returning total count.
func (s *Service) ListWithFilter(ctx context.Context, tenantID string, enabled *bool, q string, limit, offset int) ([]models.GatewayRoute, int, error) {
	return s.repo.ListWithFilter(ctx, tenantID, enabled, q, limit, offset)
}

func (s *Service) Update(ctx context.Context, tenantID, id string, req models.UpdateGatewayRouteRequest) (*models.GatewayRoute, error) {
	// First verify the route exists.
	exists, err := s.repo.Exists(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	if !exists {
		return nil, sentinel.NotFound
	}

	// Build a map of fields to update. Only set fields that are non-nil.
	updates := make(map[string]interface{})

	if req.Path != nil {
		updates["path"] = *req.Path
	}
	if req.Methods != nil {
		methodsJSON, err := repository.MarshalStringSlice(req.Methods)
		if err != nil {
			return nil, err
		}
		updates["methods"] = methodsJSON
	}
	if req.TargetURL != nil {
		updates["upstream_url"] = *req.TargetURL
	}
	if req.Enabled != nil {
		updates["enabled"] = *req.Enabled
	}
	if req.Priority != nil {
		updates["priority"] = *req.Priority
	}

	// Merge metadata fields into existing metadata.
	existing, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	existingMeta := repository.ParseMetadata(existing.Metadata)

	// Override individual metadata fields when provided.
	if req.Description != nil {
		existingMeta.Description = *req.Description
	}
	if req.AuthRequired != nil {
		existingMeta.AuthRequired = *req.AuthRequired
	}
	if req.AllowedRoles != nil {
		existingMeta.AllowedRoles = req.AllowedRoles
	}
	if req.AllowedTenants != nil {
		existingMeta.AllowedTenants = req.AllowedTenants
	}
	if req.TimeoutMs != nil {
		existingMeta.TimeoutMs = *req.TimeoutMs
	}
	if req.RateLimit != nil {
		existingMeta.RateLimit = req.RateLimit
	}
	if req.RetryPolicy != nil {
		existingMeta.RetryPolicy = req.RetryPolicy
	}

	// Merge TargetService change -> reconstruct upstream_url if not explicitly given.
	if req.TargetService != nil && req.TargetURL == nil {
		newUpstream := "http://" + *req.TargetService
		if existingMeta.TimeoutMs == 0 && req.TimeoutMs == nil {
			// keep existing metadata
		}
		updates["upstream_url"] = newUpstream
	}

	metadataJSON, err := json.Marshal(existingMeta)
	if err != nil {
		return nil, err
	}
	updates["metadata"] = metadataJSON

	if err := s.repo.Update(ctx, tenantID, id, updates); err != nil {
		return nil, err
	}
	return s.repo.GetByID(ctx, tenantID, id)
}

// Toggle sets the enabled flag for a route.
func (s *Service) Toggle(ctx context.Context, tenantID, id string, enabled bool) (*models.GatewayRoute, error) {
	updates := map[string]interface{}{"enabled": enabled}
	if err := s.repo.Update(ctx, tenantID, id, updates); err != nil {
		return nil, err
	}
	return s.repo.GetByID(ctx, tenantID, id)
}

func (s *Service) Delete(ctx context.Context, tenantID, id string) error {
	return s.repo.Delete(ctx, tenantID, id)
}

// Stats returns aggregate route statistics for the tenant.
func (s *Service) Stats(ctx context.Context, tenantID string) (*models.RouteStats, error) {
	return s.repo.GetStats(ctx, tenantID)
}

// --------------------- response helpers ---------------------

// ExtractServiceName mirrors the TS helper: hostname from upstreamUrl, fallback to path prefix.
func ExtractServiceName(upstreamURL string) string {
	if upstreamURL == "" {
		return "unknown"
	}
	u, err := url.Parse(upstreamURL)
	if err != nil {
		for i, ch := range upstreamURL {
			if ch == '/' {
				return upstreamURL[:i]
			}
		}
		return "unknown"
	}
	if u.Hostname() == "" {
		return upstreamURL
	}
	return u.Hostname()
}

// ToRouteResponse converts a stored GatewayRoute to the response shape expected by the frontend,
// mirroring the TS "route" shape in the original handlers.
func ToRouteResponse(r *models.GatewayRoute) map[string]interface{} {
	methods, err := repository.UnmarshalStringSlice(r.Methods)
	if err != nil {
		methods = []string{"GET"}
	}
	meta := repository.ParseMetadata(r.Metadata)

	resp := map[string]interface{}{
		"id":              r.ID,
		"tenant_id":       r.TenantID,
		"path":            r.Path,
		"method":          methods[0],
		"methods":         methods,
		"target_service":  ExtractServiceName(r.UpstreamURL),
		"target_url":      r.UpstreamURL,
		"description":     meta.Description,
		"enabled":         r.Enabled,
		"auth_required":   meta.AuthRequired,
		"allowed_roles":   meta.AllowedRoles,
		"allowed_tenants": meta.AllowedTenants,
		"rate_limit":      meta.RateLimit,
		"timeout_ms":      meta.TimeoutMs,
		"retry_policy":    meta.RetryPolicy,
		"created_by":      r.CreatedBy,
		"updated_by":      r.UpdatedBy,
		"created_at":      r.CreatedAt.Format("2006-01-02T15:04:05.999Z"),
		"updated_at":      r.UpdatedAt.Format("2006-01-02T15:04:05.999Z"),
		"last_request_at": meta.LastRequestAt,
		"request_count":   meta.RequestCount,
		"error_rate":      meta.ErrorRate,
		"priority":        r.Priority,
	}
	return resp
}
