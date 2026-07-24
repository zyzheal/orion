package service
//go:generate mockgen -destination=mock_service.go -package=service . ServiceInterface
//go:generate mockgen -destination=mock_repository.go -package=service . RepositoryInterface

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"orion/platform-svc-go/internal/sso-providers/models"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	Create(ctx context.Context, provider *models.SSOProvider) error
	Delete(ctx context.Context, tenantID, id string) (bool, error)
	GetByID(ctx context.Context, tenantID, id string) (*models.SSOProvider, error)
	List(ctx context.Context, tenantID string, filter *models.SSOProviderFilter) ([]models.SSOProvider, int, error)
	Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.SSOProvider, error)
}

type Service struct {
	repo RepositoryInterface
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

func (s *Service) Create(ctx context.Context, tenantID string, req *models.CreateSSOProviderRequest) (*models.SSOProvider, error) {
	provider := &models.SSOProvider{
		TenantID: tenantID,
		Name:     req.Name,
		Type:     req.Type,
		Enabled:  req.Enabled,
		Config:   req.Config,
	}
	if err := s.repo.Create(ctx, provider); err != nil {
		return nil, err
	}
	return provider, nil
}

func (s *Service) GetByID(ctx context.Context, tenantID, id string) (*models.SSOProvider, error) {
	return s.repo.GetByID(ctx, tenantID, id)
}

func (s *Service) List(ctx context.Context, tenantID string, filter *models.SSOProviderFilter) ([]models.SSOProvider, int, error) {
	return s.repo.List(ctx, tenantID, filter)
}

func (s *Service) Update(ctx context.Context, tenantID, id string, req *models.UpdateSSOProviderRequest) (*models.SSOProvider, error) {
	updates := make(map[string]interface{})
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.Type != nil {
		updates["type"] = *req.Type
	}
	if req.Enabled != nil {
		updates["enabled"] = *req.Enabled
	}
	if req.Config != nil {
		updates["config"] = req.Config
	}
	return s.repo.Update(ctx, tenantID, id, updates)
}

func (s *Service) Delete(ctx context.Context, tenantID, id string) (bool, error) {
	return s.repo.Delete(ctx, tenantID, id)
}

func (s *Service) TestConnection(ctx context.Context, tenantID, id string) (bool, string, error) {
	provider, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return false, "", err
	}
	config := provider.Config
	if config == nil {
		return false, "provider has no configuration", nil
	}
	switch strings.ToLower(provider.Type) {
	case "oidc", "oauth":
		return testOIDCConnection(ctx, config)
	case "ldap":
		return testLDAPConnection(config)
	default:
		return testGenericConnection(config)
	}
}

// ---------- Connection test helpers ----------

func testOIDCConnection(ctx context.Context, config map[string]string) (bool, string, error) {
	issuerURL, ok := config["issuer_url"]
	if !ok {
		issuerURL = config["issuerUrl"]
	}
	if issuerURL == "" {
		return false, "missing issuer_url in OIDC/OAuth configuration", nil
	}
	issuerURL = strings.TrimRight(issuerURL, "/")
	if _, err := url.ParseRequestURI(issuerURL); err != nil {
		return false, fmt.Sprintf("issuer_url is not a valid URL: %v", err), nil
	}
	discoveryURL := issuerURL + "/.well-known/openid-configuration"
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodGet, discoveryURL, nil)
	if err != nil {
		return false, fmt.Sprintf("failed to create request: %v", err), nil
	}
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(httpReq)
	if err != nil {
		return false, fmt.Sprintf("failed to reach issuer: %v", err), nil
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return false, fmt.Sprintf("issuer responded with HTTP %d", resp.StatusCode), nil
	}
	return true, "OIDC/OAuth issuer reachable", nil
}

func testLDAPConnection(config map[string]string) (bool, string, error) {
	missing := []string{}
	required := []string{"server", "port", "base_dn"}
	for _, key := range required {
		if config[key] == "" {
			missing = append(missing, key)
		}
	}
	if len(missing) > 0 {
		return false, fmt.Sprintf("LDAP requires config keys: %s (missing: %s)",
			strings.Join(required, ", "), strings.Join(missing, ", ")), nil
	}
	// Optional test bind when credentials are present.
	if config["bind_dn"] != "" && config["bind_password"] != "" {
		return true, "LDAP configuration valid; bind credentials supplied (bind not attempted)", nil
	}
	return true, "LDAP configuration valid", nil
}

func testGenericConnection(config map[string]string) (bool, string, error) {
	missing := []string{}
	required := []string{"server", "port", "type"}
	for _, key := range required {
		if config[key] == "" {
			missing = append(missing, key)
		}
	}
	if len(missing) > 0 {
		return false, fmt.Sprintf("provider requires config keys: %s (missing: %s)",
			strings.Join(required, ", "), strings.Join(missing, ", ")), nil
	}
	return true, "generic provider configuration valid", nil
}
