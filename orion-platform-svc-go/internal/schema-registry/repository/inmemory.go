package repository

import (
	"context"
	"encoding/json"
	"errors"
	"sync"

	"orion/platform-svc-go/internal/schema-registry/models"
)

// ErrSchemaNotFound is returned when a schema cannot be located in memory.
// Callers should treat nil as "not found" and only surface this when the
// caller explicitly asks for it.
var ErrSchemaNotFound = errors.New("schema not found")

// InMemory is a thread-safe, in-process implementation of Interface. It is
// the default for Phase 1a since the schema-registry table is not yet
// provisioned in the production migration set. Callers that need durable
// storage can swap this for a Postgres-backed implementation later.
type InMemory struct {
	mu       sync.RWMutex
	schemas  map[string]*models.Schema
	versions map[string][]*models.SchemaVersion
}

// NewInMemory returns an empty InMemory repository. It is safe to use
// concurrently from any goroutine.
func NewInMemory() *InMemory {
	return &InMemory{
		schemas:  map[string]*models.Schema{},
		versions: map[string][]*models.SchemaVersion{},
	}
}

func key(namespace, name string) string {
	return namespace + "/" + name
}

func (r *InMemory) CreateSchema(_ context.Context, s *models.Schema) error {
	if s == nil {
		return errors.New("schema is nil")
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	k := key(s.Namespace, s.Name)
	if _, exists := r.schemas[k]; exists {
		return errors.New("schema already exists: " + k)
	}
	cp := cloneSchema(s)
	r.schemas[k] = cp
	return nil
}

func (r *InMemory) GetSchema(_ context.Context, namespace, name string) (*models.Schema, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	s, ok := r.schemas[key(namespace, name)]
	if !ok {
		return nil, nil
	}
	return cloneSchema(s), nil
}

func (r *InMemory) ListSchemas(_ context.Context, namespace string) ([]*models.Schema, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	out := make([]*models.Schema, 0, len(r.schemas))
	for k, s := range r.schemas {
		if namespace == "" || s.Namespace == namespace {
			out = append(out, cloneSchema(s))
		}
		_ = k
	}
	return out, nil
}

func (r *InMemory) QuerySchemas(_ context.Context, q *models.QueryRequest) ([]*models.Schema, int, error) {
	if q == nil {
		q = &models.QueryRequest{}
	}
	r.mu.RLock()
	defer r.mu.RUnlock()
	var out []*models.Schema
	for _, s := range r.schemas {
		if q.Namespace != "" && s.Namespace != q.Namespace {
			continue
		}
		if q.Type != "" && s.Type != q.Type {
			continue
		}
		if q.Status != "" && s.Status != q.Status {
			continue
		}
		if q.Owner != "" && s.Owner != q.Owner {
			continue
		}
		out = append(out, cloneSchema(s))
	}
	return out, len(out), nil
}

func (r *InMemory) UpdateSchema(_ context.Context, s *models.Schema) error {
	if s == nil {
		return errors.New("schema is nil")
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	k := key(s.Namespace, s.Name)
	if _, ok := r.schemas[k]; !ok {
		return errors.New("schema not found: " + k)
	}
	r.schemas[k] = cloneSchema(s)
	return nil
}

func (r *InMemory) DeleteSchema(_ context.Context, namespace, name string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	k := key(namespace, name)
	if _, ok := r.schemas[k]; !ok {
		return ErrSchemaNotFound
	}
	delete(r.schemas, k)
	delete(r.versions, k)
	return nil
}

func (r *InMemory) GetLatestVersion(_ context.Context, namespace, name string) (int, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	s, ok := r.schemas[key(namespace, name)]
	if !ok {
		return 0, ErrSchemaNotFound
	}
	return s.Version, nil
}

func (r *InMemory) AppendVersion(_ context.Context, namespace, name string, v *models.SchemaVersion) error {
	if v == nil {
		return errors.New("version is nil")
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	k := key(namespace, name)
	if _, ok := r.schemas[k]; !ok {
		return ErrSchemaNotFound
	}
	cp := cloneVersion(v)
	r.versions[k] = append(r.versions[k], cp)
	return nil
}

func (r *InMemory) GetVersionHistory(_ context.Context, namespace, name string, limit int) ([]*models.SchemaVersion, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	versions := r.versions[key(namespace, name)]
	if len(versions) == 0 {
		return []*models.SchemaVersion{}, nil
	}
	if limit > 0 && limit < len(versions) {
		// Return the most recent `limit` entries.
		versions = versions[len(versions)-limit:]
	}
	out := make([]*models.SchemaVersion, 0, len(versions))
	for _, v := range versions {
		out = append(out, cloneVersion(v))
	}
	return out, nil
}

func (r *InMemory) GetVersion(_ context.Context, namespace, name string, version int) (*models.SchemaVersion, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	for _, v := range r.versions[key(namespace, name)] {
		if v.Version == version {
			return cloneVersion(v), nil
		}
	}
	return nil, ErrSchemaNotFound
}

func (r *InMemory) GetCompatibility(_ context.Context, namespace, name string) (models.CompatibilityMode, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	s, ok := r.schemas[key(namespace, name)]
	if !ok {
		return "", ErrSchemaNotFound
	}
	return s.Compatibility, nil
}

// cloneSchema deep-copies a Schema so callers cannot mutate internal state.
// Fields and Relationships are shallow-copied because their elements are
// structs with value semantics; Metadata is deep-copied via JSON round-trip.
func cloneSchema(s *models.Schema) *models.Schema {
	cp := *s
	cp.Fields = append([]models.SchemaField(nil), s.Fields...)
	cp.Relationships = append([]models.SchemaRelationship(nil), s.Relationships...)
	cp.Indexes = append([]models.IndexDefinition(nil), s.Indexes...)
	if s.Metadata != nil {
		buf, err := json.Marshal(s.Metadata)
		if err == nil {
			var m map[string]interface{}
			if json.Unmarshal(buf, &m) == nil {
				cp.Metadata = m
			} else {
				cp.Metadata = map[string]interface{}{}
			}
		}
	}
	return &cp
}

// cloneVersion deep-copies a SchemaVersion. The JSON blob is copied by
// value and the Changes slice is shallow-copied.
func cloneVersion(v *models.SchemaVersion) *models.SchemaVersion {
	cp := *v
	cp.Changes = append([]models.EvolutionChange(nil), v.Changes...)
	return &cp
}
