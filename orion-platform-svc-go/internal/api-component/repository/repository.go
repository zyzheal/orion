package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
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
	// Fallback to DB on cache miss
	comp, err := r.loadFromDB(ctx, name)
	if err != nil {
		return nil, err
	}
	if comp != nil && r.registry != nil {
		_ = r.registry.Register(comp)
	}
	if comp == nil {
		return nil, sentinel.NotFound
	}
	return comp, nil
}

func (r *Repository) List(ctx context.Context) ([]string, error) {
	if r.registry != nil && r.registry.Count() > 0 {
		return r.registry.ComponentNames(), nil
	}
	// Fallback to DB
	if r.db != nil {
		rows, err := r.db.QueryContext(ctx, `SELECT name FROM api_components ORDER BY created_at`)
		if err != nil {
			return nil, err
		}
		defer rows.Close()
		var names []string
		for rows.Next() {
			var name string
			if err := rows.Scan(&name); err != nil {
				return nil, err
			}
			names = append(names, name)
		}
		return names, rows.Err()
	}
	return nil, nil
}

func (r *Repository) ListRoutes(ctx context.Context) []apicomponent.FullRoute {
	if r.registry != nil && r.registry.Count() > 0 {
		return r.registry.AllRoutes()
	}
	return nil
}

func (r *Repository) loadFromDB(ctx context.Context, name string) (*apicomponent.APIComponent, error) {
	if r.db == nil {
		return nil, nil
	}
	type compRow struct {
		Name        string  `db:"name"`
		Prefix      string  `db:"prefix"`
		Version     string  `db:"version"`
		Summary     string  `db:"summary"`
		Description *string `db:"description"`
		Tags        *string `db:"tags"`
	}
	var row compRow
	err := r.db.GetContext(ctx, &row,
		`SELECT name, prefix, version, summary, description, tags FROM api_components WHERE name=$1`, name)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	// Build component with route list from DB
	comp := apicomponent.NewAPIComponent(row.Name, row.Prefix, row.Summary)
	comp.Version = row.Version
	if row.Description != nil {
		comp.Description = *row.Description
	}
	if row.Tags != nil {
		var tags []string
		if err := json.Unmarshal([]byte(*row.Tags), &tags); err == nil {
			comp.Tags = tags
		}
	}
	// Load routes
	type routeRow struct {
		Path    string `db:"path"`
		Methods string `db:"methods"`
		Summary string `db:"summary"`
	}
	routeRows, err := r.db.QueryContext(ctx,
		`SELECT path, methods, summary FROM api_component_routes WHERE component_name=$1`, name)
	if err == nil {
		defer routeRows.Close()
		var routes []apicomponent.RouteComponent
		for routeRows.Next() {
			var rr routeRow
			if err := routeRows.Scan(&rr.Path, &rr.Methods, &rr.Summary); err != nil {
				continue
			}
			var methods []apicomponent.HTTPMethod
			if err := json.Unmarshal([]byte(rr.Methods), &methods); err == nil {
				routes = append(routes, apicomponent.RouteComponent{
					Path:    rr.Path,
					Methods: methods,
					Summary: rr.Summary,
				})
			}
		}
		comp.Routes = routes
	}
	return comp, nil
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
	if r.registry != nil && r.registry.Count() > 0 {
		comps := r.registry.FilterByTag(tag)
		names := make([]string, 0, len(comps))
		for _, c := range comps {
			names = append(names, c.Name)
		}
		return names
	}
	return nil
}
