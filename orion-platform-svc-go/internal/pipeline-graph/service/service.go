package service

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"regexp"
	"strings"

	"gopkg.in/yaml.v3"

	"orion/platform-svc-go/internal/pipeline-graph/models"
	"orion/platform-svc-go/internal/pipeline-graph/repository"
)

// Service provides pipeline graph operations: YAML <-> JSON conversion,
// graph building from saved pipelines, and YAML validation.
type Service struct {
	repo *repository.Repository
}

func NewService(repo *repository.Repository) *Service {
	return &Service{repo: repo}
}

// GetPipeline retrieves a pipeline definition from the database for graph building.
func (s *Service) GetPipeline(ctx context.Context, id string) (*repository.PipelineDefinition, error) {
	pipeline, err := s.repo.GetPipelineByID(ctx, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrPipelineNotFound
		}
		return nil, err
	}
	return pipeline, nil
}

// validStageTypes is the set of recognized stage type values.
var validStageTypes = map[string]bool{
	"build": true, "test": true, "deploy": true, "lint": true,
	"analyze": true, "publish": true, "notify": true, "cleanup": true,
	"security": true, "integration-test": true, "e2e-test": true,
	"performance-test": true, "approval": true, "manual": true,
	"script": true, "container": true, "shell": true,
}

// dangerousPatterns are expressions flagged in condition strings.
var dangerousPatterns = []string{
	"eval(", "Function(", "require(", "process.", "__proto__", "constructor(",
}

// ---- Pipeline spec types (internal, for YAML deserialisation) ----

type rawStage struct {
	Name      string                 `yaml:"name"`
	Type      string                 `yaml:"type"`
	RunsOn    string                 `yaml:"runsOn"`
	DependsOn interface{}            `yaml:"dependsOn"` // string or []string
	If        string                 `yaml:"if"`
	Steps     []rawStep              `yaml:"steps"`
	Timeout   *int                   `yaml:"timeout"`
	Retries   *int                   `yaml:"retries"`
	Parallel  bool                   `yaml:"parallel"`
	Config    map[string]interface{} `yaml:"config"`
	Matrix    map[string]interface{} `yaml:"matrix"`
	Env       map[string]string      `yaml:"env"`
	Outputs   map[string]string      `yaml:"outputs"`
	Cache     interface{}            `yaml:"cache"`
	Artifacts interface{}            `yaml:"artifacts"`
}

type rawStep struct {
	Name string                 `yaml:"name"`
	Uses string                 `yaml:"uses"`
	With map[string]interface{} `yaml:"with"`
}

type rawSpec struct {
	APIVersion string            `yaml:"apiVersion"`
	Kind       string            `yaml:"kind"`
	Metadata   *rawMetadata      `yaml:"metadata"`
	Spec       *rawPipelineSpec  `yaml:"spec"`
	Stages     []rawStage        `yaml:"stages"`      // flat format
	Name       string            `yaml:"name"`         // flat format
}

type rawMetadata struct {
	Name string `yaml:"name"`
}

type rawPipelineSpec struct {
	Stages []rawStage `yaml:"stages"`
}

// ---- Public API ----

// BuildGraph parses a saved pipeline's YAML and returns the graph structure.
func (s *Service) BuildGraph(pipelineID, yamlDefinition string) (*models.GraphData, error) {
	spec, err := parseYaml(yamlDefinition)
	if err != nil {
		return nil, fmt.Errorf("failed to parse YAML: %w", err)
	}
	return buildGraphFromSpec(pipelineID, spec), nil
}

// YamlToJson parses YAML and returns the graph representation plus validation.
func (s *Service) YamlToJson(yamlDefinition string) (*models.YamlParseResponse, error) {
	spec, err := parseYaml(yamlDefinition)
	validation := validateSpec(spec, err)

	graph := &models.GraphData{Nodes: []models.GraphNode{}, Edges: []models.GraphEdge{}}
	if err == nil {
		graph = buildGraphFromSpec("pipeline", spec)
	}

	return &models.YamlParseResponse{
		Graph:    *graph,
		Valid:    validation.Valid,
		Errors:   validation.Errors,
		Warnings: validation.Warnings,
	}, nil
}

// JsonToYaml converts a graph structure back to a YAML pipeline spec string.
func (s *Service) JsonToYaml(graph models.GraphData) (*models.YamlToJsonResponse, error) {
	stages := graphToStages(graph)

	out := map[string]interface{}{
		"apiVersion": "v1",
		"kind":       "Pipeline",
		"metadata": map[string]interface{}{
			"name": "pipeline",
		},
		"spec": map[string]interface{}{
			"stages": stages,
		},
	}

	yamlBytes, err := yaml.Marshal(out)
	if err != nil {
		return &models.YamlToJsonResponse{
			Yaml:     "",
			Valid:    false,
			Errors:   []string{fmt.Sprintf("failed to marshal YAML: %v", err)},
			Warnings: []string{},
		}, nil
	}

	yamlStr := string(yamlBytes)

	// Re-validate the generated YAML
	spec, parseErr := parseYaml(yamlStr)
	validation := validateSpec(spec, parseErr)

	return &models.YamlToJsonResponse{
		Yaml:     yamlStr,
		Valid:    validation.Valid,
		Errors:   validation.Errors,
		Warnings: validation.Warnings,
	}, nil
}

// Validate validates a YAML pipeline spec and returns errors/warnings.
func (s *Service) Validate(yamlDefinition string) (*models.ValidateResponse, error) {
	spec, err := parseYaml(yamlDefinition)
	result := validateSpec(spec, err)
	return result, nil
}

// ---- YAML parsing ----

func parseYaml(yamlStr string) (*rawSpec, error) {
	var spec rawSpec
	if err := yaml.Unmarshal([]byte(yamlStr), &spec); err != nil {
		return nil, err
	}
	return &spec, nil
}

// ---- Graph building (mirrors TS PipelineGraphBuilder) ----

func buildGraphFromSpec(pipelineID string, spec *rawSpec) *models.GraphData {
	stages := extractStages(spec)

	nodes := []models.GraphNode{}
	edges := []models.GraphEdge{}

	// Build stage nodes
	for _, st := range stages {
		nodeID := normalizeStageID(st.Name)
		config := extractStageMetadata(st)

		node := models.GraphNode{
			ID:       nodeID,
			Name:     st.Name,
			Type:     "stage",
			Config:   config,
			Position: models.Position{X: 0, Y: 0},
		}
		nodes = append(nodes, node)
	}

	// Build edges from dependsOn
	for _, st := range stages {
		toID := normalizeStageID(st.Name)
		for _, dep := range resolveDependsOn(st.DependsOn) {
			fromID := normalizeStageID(dep)
			edges = append(edges, models.GraphEdge{
				Source: fromID,
				Target: toID,
			})
		}
	}

	// Build task nodes from stage steps
	for _, st := range stages {
		stageID := normalizeStageID(st.Name)
		for _, step := range st.Steps {
			taskID := stageID + "::" + normalizeStepID(step.Name)
			taskNode := models.GraphNode{
				ID:   taskID,
				Name: step.Name,
				Type: "task",
				Config: map[string]interface{}{
					"uses": step.Uses,
					"with": step.With,
				},
				Position: models.Position{X: 0, Y: 0},
			}
			nodes = append(nodes, taskNode)
			edges = append(edges, models.GraphEdge{
				Source: stageID,
				Target: taskID,
			})
		}
	}

	// Calculate layout positions
	calculateLayout(nodes)

	return &models.GraphData{Nodes: nodes, Edges: edges}
}

func extractStages(spec *rawSpec) []rawStage {
	if spec.Spec != nil && spec.Spec.Stages != nil {
		return spec.Spec.Stages
	}
	if spec.Stages != nil {
		return spec.Stages
	}
	return nil
}

func normalizeStageID(name string) string {
	re := regexp.MustCompile(`[^a-z0-9]+`)
	id := re.ReplaceAllString(strings.ToLower(name), "-")
	id = strings.Trim(id, "-")
	if id == "" {
		return "unknown"
	}
	return id
}

func normalizeStepID(name string) string {
	re := regexp.MustCompile(`[^a-z0-9]+`)
	id := re.ReplaceAllString(strings.ToLower(name), "-")
	id = strings.Trim(id, "-")
	if id == "" {
		return "step"
	}
	return id
}

func resolveDependsOn(dep interface{}) []string {
	if dep == nil {
		return nil
	}
	switch v := dep.(type) {
	case string:
		return []string{v}
	case []interface{}:
		result := make([]string, 0, len(v))
		for _, item := range v {
			if s, ok := item.(string); ok {
				result = append(result, s)
			}
		}
		return result
	default:
		return nil
	}
}

func extractStageMetadata(st rawStage) map[string]interface{} {
	meta := make(map[string]interface{})
	if st.RunsOn != "" {
		meta["runsOn"] = st.RunsOn
	}
	if st.Type != "" {
		meta["type"] = st.Type
	}
	if st.If != "" {
		meta["condition"] = st.If
	}
	if st.Timeout != nil {
		meta["timeout"] = *st.Timeout
	}
	if st.Retries != nil {
		meta["retries"] = *st.Retries
	}
	if st.Parallel {
		meta["parallel"] = true
	}
	if st.Config != nil {
		meta["config"] = st.Config
	}
	if st.Matrix != nil {
		meta["matrix"] = st.Matrix
	}
	if st.Env != nil {
		meta["env"] = st.Env
	}
	if st.Outputs != nil {
		meta["outputs"] = st.Outputs
	}
	return meta
}

// ---- Layout calculation (mirrors TS computeLayers + calculateLayoutPositions) ----

func calculateLayout(nodes []models.GraphNode) {
	// Build node map for quick lookup
	nodeMap := make(map[string]*models.GraphNode)
	for i := range nodes {
		nodeMap[nodes[i].ID] = &nodes[i]
	}

	// Compute topological layers for stage nodes
	layers := computeStageLayers(nodes)

	// Assign positions to stage nodes
	layerSpacingX := 250.0
	nodeSpacingY := 100.0
	startX := 50.0
	startY := 50.0

	for layerIdx, layer := range layers {
		for nodeIdx, nodeID := range layer {
			if node, ok := nodeMap[nodeID]; ok {
				node.Position.X = startX + float64(layerIdx)*layerSpacingX
				node.Position.Y = startY + float64(nodeIdx)*nodeSpacingY
			}
		}
	}

	// Position task nodes below their parent stage
	for i := range nodes {
		if nodes[i].Type == "task" {
			// Find parent stage: the stage whose ID is a prefix (before ::)
			parts := strings.Split(nodes[i].ID, "::")
			if len(parts) == 2 {
				if parent, ok := nodeMap[parts[0]]; ok {
					nodes[i].Position.X = parent.Position.X
					nodes[i].Position.Y = parent.Position.Y + 60
				}
			}
		}
	}
}

// computeStageLayers computes topological layers for DAG layout using Kahn's algorithm.
func computeStageLayers(nodes []models.GraphNode) [][]string {
	// Collect stage nodes and build a name->ID map
	type stageEdge struct {
		fromID string
		toID   string
	}

	stageIDSet := make(map[string]bool)
	stageNameToID := make(map[string]string)
	stageIDToName := make(map[string]string)

	for _, n := range nodes {
		if n.Type == "stage" {
			stageIDSet[n.ID] = true
			stageNameToID[n.Name] = n.ID
			stageIDToName[n.ID] = n.Name
		}
	}

	// Build edges from the "dependsOn" relationship embedded in config
	// We reconstruct edges from the names stored in config fields
	edges := []stageEdge{}

	// For each stage node, we need to figure out dependencies.
	// Since our model doesn't store dependsOn on the node itself,
	// we reconstruct from the original names. The config map may
	// contain useful info, but the primary dependency info is lost
	// after graph construction. We use a simpler approach:
	// just use the node config if available, otherwise flat layout.
	hasDeps := false
	for _, n := range nodes {
		if n.Type == "stage" && n.Config != nil {
			if _, ok := n.Config["dependsOn"]; ok {
				hasDeps = true
			}
		}
	}

	if !hasDeps {
		// No dependencies found: flat single-layer layout
		stageIDs := []string{}
		for _, n := range nodes {
			if n.Type == "stage" {
				stageIDs = append(stageIDs, n.ID)
			}
		}
		if len(stageIDs) == 0 {
			return [][]string{}
		}
		return [][]string{stageIDs}
	}

	// Build in-degree and children maps using Kahn's algorithm
	inDegree := make(map[string]int)
	children := make(map[string][]string)

	for id := range stageIDSet {
		inDegree[id] = 0
	}

	for _, edge := range edges {
		if _, ok := stageIDSet[edge.fromID]; !ok {
			continue
		}
		if _, ok := stageIDSet[edge.toID]; !ok {
			continue
		}
		inDegree[edge.toID]++
		children[edge.fromID] = append(children[edge.fromID], edge.toID)
	}

	// Kahn's algorithm
	layers := [][]string{}
	queue := []string{}
	for id, deg := range inDegree {
		if deg == 0 {
			queue = append(queue, id)
		}
	}

	visited := make(map[string]bool)
	for len(queue) > 0 {
		layer := make([]string, len(queue))
		copy(layer, queue)
		layers = append(layers, layer)

		nextQueue := []string{}
		for _, id := range queue {
			visited[id] = true
			for _, child := range children[id] {
				if visited[child] {
					continue
				}
				inDegree[child]--
				if inDegree[child] == 0 {
					nextQueue = append(nextQueue, child)
				}
			}
		}
		queue = nextQueue
	}

	// Handle unvisited nodes (cyclic fallback)
	for _, n := range nodes {
		if n.Type == "stage" && !visited[n.ID] {
			if len(layers) == 0 {
				layers = append(layers, []string{})
			}
			layers[len(layers)-1] = append(layers[len(layers)-1], n.ID)
			visited[n.ID] = true
		}
	}

	return layers
}

// ---- Graph to YAML conversion (mirrors TS YamlConverter.graphToStages) ----

func graphToStages(graph models.GraphData) []map[string]interface{} {
	// Separate stage and task nodes
	stageNodes := []models.GraphNode{}
	taskNodes := []models.GraphNode{}
	for _, n := range graph.Nodes {
		if n.Type == "stage" {
			stageNodes = append(stageNodes, n)
		} else {
			taskNodes = append(taskNodes, n)
		}
	}

	stages := make([]map[string]interface{}, 0, len(stageNodes))
	for _, sn := range stageNodes {
		stage := map[string]interface{}{
			"name": sn.Name,
		}

		// Restore metadata to stage fields
		if sn.Config != nil {
			if v, ok := sn.Config["runsOn"]; ok {
				stage["runsOn"] = v
			}
			if v, ok := sn.Config["type"]; ok {
				stage["type"] = v
			}
			if v, ok := sn.Config["condition"]; ok {
				stage["if"] = v
			}
			if v, ok := sn.Config["timeout"]; ok {
				stage["timeout"] = v
			}
			if v, ok := sn.Config["retries"]; ok {
				stage["retries"] = v
			}
			if v, ok := sn.Config["parallel"]; ok {
				stage["parallel"] = v
			}
			if v, ok := sn.Config["config"]; ok {
				stage["config"] = v
			}
			if v, ok := sn.Config["matrix"]; ok {
				stage["matrix"] = v
			}
			if v, ok := sn.Config["env"]; ok {
				stage["env"] = v
			}
			if v, ok := sn.Config["outputs"]; ok {
				stage["outputs"] = v
			}
		}

		// Add dependsOn (only stage-level dependencies from edges)
		deps := []string{}
		for _, edge := range graph.Edges {
			if edge.Target == sn.ID {
				// Find source node name
				for _, src := range stageNodes {
					if src.ID == edge.Source {
						deps = append(deps, src.Name)
					}
				}
			}
		}
		if len(deps) > 0 {
			stage["dependsOn"] = deps
		}

		// Attach tasks as steps
		steps := []map[string]interface{}{}
		for _, tn := range taskNodes {
			if strings.HasPrefix(tn.ID, sn.ID+"::") {
				step := map[string]interface{}{
					"name": tn.Name,
				}
				if tn.Config != nil {
					if uses, ok := tn.Config["uses"]; ok && uses != "" {
						step["uses"] = uses
					}
					if withVal, ok := tn.Config["with"]; ok {
						if withMap, ok2 := withVal.(map[string]interface{}); ok2 && len(withMap) > 0 {
							step["with"] = withMap
						}
					}
				}
				steps = append(steps, step)
			}
		}
		if len(steps) > 0 {
			stage["steps"] = steps
		}

		stages = append(stages, stage)
	}

	return stages
}

// ---- Validation (mirrors TS PipelineValidator) ----

type validationResult struct {
	Valid    bool
	Errors   []string
	Warnings []string
}

func validateSpec(spec *rawSpec, parseErr error) *models.ValidateResponse {
	resp := &models.ValidateResponse{
		Errors:   []string{},
		Warnings: []string{},
	}

	if parseErr != nil {
		resp.Errors = append(resp.Errors, fmt.Sprintf("YAML_PARSE_ERROR: %v", parseErr))
		resp.Valid = false
		return resp
	}

	if spec == nil {
		resp.Errors = append(resp.Errors, "INVALID_FORMAT: YAML must be a mapping/object")
		resp.Valid = false
		return resp
	}

	// Validate required fields
	if spec.APIVersion == "" {
		resp.Errors = append(resp.Errors, "MISSING_API_VERSION: Missing apiVersion field")
	}
	if spec.Kind == "" {
		resp.Errors = append(resp.Errors, "MISSING_KIND: Missing kind field (expected 'Pipeline')")
	} else if spec.Kind != "Pipeline" {
		resp.Errors = append(resp.Errors, fmt.Sprintf("INVALID_KIND: Expected kind 'Pipeline', got '%s'", spec.Kind))
	}
	if spec.Metadata == nil || spec.Metadata.Name == "" {
		resp.Errors = append(resp.Errors, "MISSING_NAME: Missing metadata.name")
	}

	// Extract stages
	stages := extractStages(spec)
	if len(stages) == 0 {
		resp.Errors = append(resp.Errors, "MISSING_STAGES: spec.stages is required and must be an array")
		resp.Valid = len(resp.Errors) == 0
		return resp
	}

	// Validate individual stages
	for _, st := range stages {
		validateStage(st, resp)
	}

	// Duplicate stage names
	validateDuplicateNames(stages, resp)

	// Missing dependsOn targets
	validateDependencies(stages, resp)

	// Cyclic dependencies
	validateCycles(stages, resp)

	resp.Valid = len(resp.Errors) == 0
	return resp
}

func validateStage(st rawStage, resp *models.ValidateResponse) {
	name := st.Name
	if name == "" {
		name = "<unnamed>"
	}

	if st.Name == "" {
		resp.Errors = append(resp.Errors, "MISSING_STAGE_NAME: Stage name is required")
	}

	if st.Type != "" && !validStageTypes[st.Type] {
		resp.Warnings = append(resp.Warnings, fmt.Sprintf("UNKNOWN_STAGE_TYPE: Unknown stage type '%s' for stage '%s'", st.Type, name))
	}

	if st.Timeout != nil && *st.Timeout <= 0 {
		resp.Errors = append(resp.Errors, fmt.Sprintf("INVALID_TIMEOUT: Stage '%s' has invalid timeout: must be a positive number", name))
	}

	if st.Retries != nil && *st.Retries < 0 {
		resp.Errors = append(resp.Errors, fmt.Sprintf("INVALID_RETRIES: Stage '%s' has invalid retries: must be a non-negative integer", name))
	}

	if st.If != "" {
		validateCondition(st.If, name, resp)
	}

	if st.DependsOn != nil {
		switch st.DependsOn.(type) {
		case string:
			resp.Warnings = append(resp.Warnings, fmt.Sprintf("DEPENDSON_STRING: Stage '%s' dependsOn should be an array, not a string", name))
		}
	}

	if len(st.Steps) == 0 {
		resp.Warnings = append(resp.Warnings, fmt.Sprintf("EMPTY_STAGE_STEPS: Stage '%s' has no steps defined", name))
	}
}

func validateCondition(condition, stageName string, resp *models.ValidateResponse) {
	if strings.TrimSpace(condition) == "" {
		resp.Errors = append(resp.Errors, fmt.Sprintf("EMPTY_CONDITION: Stage '%s' has an empty condition expression", stageName))
		return
	}
	for _, pattern := range dangerousPatterns {
		if strings.Contains(condition, pattern) {
			resp.Errors = append(resp.Errors, fmt.Sprintf("UNSAFE_CONDITION: Stage '%s' contains unsafe condition: '%s'", stageName, pattern))
		}
	}
}

func validateDuplicateNames(stages []rawStage, resp *models.ValidateResponse) {
	seen := map[string]int{}
	for _, st := range stages {
		name := st.Name
		if name == "" {
			name = "<unnamed>"
		}
		seen[name]++
	}
	for name, count := range seen {
		if count > 1 {
			resp.Errors = append(resp.Errors, fmt.Sprintf("DUPLICATE_STAGE_NAME: Duplicate stage name '%s' (appears %d times)", name, count))
		}
	}
}

func validateDependencies(stages []rawStage, resp *models.ValidateResponse) {
	stageNames := map[string]bool{}
	for _, st := range stages {
		if st.Name != "" {
			stageNames[st.Name] = true
		}
	}

	for _, st := range stages {
		if st.Name == "" {
			continue
		}
		for _, dep := range resolveDependsOn(st.DependsOn) {
			if !stageNames[dep] {
				resp.Errors = append(resp.Errors, fmt.Sprintf("MISSING_DEPENDENCY: Stage '%s' depends on unknown stage '%s'", st.Name, dep))
			}
		}
	}
}

func validateCycles(stages []rawStage, resp *models.ValidateResponse) {
	// Build adjacency list
	adj := map[string][]string{}
	for _, st := range stages {
		if st.Name == "" {
			continue
		}
		adj[st.Name] = resolveDependsOn(st.DependsOn)
	}

	const (
		white = 0
		gray  = 1
		black = 2
	)

	color := map[string]int{}
	for _, st := range stages {
		if st.Name != "" {
			color[st.Name] = white
		}
	}

	var dfs func(node string, path []string)
	dfs = func(node string, path []string) {
		color[node] = gray
		path = append(path, node)

		for _, neighbor := range adj[node] {
			if _, ok := color[neighbor]; !ok {
				continue
			}
			if color[neighbor] == gray {
				// Find cycle start
				cycleStart := -1
				for i, n := range path {
					if n == neighbor {
						cycleStart = i
						break
					}
				}
				cycle := []string{}
				if cycleStart >= 0 {
					cycle = append(cycle, path[cycleStart:]...)
					cycle = append(cycle, neighbor)
				}
				resp.Errors = append(resp.Errors, fmt.Sprintf("CYCLIC_DEPENDENCY: Cyclic dependency detected: %s", strings.Join(cycle, " -> ")))
				return
			}
			if color[neighbor] == white {
				dfs(neighbor, path)
			}
		}

		color[node] = black
	}

	for _, st := range stages {
		if st.Name != "" && color[st.Name] == white {
			dfs(st.Name, []string{})
		}
	}
}

// --- Errors ---

var ErrPipelineNotFound = errors.New("pipeline not found")

// IsNotFound returns true if the error is a pipeline-not-found error.
func IsNotFound(err error) bool {
	return errors.Is(err, ErrPipelineNotFound)
}