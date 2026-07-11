package service

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"orion-cmdb-svc-go/internal/models"
	"orion/go-common/pkg/otel"
	"orion-cmdb-svc-go/internal/repository"

	"github.com/google/uuid"
)

// CIService implements the core CMDB business logic: CI CRUD with version
// tracking, relation management, topology graph generation, and impact
// analysis. This is a direct port of the Node.js CmdbService + TopologyService.
type CIService struct {
	ciRepo    *repository.CIRepository
	relRepo   *repository.CIRelationRepository
	auditRepo *repository.CIAuditRepository
}

func NewCIService(
	ciRepo *repository.CIRepository,
	relRepo *repository.CIRelationRepository,
	auditRepo *repository.CIAuditRepository,
) *CIService {
	return &CIService{ciRepo: ciRepo, relRepo: relRepo, auditRepo: auditRepo}
}

// ---------------------------------------------------------------------------
// CI CRUD
// ---------------------------------------------------------------------------

// Create validates input, checks for duplicates, persists the CI with
// version = 1, creates the initial version snapshot, and writes an audit log.
func (s *CIService) Create(ctx context.Context, tenantID string, req *models.CreateCIRequest, actor string) (*models.CIItem, error) {
	_, span := otel.Tracer("orion-cmdb-svc").Start(ctx, "CIService.Create")
	defer span.End()

	// Validate required fields
	if req.Name == "" || req.CIType == "" {
		return nil, fmt.Errorf("missing required fields: name, ci_type")
	}

	// Duplicate guard
	exists, err := s.ciRepo.Exists(ctx, tenantID, req.Name, req.CIType)
	if err != nil {
		return nil, fmt.Errorf("duplicate check failed: %w", err)
	}
	if exists {
		return nil, fmt.Errorf("CI '%s' of type '%s' already exists", req.Name, req.CIType)
	}

	if req.Status == "" {
		req.Status = "active"
	}

	item := &models.CIItem{
		ID:          uuid.New().String(),
		TenantID:    tenantID,
		Name:        req.Name,
		CIType:      req.CIType,
		Description: req.Description,
		Status:      req.Status,
		Environment: req.Environment,
		Tags:        req.Tags,
		Owner:       req.Owner,
		Attributes:  req.Attributes,
		Version:     1,
	}

	if err := s.ciRepo.Create(ctx, item); err != nil {
		return nil, fmt.Errorf("create CI failed: %w", err)
	}

	// Initial version snapshot
	snapshot, _ := json.Marshal(item)
	_ = s.ciRepo.CreateVersion(ctx, &models.CIVersion{
		ID:      uuid.New().String(),
		CIID:    item.ID,
		Version: 1,
		Changes: "Initial creation",
		Data:    models.JSONB{"snapshot": json.RawMessage(snapshot)},
		Actor:   actor,
	})

	// Audit log
	_ = s.auditRepo.Create(ctx, &models.CIAuditLog{
		ID:       uuid.New().String(),
		TenantID: tenantID,
		CIID:     item.ID,
		Action:   "create",
		Actor:    actor,
		NewValue: models.JSONB{"name": item.Name, "ci_type": item.CIType, "status": item.Status},
	})

	return item, nil
}

// GetByID returns a single CI with error wrapping.
func (s *CIService) GetByID(ctx context.Context, id, tenantID string) (*models.CIItem, error) {
	_, span := otel.Tracer("orion-cmdb-svc").Start(ctx, "CIService.GetByID")
	defer span.End()

	return s.ciRepo.GetByID(ctx, id, tenantID)
}

// List returns a paginated, filtered list of CIs.
func (s *CIService) List(ctx context.Context, tenantID string, q models.ListQuery) ([]models.CIItem, int, error) {
	_, span := otel.Tracer("orion-cmdb-svc").Start(ctx, "CIService.List")
	defer span.End()

	if q.Page <= 0 {
		q.Page = 1
	}
	if q.PageSize <= 0 {
		q.PageSize = 20
	}

	return s.ciRepo.List(ctx, tenantID, q)
}

// Update applies partial changes to a CI, records a detailed change description,
// bumps the version, creates a version snapshot, and writes an audit log.
func (s *CIService) Update(ctx context.Context, tenantID string, id string, req *models.UpdateCIRequest, actor string) (*models.CIItem, error) {
	_, span := otel.Tracer("orion-cmdb-svc").Start(ctx, "CIService.Update")
	defer span.End()

	item, err := s.ciRepo.GetByID(ctx, id, tenantID)
	if err != nil {
		return nil, fmt.Errorf("CI not found: %w", err)
	}

	// Snapshot old state for audit
	oldState := models.JSONB{
		"name":        item.Name,
		"ci_type":     item.CIType,
		"description": item.Description,
		"status":      item.Status,
		"environment": item.Environment,
		"tags":        item.Tags,
		"owner":       item.Owner,
		"attributes":  item.Attributes,
	}

	// Track individual field changes (mirrors Node.js change tracking)
	var changes []string

	if req.Name != nil && *req.Name != item.Name {
		changes = append(changes, fmt.Sprintf("name: %s -> %s", item.Name, *req.Name))
		item.Name = *req.Name
	}
	if req.CIType != nil && *req.CIType != item.CIType {
		changes = append(changes, fmt.Sprintf("ci_type: %s -> %s", item.CIType, *req.CIType))
		item.CIType = *req.CIType
	}
	if req.Description != nil && *req.Description != item.Description {
		changes = append(changes, fmt.Sprintf("description: %s -> %s", item.Description, *req.Description))
		item.Description = *req.Description
	}
	if req.Status != nil && *req.Status != item.Status {
		changes = append(changes, fmt.Sprintf("status: %s -> %s", item.Status, *req.Status))
		item.Status = *req.Status
	}
	if req.Environment != nil && *req.Environment != item.Environment {
		changes = append(changes, fmt.Sprintf("environment: %s -> %s", item.Environment, *req.Environment))
		item.Environment = *req.Environment
	}
	if req.Tags != nil {
		oldTags, _ := json.Marshal(item.Tags)
		newTags, _ := json.Marshal(*req.Tags)
		changes = append(changes, fmt.Sprintf("tags: %s -> %s", oldTags, newTags))
		item.Tags = *req.Tags
	}
	if req.Owner != nil && *req.Owner != item.Owner {
		changes = append(changes, fmt.Sprintf("owner: %s -> %s", item.Owner, *req.Owner))
		item.Owner = *req.Owner
	}
	if req.Attributes != nil {
		changes = append(changes, "attributes updated")
		// Merge attributes rather than replace (matches Node.js behavior)
		if item.Attributes == nil {
			item.Attributes = make(models.JSONB)
		}
		for k, v := range *req.Attributes {
			item.Attributes[k] = v
		}
	}

	if len(changes) == 0 {
		return item, nil // nothing to update
	}

	// Bump version
	item.Version += 1

	if err := s.ciRepo.Update(ctx, item); err != nil {
		return nil, fmt.Errorf("update CI failed: %w", err)
	}

	// Version snapshot
	snapshot, _ := json.Marshal(item)
	_ = s.ciRepo.CreateVersion(ctx, &models.CIVersion{
		ID:      uuid.New().String(),
		CIID:    item.ID,
		Version: item.Version,
		Changes: strings.Join(changes, "; "),
		Data:    models.JSONB{"snapshot": json.RawMessage(snapshot)},
		Actor:   actor,
	})

	// Audit log
	_ = s.auditRepo.Create(ctx, &models.CIAuditLog{
		ID:       uuid.New().String(),
		TenantID: tenantID,
		CIID:     item.ID,
		Action:   "update",
		Actor:    actor,
		OldValue: oldState,
		NewValue: models.JSONB{
			"name":    item.Name,
			"status":  item.Status,
			"changes": changes,
		},
	})

	return item, nil
}

// Delete soft-deletes a CI, cascades soft-delete to its relations,
// and writes an audit log.
func (s *CIService) Delete(ctx context.Context, tenantID, id, actor string) error {
	_, span := otel.Tracer("orion-cmdb-svc").Start(ctx, "CIService.Delete")
	defer span.End()

	// Verify CI exists before deleting
	if _, err := s.ciRepo.GetByID(ctx, id, tenantID); err != nil {
		return fmt.Errorf("CI not found: %w", err)
	}

	// Cascade soft-delete to relations
	_ = s.relRepo.DeleteByCI(ctx, tenantID, id)

	_ = s.auditRepo.Create(ctx, &models.CIAuditLog{
		ID:       uuid.New().String(),
		TenantID: tenantID,
		CIID:     id,
		Action:   "delete",
		Actor:    actor,
	})

	return s.ciRepo.Delete(ctx, id, tenantID)
}

// Count returns the total number of active CIs for a tenant.
func (s *CIService) Count(ctx context.Context, tenantID string) (int, error) {
	return s.ciRepo.Count(ctx, tenantID)
}

// ---------------------------------------------------------------------------
// Version management (ports CmdbService version methods)
// ---------------------------------------------------------------------------

// GetVersions returns the full version history for a CI, newest first.
func (s *CIService) GetVersions(ctx context.Context, tenantID, ciID string) ([]models.CIVersion, error) {
	_, span := otel.Tracer("orion-cmdb-svc").Start(ctx, "CIService.GetVersions")
	defer span.End()

	// Verify the CI exists and belongs to the tenant
	if _, err := s.ciRepo.GetByID(ctx, ciID, tenantID); err != nil {
		return nil, fmt.Errorf("CI not found: %w", err)
	}

	return s.ciRepo.GetVersions(ctx, ciID)
}

// GetCurrentVersion returns the current version number of a CI.
func (s *CIService) GetCurrentVersion(ctx context.Context, tenantID, ciID string) (int, error) {
	_, span := otel.Tracer("orion-cmdb-svc").Start(ctx, "CIService.GetCurrentVersion")
	defer span.End()

	return s.ciRepo.GetCurrentVersion(ctx, ciID, tenantID)
}

// RestoreToVersion rolls a CI back to a prior version. It reads the stored
// snapshot, applies it, bumps the version, and creates a new version record
// documenting the restoration.
func (s *CIService) RestoreToVersion(ctx context.Context, tenantID, ciID string, targetVersion int, actor string) (*models.CIItem, error) {
	_, span := otel.Tracer("orion-cmdb-svc").Start(ctx, "CIService.RestoreToVersion")
	defer span.End()

	item, err := s.ciRepo.GetByID(ctx, ciID, tenantID)
	if err != nil {
		return nil, fmt.Errorf("CI not found: %w", err)
	}

	versionRecord, err := s.ciRepo.GetVersion(ctx, ciID, targetVersion)
	if err != nil {
		return nil, fmt.Errorf("version %d not found for CI '%s': %w", targetVersion, ciID, err)
	}

	// Extract the snapshot from the version data
	snapshotData, ok := versionRecord.Data["snapshot"]
	if !ok {
		return nil, fmt.Errorf("version %d has no snapshot data", targetVersion)
	}

	snapshotBytes, err := json.Marshal(snapshotData)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal snapshot: %w", err)
	}

	var snapshot models.CIItem
	if err := json.Unmarshal(snapshotBytes, &snapshot); err != nil {
		return nil, fmt.Errorf("failed to unmarshal snapshot: %w", err)
	}

	// Apply the restored fields
	item.Description = snapshot.Description
	item.Status = snapshot.Status
	item.Environment = snapshot.Environment
	item.Tags = snapshot.Tags
	item.Owner = snapshot.Owner
	item.Attributes = snapshot.Attributes
	item.Version += 1

	if err := s.ciRepo.Update(ctx, item); err != nil {
		return nil, fmt.Errorf("restore update failed: %w", err)
	}

	// Create a new version recording the restoration
	snapshotBytes, _ = json.Marshal(item)
	_ = s.ciRepo.CreateVersion(ctx, &models.CIVersion{
		ID:      uuid.New().String(),
		CIID:    ciID,
		Version: item.Version,
		Changes: fmt.Sprintf("Restored to version %d", targetVersion),
		Data:    models.JSONB{"snapshot": json.RawMessage(snapshotBytes)},
		Actor:   actor,
	})

	return item, nil
}

// ---------------------------------------------------------------------------
// Relation management
// ---------------------------------------------------------------------------

// CreateRelation validates both endpoints exist, checks for duplicates,
// persists the relation, and writes an audit log.
func (s *CIService) CreateRelation(ctx context.Context, tenantID string, req *models.CreateRelationRequest, actor string) (*models.CIRelation, error) {
	_, span := otel.Tracer("orion-cmdb-svc").Start(ctx, "CIService.CreateRelation")
	defer span.End()

	// Validate both CIs exist
	if _, err := s.ciRepo.GetByID(ctx, req.SourceCIID, tenantID); err != nil {
		return nil, fmt.Errorf("source CI not found: %w", err)
	}
	if _, err := s.ciRepo.GetByID(ctx, req.TargetCIID, tenantID); err != nil {
		return nil, fmt.Errorf("target CI not found: %w", err)
	}

	// Duplicate guard
	exists, err := s.relRepo.Exists(ctx, tenantID, req.SourceCIID, req.TargetCIID, req.RelationType)
	if err != nil {
		return nil, fmt.Errorf("duplicate check failed: %w", err)
	}
	if exists {
		return nil, fmt.Errorf("relation of type '%s' already exists between '%s' and '%s'",
			req.RelationType, req.SourceCIID, req.TargetCIID)
	}

	rel := &models.CIRelation{
		ID:           uuid.New().String(),
		TenantID:     tenantID,
		SourceCIID:   req.SourceCIID,
		TargetCIID:   req.TargetCIID,
		RelationType: req.RelationType,
		Description:  req.Description,
		CreatedBy:    actor,
	}

	if err := s.relRepo.Create(ctx, rel); err != nil {
		return nil, fmt.Errorf("create relation failed: %w", err)
	}

	_ = s.auditRepo.Create(ctx, &models.CIAuditLog{
		ID:       uuid.New().String(),
		TenantID: tenantID,
		CIID:     req.SourceCIID,
		Action:   "create_relation",
		Actor:    actor,
		NewValue: models.JSONB{
			"relation_id":   rel.ID,
			"target_ci_id":  req.TargetCIID,
			"relation_type": req.RelationType,
		},
	})

	return rel, nil
}

// DeleteRelation soft-deletes a relation and writes an audit log.
func (s *CIService) DeleteRelation(ctx context.Context, tenantID, id string, actor string) error {
	_, span := otel.Tracer("orion-cmdb-svc").Start(ctx, "CIService.DeleteRelation")
	defer span.End()

	// Verify relation exists
	rel, err := s.relRepo.GetByID(ctx, id, tenantID)
	if err != nil {
		return fmt.Errorf("relation not found: %w", err)
	}

	if err := s.relRepo.Delete(ctx, id, tenantID); err != nil {
		return fmt.Errorf("delete relation failed: %w", err)
	}

	_ = s.auditRepo.Create(ctx, &models.CIAuditLog{
		ID:       uuid.New().String(),
		TenantID: tenantID,
		CIID:     rel.SourceCIID,
		Action:   "delete_relation",
		Actor:    actor,
		OldValue: models.JSONB{
			"relation_id":   rel.ID,
			"target_ci_id":  rel.TargetCIID,
			"relation_type": rel.RelationType,
		},
	})

	return nil
}

// GetTopology returns a single CI with its direct relations attached.
func (s *CIService) GetTopology(ctx context.Context, tenantID, ciID string) (*models.TopologyNode, error) {
	_, span := otel.Tracer("orion-cmdb-svc").Start(ctx, "CIService.GetTopology")
	defer span.End()

	item, err := s.ciRepo.GetByID(ctx, ciID, tenantID)
	if err != nil {
		return nil, err
	}

	rels, err := s.relRepo.ListByCI(ctx, tenantID, ciID)
	if err != nil {
		return nil, err
	}

	var edges []models.TopologyEdge
	for _, r := range rels {
		edges = append(edges, models.TopologyEdge{
			ID:           r.ID,
			TargetCIID:   r.TargetCIID,
			RelationType: r.RelationType,
		})
	}

	return &models.TopologyNode{
		CIItem:    *item,
		Relations: edges,
	}, nil
}

// ---------------------------------------------------------------------------
// Topology graph (ports TopologyService.getTopology)
// ---------------------------------------------------------------------------

// GetFullTopology builds the complete topology graph for a tenant:
// every CI becomes a node, every relation becomes a directed edge.
// If rootCiID is non-empty and depth > 0, the graph is pruned via BFS
// to only include nodes reachable within the given depth.
func (s *CIService) GetFullTopology(ctx context.Context, tenantID string, rootCiID string, depth int) (*models.TopologyResponse, error) {
	_, span := otel.Tracer("orion-cmdb-svc").Start(ctx, "CIService.GetFullTopology")
	defer span.End()

	// Fetch all CIs for the tenant
	cis, err := s.ciRepo.ListAllByTenant(ctx, tenantID)
	if err != nil {
		return nil, fmt.Errorf("list CIs failed: %w", err)
	}

	// Build nodes and node map
	nodeMap := make(map[string]*models.CIItem)
	for i := range cis {
		nodeMap[cis[i].ID] = &cis[i]
	}

	// Fetch all relations
	rels, err := s.relRepo.ListAllByTenant(ctx, tenantID)
	if err != nil {
		return nil, fmt.Errorf("list relations failed: %w", err)
	}

	// Build adjacency list from relations
	adj := make(map[string][]neighbor)
	edgeSet := make(map[string]bool)

	for _, rel := range rels {
		edgeKey := rel.SourceCIID + ":" + rel.TargetCIID + ":" + rel.RelationType
		if edgeSet[edgeKey] {
			continue
		}
		edgeSet[edgeKey] = true

		topoEdge := models.TopologyEdge{
			ID:           rel.ID,
			TargetCIID:   rel.TargetCIID,
			RelationType: rel.RelationType,
		}

		adj[rel.SourceCIID] = append(adj[rel.SourceCIID], neighbor{
			ciID: rel.TargetCIID,
			edge: topoEdge,
		})
		// Reverse edge for undirected traversal
		adj[rel.TargetCIID] = append(adj[rel.TargetCIID], neighbor{
			ciID: rel.SourceCIID,
			edge: models.TopologyEdge{
				ID:           rel.ID,
				TargetCIID:   rel.SourceCIID,
				RelationType: rel.RelationType,
			},
		})
	}

	// If a root and depth are specified, prune via BFS
	if rootCiID != "" && depth > 0 {
		return s.bfsPrune(cis, adj, rootCiID, depth), nil
	}

	// Build full topology
	nodes := make([]models.TopologyNode, 0, len(cis))
	for _, ci := range cis {
		var ciEdges []models.TopologyEdge
		for _, nb := range adj[ci.ID] {
			ciEdges = append(ciEdges, nb.edge)
		}
		nodes = append(nodes, models.TopologyNode{CIItem: ci, Relations: ciEdges})
	}

	var allEdges []models.TopologyEdge
	seen := make(map[string]bool)
	for _, nbList := range adj {
		for _, nb := range nbList {
			if !seen[nb.edge.ID] {
				seen[nb.edge.ID] = true
				allEdges = append(allEdges, nb.edge)
			}
		}
	}

	return &models.TopologyResponse{Nodes: nodes, Edges: allEdges}, nil
}

// neighbor represents a graph adjacency entry used by topology methods.
type neighbor struct {
	ciID string
	edge models.TopologyEdge
}

// bfsPrune performs BFS from rootCiID and retains only nodes within maxDepth hops.
func (s *CIService) bfsPrune(
	cis []models.CIItem,
	adj map[string][]neighbor,
	rootCiID string,
	maxDepth int,
) *models.TopologyResponse {

	type queueItem struct {
		ciID  string
		depth int
	}
	queue := []queueItem{{ciID: rootCiID, depth: 0}}
	visited := make(map[string]bool)
	filteredNodes := make(map[string]bool)
	var filteredEdges []models.TopologyEdge
	seenEdge := make(map[string]bool)

	for len(queue) > 0 {
		item := queue[0]
		queue = queue[1:]

		if visited[item.ciID] || item.depth > maxDepth {
			continue
		}
		visited[item.ciID] = true
		filteredNodes[item.ciID] = true

		if item.depth < maxDepth {
			for _, nb := range adj[item.ciID] {
				if !visited[nb.ciID] {
					queue = append(queue, queueItem{ciID: nb.ciID, depth: item.depth + 1})
					if !seenEdge[nb.edge.ID] {
						seenEdge[nb.edge.ID] = true
						filteredEdges = append(filteredEdges, nb.edge)
					}
				}
			}
		}
	}

	// Filter nodes
	resultNodes := make([]models.TopologyNode, 0, len(filteredNodes))
	for _, ci := range cis {
		if filteredNodes[ci.ID] {
			resultNodes = append(resultNodes, models.TopologyNode{CIItem: ci})
		}
	}

	return &models.TopologyResponse{Nodes: resultNodes, Edges: filteredEdges}
}

// ---------------------------------------------------------------------------
// Impact analysis (ports TopologyService.getImpactAnalysis)
// ---------------------------------------------------------------------------

// GetImpactAnalysis performs a reverse BFS from the given CI to find all
// CIs that depend on it (the "blast radius"). Returns the affected subgraph
// and an impact level: critical (>=10), high (>=5), medium (>=2), low (<2).
func (s *CIService) GetImpactAnalysis(ctx context.Context, tenantID, ciID string) (*models.ImpactAnalysisResult, error) {
	_, span := otel.Tracer("orion-cmdb-svc").Start(ctx, "CIService.GetImpactAnalysis")
	defer span.End()

	// Verify CI exists
	if _, err := s.ciRepo.GetByID(ctx, ciID, tenantID); err != nil {
		return nil, fmt.Errorf("CI not found: %w", err)
	}

	// Collect all relations for the tenant
	rels, err := s.relRepo.ListAllByTenant(ctx, tenantID)
	if err != nil {
		return nil, fmt.Errorf("list relations failed: %w", err)
	}

	// Build reverse adjacency: target -> sources (who depends on me)
	reverseAdj := make(map[string][]models.CIRelation)
	for _, rel := range rels {
		reverseAdj[rel.TargetCIID] = append(reverseAdj[rel.TargetCIID], rel)
	}

	// BFS in reverse direction
	visited := make(map[string]bool)
	var affectedNodes []models.TopologyNode
	var affectedEdges []models.TopologyEdge

	var collectDependents func(currentCiID string)
	collectDependents = func(currentCiID string) {
		if visited[currentCiID] {
			return
		}
		visited[currentCiID] = true

		for _, rel := range reverseAdj[currentCiID] {
			sourceCI, err := s.ciRepo.GetByID(ctx, rel.SourceCIID, tenantID)
			if err != nil {
				continue
			}
			affectedNodes = append(affectedNodes, models.TopologyNode{CIItem: *sourceCI})
			affectedEdges = append(affectedEdges, models.TopologyEdge{
				ID:           rel.ID,
				TargetCIID:   rel.TargetCIID,
				RelationType: rel.RelationType,
			})
			collectDependents(rel.SourceCIID)
		}
	}

	collectDependents(ciID)

	// Determine impact level
	impactLevel := "low"
	switch {
	case len(affectedNodes) >= 10:
		impactLevel = "critical"
	case len(affectedNodes) >= 5:
		impactLevel = "high"
	case len(affectedNodes) >= 2:
		impactLevel = "medium"
	}

	return &models.ImpactAnalysisResult{
		AffectedNodes: affectedNodes,
		AffectedEdges: affectedEdges,
		ImpactLevel:   impactLevel,
	}, nil
}

// ---------------------------------------------------------------------------
// Service dependency chain (ports TopologyService.getServiceDependencies)
// ---------------------------------------------------------------------------

// GetServiceDependencies walks the relation graph forward from the given CI
// to collect its full dependency tree (up to 10 levels deep).
func (s *CIService) GetServiceDependencies(ctx context.Context, tenantID, ciID string) (*models.TopologyResponse, error) {
	_, span := otel.Tracer("orion-cmdb-svc").Start(ctx, "CIService.GetServiceDependencies")
	defer span.End()

	if _, err := s.ciRepo.GetByID(ctx, ciID, tenantID); err != nil {
		return nil, fmt.Errorf("CI not found: %w", err)
	}

	visited := make(map[string]bool)
	var nodes []models.TopologyNode
	var edges []models.TopologyEdge
	seenEdge := make(map[string]bool)

	var collect func(currentID string, depth int)
	collect = func(currentID string, depth int) {
		if depth > 10 || visited[currentID] {
			return
		}
		visited[currentID] = true

		ci, err := s.ciRepo.GetByID(ctx, currentID, tenantID)
		if err != nil {
			return
		}

		nodes = append(nodes, models.TopologyNode{CIItem: *ci})

		rels, err := s.relRepo.ListByCI(ctx, tenantID, currentID)
		if err != nil {
			return
		}

		for _, rel := range rels {
			if !seenEdge[rel.ID] {
				seenEdge[rel.ID] = true
				edges = append(edges, models.TopologyEdge{
					ID:           rel.ID,
					TargetCIID:   rel.TargetCIID,
					RelationType: rel.RelationType,
				})
			}

			// Walk to the other end of the relation
			var nextID string
			if rel.SourceCIID == currentID {
				nextID = rel.TargetCIID
			} else {
				nextID = rel.SourceCIID
			}
			collect(nextID, depth+1)
		}
	}

	collect(ciID, 0)

	return &models.TopologyResponse{Nodes: nodes, Edges: edges}, nil
}

// ListCIRelations returns all active relations for a given CI.
func (s *CIService) ListCIRelations(ctx context.Context, tenantID, ciID string) ([]models.CIRelation, error) {
	_, span := otel.Tracer("orion-cmdb-svc").Start(ctx, "CIService.ListCIRelations")
	defer span.End()

	return s.relRepo.ListByCI(ctx, tenantID, ciID)
}

// ---------------------------------------------------------------------------
// Batch operations (Task 4.15)
// ---------------------------------------------------------------------------

// BatchCreate creates multiple CIs in one transaction.
func (s *CIService) BatchCreate(ctx context.Context, tenantID string, items []models.CreateCIRequest, actor string) (int, int, []models.CIItem, error) {
	_, span := otel.Tracer("orion-cmdb-svc").Start(ctx, "CIService.BatchCreate")
	defer span.End()

	createdItems := make([]models.CIItem, 0, len(items))
	for _, item := range items {
		if item.Name == "" || item.CIType == "" {
			continue // skip invalid items
		}
		if item.Status == "" {
			item.Status = "active"
		}
		createdItems = append(createdItems, models.CIItem{
			ID:          uuid.New().String(),
			TenantID:    tenantID,
			Name:        item.Name,
			CIType:      item.CIType,
			Description: item.Description,
			Status:      item.Status,
			Environment: item.Environment,
			Tags:        item.Tags,
			Owner:       item.Owner,
			Attributes:  item.Attributes,
			Version:     1,
		})
	}

	if len(createdItems) == 0 {
		return 0, 0, nil, nil
	}

	succeeded, failed, created, err := s.ciRepo.CreateMany(ctx, createdItems)
	if err != nil {
		return 0, 0, nil, fmt.Errorf("batch create failed: %w", err)
	}

	// Write audit log
	_ = s.auditRepo.Create(ctx, &models.CIAuditLog{
		ID:       uuid.New().String(),
		TenantID: tenantID,
		Action:   "batch_create",
		Actor:    actor,
		NewValue: models.JSONB{"count": succeeded},
	})

	return succeeded, failed, created, nil
}

// BatchUpdate updates multiple CIs by ID.
func (s *CIService) BatchUpdate(ctx context.Context, tenantID string, items []models.CIItem, actor string) (int, int, error) {
	_, span := otel.Tracer("orion-cmdb-svc").Start(ctx, "CIService.BatchUpdate")
	defer span.End()

	if len(items) == 0 {
		return 0, 0, nil
	}

	succeeded, failed, err := s.ciRepo.UpdateMany(ctx, items)
	if err != nil {
		return 0, 0, fmt.Errorf("batch update failed: %w", err)
	}

	_ = s.auditRepo.Create(ctx, &models.CIAuditLog{
		ID:       uuid.New().String(),
		TenantID: tenantID,
		Action:   "batch_update",
		Actor:    actor,
		NewValue: models.JSONB{"count": succeeded},
	})

	return succeeded, failed, nil
}

// BatchDelete soft-deletes multiple CIs by ID.
func (s *CIService) BatchDelete(ctx context.Context, tenantID string, ids []string) (int, int, error) {
	_, span := otel.Tracer("orion-cmdb-svc").Start(ctx, "CIService.BatchDelete")
	defer span.End()

	deleted, failed, err := s.ciRepo.DeleteMany(ctx, ids, tenantID)
	if err != nil {
		return 0, 0, fmt.Errorf("batch delete failed: %w", err)
	}

	_ = s.auditRepo.Create(ctx, &models.CIAuditLog{
		ID:       uuid.New().String(),
		TenantID: tenantID,
		Action:   "batch_delete",
		Actor:    "system",
		NewValue: models.JSONB{"count": deleted},
	})

	return deleted, failed, nil
}

// ---------------------------------------------------------------------------
// Batch query (complex filter)
// ---------------------------------------------------------------------------

// BatchQuery returns CIs with complex filter criteria.
func (s *CIService) BatchQuery(ctx context.Context, tenantID string, req models.ListRequest) ([]models.CIItem, int, error) {
	_, span := otel.Tracer("orion-cmdb-svc").Start(ctx, "CIService.BatchQuery")
	defer span.End()

	if req.Page <= 0 {
		req.Page = 1
	}
	if req.PageSize <= 0 {
		req.PageSize = 20
	}

	q := models.ListQuery{
		Page:        req.Page,
		PageSize:    req.PageSize,
		CIType:      req.CIType,
		Status:      req.Status,
		Environment: req.Environment,
		Tags:        req.Tags,
		Search:      req.Search,
		OrderBy:     req.OrderBy,
		Order:       req.Order,
	}

	items, total, err := s.ciRepo.List(ctx, tenantID, q)
	if err != nil {
		return nil, 0, fmt.Errorf("query failed: %w", err)
	}

	return items, total, nil
}

// ---------------------------------------------------------------------------
// Import / Export
// ---------------------------------------------------------------------------

// ImportCIs imports a list of CI raw data, creating new ones or skipping duplicates.
func (s *CIService) ImportCIs(ctx context.Context, tenantID string, raw []models.ImportCIRaw, skipDuplicates bool, actor string) (*models.ImportResult, error) {
	_, span := otel.Tracer("orion-cmdb-svc").Start(ctx, "CIService.ImportCIs")
	defer span.End()

	result := &models.ImportResult{}

	for _, item := range raw {
		if item.Name == "" || item.CIType == "" {
			result.Failed++
			continue
		}

		// Check for duplicates
		exists, err := s.ciRepo.Exists(ctx, tenantID, item.Name, item.CIType)
		if err != nil {
			result.Failed++
			continue
		}
		if exists {
			if skipDuplicates {
				result.Skipped++
			} else {
				result.Failed++
			}
			continue
		}

		status := item.Status
		if status == "" {
			status = "active"
		}

		ci := &models.CIItem{
			ID:          uuid.New().String(),
			TenantID:    tenantID,
			Name:        item.Name,
			CIType:      item.CIType,
			Description: item.Description,
			Status:      status,
			Environment: item.Environment,
			Tags:        item.Tags,
			Owner:       item.Owner,
			Attributes:  item.Attributes,
			Version:     1,
		}

		if err := s.ciRepo.Create(ctx, ci); err != nil {
			result.Failed++
			continue
		}
		result.Created++
	}

	_ = s.auditRepo.Create(ctx, &models.CIAuditLog{
		ID:       uuid.New().String(),
		TenantID: tenantID,
		Action:   "import",
		Actor:    actor,
		NewValue: models.JSONB{"created": result.Created, "skipped": result.Skipped, "failed": result.Failed},
	})

	return result, nil
}

// ExportCIs returns all CIs matching the export criteria.
func (s *CIService) ExportCIs(ctx context.Context, tenantID string, q models.ExportQuery) ([]models.CIItem, error) {
	_, span := otel.Tracer("orion-cmdb-svc").Start(ctx, "CIService.ExportCIs")
	defer span.End()

	items, err := s.ciRepo.ListForExport(ctx, tenantID, q)
	if err != nil {
		return nil, fmt.Errorf("export failed: %w", err)
	}

	return items, nil
}

// ExportCI exports a single CI by ID (UUID or business name).
func (s *CIService) ExportCI(ctx context.Context, tenantID string, id string) (*models.CIItem, error) {
	_, span := otel.Tracer("orion-cmdb-svc").Start(ctx, "CIService.ExportCI")
	defer span.End()

	// First try as UUID
	item, err := s.ciRepo.GetByID(ctx, id, tenantID)
	if err != nil {
		// Fallback: try as business CI ID (name)
		item, err = s.ciRepo.GetByCiID(ctx, id, tenantID)
		if err != nil {
			return nil, err
		}
	}
	return item, nil
}

// GetCIByCiID returns a CI by its business key (name-based lookup).
func (s *CIService) GetCIByCiID(ctx context.Context, tenantID, ciID string) (*models.CIItem, error) {
	return s.ciRepo.GetByCiID(ctx, ciID, tenantID)
}
