package repository

import (
	"context"
	"sync"

	apicomponent "orion/platform-svc-go/internal/api-component"
)

// Repository persists API component registry state so components survive restarts.
type Repository struct {
	mu       sync.RWMutex
	registry *apicomponent.Registry
}

func NewRepository() *Repository {
	return &Repository{registry: apicomponent.NewRegistry()}
}

func (r *Repository) Save(ctx context.Context, comp *apicomponent.APIComponent) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.registry.Register(comp)
}

func (r *Repository) Get(ctx context.Context, name string) (*apicomponent.APIComponent, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.registry.Get(name), nil
}

func (r *Repository) List(ctx context.Context) ([]string, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.registry.ComponentNames(), nil
}

func (r *Repository) ListRoutes(ctx context.Context) []apicomponent.FullRoute {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.registry.AllRoutes()
}

func (r *Repository) Delete(ctx context.Context, name string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.registry.Unregister(name)
}

func (r *Repository) FilterByTag(ctx context.Context, tag string) []string {
	r.mu.RLock()
	defer r.mu.RUnlock()
	comps := r.registry.FilterByTag(tag)
	names := make([]string, 0, len(comps))
	for _, c := range comps {
		names = append(names, c.Name)
	}
	return names
}
