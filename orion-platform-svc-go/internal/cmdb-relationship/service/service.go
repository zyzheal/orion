// Package service provides business logic for the CMDB relationship service.
//
// The RelationshipManager orchestrates relationship type lifecycle (create/read/
// update/delete/status transitions) and concrete relationship management with
// cardinality validation and topology graph construction.
//
// Design decisions:
//   - All tenant-scoped: every operation validates tenant_id ownership.
//   - Cardinality validation on relationship creation to prevent over-subscription.
//   - Topology build uses BFS graph traversal capped at a configurable depth.
//   - Soft-delete for types (status=deprecated); hard-delete for concrete records.
package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"orion/platform-svc-go/internal/cmdb-relationship/models"
	"orion/platform-svc-go/internal/cmdb-relationship/repository"

	"orion/go-common/pkg/sentinel"

	"go.uber.org/zap"
)

var (
	ErrTypeNotFound       = errors.New("relationship type not found")
	ErrRelationshipNotFound = errors.New("relationship not found")
	ErrInvalidCardinality = errors.New("invalid cardinality")
	ErrCardinalityExceeded  = errors.New("cardinality limit exceeded")
	ErrInvalidStatus      = errors.New("invalid status value")
	ErrInvalidDirection   = errors.New("invalid direction")
)

// ValidStatuses enumerates allowed relationship type statuses.
var ValidStatuses = map[string]bool{
	"active":     true,
	"deprecated": true,
}

// RelationshipManager provides business logic for relationship types and records.
type RelationshipManager struct {
	repo   *repository.Repository
	logger *zap.Logger
}

// NewRelationshipManager creates a new RelationshipManager.
func NewRelationshipManager(repo *repository.Repository, logger *zap.Logger) *RelationshipManager {
	return &RelationshipManager{repo: repo, logger: logger}
}

// ===========================================================================
// Relationship Type Lifecycle
// ===========================================================================

// CreateRelationshipType creates a new relationship type after validating
// cardinality and required fields.
func (m *RelationshipManager) CreateRelationshipType(ctx context.Context, tenantID string, req *models.CreateRelationshipTypeRequest) (*models.CMDBRelationshipType, error) {
	if !models.ValidCardinalities[req.Cardinality] {
		return nil, fmt.Errorf("%w: %s (allowed: 1:1, 1:N, N:1, N:N)", ErrInvalidCardinality, req.Cardinality)
	}

	attrs, err := json.Marshal(req.Attributes)
	if err != nil {
		return nil, fmt.Errorf("marshal attributes failed: %w", err)
	}

	rt := &models.CMDBRelationshipType{
		TenantID:      tenantID,
		Name:          req.Name,
		Description:   req.Description,
		SourceType:    req.SourceType,
		TargetType:    req.TargetType,
		Cardinality:   req.Cardinality,
		Bidirectional: req.Bidirectional,
		InverseName:   req.InverseName,
		Icon:          req.Icon,
		Color:         req.Color,
		Attributes:    string(attrs),
		Enabled:       true,
		Status:        "active",
	}

	if err := m.repo.CreateRelationshipType(ctx, rt); err != nil {
		if errors.Is(err, repository.ErrDuplicate) {
			return nil, fmt.Errorf("%w: duplicate", sentinel.Conflict)
		}
		return nil, fmt.Errorf("create relationship type failed: %w", err)
	}

	m.logger.Info("relationship type created",
		zap.String("id", rt.ID),
		zap.String("tenant_id", tenantID),
		zap.String("name", rt.Name),
		zap.String("cardinality", rt.Cardinality),
	)

	return rt, nil
}

// GetRelationshipType returns a relationship type by id, scoped to tenant.
func (m *RelationshipManager) GetRelationshipType(ctx context.Context, tenantID, id string) (*models.CMDBRelationshipType, error) {
	rt, err := m.repo.GetRelationshipType(ctx, tenantID, id)
	if err != nil {
		if errors.Is(err, sentinel.NotFound) || errors.Is(err, repository.ErrNotFound) {
			return nil, fmt.Errorf("%w: %s", ErrTypeNotFound, id)
		}
		return nil, fmt.Errorf("get relationship type failed: %w", err)
	}
	return rt, nil
}

// ListRelationshipTypes returns all relationship types for a tenant with optional filters.
func (m *RelationshipManager) ListRelationshipTypes(ctx context.Context, tenantID, status string, enabled *bool) ([]models.CMDBRelationshipType, error) {
	items, err := m.repo.ListRelationshipTypes(ctx, tenantID, status, enabled)
	if err != nil {
		return nil, fmt.Errorf("list relationship types failed: %w", err)
	}
	if items == nil {
		items = []models.CMDBRelationshipType{}
	}
	return items, nil
}

// UpdateRelationshipType performs a partial update on a relationship type.
func (m *RelationshipManager) UpdateRelationshipType(ctx context.Context, tenantID, id string, req *models.UpdateRelationshipTypeRequest) (*models.CMDBRelationshipType, error) {
	// Verify type exists and is owned by tenant
	_, err := m.repo.GetRelationshipType(ctx, tenantID, id)
	if err != nil {
		if errors.Is(err, sentinel.NotFound) || errors.Is(err, repository.ErrNotFound) {
			return nil, fmt.Errorf("%w: %s", ErrTypeNotFound, id)
		}
		return nil, fmt.Errorf("get relationship type failed: %w", err)
	}

	// Validate cardinality if provided
	if req.Cardinality != nil && !models.ValidCardinalities[*req.Cardinality] {
		return nil, fmt.Errorf("%w: %s (allowed: 1:1, 1:N, N:1, N:N)", ErrInvalidCardinality, *req.Cardinality)
	}

	// Validate status if provided
	if req.Status != nil && !ValidStatuses[*req.Status] {
		return nil, fmt.Errorf("%w: %s (allowed: active, deprecated)", ErrInvalidStatus, *req.Status)
	}

	if err := m.repo.UpdateRelationshipType(ctx, id, req); err != nil {
		return nil, fmt.Errorf("update relationship type failed: %w", err)
	}

	m.logger.Info("relationship type updated",
		zap.String("id", id),
		zap.String("tenant_id", tenantID),
	)

	rt, err := m.repo.GetRelationshipType(ctx, tenantID, id)
	return rt, err
}

// DeleteRelationshipType soft-deletes a relationship type (status=deprecated).
func (m *RelationshipManager) DeleteRelationshipType(ctx context.Context, tenantID, id string) error {
	// Verify type exists and is owned by tenant
	_, err := m.repo.GetRelationshipType(ctx, tenantID, id)
	if err != nil {
		if errors.Is(err, sentinel.NotFound) || errors.Is(err, repository.ErrNotFound) {
			return fmt.Errorf("%w: %s", ErrTypeNotFound, id)
		}
		return fmt.Errorf("get relationship type failed: %w", err)
	}

	if err := m.repo.DeleteRelationshipType(ctx, tenantID, id); err != nil {
		return fmt.Errorf("delete relationship type failed: %w", err)
	}

	m.logger.Info("relationship type soft-deleted",
		zap.String("id", id),
		zap.String("tenant_id", tenantID),
	)

	return nil
}

// ===========================================================================
// Relationship CRUD
// ===========================================================================

// CreateRelationship creates a concrete relationship between two CIs, validating
// the type exists and cardinality constraints are not violated.
func (m *RelationshipManager) CreateRelationship(ctx context.Context, tenantID, sourceID, targetID, typeID string, attrs map[string]interface{}) (*models.CMDBRelationship, error) {
	// Verify relationship type exists and is enabled
	rt, err := m.repo.GetRelationshipType(ctx, tenantID, typeID)
	if err != nil {
		if errors.Is(err, sentinel.NotFound) || errors.Is(err, repository.ErrNotFound) {
			return nil, fmt.Errorf("%w: %s", ErrTypeNotFound, typeID)
		}
		return nil, fmt.Errorf("get relationship type failed: %w", err)
	}
	if !rt.Enabled {
		return nil, fmt.Errorf("%w: type %s is disabled", ErrTypeNotFound, typeID)
	}
	if rt.Status != "active" {
		return nil, fmt.Errorf("%w: type %s status is %s", ErrTypeNotFound, typeID, rt.Status)
	}

	// Validate cardinality constraints (count existing relationships for this type
	// involving the same source/target combo and check against cardinality)
	if err := m.validateCardinality(ctx, tenantID, sourceID, targetID, rt.Cardinality, m.repo); err != nil {
		return nil, err
	}

	attrsJSON, err := json.Marshal(attrs)
	if err != nil {
		return nil, fmt.Errorf("marshal attributes failed: %w", err)
	}

	rel := &models.CMDBRelationship{
		TenantID:   tenantID,
		SourceID:   sourceID,
		TargetID:   targetID,
		TypeID:     typeID,
		Attributes: string(attrsJSON),
	}

	if err := m.repo.CreateRelationship(ctx, rel); err != nil {
		return nil, fmt.Errorf("create relationship failed: %w", err)
	}

	m.logger.Info("relationship created",
		zap.String("id", rel.ID),
		zap.String("tenant_id", tenantID),
		zap.String("source_id", sourceID),
		zap.String("target_id", targetID),
		zap.String("type_id", typeID),
	)

	return rel, nil
}

// GetRelationships returns relationships connected to a CI, filtered by direction.
// direction: "outbound", "inbound", "both".
func (m *RelationshipManager) GetRelationships(ctx context.Context, tenantID, ciID, direction string) ([]models.CMDBRelationship, error) {
	if direction != "outbound" && direction != "inbound" && direction != "both" {
		return nil, fmt.Errorf("%w: %s (allowed: outbound, inbound, both)", ErrInvalidDirection, direction)
	}

	items, err := m.repo.GetRelationships(ctx, tenantID, ciID, direction)
	if err != nil {
		return nil, fmt.Errorf("get relationships failed: %w", err)
	}
	if items == nil {
		items = []models.CMDBRelationship{}
	}
	return items, nil
}

// DeleteRelationship removes a relationship record.
func (m *RelationshipManager) DeleteRelationship(ctx context.Context, tenantID, id string) error {
	_, err := m.repo.GetRelationship(ctx, tenantID, id)
	if err != nil {
		if errors.Is(err, sentinel.NotFound) || errors.Is(err, repository.ErrNotFound) {
			return fmt.Errorf("%w: %s", ErrRelationshipNotFound, id)
		}
		return fmt.Errorf("get relationship failed: %w", err)
	}

	if err := m.repo.DeleteRelationship(ctx, tenantID, id); err != nil {
		return fmt.Errorf("delete relationship failed: %w", err)
	}

	m.logger.Info("relationship deleted",
		zap.String("id", id),
		zap.String("tenant_id", tenantID),
	)

	return nil
}

// ===========================================================================
// Topology graph construction
// ===========================================================================

// BuildTopology builds a topology graph rooted at rootID up to the given depth.
// The graph is traversed bidirectionally using BFS, returning a map of node ID
// to its outgoing relationship edges.
func (m *RelationshipManager) BuildTopology(ctx context.Context, tenantID, rootID string, depth int) (map[string][]models.CMDBRelationship, error) {
	if depth < 0 || depth > 10 {
		return nil, fmt.Errorf("%w: depth must be between 0 and 10", ErrInvalidCardinality)
	}

	// Collect all nodes and edges reachable from rootID within depth via BFS
	visited := map[string]bool{rootID: true}
	var edges []models.CMDBRelationship

	for level := 0; level <= depth; level++ {
		var levelEdges []models.CMDBRelationship

		// For each visited node at this level, find its relationships
		for nodeID := range visited {
			rels, err := m.repo.GetRelationships(ctx, tenantID, nodeID, "both")
			if err != nil {
				m.logger.Error("failed to get relationships during topology build",
					zap.String("node_id", nodeID),
					zap.Error(err),
				)
				continue
			}

			for _, rel := range rels {
				// Determine the opposite node (the one we haven't visited yet)
				var oppositeID string
				if rel.SourceID == nodeID {
					oppositeID = rel.TargetID
				} else {
					oppositeID = rel.SourceID
				}

				// Add edge to the result
				edges = append(edges, rel)

				// If not visited and not at max depth, mark for next level
				if !visited[oppositeID] && level < depth {
					visited[oppositeID] = true
					levelEdges = append(levelEdges, rel)
				}
			}
		}

		// Only continue if there are new nodes to explore
		if len(levelEdges) == 0 {
			break
		}
	}

	// Build adjacency map: node -> []relationships
	graph := map[string][]models.CMDBRelationship{}
	for _, rel := range edges {
		graph[rel.SourceID] = append(graph[rel.SourceID], rel)
		graph[rel.TargetID] = append(graph[rel.TargetID], rel)
	}

	m.logger.Info("topology built",
		zap.String("root_id", rootID),
		zap.Int("depth", depth),
		zap.Int("edges", len(edges)),
		zap.Int("nodes", len(visited)),
	)

	return graph, nil
}

// ===========================================================================
// Internal helpers
// ===========================================================================

// validateCardinality checks whether creating a relationship between sourceID and
// targetID with the given cardinality would violate the type's constraints.
func (m *RelationshipManager) validateCardinality(ctx context.Context, tenantID, sourceID, targetID, cardinality string, repo *repository.Repository) error {
	switch cardinality {
	case "1:1":
		// No other relationship of any type where source or target is involved as source/target pair
		outbound, err := repo.GetRelationships(ctx, tenantID, sourceID, "outbound")
		if err != nil {
			return fmt.Errorf("cardinality check failed: %w", err)
		}
		// Check if source already has an outbound relationship
		for _, rel := range outbound {
			if rel.TargetID == targetID {
				return ErrCardinalityExceeded
			}
		}
		return nil

	case "1:N":
		// Source can have multiple targets; target can only have one source of this type
		inbound, err := repo.GetRelationships(ctx, tenantID, targetID, "inbound")
		if err != nil {
			return fmt.Errorf("cardinality check failed: %w", err)
		}
		if len(inbound) > 0 {
			return ErrCardinalityExceeded
		}
		return nil

	case "N:1":
		// Target can have multiple sources; source can only have one target of this type
		outbound, err := repo.GetRelationships(ctx, tenantID, sourceID, "outbound")
		if err != nil {
			return fmt.Errorf("cardinality check failed: %w", err)
		}
		if len(outbound) > 0 {
			return ErrCardinalityExceeded
		}
		return nil

	case "N:N":
		// No constraint
		return nil

	default:
		return fmt.Errorf("%w: %s", ErrInvalidCardinality, cardinality)
	}
}

// CountRelationshipTypes returns the total relationship type count for a tenant.
func (m *RelationshipManager) CountRelationshipTypes(ctx context.Context, tenantID string) (int, error) {
	return m.repo.CountRelationshipTypes(ctx, tenantID)
}

// CountRelationships returns the relationship count for a CI in a tenant.
func (m *RelationshipManager) CountRelationships(ctx context.Context, tenantID, ciID string) (int, error) {
	return m.repo.CountRelationships(ctx, tenantID, ciID)
}
