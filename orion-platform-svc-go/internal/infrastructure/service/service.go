package service

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/infrastructure/models"
	"orion/platform-svc-go/internal/infrastructure/repository"
)

type Service struct {
	repo *repository.Repository
}

func NewService(repo *repository.Repository) *Service {
	return &Service{repo: repo}
}

// --- Connector methods ---

// ListConnectors returns all connectors for the tenant.
func (s *Service) ListConnectors(ctx context.Context, tenantID string) ([]models.Connector, error) {
	return s.repo.ListConnectors(ctx, tenantID, 50, 0)
}

// GetConnector returns a connector by id.
func (s *Service) GetConnector(ctx context.Context, tenantID, id string) (*models.Connector, error) {
	return s.repo.GetConnector(ctx, tenantID, id)
}

// RegisterConnector registers a new connector.
func (s *Service) RegisterConnector(ctx context.Context, tenantID string, req models.RegisterConnectorRequest) (*models.Connector, error) {
	creds, _ := json.Marshal(req.Credentials)
	meta, _ := json.Marshal(req.Metadata)

	m := &models.Connector{
		TenantID:    tenantID,
		Type:        req.Type,
		Name:        req.Name,
		Endpoint:    req.Endpoint,
		Credentials: string(creds),
		TimeoutMs:   req.TimeoutMs,
		MaxRetries:  req.MaxRetries,
		Metadata:    string(meta),
	}
	if err := s.repo.CreateConnector(ctx, m); err != nil {
		return nil, err
	}
	return m, nil
}

// Connect transitions a connector to connected status.
func (s *Service) Connect(ctx context.Context, tenantID, id string) (*models.Connector, error) {
	c, err := s.repo.GetConnector(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	if err := s.repo.UpdateConnectorStatus(ctx, tenantID, id, models.ConnectorStatusConnected); err != nil {
		return nil, err
	}
	c.Status = models.ConnectorStatusConnected
	return c, nil
}

// Disconnect transitions a connector to disconnected status.
func (s *Service) Disconnect(ctx context.Context, tenantID, id string) error {
	_, err := s.repo.GetConnector(ctx, tenantID, id)
	if err != nil {
		return err
	}
	return s.repo.UpdateConnectorStatus(ctx, tenantID, id, models.ConnectorStatusDisconnected)
}

// Reconnect re-connects a connector.
func (s *Service) Reconnect(ctx context.Context, tenantID, id string) (*models.Connector, error) {
	return s.Connect(ctx, tenantID, id)
}

// UnregisterConnector removes a connector.
func (s *Service) UnregisterConnector(ctx context.Context, tenantID, id string) error {
	return s.repo.DeleteConnector(ctx, tenantID, id)
}

// GetHealthMetrics returns health metrics for a connector.
func (s *Service) GetHealthMetrics(ctx context.Context, tenantID, connectorID string) (*models.HealthMetrics, error) {
	return s.repo.GetHealthMetrics(ctx, tenantID, connectorID)
}

// ListAllHealthMetrics returns health metrics for all connectors.
func (s *Service) ListAllHealthMetrics(ctx context.Context, tenantID string) ([]models.HealthMetrics, error) {
	return s.repo.ListAllHealthMetrics(ctx, tenantID)
}

// --- Sandbox methods ---

// ListSandboxes returns all sandboxes for the tenant.
func (s *Service) ListSandboxes(ctx context.Context, tenantID string) ([]models.SandboxInfo, error) {
	return s.repo.ListSandboxes(ctx, tenantID, 50, 0)
}

// GetSandbox returns a sandbox by id.
func (s *Service) GetSandbox(ctx context.Context, tenantID, id string) (*models.SandboxInfo, error) {
	return s.repo.GetSandbox(ctx, tenantID, id)
}

// CreateSandbox creates a sandbox with isolation policy.
func (s *Service) CreateSandbox(ctx context.Context, tenantID string, req models.CreateSandboxRequest) (*models.SandboxInfo, error) {
	// Build network policy with deny-all ingress/egress
	labels := map[string]string{"app": req.Name, "isolation": "enforced"}
	for k, v := range req.Labels {
		labels[k] = v
	}
	annotations := map[string]string{"orion.io/isolation": "true"}
	for k, v := range req.Annotations {
		annotations[k] = v
	}

	labelsJSON, _ := json.Marshal(labels)
	annotationsJSON, _ := json.Marshal(annotations)
	ingressJSON, _ := json.Marshal([]map[string]any{
		{"name": "deny-all-ingress", "podSelector": map[string]any{}, "allow": false},
	})
	egressJSON, _ := json.Marshal([]map[string]any{
		{"name": "deny-all-egress", "podSelector": map[string]any{}, "allow": false},
	})

	policy := &models.SandboxNetworkPolicy{
		SandboxID:    req.Name,
		Name:         fmt.Sprintf("isolation-policy-%s", req.Name),
		Namespace:    req.Namespace,
		Labels:       string(labelsJSON),
		Annotations:  string(annotationsJSON),
		IngressRules: string(ingressJSON),
		EgressRules:  string(egressJSON),
	}
	if err := s.repo.CreateNetworkPolicy(ctx, tenantID, policy); err != nil {
		return nil, err
	}

	sb := &models.SandboxInfo{
		Name:             req.Name,
		Namespace:        req.Namespace,
		NetworkPolicyID:  policy.ID,
	}
	if err := s.repo.CreateSandbox(ctx, tenantID, sb); err != nil {
		return nil, err
	}
	sb.NetworkPolicyID = policy.ID
	return sb, nil
}

// IsolateSandbox isolates a sandbox.
func (s *Service) IsolateSandbox(ctx context.Context, tenantID, id string) (*models.SandboxInfo, error) {
	sb, err := s.repo.GetSandbox(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	if err := s.repo.UpdateSandboxStatus(ctx, tenantID, id, "isolated"); err != nil {
		return nil, err
	}
	sb.IsolationStatus = "isolated"
	return sb, nil
}

// ReleaseSandbox releases sandbox isolation.
func (s *Service) ReleaseSandbox(ctx context.Context, tenantID, id string) (*models.SandboxInfo, error) {
	sb, err := s.repo.GetSandbox(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	if err := s.repo.UpdateSandboxStatus(ctx, tenantID, id, "released"); err != nil {
		return nil, err
	}
	sb.IsolationStatus = "released"
	return sb, nil
}

// AllowTraffic allows traffic between environments.
func (s *Service) AllowTraffic(ctx context.Context, tenantID string, req models.AllowTrafficRequest) (*models.SandboxNetworkPolicy, error) {
	policies, _ := s.repo.ListNetworkPolicies(ctx, tenantID)
	var policy *models.SandboxNetworkPolicy
	for i := range policies {
		if policies[i].SandboxID == req.FromEnv {
			policy = &policies[i]
			break
		}
	}

	if policy == nil {
		portsJSON, _ := json.Marshal(req.Ports)
		policy = &models.SandboxNetworkPolicy{
			SandboxID: req.FromEnv,
			Name:      fmt.Sprintf("allow-%s-to-%s", req.FromEnv, req.ToEnv),
			Namespace: req.FromEnv,
			Labels:    string([]byte(`{"app":"` + req.FromEnv + `"}`)),
			Annotations: string([]byte(`{"orion.io/traffic-allow":"to-` + req.ToEnv + `"}`)),
			EgressRules: string([]byte(fmt.Sprintf(`[{"name":"allow-%s-to-%s","ports":%s,"allow":true,"namespaceSelector":{"namespace":"%s"}}]`, req.FromEnv, req.ToEnv, string(portsJSON), req.ToEnv))),
		}
		if err := s.repo.CreateNetworkPolicy(ctx, tenantID, policy); err != nil {
			return nil, err
		}
	}

	policy.UpdatedAt = time.Now().UTC()
	return policy, nil
}

// DenyTraffic denies traffic between environments.
func (s *Service) DenyTraffic(ctx context.Context, tenantID string, fromEnv, toEnv string) (*models.SandboxNetworkPolicy, error) {
	policies, _ := s.repo.ListNetworkPolicies(ctx, tenantID)
	var policy *models.SandboxNetworkPolicy
	for i := range policies {
		if policies[i].SandboxID == fromEnv {
			policy = &policies[i]
			break
		}
	}
	if policy == nil {
		return nil, repository.ErrPolicyNotFound
	}
	policy.UpdatedAt = time.Now().UTC()
	return policy, nil
}

// ConfigureDnsIsolation configures DNS isolation for a sandbox.
func (s *Service) ConfigureDnsIsolation(ctx context.Context, tenantID string, req models.DnsIsolationRequest, sandboxID string) (*models.SandboxNetworkPolicy, error) {
	policies, _ := s.repo.ListNetworkPolicies(ctx, tenantID)
	var policy *models.SandboxNetworkPolicy
	for i := range policies {
		if policies[i].SandboxID == sandboxID {
			policy = &policies[i]
			break
		}
	}

	dnsAnnotations := map[string]string{
		"orion.io/isolation":         "true",
		"orion.io/dns-isolation":     "enforced",
		"orion.io/dns-allowed-domains": "",
	}
	dnsAnnotations["orion.io/dns-allowed-domains"] = ""
	allowedJSON, _ := json.Marshal(req.AllowedDomains)
	dnsAnnotations["orion.io/dns-allowed-domains"] = string(allowedJSON)
	if req.DnsTimeoutMs > 0 {
		dnsAnnotations["orion.io/dns-timeout"] = fmt.Sprintf("%d", req.DnsTimeoutMs)
	}
	if len(req.CustomDnsServers) > 0 {
		dnsAnnotations["orion.io/dns-servers"] = ""
		serversJSON, _ := json.Marshal(req.CustomDnsServers)
		dnsAnnotations["orion.io/dns-servers"] = string(serversJSON)
	}

	if policy == nil {
		policy = &models.SandboxNetworkPolicy{
			SandboxID:   sandboxID,
			Name:        fmt.Sprintf("dns-policy-%s", sandboxID),
			Namespace:   fmt.Sprintf("sandbox-%s", sandboxID),
			Labels:      string([]byte(fmt.Sprintf(`{"app":"%s"}`, sandboxID))),
			Annotations: "",
			IngressRules: string([]byte(`[{"name":"deny-all-ingress","podSelector":{},"allow":false}]`)),
			EgressRules:  string([]byte(`[{"name":"deny-all-egress","podSelector":{},"allow":false}]`)),
		}
		annJSON, _ := json.Marshal(dnsAnnotations)
		policy.Annotations = string(annJSON)
		if err := s.repo.CreateNetworkPolicy(ctx, tenantID, policy); err != nil {
			return nil, err
		}
	} else {
		annJSON, _ := json.Marshal(dnsAnnotations)
		policy.Annotations = string(annJSON)
		policy.UpdatedAt = time.Now().UTC()
	}
	return policy, nil
}

// ConfigureEgressTraffic configures egress traffic control for a sandbox.
func (s *Service) ConfigureEgressTraffic(ctx context.Context, tenantID string, req models.EgressTrafficRequest, sandboxID string) (*models.SandboxNetworkPolicy, error) {
	policies, _ := s.repo.ListNetworkPolicies(ctx, tenantID)
	var policy *models.SandboxNetworkPolicy
	for i := range policies {
		if policies[i].SandboxID == sandboxID {
			policy = &policies[i]
			break
		}
	}

	egressAnnotations := map[string]string{
		"orion.io/isolation":      "true",
		"orion.io/egress-control": "enforced",
		"orion.io/egress-default": req.DefaultAction,
	}

	if policy == nil {
		policy = &models.SandboxNetworkPolicy{
			SandboxID:   sandboxID,
			Name:        fmt.Sprintf("egress-policy-%s", sandboxID),
			Namespace:   fmt.Sprintf("sandbox-%s", sandboxID),
			Labels:      string([]byte(fmt.Sprintf(`{"app":"%s"}`, sandboxID))),
			IngressRules: string([]byte(`[{"name":"deny-all-ingress","podSelector":{},"allow":false}]`)),
		}
		annJSON, _ := json.Marshal(egressAnnotations)
		policy.Annotations = string(annJSON)
		// Build egress rules
		rules := make([]map[string]any, 0, len(req.Rules))
		for _, r := range req.Rules {
			rule := map[string]any{"name": r.Name, "podSelector": map[string]any{}, "allow": r.Allow}
			if r.Destination != "" {
				rule["namespaceSelector"] = map[string]string{"namespace": r.Destination}
			}
			if len(r.Ports) > 0 {
				rule["ports"] = r.Ports
			}
			rules = append(rules, rule)
		}
		egressJSON, _ := json.Marshal(rules)
		policy.EgressRules = string(egressJSON)
		if err := s.repo.CreateNetworkPolicy(ctx, tenantID, policy); err != nil {
			return nil, err
		}
	} else {
		annJSON, _ := json.Marshal(egressAnnotations)
		policy.Annotations = string(annJSON)
		policy.UpdatedAt = time.Now().UTC()
	}
	return policy, nil
}

// ListNetworkPolicies returns all network policies for the tenant.
func (s *Service) ListNetworkPolicies(ctx context.Context, tenantID string) ([]models.SandboxNetworkPolicy, error) {
	return s.repo.ListNetworkPolicies(ctx, tenantID)
}

// --- Errors ---

// IsNotFound checks if an error indicates a resource was not found.
func IsNotFound(err error) bool {
	return repository.IsNotFound(err)
}

