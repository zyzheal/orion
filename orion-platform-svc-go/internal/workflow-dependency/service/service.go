package service
//go:generate mockgen -destination=mock_service.go -package=service . ServiceInterface
//go:generate mockgen -destination=mock_repository.go -package=service . RepositoryInterface

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"

	"orion/platform-svc-go/internal/workflow-dependency/models"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	GetAllWorkflows(ctx context.Context) ([]models.WorkflowDefinitionRow, error)
	GetWorkflowByID(ctx context.Context, id string) (*models.WorkflowDefinitionRow, error)
}

type Service struct {
	repo RepositoryInterface
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

// nodeInfo holds parsed sub-workflow references from a definition node.
type nodeInfo struct {
	Type   string `json:"type"`
	Config config `json:"config"`
}

type config struct {
	SubWorkflowID string `json:"subWorkflowId"`
}

// parseSubWorkflowIDs extracts sub-workflow references from nodes JSON.
func parseSubWorkflowIDs(nodesJSON string) []string {
	var nodes []nodeInfo
	if err := json.Unmarshal([]byte(nodesJSON), &nodes); err != nil {
		return nil
	}
	var ids []string
	for _, n := range nodes {
		if n.Type == "sub-workflow" && n.Config.SubWorkflowID != "" {
			ids = append(ids, n.Config.SubWorkflowID)
		}
	}
	return ids
}

// detectCycles performs DFS-based cycle detection on the graph.
// Returns all cycles found.
func detectCycles(edges map[string][]string) []models.Cycle {
	const (
		white = 0
		gray  = 1
		black = 2
	)

	color := make(map[string]int)
	parent := make(map[string]string)
	var cycles []models.Cycle

	var dfs func(u string, path []string)
	dfs = func(u string, path []string) {
		color[u] = gray
		path = append(path, u)

		for _, v := range edges[u] {
			if color[v] == gray {
				// Found a cycle: extract the cycle from path
				cycleStart := -1
				for i, n := range path {
					if n == v {
						cycleStart = i
						break
					}
				}
				if cycleStart >= 0 {
					cycleNodes := append([]string{}, path[cycleStart:]...)
					desc := "cycle: "
					for i, n := range cycleNodes {
						if i > 0 {
							desc += " -> "
						}
						desc += n
					}
					cycles = append(cycles, models.Cycle{
						Nodes:       cycleNodes,
						Description: desc,
					})
				}
			} else if color[v] == white {
				parent[v] = u
				dfs(v, path)
			}
		}

		color[u] = black
	}

	// Collect all nodes
	allNodes := make(map[string]bool)
	for u := range edges {
		allNodes[u] = true
		for _, v := range edges[u] {
			allNodes[v] = true
		}
	}

	for u := range allNodes {
		if color[u] == white {
			dfs(u, nil)
		}
	}

	// Deduplicate cycles
	seen := make(map[string]bool)
	var unique []models.Cycle
	for _, c := range cycles {
		key := ""
		for _, n := range c.Nodes {
			key += n + ","
		}
		if !seen[key] {
			seen[key] = true
			unique = append(unique, c)
		}
	}
	if unique == nil {
		unique = []models.Cycle{}
	}
	return unique
}

func (s *Service) GetGraph(ctx context.Context) (*models.DependencyGraph, error) {
	rows, err := s.repo.GetAllWorkflows(ctx)
	if err != nil {
		return nil, err
	}

	edges := make(map[string][]string)
	for _, row := range rows {
		deps := parseSubWorkflowIDs(row.NodesJSON)
		if len(deps) > 0 {
			edges[row.ID] = deps
		} else {
			edges[row.ID] = []string{}
		}
	}

	totalEdges := 0
	for _, deps := range edges {
		totalEdges += len(deps)
	}

	cycles := detectCycles(edges)

	return &models.DependencyGraph{
		IsSafe:           len(cycles) == 0,
		TotalDefinitions: len(rows),
		TotalEdges:       totalEdges,
		Cycles:           cycles,
	}, nil
}

func (s *Service) CheckDefinition(ctx context.Context, definitionID string) (*models.DependencyCheck, error) {
	row, err := s.repo.GetWorkflowByID(ctx, definitionID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrWorkflowNotFound
		}
		return nil, err
	}

	deps := parseSubWorkflowIDs(row.NodesJSON)
	if deps == nil {
		deps = []string{}
	}

	// Build subgraph for this definition
	edges := make(map[string][]string)
	edges[definitionID] = deps
	for _, depID := range deps {
		depRow, err := s.repo.GetWorkflowByID(ctx, depID)
		if err == nil {
			subDeps := parseSubWorkflowIDs(depRow.NodesJSON)
			edges[depID] = subDeps
		}
	}

	cycles := detectCycles(edges)
	// Filter cycles that involve the definition
	var relevantCycles []models.Cycle
	for _, c := range cycles {
		for _, n := range c.Nodes {
			if n == definitionID {
				relevantCycles = append(relevantCycles, c)
				break
			}
		}
	}
	if relevantCycles == nil {
		relevantCycles = []models.Cycle{}
	}

	return &models.DependencyCheck{
		DefinitionId: definitionID,
		IsSafe:       len(relevantCycles) == 0,
		Dependencies: deps,
		Cycles:       relevantCycles,
	}, nil
}

func (s *Service) GetVisualization(ctx context.Context) (*models.VisualizationData, error) {
	rows, err := s.repo.GetAllWorkflows(ctx)
	if err != nil {
		return nil, err
	}

	var nodes []models.VisNode
	edgeSet := make(map[string]bool)

	for _, row := range rows {
		nodes = append(nodes, models.VisNode{
			Id:    row.ID,
			Name:  row.Name,
			Group: "workflow",
		})

		deps := parseSubWorkflowIDs(row.NodesJSON)
		for _, depID := range deps {
			edgeKey := row.ID + "->" + depID
			if !edgeSet[edgeKey] {
				edgeSet[edgeKey] = true
			}
		}
	}

	if nodes == nil {
		nodes = []models.VisNode{}
	}

	var edges []models.VisEdge
	for key := range edgeSet {
		// key is "source->target"
		source := ""
		target := ""
		for i := 0; i < len(key); i++ {
			if i+2 < len(key) && key[i] == '-' && key[i+1] == '>' {
				source = key[:i]
				target = key[i+2:]
				break
			}
		}
		if source != "" && target != "" {
			edges = append(edges, models.VisEdge{Source: source, Target: target, Weight: 1})
		}
	}
	if edges == nil {
		edges = []models.VisEdge{}
	}

	return &models.VisualizationData{
		Nodes: nodes,
		Edges: edges,
	}, nil
}

var ErrWorkflowNotFound = errors.New("workflow not found")

func IsNotFound(err error) bool {
	return errors.Is(err, ErrWorkflowNotFound)
}
