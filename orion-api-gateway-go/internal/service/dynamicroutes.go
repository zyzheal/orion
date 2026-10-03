package service

import (
	"context"
	"fmt"
	"net/http"
	"sort"
	"sync"
	"time"

	"go.uber.org/zap"
)

// RouteStatus represents the lifecycle state of a dynamic route.
type RouteStatus string

const (
	RouteActive      RouteStatus = "active"
	RouteInactive    RouteStatus = "inactive"
	RouteMaintenance RouteStatus = "maintenance"
)

// TokenExchangeConfig holds token exchange settings for a route.
type TokenExchangeConfig struct {
	ServiceType       string
	TargetURL         string
	PandawikiAccount  string
	PandawikiPassword string
}

// DynamicRouteConfig defines a dynamically registered route.
type DynamicRouteConfig struct {
	ID            string
	ServiceName   string
	Prefix        string
	Target        string
	Timeout       time.Duration
	StripPrefix   bool
	TokenExchange *TokenExchangeConfig
	Description   string
	Status        RouteStatus
	RegisteredAt  time.Time
	UpdatedAt     time.Time
	Metadata      map[string]interface{}
}

// ServiceRouteMapping maps a service name to its API path prefixes.
type ServiceRouteMapping struct {
	ServiceName   string
	APIPaths      []string
	TokenExchange *TokenExchangeConfig
}

// ListRoutesOptions filters for listing routes.
type ListRoutesOptions struct {
	ServiceName string
	Status      RouteStatus
	Prefix      string
}

// DefaultServiceRouteMappings returns the default service-to-prefix mapping table.
func DefaultServiceRouteMappings() []ServiceRouteMapping {
	return []ServiceRouteMapping{
		{ServiceName: "platform", APIPaths: []string{"/api/v1/platform"}},
		{ServiceName: "pipeline", APIPaths: []string{"/api/v1/pipelines", "/api/v1/pipeline", "/api/v1/pipeline-templates", "/api/v1/pipeline-versions", "/api/v1/pipeline-budget"}},
		{ServiceName: "deploy", APIPaths: []string{"/api/v1/deploy", "/api/v1/deployments"}},
		{ServiceName: "ticket", APIPaths: []string{"/api/v1/tickets", "/api/v1/ticket"}},
		{ServiceName: "monitor", APIPaths: []string{"/api/v1/monitoring", "/api/v1/alert", "/api/v1/alerts", "/api/v1/metrics"}},
		{ServiceName: "intelligence", APIPaths: []string{"/api/v1/ai-gateway", "/api/v1/ai-decision", "/api/v1/ai-review", "/api/v1/ai-security", "/api/v1/change-intelligence", "/api/v1/intelligence"}},
		{ServiceName: "agent", APIPaths: []string{"/api/v1/agents", "/api/v1/agent"}},
		{ServiceName: "digital-twin", APIPaths: []string{"/api/v1/digital-twin"}},
		{ServiceName: "finops", APIPaths: []string{"/api/v1/cost", "/api/v1/finops", "/api/v1/cost-operations"}},
		{ServiceName: "code", APIPaths: []string{"/api/v1/code-repo", "/api/v1/code", "/api/v1/build", "/api/v1/test-reports"}},
		{ServiceName: "plugin", APIPaths: []string{"/api/v1/plugins-spi", "/api/v1/plugins", "/api/v1/plugin", "/api/v1/plugins-enhanced", "/api/v1/plugins/marketplace"}},
		{ServiceName: "ai", APIPaths: []string{"/api/v1/ai", "/api/v1/ai-models", "/api/v1/ai-model", "/api/v1/vector-store", "/api/v1/vector", "/api/v1/llm", "/api/v1/degradation"}},
		{ServiceName: "security", APIPaths: []string{"/api/v1/security", "/api/v1/risk", "/api/v1/sbom", "/api/v1/supply-chain", "/api/v1/policies", "/api/v1/quality-gates"}},
		{ServiceName: "artifact", APIPaths: []string{"/api/v1/artifacts", "/api/v1/artifact", "/api/v1/artifact-ops", "/api/v1/artifact-versions"}},
		{ServiceName: "efficiency", APIPaths: []string{"/api/v1/efficiency"}},
		{ServiceName: "dr", APIPaths: []string{"/api/v1/backup", "/api/v1/disaster-recovery", "/api/v1/dr"}},
		{ServiceName: "federation", APIPaths: []string{"/api/v1/federation", "/api/v1/federation-advanced", "/api/v1/multi-cloud", "/api/v1/multi-cloud-advanced"}},
		{ServiceName: "approval", APIPaths: []string{"/api/v1/approval", "/api/v1/approvals"}},
		{ServiceName: "notify", APIPaths: []string{"/api/v1/notify", "/api/v1/notification", "/api/v1/notifications", "/api/v1/webhook", "/api/v1/webhooks"}},
		{ServiceName: "knowledge", APIPaths: []string{"/api/v1/knowledge_base", "/api/v1/knowledge", "/api/v1/nav", "/api/v1/node", "/api/v1/user", "/api/v1/model", "/api/v1/stat", "/api/v1/app", "/api/v1/file", "/api/v1/conversation", "/api/v1/comment", "/api/v1/crawler", "/api/v1/setting", "/api/v1/license", "/api/v1/share", "/api/v1/health", "/share", "/static-file"}},
		{ServiceName: "graph", APIPaths: []string{"/api/v1/graph"}},
		{ServiceName: "governance", APIPaths: []string{"/api/v1/governance", "/api/v1/compliance"}},
		{ServiceName: "skill", APIPaths: []string{"/api/v1/skills", "/api/v1/skill"}},
		{ServiceName: "selfhealing", APIPaths: []string{"/api/v1/selfhealing", "/api/v1/self-healing", "/api/v1/healing"}},
		{ServiceName: "risk", APIPaths: []string{"/api/v1/risks"}},
		{ServiceName: "audit", APIPaths: []string{"/api/v1/audit", "/api/v1/audits"}},
		{ServiceName: "chatops", APIPaths: []string{"/api/v1/chatops", "/api/v1/chat"}},
		{ServiceName: "runner", APIPaths: []string{"/api/v1/runner", "/api/v1/runners", "/api/v1/jobs"}},
		{ServiceName: "config-mgmt", APIPaths: []string{"/api/v1/config", "/api/v1/configuration", "/api/v1/config-mgmt", "/api/v1/environment", "/api/v1/environments"}},
		{ServiceName: "cmdb", APIPaths: []string{"/api/v1/cmdb", "/api/v1/assets"}},
		{ServiceName: "inception", APIPaths: []string{"/api/v1/inception"}},
		{ServiceName: "dba", APIPaths: []string{"/api/v1/dba", "/api/v1/database", "/api/v1/databases"}},
		{ServiceName: "community", APIPaths: []string{"/api/v1/community"}},
		{ServiceName: "visor", APIPaths: []string{"/api/v1/visor", "/api/v1/visualization"}},
	}
}

// ServiceInfoLite is a lightweight service descriptor for discovery.
type ServiceInfoLite struct {
	Name     string
	URL      string
	Metadata map[string]interface{}
}

// GatewayDynamicRoutes manages runtime route registration and discovery.
type GatewayDynamicRoutes struct {
	mu             sync.RWMutex
	routes         map[string]*DynamicRouteConfig
	mappings       []ServiceRouteMapping
	logger         *zap.Logger
	httpClient     *http.Client
	stopHealth     chan struct{}
	stopHealthOnce sync.Once
}

// NewGatewayDynamicRoutes creates a new dynamic route manager.
func NewGatewayDynamicRoutes(logger *zap.Logger) *GatewayDynamicRoutes {
	return &GatewayDynamicRoutes{
		routes:     make(map[string]*DynamicRouteConfig),
		mappings:   DefaultServiceRouteMappings(),
		logger:     logger,
		httpClient: &http.Client{Timeout: 5 * time.Second},
		stopHealth: make(chan struct{}),
	}
}

// RegisterRoute registers a single route. Returns true if newly registered.
func (g *GatewayDynamicRoutes) RegisterRoute(cfg *DynamicRouteConfig) bool {
	g.mu.Lock()
	defer g.mu.Unlock()

	existing, ok := g.routes[cfg.ID]
	if ok && existing.Status != RouteInactive {
		return false
	}

	now := time.Now()
	cfg.UpdatedAt = now
	if existing != nil {
		cfg.RegisteredAt = existing.RegisteredAt
	} else {
		cfg.RegisteredAt = now
	}
	if cfg.Status == "" {
		cfg.Status = RouteActive
	}
	if cfg.Timeout == 0 {
		cfg.Timeout = 30 * time.Second
	}
	g.routes[cfg.ID] = cfg
	return true
}

// UnregisterRoute marks a route as inactive.
func (g *GatewayDynamicRoutes) UnregisterRoute(routeID string) bool {
	g.mu.Lock()
	defer g.mu.Unlock()
	r, ok := g.routes[routeID]
	if !ok {
		return false
	}
	r.Status = RouteInactive
	r.UpdatedAt = time.Now()
	return true
}

// UpdateRoute updates a route's configuration.
func (g *GatewayDynamicRoutes) UpdateRoute(routeID string, updates map[string]interface{}) (*DynamicRouteConfig, bool) {
	g.mu.Lock()
	defer g.mu.Unlock()
	r, ok := g.routes[routeID]
	if !ok {
		return nil, false
	}

	if target, ok := updates["target"].(string); ok && target != r.Target {
		g.logger.Warn("route target changed; restart required for change to take effect",
			zap.String("routeId", routeID),
			zap.String("old", r.Target),
			zap.String("new", target),
		)
		r.Target = target
	}
	if status, ok := updates["status"].(RouteStatus); ok {
		r.Status = status
	}
	if desc, ok := updates["description"].(string); ok {
		r.Description = desc
	}
	r.UpdatedAt = time.Now()
	return r, true
}

// GetRoute returns a single route by ID.
func (g *GatewayDynamicRoutes) GetRoute(routeID string) (*DynamicRouteConfig, bool) {
	g.mu.RLock()
	defer g.mu.RUnlock()
	r, ok := g.routes[routeID]
	if !ok {
		return nil, false
	}
	copy := *r
	return &copy, true
}

// ListRoutes returns routes filtered by the given options.
func (g *GatewayDynamicRoutes) ListRoutes(opts ListRoutesOptions) []*DynamicRouteConfig {
	g.mu.RLock()
	result := make([]*DynamicRouteConfig, 0, len(g.routes))
	for _, r := range g.routes {
		if opts.ServiceName != "" && r.ServiceName != opts.ServiceName {
			continue
		}
		if opts.Status != "" && r.Status != opts.Status {
			continue
		}
		if opts.Prefix != "" && r.Prefix != opts.Prefix {
			continue
		}
		copy := *r
		result = append(result, &copy)
	}
	g.mu.RUnlock()

	sort.Slice(result, func(i, j int) bool {
		return result[i].UpdatedAt.After(result[j].UpdatedAt)
	})
	return result
}

// GetActiveRouteCount returns the number of active routes.
func (g *GatewayDynamicRoutes) GetActiveRouteCount() int {
	g.mu.RLock()
	defer g.mu.RUnlock()
	count := 0
	for _, r := range g.routes {
		if r.Status == RouteActive {
			count++
		}
	}
	return count
}

// DiscoverFromServiceRegistry discovers routes from a list of registered services.
func (g *GatewayDynamicRoutes) DiscoverFromServiceRegistry(services []ServiceInfoLite, serviceURLMap map[string]string) int {
	discovered := 0
	for _, svc := range services {
		apiPathsRaw, ok := svc.Metadata["api_paths"]
		if !ok {
			continue
		}
		apiPaths, ok := apiPathsRaw.([]string)
		if !ok || len(apiPaths) == 0 {
			continue
		}

		target := serviceURLMap[svc.Name]
		if target == "" {
			target = svc.URL
		}
		if target == "" {
			continue
		}

		for _, prefix := range apiPaths {
			routeID := fmt.Sprintf("%s:%s", svc.Name, prefix)
			if g.RegisterRoute(&DynamicRouteConfig{
				ID:          routeID,
				ServiceName: svc.Name,
				Prefix:      prefix,
				Target:      target,
				Status:      RouteActive,
				Description: fmt.Sprintf("Auto-discovered from service registry: %s", svc.Name),
				Metadata:    map[string]interface{}{"source": "service-registry"},
			}) {
				discovered++
			}
		}
	}

	if discovered > 0 {
		g.logger.Info("discovered routes from service registry", zap.Int("count", discovered))
	}
	return discovered
}

// SyncWithServiceRegistry syncs routes based on service registry + static mapping.
func (g *GatewayDynamicRoutes) SyncWithServiceRegistry(services []ServiceInfoLite, serviceURLMap map[string]string) int {
	synced := 0
	for _, svc := range services {
		var mapping *ServiceRouteMapping
		for i := range g.mappings {
			if g.mappings[i].ServiceName == svc.Name {
				mapping = &g.mappings[i]
				break
			}
		}
		if mapping == nil {
			continue
		}

		target := serviceURLMap[svc.Name]
		if target == "" {
			target = svc.URL
		}
		if target == "" {
			continue
		}

		// Prefer api_paths from metadata
		apiPaths := mapping.APIPaths
		if pathsRaw, ok := svc.Metadata["api_paths"]; ok {
			if paths, ok := pathsRaw.([]string); ok && len(paths) > 0 {
				apiPaths = paths
			}
		}

		status := RouteActive
		if s, ok := svc.Metadata["status"].(string); ok && s != "healthy" {
			status = RouteInactive
		}

		for _, prefix := range apiPaths {
			routeID := fmt.Sprintf("%s:%s", svc.Name, prefix)
			cfg := &DynamicRouteConfig{
				ID:          routeID,
				ServiceName: svc.Name,
				Prefix:      prefix,
				Target:      target,
				Status:      status,
				Description: fmt.Sprintf("Synced from service registry: %s", svc.Name),
				Metadata:    map[string]interface{}{"source": "service-registry"},
			}
			if mapping.TokenExchange != nil {
				cfg.TokenExchange = mapping.TokenExchange
			}
			if g.RegisterRoute(cfg) {
				synced++
			}
		}
	}

	if synced > 0 {
		g.logger.Info("synced routes from service registry", zap.Int("count", synced))
	}
	return synced
}

// StartHealthCheckIntegration starts periodic health checks for active routes.
func (g *GatewayDynamicRoutes) StartHealthCheckIntegration(interval time.Duration) {
	g.logger.Info("starting health check integration", zap.Duration("interval", interval))

	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()

		g.checkAllRoutesHealth()

		for {
			select {
			case <-ticker.C:
				g.checkAllRoutesHealth()
			case <-g.stopHealth:
				return
			}
		}
	}()
}

// StopHealthCheckIntegration stops the health check loop.
func (g *GatewayDynamicRoutes) StopHealthCheckIntegration() {
	g.stopHealthOnce.Do(func() {
		close(g.stopHealth)
	})
	g.logger.Info("health check integration stopped")
}

func (g *GatewayDynamicRoutes) checkAllRoutesHealth() {
	g.mu.RLock()
	activeTargets := make(map[string]bool) // target -> healthy?
	for _, r := range g.routes {
		if r.Status == RouteActive {
			activeTargets[r.Target] = false
		}
	}
	g.mu.RUnlock()

	var mu sync.Mutex
	var wg sync.WaitGroup
	targets := make([]string, 0, len(activeTargets))
	for target := range activeTargets {
		targets = append(targets, target)
	}
	for _, target := range targets {
		wg.Add(1)
		go func(t string) {
			defer wg.Done()
			healthy := g.checkServiceHealth(t)
			mu.Lock()
			activeTargets[t] = healthy
			mu.Unlock()
		}(target)
	}
	wg.Wait()

	g.mu.Lock()
	for _, r := range g.routes {
		healthy := activeTargets[r.Target]
		if !healthy && r.Status == RouteActive {
			r.Status = RouteInactive
			r.UpdatedAt = time.Now()
			g.logger.Warn("route marked inactive (unhealthy backend)",
				zap.String("routeId", r.ID),
				zap.String("target", r.Target),
			)
		} else if healthy && r.Status == RouteInactive {
			r.Status = RouteActive
			r.UpdatedAt = time.Now()
			g.logger.Info("route reactivated (backend healthy)",
				zap.String("routeId", r.ID),
			)
		}
	}
	g.mu.Unlock()
}

func (g *GatewayDynamicRoutes) checkServiceHealth(targetURL string) bool {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, "GET", targetURL+"/healthz", nil)
	if err != nil {
		return false
	}

	resp, err := g.httpClient.Do(req)
	if err != nil {
		return false
	}
	resp.Body.Close()
	return resp.StatusCode < 400
}

// Shutdown stops all background tasks.
func (g *GatewayDynamicRoutes) Shutdown() {
	g.StopHealthCheckIntegration()
	g.mu.Lock()
	g.routes = make(map[string]*DynamicRouteConfig)
	g.mu.Unlock()
	g.logger.Info("dynamic routes shutdown complete")
}
