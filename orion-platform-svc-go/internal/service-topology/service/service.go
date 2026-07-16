package service

import (
	"context"
	"errors"

	"orion/platform-svc-go/internal/service-topology/models"
	"orion/platform-svc-go/internal/service-topology/repository"
)

var ErrNotFound = errors.New("service topology not found")

type Service struct {
	repo *repository.Repository
}

func NewService(repo *repository.Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) Create(ctx context.Context, tenantID string, req models.CreateServiceTopologyRequest) (*models.ServiceTopology, error) {
	status := models.ServiceStatus(req.Status)
	if status == "" {
		status = models.StatusActive
	}
	if !isValidStatus(status) {
		return nil, errors.New("invalid status: must be ACTIVE, INACTIVE, or DEGRADED")
	}
	m := &models.ServiceTopology{
		TenantID:     tenantID,
		ServiceName:  req.ServiceName,
		ServiceURL:   req.ServiceURL,
		Port:         req.Port,
		Status:       status,
		Dependencies: req.Dependencies,
		Metadata:     req.Metadata,
	}
	if m.Metadata == nil {
		m.Metadata = map[string]string{}
	}
	if err := s.repo.Create(ctx, tenantID, m); err != nil {
		return nil, err
	}
	return m, nil
}

func (s *Service) Get(ctx context.Context, tenantID, id string) (*models.ServiceTopology, error) {
	return s.repo.GetByID(ctx, tenantID, id)
}

func (s *Service) GetByServiceName(ctx context.Context, tenantID, serviceName string) (*models.ServiceTopology, error) {
	return s.repo.GetByServiceName(ctx, tenantID, serviceName)
}

func (s *Service) List(ctx context.Context, tenantID string) ([]models.ServiceTopology, error) {
	return s.repo.List(ctx, tenantID)
}

func (s *Service) Update(ctx context.Context, tenantID, id string, req models.UpdateServiceTopologyRequest) (*models.ServiceTopology, error) {
	updates := make(map[string]interface{})
	if req.ServiceName != nil {
		updates["service_name"] = *req.ServiceName
	}
	if req.ServiceURL != nil {
		updates["service_url"] = *req.ServiceURL
	}
	if req.Port != nil {
		updates["port"] = *req.Port
	}
	if req.Status != nil {
		status := models.ServiceStatus(*req.Status)
		if !isValidStatus(status) {
			return nil, errors.New("invalid status")
		}
		updates["status"] = string(status)
	}
	if req.Dependencies != nil {
		updates["dependencies"] = req.Dependencies
	}
	if req.Metadata != nil {
		updates["metadata"] = req.Metadata
	}
	return s.repo.Update(ctx, tenantID, id, updates)
}

func (s *Service) Delete(ctx context.Context, tenantID, id string) error {
	return s.repo.Delete(ctx, tenantID, id)
}

// AddDependency adds a dependency edge between two services, checking for cycles.
func (s *Service) AddDependency(ctx context.Context, tenantID, source, target string, relType models.RelationType) error {
	// Check if adding this edge would create a cycle
	existingDownstream, err := s.repo.GetDownstreamDependents(ctx, tenantID, target)
	if err != nil {
		return err
	}
	for _, d := range existingDownstream {
		if d == source {
			return errors.New("adding this dependency would create a cycle")
		}
	}
	if relType == "" {
		relType = models.RelDependsOn
	}
	return s.repo.AddEdge(ctx, tenantID, source, target, relType)
}

// RemoveDependency removes a dependency edge.
func (s *Service) RemoveDependency(ctx context.Context, tenantID, source, target string) error {
	return s.repo.RemoveEdge(ctx, tenantID, source, target)
}

// GetDependencies returns direct outgoing edges for a service.
func (s *Service) GetDependencies(ctx context.Context, tenantID, serviceName string) ([]models.TopologyEdge, error) {
	return s.repo.GetEdges(ctx, tenantID, serviceName)
}

// GetUpstreamDependencies returns all transitive upstream dependencies via BFS.
func (s *Service) GetUpstreamDependencies(ctx context.Context, tenantID, serviceName string) ([]string, error) {
	return s.repo.GetUpstreamDependencies(ctx, tenantID, serviceName)
}

// GetDownstreamDependents returns all transitive downstream dependents via BFS.
func (s *Service) GetDownstreamDependents(ctx context.Context, tenantID, serviceName string) ([]string, error) {
	return s.repo.GetDownstreamDependents(ctx, tenantID, serviceName)
}

// FindImpactScope returns downstream services affected if a service goes down.
func (s *Service) FindImpactScope(ctx context.Context, tenantID, serviceName string) (*models.ImpactScope, error) {
	downstream, err := s.repo.GetDownstreamDependents(ctx, tenantID, serviceName)
	if err != nil {
		return nil, err
	}
	return &models.ImpactScope{
		ServiceName:      serviceName,
		DownstreamCount:  len(downstream),
		AffectedServices: downstream,
	}, nil
}

// DetectCycles returns all cycles in the topology graph.
func (s *Service) DetectCycles(ctx context.Context, tenantID string) ([][]string, error) {
	return s.repo.DetectCycles(ctx, tenantID)
}

// ValidateTopology checks for cycles and returns validation result.
func (s *Service) ValidateTopology(ctx context.Context, tenantID string) (*models.ValidateTopologyResult, error) {
	cycles, err := s.repo.DetectCycles(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	return &models.ValidateTopologyResult{
		HasCycle: len(cycles) > 0,
		Cycles: func() []models.CyclePath {
			result := make([]models.CyclePath, len(cycles))
			for i, c := range cycles {
				result[i] = models.CyclePath{Path: c}
			}
			return result
		}(),
	}, nil
}

// GetTopologyStats returns aggregated topology metrics.
func (s *Service) GetTopologyStats(ctx context.Context, tenantID string) (*models.TopologyStats, error) {
	return s.repo.GetTopologyStats(ctx, tenantID)
}

func isValidStatus(status models.ServiceStatus) bool {
	switch status {
	case models.StatusActive, models.StatusInactive, models.StatusDegraded:
		return true
	}
	return false
}
