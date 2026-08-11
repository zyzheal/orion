package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"orion/go-common/pkg/sentinel"
	apicomponent "orion/platform-svc-go/internal/api-component"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

// Repository persists API component registry state so components survive restarts.
type Repository struct {
	db       *sqlx.DB
	registry *apicomponent.Registry
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db, registry: apicomponent.NewRegistry()}
}

func (r *Repository) Save(ctx context.Context, comp *apicomponent.APIComponent) error {
	if r.db != nil {
		var tagsJSON, metaJSON string
		if len(comp.Tags) > 0 {
			if b, err := json.Marshal(comp.Tags); err == nil {
				tagsJSON = string(b)
			}
		}
		if len(comp.Metadata) > 0 {
			if b, err := json.Marshal(comp.Metadata); err == nil {
				metaJSON = string(b)
			}
		}
		now := time.Now().UTC()
		_, err := r.db.NamedExecContext(ctx,
			`INSERT INTO api_components (id, name, prefix, version, summary, description, tags, metadata, created_at, updated_at)
			 VALUES (:id, :name, :prefix, :version, :summary, :description, :tags, :metadata, :created_at, :updated_at)
			 ON CONFLICT (name) DO UPDATE SET
			 prefix = EXCLUDED.prefix, version = EXCLUDED.version, summary = EXCLUDED.summary,
			 description = EXCLUDED.description, tags = EXCLUDED.tags, metadata = EXCLUDED.metadata,
			 updated_at = EXCLUDED.updated_at`,
			map[string]interface{}{
				"id":          uuid.New().String(),
				"name":        comp.Name,
				"prefix":      comp.Prefix,
				"version":     comp.Version,
				"summary":     comp.Summary,
				"description": comp.Description,
				"tags":        tagsJSON,
				"metadata":    metaJSON,
				"created_at":  now,
				"updated_at":  now,
			})
		if err != nil {
			return fmt.Errorf("persist component %s: %w", comp.Name, err)
		}

		// Persist routes
		for i, route := range comp.Routes {
			methodsJSON := "[]"
			if len(route.Methods) > 0 {
				if b, err := json.Marshal(route.Methods); err == nil {
					methodsJSON = string(b)
				}
			}
			_, err := r.db.ExecContext(ctx,
				`INSERT INTO api_component_routes (id, component_name, path, methods, summary, handler_ref, created_at)
				 VALUES ($1, $2, $3, $4, $5, $6, $7)
				 ON CONFLICT DO NOTHING`,
				uuid.New().String(), comp.Name, route.Path, methodsJSON, route.Summary, fmt.Sprintf("route_%d", i), now)
			if err != nil {
				return fmt.Errorf("persist route %s: %w", comp.Name, err)
			}
		}
	}

	return r.registry.Register(comp)
}

func (r *Repository) Get(ctx context.Context, name string) (*apicomponent.APIComponent, error) {
	if r.registry != nil {
		comp := r.registry.Get(name)
		if comp != nil {
			return comp, nil
		}
	}
	return nil, sentinel.NotFound
}

func (r *Repository) List(ctx context.Context) ([]string, error) {
	if r.registry != nil {
		return r.registry.ComponentNames(), nil
	}
	return nil, nil
}

func (r *Repository) ListRoutes(ctx context.Context) []apicomponent.FullRoute {
	if r.registry != nil {
		return r.registry.AllRoutes()
	}
	return nil
}

func (r *Repository) Delete(ctx context.Context, name string) error {
	if r.db != nil {
		_, err := r.db.ExecContext(ctx,
			`DELETE FROM api_components WHERE name=$1`, name)
		if err != nil {
			return fmt.Errorf("delete component %s: %w", name, err)
		}
	}
	if r.registry != nil {
		return r.registry.Unregister(name)
	}
	return nil
}

func (r *Repository) FilterByTag(ctx context.Context, tag string) []string {
	if r.registry != nil {
		comps := r.registry.FilterByTag(tag)
		names := make([]string, 0, len(comps))
		for _, c := range comps {
			names = append(names, c.Name)
		}
		return names
	}
	return nil
}
