package repository

import (
	"context"
	"sync"

	"orion/platform-svc-go/internal/roweditor"
)

// Repository persists RowEditor specifications (which tables are editable,
// their columns, primary keys, etc.) so they survive process restarts.
type Repository struct {
	mu      sync.RWMutex
	editors map[string]roweditor.RowSpec
}

func NewRepository() *Repository {
	return &Repository{editors: make(map[string]roweditor.RowSpec)}
}

func (r *Repository) Save(ctx context.Context, name string, spec roweditor.RowSpec) error {
	r.mu.Lock()
	r.editors[name] = spec
	r.mu.Unlock()
	return nil
}

func (r *Repository) Get(ctx context.Context, name string) (roweditor.RowSpec, error) {
	r.mu.RLock()
	spec, ok := r.editors[name]
	r.mu.RUnlock()
	if !ok {
		return roweditor.RowSpec{}, nil
	}
	return spec, nil
}

func (r *Repository) List(ctx context.Context) map[string]roweditor.RowSpec {
	r.mu.RLock()
	defer r.mu.RUnlock()
	result := make(map[string]roweditor.RowSpec, len(r.editors))
	for k, v := range r.editors {
		result[k] = v
	}
	return result
}

func (r *Repository) Delete(ctx context.Context, name string) error {
	r.mu.Lock()
	delete(r.editors, name)
	r.mu.Unlock()
	return nil
}

func (r *Repository) Exists(ctx context.Context, name string) bool {
	r.mu.RLock()
	_, ok := r.editors[name]
	r.mu.RUnlock()
	return ok
}
