package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"sync"
	"time"

	"orion/platform-svc-go/internal/graph/models"
	"orion/platform-svc-go/internal/graph/repository"
)

// Service provides business logic for graph operations.
type Service struct {
	mu sync.RWMutex

	nodeRepo   *repository.GraphNodeRepository
	relRepo    *repository.GraphRelationshipRepository

	// In-memory fallback (used when repository is nil)
	nodes     map[string]*models.GraphNode
	rels      map[string]*models.GraphRelationship
	nodeSeq   int
	relSeq    int
}

// NewService creates a Service with PostgreSQL repositories.
func NewService(nodeRepo *repository.GraphNodeRepository, relRepo *repository.GraphRelationshipRepository) *Service {
	return &Service{
		nodeRepo: nodeRepo,
		relRepo:  relRepo,
	}
}

// NewServiceInMemory creates a Service with in-memory storage (for testing/blueprint).
func NewServiceInMemory() *Service {
	return &Service{
		nodes: make(map[string]*models.GraphNode),
		rels:  make(map[string]*models.GraphRelationship),
	}
}

// --- Node CRUD ---

// CreateNode creates a new graph node.
func (s *Service) CreateNode(ctx context.Context, tenantID string, req models.CreateNodeRequest) (*models.GraphNode, error) {
	if err := s.validateLabel(req.Labels); err != nil {
		return nil, err
	}

	if s.nodeRepo != nil {
		return s.nodeRepo.CreateNode(ctx, tenantID, req)
	}
	return s.createNodeInMemory(tenantID, req)
}

// GetNode retrieves a node by ID.
func (s *Service) GetNode(ctx context.Context, tenantID, id string) (*models.GraphNode, error) {
	if s.nodeRepo != nil {
		return s.nodeRepo.GetNodeByTenant(ctx, tenantID, id)
	}
	return s.getNodeInMemory(id)
}

// ListNodes returns nodes for a tenant.
func (s *Service) ListNodes(ctx context.Context, tenantID string, label string, limit int) ([]models.GraphNode, error) {
	if s.nodeRepo != nil {
		return s.nodeRepo.ListNodesByTenant(ctx, tenantID, label, limit)
	}
	return s.listNodesInMemory(tenantID, label, limit)
}

// UpdateNode updates a node.
func (s *Service) UpdateNode(ctx context.Context, tenantID, id string, req models.UpdateNodeRequest) (*models.GraphNode, error) {
	if s.nodeRepo != nil {
		return s.nodeRepo.UpdateNode(ctx, tenantID, id, req)
	}
	return s.updateNodeInMemory(tenantID, id, req)
}

// DeleteNode deletes a node and its relationships.
func (s *Service) DeleteNode(ctx context.Context, tenantID, id string) error {
	// Delete relationships first
	if s.relRepo != nil {
		_, err := s.relRepo.DeleteByNodeId(ctx, tenantID, id)
		if err != nil {
			return err
		}
	} else {
		s.deleteRelsByNodeInMemory(id)
	}

	// Delete the node
	if s.nodeRepo != nil {
		return s.nodeRepo.DeleteNode(ctx, tenantID, id)
	}
	return s.deleteNodeInMemory(id)
}

// --- Relationship CRUD ---

// CreateRelationship creates a new relationship.
func (s *Service) CreateRelationship(ctx context.Context, tenantID string, req models.CreateRelationshipRequest) (*models.GraphRelationship, error) {
	// Validate nodes exist
	nodeExists, err := s.nodeExists(ctx, tenantID, req.StartNodeID)
	if err != nil {
		return nil, err
	}
	if !nodeExists {
		return nil, ErrStartNodeNotFound
	}
	nodeExists, err = s.nodeExists(ctx, tenantID, req.EndNodeID)
	if err != nil {
		return nil, err
	}
	if !nodeExists {
		return nil, ErrEndNodeNotFound
	}

	// Validate relationship type
	if err := s.validateRelationshipType(req.Type); err != nil {
		return nil, err
	}

	if s.relRepo != nil {
		return s.relRepo.CreateRelationship(ctx, tenantID, req)
	}
	return s.createRelInMemory(tenantID, req)
}

// GetRelationship retrieves a relationship by ID.
func (s *Service) GetRelationship(ctx context.Context, tenantID, id string) (*models.GraphRelationship, error) {
	if s.relRepo != nil {
		return s.relRepo.GetRelationshipByTenant(ctx, tenantID, id)
	}
	return s.getRelInMemory(id)
}

// ListRelationships returns relationships for a tenant.
func (s *Service) ListRelationships(ctx context.Context, tenantID string, relType string, limit int) ([]models.GraphRelationship, error) {
	if s.relRepo != nil {
		return s.relRepo.ListRelationshipsByTenant(ctx, tenantID, relType, limit)
	}
	return s.listRelsInMemory(tenantID, relType, limit)
}

// UpdateRelationship updates a relationship.
func (s *Service) UpdateRelationship(ctx context.Context, tenantID, id string, req models.UpdateRelationshipRequest) (*models.GraphRelationship, error) {
	if s.relRepo != nil {
		return s.relRepo.UpdateRelationship(ctx, tenantID, id, req)
	}
	return s.updateRelInMemory(tenantID, id, req)
}

// DeleteRelationship deletes a relationship.
func (s *Service) DeleteRelationship(ctx context.Context, tenantID, id string) error {
	if s.relRepo != nil {
		return s.relRepo.DeleteRelationship(ctx, tenantID, id)
	}
	return s.deleteRelInMemory(id)
}

// --- Traversal / Path ---

// FindShortestPath finds the shortest path between two nodes.
// Uses BFS over relationships.
func (s *Service) FindShortestPath(ctx context.Context, tenantID string, req models.FindPathRequest) ([]models.GraphPath, error) {
	_, err := s.GetNode(ctx, tenantID, req.StartID)
	if err != nil {
		return nil, fmt.Errorf("start node not found: %w", err)
	}
	_, err = s.GetNode(ctx, tenantID, req.EndID)
	if err != nil {
		return nil, fmt.Errorf("end node not found: %w", err)
	}

	// BFS traversal
	paths, err := s.bfsPaths(ctx, tenantID, req.StartID, req.EndID)
	if err != nil {
		return nil, err
	}

	// Populate nodes for each path
	for i, p := range paths {
		p.Nodes = s.pathNodesFromRels(ctx, p.Relationships)
		paths[i].Nodes = p.Nodes
	}

	return paths, nil
}

// Neighbors returns nodes connected to a given node (up to depth).
func (s *Service) Neighbors(ctx context.Context, tenantID, nodeId string, depth int) ([]models.GraphPath, error) {
	if s.relRepo != nil {
		return s.relRepo.Neighbors(ctx, tenantID, nodeId, depth)
	}
	return s.neighborsInMemory(nodeId, depth)
}

// --- Graph Query (Cypher-style) ---

// ExecuteQuery executes a Cypher-style query (simplified for PostgreSQL).
// In production, this would call a Neo4j service. For now, it supports
// basic node/relationship queries.
func (s *Service) ExecuteQuery(ctx context.Context, tenantID string, req models.GraphQueryRequest) (*models.GraphResult, error) {
	// Parse simple Cypher-like queries for common patterns
	// Full Cypher support would require Neo4j; here we support basic retrieval
	result := &models.GraphResult{}

	// Support: MATCH (n) WHERE n.labels = [...], return node
	// Support: MATCH (a)-[r]->(b), return edges
	// For now, extract node IDs from params and return them
	params := req.Params
	if nodeIDs, ok := params["nodeIds"]; ok {
		if ids, ok := nodeIDs.([]interface{}); ok {
			for _, idAny := range ids {
				if id, ok := idAny.(string); ok {
					node, err := s.GetNode(ctx, tenantID, id)
					if err == nil {
						result.Nodes = append(result.Nodes, *node)
					}
				}
			}
		}
	}

	result.Count = len(result.Nodes)
	return result, nil
}

// --- Topology ---

// GetServiceTopology returns the service topology graph.
func (s *Service) GetServiceTopology(ctx context.Context, tenantID string) ([]models.TopologyNode, error) {
	// Get all nodes with "Service" label
	nodes, err := s.ListNodes(ctx, tenantID, "Service", 0) // 0 = no limit for PG
	if err != nil {
		return nil, err
	}

	// Build topology
	topoNodes := make(map[string]*models.TopologyNode)

	for _, node := range nodes {
		name := "Unknown"
		status := "unknown"
		props := node.Properties
		if p, ok := props["name"]; ok {
            name = fmt.Sprintf("%v", p)
        }
        if p, ok := props["status"]; ok {
            status = fmt.Sprintf("%v", p)
        }

		if _, ok := topoNodes[node.ID]; !ok {
			topoNodes[node.ID] = &models.TopologyNode{
				ID:          node.ID,
				Name:        name,
				Type:        node.Labels,
				Status:      status,
				Properties:  props,
				Connections: []string{},
			}
		}
	}

	// Get all relationships and add connections
	rels, err := s.ListRelationships(ctx, tenantID, "", 0)
	if err != nil {
		return nil, err
	}
	for _, rel := range rels {
		if src, ok := topoNodes[rel.StartNodeID]; ok {
			src.Connections = append(src.Connections, rel.EndNodeID)
		}
	}

	result := make([]models.TopologyNode, 0, len(topoNodes))
	for _, n := range topoNodes {
		result = append(result, *n)
	}
	return result, nil
}

// --- Stats ---

// GetStats returns graph statistics.
func (s *Service) GetStats(ctx context.Context, tenantID string) (*models.GraphStats, error) {
	stats := &models.GraphStats{}

	if s.nodeRepo != nil {
		stats.TotalNodes = int(s.nodeCount(tenantID))
		stats.TotalRels = int(s.relCount(tenantID))
		// Additional stats would come from DB queries
	} else {
		s.mu.RLock()
        stats.TotalNodes = len(s.nodes)
        stats.TotalRels = len(s.rels)
        s.mu.RUnlock()
	}

	return stats, nil
}

// --- Helpers ---

func (s *Service) nodeExists(ctx context.Context, tenantID, nodeID string) (bool, error) {
	if s.nodeRepo != nil {
		return s.nodeRepo.NodeExists(ctx, tenantID, nodeID)
	}
	s.mu.RLock()
	_, ok := s.nodes[nodeID]
	s.mu.RUnlock()
	return ok, nil
}

func (s *Service) nodeCount(tenantID string) int64 {
	if s.nodeRepo != nil {
		// Would need context; for stats we approximate
		_ = tenantID
	}
	s.mu.RLock()
	c := int64(0)
	for _, n := range s.nodes {
		if n.TenantID == tenantID {
			c++
		}
	}
	s.mu.RUnlock()
	return c
}

func (s *Service) relCount(tenantID string) int64 {
	if s.relRepo != nil {
		_ = tenantID
	}
	s.mu.RLock()
	c := int64(0)
	for _, r := range s.rels {
		if r.TenantID == tenantID {
			c++
		}
	}
	s.mu.RUnlock()
	return c
}

// validateLabel ensures labels are valid (alphanumeric + underscore + space).
func (s *Service) validateLabel(labels []string) error {
	labelRe := regexp.MustCompile(`^[a-zA-Z_][a-zA-Z0-9_ ]*$`)
	for _, l := range labels {
		if !labelRe.MatchString(l) {
			return fmt.Errorf("%w: %q. Only alphanumeric characters, underscores, and spaces allowed", ErrInvalidLabel, l)
		}
	}
	return nil
}

// validateRelationshipType ensures type is a valid Cypher relationship type.
func (s *Service) validateRelationshipType(t string) error {
	if !regexp.MustCompile(`^[a-zA-Z_][a-zA-Z0-9_]*$`).MatchString(t) {
		return fmt.Errorf("%w: %q. Only alphanumeric characters and underscores allowed", ErrInvalidRelType, t)
	}
	return nil
}

// bfsPaths performs BFS to find all shortest paths between start and end.
func (s *Service) bfsPaths(ctx context.Context, tenantID, startID, endID string) ([]models.GraphPath, error) {
	// Build adjacency list from all relationships
	adjacency := make(map[string][]*models.GraphRelationship) // nodeID -> outgoing edges
	relMap := make(map[string]*models.GraphRelationship)

	if s.relRepo != nil {
		rels, err := s.relRepo.ListRelationshipsByTenant(ctx, tenantID, "", 0)
		if err != nil {
			return nil, err
		}
		for i := range rels {
			relMap[rels[i].ID] = &rels[i]
			adjacency[rels[i].StartNodeID] = append(adjacency[rels[i].StartNodeID], &rels[i])
		}
	} else {
		s.mu.RLock()
		for _, r := range s.rels {
			relMap[r.ID] = r
			adjacency[r.StartNodeID] = append(adjacency[r.StartNodeID], r)
		}
		s.mu.RUnlock()
	}

	// BFS
	type queueItem struct {
		nodeID  string
		path    []*models.GraphRelationship
	}

	var paths []models.GraphPath
	visited := make(map[string]bool)
	queue := []queueItem{{startID, nil}}

	for len(queue) > 0 {
		item := queue[0]
		queue = queue[1:]

		if item.nodeID == endID {
            p := models.GraphPath{
                Relationships: make([]models.GraphRelationship, len(item.path)),
            }
            for i, r := range item.path {
                p.Relationships[i] = *r
            }
            paths = append(paths, p)
            continue
        }

        if visited[item.nodeID] {
            continue
        }
        visited[item.nodeID] = true

        for _, edge := range adjacency[item.nodeID] {
            nextPath := make([]*models.GraphRelationship, len(item.path))
            copy(nextPath, item.path)
            nextPath = append(nextPath, edge)
            queue = append(queue, queueItem{edge.EndNodeID, nextPath})
        }
	}

	return paths, nil
}

// pathNodesFromRels extracts unique nodes from a path's relationships.
func (s *Service) pathNodesFromRels(ctx context.Context, rels []models.GraphRelationship) []models.GraphNode {
	seen := make(map[string]bool)
	var nodes []models.GraphNode

	for _, r := range rels {
        if !seen[r.StartNodeID] {
            seen[r.StartNodeID] = true
            node, _ := s.GetNode(ctx, "", r.StartNodeID) // skip tenant for path
            if node != nil {
                nodes = append(nodes, *node)
            }
        }
        if !seen[r.EndNodeID] {
            seen[r.EndNodeID] = true
            node, _ := s.GetNode(ctx, "", r.EndNodeID)
            if node != nil {
                nodes = append(nodes, *node)
            }
        }
	}

	return nodes
}

// --- In-memory implementations (for blueprint/testing) ---

func (s *Service) createNodeInMemory(tenantID string, req models.CreateNodeRequest) (*models.GraphNode, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	id := fmt.Sprintf("node_%d", s.nodeSeq)
	s.nodeSeq++
	now := time.Now().UTC()

	labels, _ := json.Marshal(req.Labels)
	node := &models.GraphNode{
		ID:         id,
		TenantID:   tenantID,
		Labels:     string(labels),
		Properties: req.Properties,
		CreatedAt:  now,
		UpdatedAt:  now,
	}
	s.nodes[id] = node
	return node, nil
}

func (s *Service) getNodeInMemory(id string) (*models.GraphNode, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if node, ok := s.nodes[id]; ok {
		return node, nil
	}
	return nil, ErrNodeNotFound
}

func (s *Service) listNodesInMemory(tenantID string, label string, limit int) ([]models.GraphNode, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var result []models.GraphNode
	for _, node := range s.nodes {
		if node.TenantID != tenantID {
			continue
		}
		if label != "" && !s.labelContains(node.Labels, label) {
			continue
		}
		result = append(result, *node)
	}
	if limit > 0 && len(result) > limit {
		result = result[:limit]
	}
	return result, nil
}

func (s *Service) updateNodeInMemory(tenantID, id string, req models.UpdateNodeRequest) (*models.GraphNode, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	node, ok := s.nodes[id]
	if !ok || node.TenantID != tenantID {
		return nil, ErrNodeNotFound
	}
	if req.Labels != nil {
		labels, _ := json.Marshal(*req.Labels)
		node.Labels = string(labels)
	}
	if req.Properties != nil {
		node.Properties = req.Properties
	}
	node.UpdatedAt = time.Now().UTC()
	return node, nil
}

func (s *Service) deleteNodeInMemory(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.nodes[id]; !ok {
		return ErrNodeNotFound
	}
	delete(s.nodes, id)
	return nil
}

func (s *Service) labelContains(labelsJSON string, label string) bool {
	var labels []string
	json.Unmarshal([]byte(labelsJSON), &labels)
	for _, l := range labels {
		if l == label {
			return true
		}
	}
	return false
}

func (s *Service) createRelInMemory(tenantID string, req models.CreateRelationshipRequest) (*models.GraphRelationship, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	id := fmt.Sprintf("rel_%d", s.relSeq)
	s.relSeq++
	now := time.Now().UTC()

	rel := &models.GraphRelationship{
		ID:          id,
		TenantID:    tenantID,
		Type:        req.Type,
		StartNodeID: req.StartNodeID,
		EndNodeID:   req.EndNodeID,
		Properties:  req.Properties,
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	s.rels[id] = rel
	return rel, nil
}

func (s *Service) getRelInMemory(id string) (*models.GraphRelationship, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if rel, ok := s.rels[id]; ok {
		return rel, nil
	}
	return nil, ErrRelNotFound
}

func (s *Service) listRelsInMemory(tenantID string, relType string, limit int) ([]models.GraphRelationship, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var result []models.GraphRelationship
	for _, rel := range s.rels {
		if rel.TenantID != tenantID {
			continue
		}
		if relType != "" && rel.Type != relType {
			continue
		}
		// Check node tenant
		if src, ok := s.nodes[rel.StartNodeID]; !ok || src.TenantID != tenantID {
			continue
		}
		result = append(result, *rel)
	}
	if limit > 0 && len(result) > limit {
		// Already limited by tenant+type; sort by created_at if needed
		_ = limit
	}
	return result, nil
}

func (s *Service) updateRelInMemory(tenantID, id string, req models.UpdateRelationshipRequest) (*models.GraphRelationship, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	rel, ok := s.rels[id]
	if !ok || rel.TenantID != tenantID {
		return nil, ErrRelNotFound
	}
	if req.Type != nil {
		rel.Type = *req.Type
	}
	if req.StartNodeID != nil {
		rel.StartNodeID = *req.StartNodeID
	}
	if req.EndNodeID != nil {
		rel.EndNodeID = *req.EndNodeID
	}
	if req.Properties != nil {
		rel.Properties = req.Properties
	}
	rel.UpdatedAt = time.Now().UTC()
	return rel, nil
}

func (s *Service) deleteRelInMemory(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.rels[id]; !ok {
		return ErrRelNotFound
	}
	delete(s.rels, id)
	return nil
}

func (s *Service) deleteRelsByNodeInMemory(nodeID string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for id, rel := range s.rels {
		if rel.StartNodeID == nodeID || rel.EndNodeID == nodeID {
			delete(s.rels, id)
		}
	}
}

func (s *Service) neighborsInMemory(nodeID string, depth int) ([]models.GraphPath, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var rels []models.GraphRelationship
	for _, rel := range s.rels {
		if rel.StartNodeID == nodeID || rel.EndNodeID == nodeID {
			rels = append(rels, *rel)
		}
	}

	var paths []models.GraphPath
	if len(rels) > 0 {
		paths = append(paths, models.GraphPath{Relationships: rels})
	}
	_ = depth // BFS depth handling would go here
	return paths, nil
}

// Errors
var (
	ErrNodeNotFound       = errors.New("node not found")
	ErrRelNotFound        = errors.New("relationship not found")
	ErrStartNodeNotFound  = errors.New("start node not found")
	ErrEndNodeNotFound    = errors.New("end node not found")
	ErrDuplicateNode      = errors.New("node already exists")
	ErrDuplicateRel       = errors.New("relationship already exists")
	ErrInvalidLabel       = errors.New("invalid label format")
	ErrInvalidRelType     = errors.New("invalid relationship type format")
	ErrMaxDepthExceeded   = errors.New("max traversal depth exceeded")
)
