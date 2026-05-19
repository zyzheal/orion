package topology

import (
	"fmt"

	cmdbService "github.com/orion-platform/orion-cmdb/internal/cmdb"
	"github.com/orion-platform/orion-cmdb/internal/relation"
)

// Service defines the business logic layer for topology operations
type Service struct {
	cmdbSvc     *cmdbService.Service
	relationSvc *relation.Service
}

// NewService creates a new topology service
func NewService(cmdbSvc *cmdbService.Service, relationSvc *relation.Service) *Service {
	return &Service{
		cmdbSvc:     cmdbSvc,
		relationSvc: relationSvc,
	}
}

// BuildTopology builds a topology graph for a given tenant and optional CI type filter
func (s *Service) BuildTopology(tenantID int64, ciType string) (*Topology, error) {
	if tenantID == 0 {
		return nil, ErrInvalidTenantID
	}

	// Get all CIs for the tenant
	var cis []cmdbService.CI
	var total int64
	var err error

	if ciType != "" {
		cis, total, err = s.cmdbSvc.ListCIs(ciType, "", "", 1, 10000, tenantID)
	} else {
		cis, total, err = s.cmdbSvc.ListCIs("", "", "", 1, 10000, tenantID)
	}
	if err != nil {
		return nil, fmt.Errorf("failed to list CIs: %w", err)
	}

	// Build nodes
	nodes := make([]TopologyNode, 0, len(cis))
	ciMap := make(map[string]cmdbService.CI)
	for _, ci := range cis {
		node := TopologyNode{
			ID:       ci.ID,
			CiID:     ci.CiID,
			CiType:   ci.CiType,
			Name:     ci.Name,
			Status:   ci.Status,
			Metadata: map[string]interface{}{
				"description": ci.Description,
				"environment": ci.Environment,
				"tags":        ci.Tags,
				"attributes":  ci.Attributes,
			},
		}
		nodes = append(nodes, node)
		ciMap[ci.CiID] = ci
	}

	// Get all relations for the tenant (we need to iterate all CIs to get their relations)
	// For now, we get relations for each CI - this could be optimized
	edgeSet := make(map[string]TopologyEdge)
	processedPairs := make(map[string]bool)

	for _, ci := range cis {
		relations, err := s.relationSvc.GetRelationsByCiID(ci.CiID, tenantID)
		if err != nil {
			continue // Skip if we can't get relations for this CI
		}

		for _, rel := range relations {
			// Only include relations where both CIs are in our node list
			if _, ok := ciMap[rel.FromCiID]; ok {
				if _, ok := ciMap[rel.ToCiID]; ok {
					// Avoid duplicate edges
					pairKey := rel.FromCiID + "->" + rel.ToCiID
					if !processedPairs[pairKey] {
						processedPairs[pairKey] = true
						edge := TopologyEdge{
							ID:           rel.ID,
							Source:       rel.FromCiID,
							Target:       rel.ToCiID,
							RelationType: rel.RelationType,
						}
						edgeSet[pairKey] = edge
					}
				}
			}
		}
	}

	edges := make([]TopologyEdge, 0, len(edgeSet))
	for _, edge := range edgeSet {
		edges = append(edges, edge)
	}

	_ = total // total is available but not needed for topology

	return &Topology{
		Nodes: nodes,
		Edges: edges,
	}, nil
}

// AnalyzeImpact analyzes the impact of a CI failure
func (s *Service) AnalyzeImpact(ciID string, tenantID int64, maxDepth int) (*ImpactAnalysis, error) {
	if ciID == "" {
		return nil, ErrInvalidCIID
	}
	if tenantID == 0 {
		return nil, ErrInvalidTenantID
	}
	if maxDepth <= 0 {
		maxDepth = 3 // default max depth
	}

	// Get the CI first
	ci, err := s.cmdbSvc.GetCIByCiID(ciID, tenantID)
	if err != nil {
		return nil, fmt.Errorf("CI not found: %w", err)
	}

	// Build topology
	topology, err := s.BuildTopology(tenantID, "")
	if err != nil {
		return nil, fmt.Errorf("failed to build topology: %w", err)
	}

	// Create graph
	graph := NewGraph()
	for _, node := range topology.Nodes {
		graph.AddNode(node)
	}
	for _, edge := range topology.Edges {
		graph.AddEdge(edge)
	}

	// Check if CI exists in topology
	if !graph.HasNode(ciID) {
		return &ImpactAnalysis{
			CiID:             ciID,
			AffectedCIs:      []TopologyNode{},
			WarningMessages:  []string{"CI not found in topology"},
			CanProceed:       true,
		}, nil
	}

	// Find dependents (CIs that depend on this CI)
	affectedNodes := s.findDependentsGraph(ciID, graph, maxDepth)

	// Convert to topology nodes
	affectedTopologyNodes := make([]TopologyNode, 0, len(affectedNodes))
	warningMessages := []string{}

	for _, nodeID := range affectedNodes {
		node, ok := graph.GetNode(nodeID)
		if ok {
			affectedTopologyNodes = append(affectedTopologyNodes, *node)

			// Add warning messages for critical CI types
			if node.CiType == "DATABASE" || node.CiType == "K8S_CLUSTER" {
				warningMessages = append(warningMessages,
					fmt.Sprintf("Critical component %s (%s) will be affected", node.Name, node.CiType))
			}
		}
	}

	// Determine if we can proceed
	// In a real system, this would involve business rules
	canProceed := true
	if len(warningMessages) > 0 {
		canProceed = false
	}

	// Add info about the CI itself
	if ci.Status == "MAINTENANCE" {
		warningMessages = append(warningMessages, "CI is currently in maintenance mode")
		canProceed = true // Maintenance mode is intentional
	}

	if ci.Status == "INACTIVE" || ci.Status == "DECOMMISSIONED" {
		warningMessages = append(warningMessages, fmt.Sprintf("CI is %s - operation may have no effect", ci.Status))
	}

	return &ImpactAnalysis{
		CiID:             ciID,
		AffectedCIs:      affectedTopologyNodes,
		WarningMessages:  warningMessages,
		CanProceed:       canProceed,
	}, nil
}

// FindDependencies finds all CIs that this CI depends on (outgoing edges)
func (s *Service) FindDependencies(ciID string, tenantID int64) ([]TopologyNode, error) {
	if ciID == "" {
		return nil, ErrInvalidCIID
	}
	if tenantID == 0 {
		return nil, ErrInvalidTenantID
	}

	// Get relations where this CI is the source (it depends on others)
	relations, err := s.relationSvc.GetRelationsByCiID(ciID, tenantID)
	if err != nil {
		return nil, err
	}

	// Get dependent CI IDs (outgoing relations)
	depCiIDs := make(map[string]bool)
	for _, rel := range relations {
		if rel.FromCiID == ciID {
			depCiIDs[rel.ToCiID] = true
		}
	}

	// Get the CI details
	nodes := make([]TopologyNode, 0)
	for depCiID := range depCiIDs {
		ci, err := s.cmdbSvc.GetCIByCiID(depCiID, tenantID)
		if err != nil {
			continue
		}

		node := TopologyNode{
			ID:       ci.ID,
			CiID:     ci.CiID,
			CiType:   ci.CiType,
			Name:     ci.Name,
			Status:   ci.Status,
			Metadata: map[string]interface{}{},
		}
		nodes = append(nodes, node)
	}

	return nodes, nil
}

// FindDependents finds all CIs that depend on this CI (incoming edges)
func (s *Service) FindDependents(ciID string, tenantID int64) ([]TopologyNode, error) {
	if ciID == "" {
		return nil, ErrInvalidCIID
	}
	if tenantID == 0 {
		return nil, ErrInvalidTenantID
	}

	// Get all CIs for this tenant to find incoming relations
	cis, _, err := s.cmdbSvc.ListCIs("", "", "", 1, 10000, tenantID)
	if err != nil {
		return nil, err
	}

	// Build a map of CI IDs
	ciMap := make(map[string]cmdbService.CI)
	for _, ci := range cis {
		ciMap[ci.CiID] = ci
	}

	// Find relations where this CI is the target (others depend on it)
	dependentCiIDs := make(map[string]bool)
	for _, ci := range cis {
		relations, err := s.relationSvc.GetRelationsByCiID(ci.CiID, tenantID)
		if err != nil {
			continue
		}

		for _, rel := range relations {
			if rel.FromCiID == ciID {
				// ci.CiID depends on ciID
				dependentCiIDs[ci.CiID] = true
			}
		}
	}

	// Get the CI details
	nodes := make([]TopologyNode, 0)
	for depCiID := range dependentCiIDs {
		if ci, ok := ciMap[depCiID]; ok {
			node := TopologyNode{
				ID:       ci.ID,
				CiID:     ci.CiID,
				CiType:   ci.CiType,
				Name:     ci.Name,
				Status:   ci.Status,
				Metadata: map[string]interface{}{},
			}
			nodes = append(nodes, node)
		}
	}

	return nodes, nil
}

// findDependentsGraph finds all dependents using graph traversal with max depth
func (s *Service) findDependentsGraph(startNodeID string, graph *Graph, maxDepth int) []string {
	// This finds nodes that have edges TO the start node (incoming edges)
	// We need to reverse the graph or check all edges
	result := make(map[string]bool)
	visited := make(map[string]bool)
	queue := []string{startNodeID}
	currentDepth := make(map[string]int)

	visited[startNodeID] = true
	currentDepth[startNodeID] = 0

	for len(queue) > 0 {
		current := queue[0]
		queue = queue[1:]

		depth := currentDepth[current]
		if depth >= maxDepth {
			continue
		}

		// Find all nodes that have edges pointing to current
		// In our model: edges go from dependent to dependency
		// So we need to reverse the relationship
		// For this, we need to look at incoming edges
		for _, node := range graph.GetAllNodes() {
			if visited[node.CiID] {
				continue
			}

			// Check if this node has an edge to current
			for _, edge := range graph.GetEdges(node.CiID) {
				if edge.Target == current {
					visited[node.CiID] = true
					currentDepth[node.CiID] = depth + 1
					result[node.CiID] = true
					queue = append(queue, node.CiID)
					break
				}
			}
		}
	}

	// Convert to slice
	resultSlice := make([]string, 0, len(result))
	for id := range result {
		resultSlice = append(resultSlice, id)
	}

	return resultSlice
}

// BuildGraph builds a topology graph from a topology structure
func BuildGraph(topology *Topology) *Graph {
	graph := NewGraph()

	for _, node := range topology.Nodes {
		graph.AddNode(node)
	}

	for _, edge := range topology.Edges {
		graph.AddEdge(edge)
	}

	return graph
}

// Service errors
var (
	ErrInvalidTenantID = fmt.Errorf("invalid tenant ID")
	ErrInvalidCIID     = fmt.Errorf("invalid CI ID")
)