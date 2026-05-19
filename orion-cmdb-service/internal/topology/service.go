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

// AnalyzeChangeImpact analyzes the impact of a CI change operation
func (s *Service) AnalyzeChangeImpact(ciID string, operation ChangeOperation, tenantID int64) (*ImpactReport, error) {
	if ciID == "" {
		return nil, ErrInvalidCIID
	}
	if tenantID == 0 {
		return nil, ErrInvalidTenantID
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
		return &ImpactReport{
			CiID:            ciID,
			Operation:       string(operation),
			ImpactLevel:     ImpactLevelLow,
			DirectAffected:  []TopologyNode{},
			IndirectAffected: []TopologyNode{},
			CriticalPaths:   [][]string{},
			Recommendations: []string{"CI not found in topology - no impact expected"},
			CanProceed:      true,
			RequiresApproval: false,
		}, nil
	}

	// Get direct dependents (incoming edges) - nodes that depend on this CI
	directDependents := graph.GetAllDependents(ciID)
	directAffected := make([]TopologyNode, 0)
	for nodeID := range directDependents {
		if node, ok := graph.GetNode(nodeID); ok {
			directAffected = append(directAffected, *node)
		}
	}

	// Get indirect dependents (depth 2+)
	indirectAffectedMap := make(map[string]bool)
	for nodeID := range directDependents {
		// Get dependents of each direct dependent
		indirects := graph.GetAllDependents(nodeID)
		for indID := range indirects {
			if indID != ciID && !directDependents[indID] {
				indirectAffectedMap[indID] = true
			}
		}
	}
	indirectAffected := make([]TopologyNode, 0)
	for nodeID := range indirectAffectedMap {
		if node, ok := graph.GetNode(nodeID); ok {
			indirectAffected = append(indirectAffected, *node)
		}
	}

	// Calculate impact level based on number of affected CIs and their types
	impactLevel := s.calculateImpactLevel(ci, directAffected, indirectAffected)

	// Get critical paths
	criticalPaths := s.findCriticalPaths(ciID, graph)

	// Generate recommendations
	recommendations := s.generateRecommendations(ci, operation, directAffected, indirectAffected)

	// Determine if approval is required
	requiresApproval := impactLevel == ImpactLevelCritical || impactLevel == ImpactLevelHigh

	// For delete operations, always require approval if there are dependents
	canProceed := true
	if operation == ChangeOperationDelete && len(directAffected) > 0 {
		canProceed = false
		requiresApproval = true
	}

	return &ImpactReport{
		CiID:             ciID,
		Operation:        string(operation),
		ImpactLevel:      impactLevel,
		DirectAffected:   directAffected,
		IndirectAffected: indirectAffected,
		CriticalPaths:    criticalPaths,
		Recommendations:  recommendations,
		CanProceed:       canProceed,
		RequiresApproval: requiresApproval,
	}, nil
}

// GetCriticalPaths finds all critical paths from entry points to the given CI
func (s *Service) GetCriticalPaths(ciID string, tenantID int64) ([][]string, error) {
	if ciID == "" {
		return nil, ErrInvalidCIID
	}
	if tenantID == 0 {
		return nil, ErrInvalidTenantID
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
		return [][]string{}, nil
	}

	// Find entry points (nodes with no incoming edges)
	entryPoints := s.findEntryPoints(graph)

	// Find all paths from entry points to the target CI
	var allPaths [][]string
	for _, entryID := range entryPoints {
		paths := graph.FindAllPaths(entryID, ciID)
		allPaths = append(allPaths, paths...)
	}

	// Also check direct dependencies as potential paths
	dependencies, _ := s.FindDependencies(ciID, tenantID)
	for _, dep := range dependencies {
		depPaths := graph.FindAllPaths(dep.CiID, ciID)
		allPaths = append(allPaths, depPaths...)
	}

	return allPaths, nil
}

// IdentifyCriticalComponents identifies all critical components in the topology
func (s *Service) IdentifyCriticalComponents(tenantID int64) ([]CriticalComponent, error) {
	if tenantID == 0 {
		return nil, ErrInvalidTenantID
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

	// Count dependencies for each node
	dependencyCount := make(map[string]int)
	incomingCount := make(map[string]int)

	for _, node := range topology.Nodes {
		// Count outgoing (what this CI depends on)
		reachable := graph.GetAllReachableFrom(node.CiID)
		dependencyCount[node.CiID] = len(reachable)

		// Count incoming (what depends on this CI)
		dependents := graph.GetAllDependents(node.CiID)
		incomingCount[node.CiID] = len(dependents)
	}

	// Identify critical components
	var criticalComponents []CriticalComponent

	for _, node := range topology.Nodes {
		incoming := incomingCount[node.CiID]
		_ = dependencyCount[node.CiID] // outgoing dependency count (reserved for future use)

		// Single point of failure: no redundancy (no other CIs point to same targets)
		// High dependency: many CIs depend on this component
		criticalType := ""

		if incoming > 3 {
			criticalType = "HIGH_DEPENDENCY"
		}

		// Check for single point of failure
		if incoming > 0 && s.isSinglePointOfFailure(node.CiID, graph, topology) {
			if criticalType != "" {
				criticalType = "SINGLE_POINT_OF_FAILURE_HIGH_DEPENDENCY"
			} else {
				criticalType = "SINGLE_POINT_OF_FAILURE"
			}
		}

		// Mark critical infrastructure types
		criticalTypes := map[string]bool{
			"DATABASE":       true,
			"K8S_CLUSTER":    true,
			"LOAD_BALANCER":  true,
			"CACHE":          true,
			"MESSAGE_QUEUE":  true,
			"API_GATEWAY":    true,
			"AUTH_SERVICE":   true,
		}

		if criticalTypes[node.CiType] && incoming > 0 {
			if criticalType != "" {
				criticalType = criticalType + "_CRITICAL_INFRASTRUCTURE"
			} else {
				criticalType = "CRITICAL_INFRASTRUCTURE"
			}
		}

		// Only include components with some criticality
		if criticalType != "" {
			// Get affected services
			dependents := graph.GetAllDependents(node.CiID)
			affectedServices := make([]string, 0)
			for depID := range dependents {
				if depNode, ok := graph.GetNode(depID); ok {
					affectedServices = append(affectedServices, depNode.Name)
				}
			}

			criticalComponents = append(criticalComponents, CriticalComponent{
				CiID:            node.CiID,
				CiType:          node.CiType,
				Name:            node.Name,
				CriticalType:    criticalType,
				DependencyCount: incoming,
				AffectedServices: affectedServices,
			})
		}
	}

	return criticalComponents, nil
}

// findEntryPoints finds nodes with no incoming edges (entry points in the topology)
func (s *Service) findEntryPoints(graph *Graph) []string {
	var entryPoints []string
	hasIncoming := make(map[string]bool)

	// Build a map of all nodes that have incoming edges
	for _, edges := range graph.edges {
		for _, edge := range edges {
			hasIncoming[edge.Target] = true
		}
	}

	// Entry points are nodes with no incoming edges
	for _, node := range graph.GetAllNodes() {
		if !hasIncoming[node.CiID] {
			entryPoints = append(entryPoints, node.CiID)
		}
	}

	return entryPoints
}

// calculateImpactLevel determines the impact level based on affected CIs
func (s *Service) calculateImpactLevel(ci *cmdbService.CI, directAffected, indirectAffected []TopologyNode) ImpactLevel {
	// Critical infrastructure types
	criticalTypes := map[string]bool{
		"DATABASE":       true,
		"K8S_CLUSTER":    true,
		"LOAD_BALANCER":  true,
		"CACHE":          true,
		"MESSAGE_QUEUE":  true,
		"API_GATEWAY":    true,
		"AUTH_SERVICE":   true,
	}

	// If CI is critical infrastructure, impact is at least HIGH
	if criticalTypes[ci.CiType] {
		if len(directAffected) > 5 {
			return ImpactLevelCritical
		}
		return ImpactLevelHigh
	}

	// Calculate based on number of affected CIs
	totalAffected := len(directAffected) + len(indirectAffected)

	if totalAffected > 10 {
		return ImpactLevelCritical
	}
	if totalAffected > 5 {
		return ImpactLevelHigh
	}
	if totalAffected > 0 {
		return ImpactLevelMedium
	}
	return ImpactLevelLow
}

// findCriticalPaths finds all paths from entry points to the target CI
func (s *Service) findCriticalPaths(ciID string, graph *Graph) [][]string {
	var paths [][]string

	// Find all paths using DFS from each node
	for _, node := range graph.GetAllNodes() {
		// Skip the target node itself
		if node.CiID == ciID {
			continue
		}

		// Try to find a path from this node to the target
		path := graph.FindPath(node.CiID, ciID)
		if path != nil && len(path) > 1 {
			// Only include paths that have multiple hops (meaning they go through intermediate nodes)
			paths = append(paths, path)
		}
	}

	// If no paths found from other nodes, check if ciID has any dependencies
	if len(paths) == 0 {
		edges := graph.GetEdges(ciID)
		if len(edges) > 0 {
			// The CI depends on something - that's part of the critical path
			for _, edge := range edges {
				paths = append(paths, []string{ciID, edge.Target})
			}
		}
	}

	return paths
}

// generateRecommendations generates recommendations based on impact analysis
func (s *Service) generateRecommendations(ci *cmdbService.CI, operation ChangeOperation, directAffected, indirectAffected []TopologyNode) []string {
	var recommendations []string

	// Critical infrastructure recommendations
	criticalTypes := map[string]bool{
		"DATABASE":       true,
		"K8S_CLUSTER":    true,
		"LOAD_BALANCER":  true,
		"CACHE":          true,
		"MESSAGE_QUEUE":  true,
		"API_GATEWAY":    true,
		"AUTH_SERVICE":   true,
	}

	if criticalTypes[ci.CiType] {
		recommendations = append(recommendations,
			fmt.Sprintf("Warning: %s (%s) is critical infrastructure", ci.Name, ci.CiType))
		recommendations = append(recommendations, "Schedule maintenance window during off-peak hours")
		recommendations = append(recommendations, "Coordinate with affected teams before proceeding")
	}

	// High dependency recommendations
	if len(directAffected) > 3 {
		recommendations = append(recommendations,
			fmt.Sprintf("High impact: %d CIs directly depend on this component", len(directAffected)))
		recommendations = append(recommendations, "Consider blue-green deployment or canary release")
		recommendations = append(recommendations, "Prepare rollback plan")
	}

	// Delete operation specific recommendations
	if operation == ChangeOperationDelete {
		if len(directAffected) > 0 {
			recommendations = append(recommendations,
				fmt.Sprintf("Cannot delete: %d CIs depend on this component", len(directAffected)))
			recommendations = append(recommendations, "Update dependent CIs before deletion")
		} else {
			recommendations = append(recommendations, "No CIs depend on this component - safe to delete")
		}
	}

	// Update operation specific recommendations
	if operation == ChangeOperationUpdate {
		recommendations = append(recommendations, "Consider backward compatibility")
		if ci.Status == "ACTIVE" {
			recommendations = append(recommendations, "CI is active - plan for zero-downtime update")
		}
	}

	// Create operation specific recommendations
	if operation == ChangeOperationCreate {
		recommendations = append(recommendations, "Document new CI relationships after creation")
		recommendations = append(recommendations, "Update topology view")
	}

	// Default recommendation if nothing else
	if len(recommendations) == 0 {
		recommendations = append(recommendations, "Standard change management process applies")
	}

	return recommendations
}

// isSinglePointOfFailure checks if a node is a single point of failure
func (s *Service) isSinglePointOfFailure(nodeID string, graph *Graph, topology *Topology) bool {
	// Get all nodes that this node depends on
	dependencies := graph.GetAllReachableFrom(nodeID)

	// Find other nodes that share the same dependencies
	for _, otherNode := range topology.Nodes {
		if otherNode.CiID == nodeID {
			continue
		}

		otherDependencies := graph.GetAllReachableFrom(otherNode.CiID)

		// If other node has same dependencies, this is not a single point of failure
		if len(dependencies) > 0 {
			sameDeps := 0
			for dep := range dependencies {
				if otherDependencies[dep] {
					sameDeps++
				}
			}
			// If more than 50% overlap, there's redundancy
			if sameDeps >= len(dependencies)/2 {
				return false
			}
		}
	}

	// No redundancy found
	return len(dependencies) > 0
}

// Service errors
var (
	ErrInvalidTenantID = fmt.Errorf("invalid tenant ID")
	ErrInvalidCIID     = fmt.Errorf("invalid CI ID")
)