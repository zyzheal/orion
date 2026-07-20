package service
//go:generate mockgen -destination=mock_service.go -package=service . ServiceInterface
//go:generate mockgen -destination=mock_repository.go -package=service . RepositoryInterface

import (
	"context"
	"errors"
	"sort"

	"orion/platform-svc-go/internal/module/models"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	GetByID(ctx context.Context, tenantID, id string) (*models.Module, error)
	List(ctx context.Context, tenantID string) ([]models.Module, error)
	UpdateStatus(ctx context.Context, tenantID, id string, enabled bool, status string) (*models.Module, error)
}

var ErrCoreModule = errors.New("core module cannot be disabled")

type Service struct {
	repo RepositoryInterface
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

// GetModuleStatus returns a snapshot of all module statuses for the tenant.
func (s *Service) GetModuleStatus(ctx context.Context, tenantID string) (*models.ModuleStatusSnapshot, error) {
	modules, err := s.repo.List(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	return &models.ModuleStatusSnapshot{
		Modules: modules,
		Total:   len(modules),
	}, nil
}

// GetModuleByID returns a single module by id.
func (s *Service) GetModuleByID(ctx context.Context, tenantID, id string) (*models.Module, error) {
	return s.repo.GetByID(ctx, tenantID, id)
}

// ToggleModule enables or disables a module. Core modules cannot be disabled.
func (s *Service) ToggleModule(ctx context.Context, tenantID, id string, enabled bool) (*models.Module, error) {
	mod, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	if mod.Core && !enabled {
		return nil, ErrCoreModule
	}
	status := "running"
	if !enabled {
		status = "disabled"
	}
	return s.repo.UpdateStatus(ctx, tenantID, id, enabled, status)
}

// ValidateDependencies checks that every declared dependency exists and is enabled.
func (s *Service) ValidateDependencies(ctx context.Context, tenantID string) ([]models.ValidationResult, error) {
	modules, err := s.repo.List(ctx, tenantID)
	if err != nil {
		return nil, err
	}

	enabledSet := make(map[string]struct{}, len(modules))
	for _, m := range modules {
		if m.Enabled {
			enabledSet[m.Name] = struct{}{}
		}
	}

	var results []models.ValidationResult
	for _, m := range modules {
		for _, dep := range parseDependencies(m.Dependencies) {
			_, ok := enabledSet[dep]
			results = append(results, models.ValidationResult{
				ModuleID:   m.ID,
				Dependency: dep,
				Resolved:   ok,
				Message:    dependencyMessage(ok, m.Name, dep),
			})
		}
	}

	return results, nil
}

// GetStartupOrder returns modules sorted by their startup order, skipping disabled ones.
func (s *Service) GetStartupOrder(ctx context.Context, tenantID string) ([]string, error) {
	modules, err := s.repo.List(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	enabled := make([]models.Module, 0, len(modules))
	for _, m := range modules {
		if m.Enabled {
			enabled = append(enabled, m)
		}
	}
	sort.Slice(enabled, func(i, j int) bool {
		return enabled[i].StartupOrder < enabled[j].StartupOrder
	})
	names := make([]string, len(enabled))
	for i, m := range enabled {
		names[i] = m.Name
	}
	return names, nil
}

// parseDependencies splits a comma/semicolon-separated dependencies string.
func parseDependencies(s string) []string {
	result := make([]string, 0)
	for _, part := range split(s) {
		part = trimSpace(part)
		if part != "" {
			result = append(result, part)
		}
	}
	return result
}

// split splits a string by comma or semicolon.
func split(s string) []string {
	if s == "" {
		return []string{}
	}
	out := make([]string, 0, 4)
	current := ""
	for _, ch := range s {
		if ch == ',' || ch == ';' {
			out = append(out, current)
			current = ""
		} else {
			current += string(ch)
		}
	}
	out = append(out, current)
	return out
}

// trimSpace trims leading and trailing spaces.
func trimSpace(s string) string {
	for len(s) > 0 && s[0] == ' ' {
		s = s[1:]
	}
	for len(s) > 0 && s[len(s)-1] == ' ' {
		s = s[:len(s)-1]
	}
	return s
}

// dependencyMessage returns a human-readable dependency status.
func dependencyMessage(resolved bool, module, dep string) string {
	if resolved {
		return "dependency resolved"
	}
	return "dependency missing or disabled"
}
