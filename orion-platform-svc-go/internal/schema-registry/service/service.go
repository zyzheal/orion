package service

import (
	"context"
	"fmt"
	"sort"
	"strings"
	"sync"
	"time"

	"go.uber.org/zap"

	"orion/platform-svc-go/internal/otel"
	"orion/platform-svc-go/internal/schema-registry/models"
	"orion/platform-svc-go/internal/schema-registry/repository"
)

// Service is the schema registry business layer.
type Service struct {
	repo   repository.Interface
	logger *zap.Logger
	mu     sync.RWMutex
}

func New(repo repository.Interface, logger *zap.Logger) *Service {
	if logger == nil {
		logger, _ = zap.NewProduction()
	}
	return &Service{repo: repo, logger: logger}
}

// Register creates a new schema or appends a version if the schema exists.
func (s *Service) Register(ctx context.Context, req *models.RegisterRequest) (*models.RegisterResponse, error) {
	ctx, span := otel.StartSpan(ctx, "schema-registry.Register",
		otel.AttrString("schema.name", req.Name),
		otel.AttrString("schema.namespace", req.Namespace),
		otel.AttrString("schema.type", string(req.Type)))
	defer span.End()

	s.mu.Lock()
	defer s.mu.Unlock()

	existing, err := s.repo.GetSchema(ctx, req.Namespace, req.Name)
	if err != nil {
		return nil, fmt.Errorf("lookup existing schema: %w", err)
	}

	if existing == nil {
		schema := &models.Schema{
			ID:            req.Namespace + "/" + req.Name,
			Name:          req.Name,
			Namespace:     req.Namespace,
			Type:          req.Type,
			Version:       1,
			Status:        models.SchemaActive,
			Owner:         req.Owner,
			Description:   req.Description,
			Fields:        req.Fields,
			Relationships: req.Relationships,
			Indexes:       req.Indexes,
			Compatibility: req.Compatibility,
			Metadata:      req.Metadata,
			CreatedAt:     time.Now(),
			UpdatedAt:     time.Now(),
		}
		if schema.Compatibility == "" {
			schema.Compatibility = models.CompatibilityBackward
		}
		if err := s.repo.CreateSchema(ctx, schema); err != nil {
			return nil, fmt.Errorf("persist schema: %w", err)
		}
		_ = s.repo.AppendVersion(ctx, req.Namespace, req.Name, &models.SchemaVersion{
			Version: 1, ReleasedAt: time.Now(), ReleasedBy: req.Owner,
		})
		return &models.RegisterResponse{Schema: schema, Version: 1}, nil
	}

	// Schema exists — this is an evolution.
	if existing.Status == models.SchemaArchived {
		return nil, fmt.Errorf("schema %s is archived", existing.FullName())
	}

	compat := existing.Compatibility
	if compat == "" {
		compat = models.CompatibilityBackward
	}

	result := s.Evolve(existing, req.Fields, compat)
	if result.Breaking {
		return nil, fmt.Errorf("breaking schema change: %s", buildBreakingSummary(result))
	}

	existing.Version++
	existing.Fields = req.Fields
	if len(req.Relationships) > 0 {
		existing.Relationships = req.Relationships
	}
	if len(req.Indexes) > 0 {
		existing.Indexes = req.Indexes
	}
	if req.Description != "" {
		existing.Description = req.Description
	}
	existing.UpdatedAt = time.Now()

	if err := s.repo.UpdateSchema(ctx, existing); err != nil {
		return nil, fmt.Errorf("persist updated schema: %w", err)
	}
	_ = s.repo.AppendVersion(ctx, req.Namespace, req.Name, &models.SchemaVersion{
		Version: existing.Version, ReleasedAt: time.Now(),
		ReleasedBy: req.Owner, Changes: result.Changes,
	})

	return &models.RegisterResponse{Schema: existing, Version: existing.Version}, nil
}

// Lookup returns the latest version of a schema.
func (s *Service) Lookup(ctx context.Context, namespace, name string) (*models.Schema, error) {
	_, span := otel.StartSpan(ctx, "schema-registry.Lookup",
		otel.AttrString("schema.name", name),
		otel.AttrString("schema.namespace", namespace))
	defer span.End()

	schema, err := s.repo.GetSchema(ctx, namespace, name)
	if err != nil {
		return nil, fmt.Errorf("lookup: %w", err)
	}
	if schema == nil {
		return nil, fmt.Errorf("schema %s not found", namespace+"/"+name)
	}
	return schema, nil
}

// List returns all schemas in a namespace, filtered by type/status.
func (s *Service) List(ctx context.Context, q *models.QueryRequest) (*models.QueryResponse, error) {
	_, span := otel.StartSpan(ctx, "schema-registry.List",
		otel.AttrString("namespace", q.Namespace))
	defer span.End()

	schemas, total, err := s.repo.QuerySchemas(ctx, q)
	if err != nil {
		return nil, fmt.Errorf("list schemas: %w", err)
	}
	return &models.QueryResponse{Schemas: schemas, Total: total}, nil
}

// Evolve compares existing fields against proposed fields and returns the result.
// This is the pure comparison function with no persistence.
func (s *Service) Evolve(existing *models.Schema, proposed []models.SchemaField, mode models.CompatibilityMode) *models.EvolutionResult {
	existingMap := make(map[string]*models.SchemaField, len(existing.Fields))
	for i := range existing.Fields {
		f := existing.Fields[i]
		existingMap[f.Name] = &f
	}
	proposedMap := make(map[string]*models.SchemaField, len(proposed))
	for i := range proposed {
		f := proposed[i]
		proposedMap[f.Name] = &f
	}

	var changes []models.EvolutionChange
	worst := models.BreakingNone

	// Fields added in proposed but not in existing.
	for name, pf := range proposedMap {
		if _, ok := existingMap[name]; !ok {
			breaking := classifyAdd(name, pf, mode)
			detail := "added field " + pf.Type
			if pf.Nullable {
				detail += " nullable"
			} else {
				detail += " not-null"
			}
			changes = append(changes, models.EvolutionChange{
				Type: models.ChangeAddField, Field: name, Severity: breaking,
				Detail: detail, Fixable: !isBreakingLevel(breaking),
			})
			worst = upgradeWorst(worst, breaking)
		}
	}

	// Fields removed.
	for name, ef := range existingMap {
		if _, ok := proposedMap[name]; !ok {
			breaking := classifyRemove(name, ef, mode)
			changes = append(changes, models.EvolutionChange{
				Type: models.ChangeRemoveField, Field: name, Severity: breaking,
				Detail: "removed field " + ef.Type, Fixable: false,
			})
			worst = upgradeWorst(worst, breaking)
		}
	}

	// Fields altered (present in both).
	for name, pf := range proposedMap {
		ef, ok := existingMap[name]
		if !ok {
			continue
		}
		alterChg := classifyAlter(name, ef, pf, mode)
		if alterChg != nil {
			changes = append(changes, *alterChg)
			worst = upgradeWorst(worst, alterChg.Severity)
		}
	}

	sort.Slice(changes, func(i, j int) bool {
		return breakingLevelRank(changes[i].Severity) > breakingLevelRank(changes[j].Severity)
	})

	compatible := !isBreakingLevel(worst)
	breaking := isBreakingLevel(worst)
	result := &models.EvolutionResult{
		Compatible: compatible,
		Breaking:   breaking,
		WorstLevel: worst,
		Changes:    changes,
		TargetMode: mode,
	}
	if breaking {
		result.RecommendedAction = recommendedAction(worst)
	}
	return result
}

// ValidateFields performs structural validation on a field list.
func (s *Service) ValidateFields(fields []models.SchemaField) []string {
	var errors []string
	seen := make(map[string]struct{})
	hasPK := false
	for i, f := range fields {
		if f.Name == "" {
			errors = append(errors, fmt.Sprintf("field[%d]: name is required", i))
		}
		if f.Type == "" {
			errors = append(errors, fmt.Sprintf("field %q: type is required", f.Name))
		}
		if _, dup := seen[f.Name]; f.Name != "" && dup {
			errors = append(errors, fmt.Sprintf("duplicate field name %q", f.Name))
		}
		if f.Name != "" {
			seen[f.Name] = struct{}{}
		}
		if f.PrimaryKey {
			hasPK = true
		}
	}
	if !hasPK {
		errors = append(errors, "at least one field must be marked as primaryKey")
	}
	return errors
}

func buildBreakingSummary(r *models.EvolutionResult) string {
	var b strings.Builder
	b.WriteString(fmt.Sprintf("worst=%s changes=%d", r.WorstLevel, len(r.Changes)))
	for _, c := range r.Changes {
		if isBreakingLevel(c.Severity) {
			b.WriteString(fmt.Sprintf("; %s:%s", c.Field, c.Type))
		}
	}
	return b.String()
}

// --- Classifiers ---

func classifyAdd(name string, pf *models.SchemaField, mode models.CompatibilityMode) models.EvolutionBreakingLevel {
	switch mode {
	case models.CompatibilityBackward:
		// Adding nullable field is backward-compatible; not-null without default is breaking.
		if !pf.Nullable && pf.Default == nil {
			return models.BreakingMinor
		}
		return models.BreakingNone
	case models.CompatibilityForward:
		return models.BreakingNone
	case models.CompatibilityFull:
		return models.BreakingNone
	default:
		return models.BreakingNone
	}
}

func classifyRemove(name string, ef *models.SchemaField, mode models.CompatibilityMode) models.EvolutionBreakingLevel {
	switch mode {
	case models.CompatibilityBackward:
		return models.BreakingCritical
	case models.CompatibilityForward:
		return models.BreakingMinor
	case models.CompatibilityFull:
		return models.BreakingCritical
	default:
		return models.BreakingNone
	}
}

func classifyAlter(name string, old, new *models.SchemaField, mode models.CompatibilityMode) *models.EvolutionChange {
	var details []string
	breaking := models.BreakingNone

	if old.Type != new.Type {
		details = append(details, fmt.Sprintf("type %s -> %s", old.Type, new.Type))
		breaking = models.BreakingCritical
	}
	if !old.Nullable && new.Nullable {
		// Allowing null is generally backward-compatible.
		details = append(details, "nullable: false -> true")
		breaking = upgradeWorst(breaking, models.BreakingNone)
	} else if old.Nullable && !new.Nullable {
		details = append(details, "nullable: true -> false")
		breaking = upgradeWorst(breaking, models.BreakingMinor)
	}
	if old.PrimaryKey != new.PrimaryKey {
		details = append(details, "primaryKey changed")
		breaking = upgradeWorst(breaking, models.BreakingCritical)
	}
	if old.Unique != new.Unique {
		details = append(details, "unique changed")
		breaking = upgradeWorst(breaking, models.BreakingMinor)
	}

	if breaking == models.BreakingNone && len(details) == 0 {
		return nil
	}

	fixable := breaking != models.BreakingCritical
	return &models.EvolutionChange{
		Type: models.ChangeAlterField, Field: name, Severity: breaking,
		Detail: strings.Join(details, ", "), Fixable: fixable,
	}
}

func upgradeWorst(cur, candidate models.EvolutionBreakingLevel) models.EvolutionBreakingLevel {
	if breakingLevelRank(candidate) > breakingLevelRank(cur) {
		return candidate
	}
	return cur
}

func breakingLevelRank(l models.EvolutionBreakingLevel) int {
	switch l {
	case models.BreakingCritical:
		return 4
	case models.BreakingMajor:
		return 3
	case models.BreakingMinor:
		return 2
	case models.BreakingNone:
		return 1
	default:
		return 0
	}
}

func isBreakingLevel(l models.EvolutionBreakingLevel) bool {
	return breakingLevelRank(l) >= breakingLevelRank(models.BreakingMinor)
}

func recommendedAction(worst models.EvolutionBreakingLevel) string {
	switch worst {
	case models.BreakingCritical:
		return "create a new major version or introduce a new schema; breaking change not auto-acceptible"
	case models.BreakingMajor:
		return "coordinate with downstream consumers and bump major version"
	case models.BreakingMinor:
		return "review consumers; add nullable fields or defaults to reduce breakage"
	default:
		return "safe to auto-publish"
	}
}
