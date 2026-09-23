package service

import (
	"context"
	"errors"
	"sync"

	"orion/go-common/pkg/sentinel"
	apicomponent "orion/platform-svc-go/internal/api-component"
	"orion/platform-svc-go/internal/api-component/handler/models"
	"orion/platform-svc-go/internal/api-component/repository"
)

// componentStore is the read surface the service needs. *repository.Repository
// satisfies it, so the wiring call site is unchanged, and a fake keeps the
// read-through logic testable without a database.
type componentStore interface {
	Get(ctx context.Context, name string) (*apicomponent.APIComponent, error)
	List(ctx context.Context) ([]string, error)
	ListRoutes(ctx context.Context) []apicomponent.FullRoute
	FilterByTag(ctx context.Context, tag string) []string
	Save(ctx context.Context, comp *apicomponent.APIComponent) error
	Delete(ctx context.Context, name string) error
}

type Service struct {
	mu       sync.RWMutex
	loaded   bool
	registry *apicomponent.Registry
	repo     componentStore
}

func NewService(repo *repository.Repository) *Service {
	s := &Service{registry: apicomponent.NewRegistry()}
	// Assign only when non-nil: a nil *repository.Repository stored in the
	// componentStore interface is not a nil interface, so the s.repo == nil
	// guards below would stop working once the parameter stopped being concrete.
	if repo != nil {
		s.repo = repo
	}
	return s
}

// ensureLoaded mirrors the persisted components into the process-local cache.
//
// RegisterComponent writes to both the store and the in-process registry, so
// the two agree within one lifetime. The registry is rebuilt empty on every
// start, so without this step GET /api-components/:name answers
// ErrComponentNotFound and the list routes answer empty for components that
// were already registered and saved to api_components.
func (s *Service) ensureLoaded(ctx context.Context) error {
	if s.repo == nil {
		return nil
	}
	s.mu.RLock()
	if s.loaded || s.registry.Count() > 0 {
		s.mu.RUnlock()
		return nil
	}
	s.mu.RUnlock()

	s.mu.Lock()
	defer s.mu.Unlock()
	if s.loaded || s.registry.Count() > 0 {
		return nil
	}
	names, err := s.repo.List(ctx)
	if err != nil {
		return err
	}
	for _, name := range names {
		comp, err := s.repo.Get(ctx, name)
		if err != nil {
			// Deleted by another process while we were loading.
			continue
		}
		if err := s.registry.Register(comp); err != nil {
			continue
		}
	}
	s.loaded = true
	return nil
}

func (s *Service) RegisterComponent(ctx context.Context, req *models.RegisterComponentRequest) error {
	opts := []apicomponent.ComponentOption{
		apicomponent.WithDescription(req.Description),
		apicomponent.WithVersion(req.Version),
		apicomponent.WithTags(req.Tags),
	}
	comp := apicomponent.NewAPIComponent(req.Name, req.Prefix, req.Summary, opts...)
	if s.repo != nil {
		if err := s.repo.Save(ctx, comp); err != nil {
			return err
		}
	}
	return s.registry.Register(comp)
}

func (s *Service) UnregisterComponent(ctx context.Context, name string) error {
	if s.repo != nil {
		if err := s.repo.Delete(ctx, name); err != nil {
			return err
		}
	}
	return s.registry.Unregister(name)
}

func (s *Service) GetComponent(ctx context.Context, name string) (*apicomponent.APIComponent, error) {
	if comp := s.registry.Get(name); comp != nil {
		return comp, nil
	}
	if s.repo == nil {
		return nil, apicomponent.ErrComponentNotFound
	}
	comp, err := s.repo.Get(ctx, name)
	if err != nil {
		if errors.Is(err, sentinel.NotFound) {
			return nil, apicomponent.ErrComponentNotFound
		}
		return nil, err
	}
	// Repopulate so the next call stays in memory.
	if err := s.registry.Register(comp); err != nil {
		return nil, err
	}
	return comp, nil
}

func (s *Service) ListComponents(ctx context.Context) ([]string, error) {
	if err := s.ensureLoaded(ctx); err != nil {
		return nil, err
	}
	return s.registry.ComponentNames(), nil
}

func (s *Service) ListRoutes(ctx context.Context) ([]models.RouteListResponse, error) {
	if err := s.ensureLoaded(ctx); err != nil {
		return nil, err
	}
	routes := s.registry.AllRoutes()
	resp := make([]models.RouteListResponse, 0, len(routes))
	for _, r := range routes {
		methods := make([]string, 0, len(r.Methods))
		for _, m := range r.Methods {
			methods = append(methods, string(m))
		}
		resp = append(resp, models.RouteListResponse{
			Component: r.ComponentName,
			Path:      r.Path,
			Methods:   methods,
			Summary:   r.Summary,
		})
	}
	return resp, nil
}

func (s *Service) Stats(ctx context.Context) *models.ComponentStats {
	// Best effort: an unreachable store still yields a valid, if incomplete, count.
	_ = s.ensureLoaded(ctx)
	comps := s.registry.All()
	names := make([]string, 0, len(comps))
	for _, c := range comps {
		names = append(names, c.Name)
	}
	return &models.ComponentStats{
		ComponentCount: s.registry.Count(),
		RouteCount:     s.registry.RouteCount(),
		Components:     names,
	}
}

func (s *Service) FilterByTag(ctx context.Context, tag string) ([]string, error) {
	if err := s.ensureLoaded(ctx); err != nil {
		return nil, err
	}
	comps := s.registry.FilterByTag(tag)
	names := make([]string, 0, len(comps))
	for _, c := range comps {
		names = append(names, c.Name)
	}
	return names, nil
}
