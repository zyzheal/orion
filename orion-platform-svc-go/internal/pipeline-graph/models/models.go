package models

// GraphNode represents a single node in the pipeline DAG.
type GraphNode struct {
	ID       string                 `json:"id"`
	Name     string                 `json:"name"`
	Type     string                 `json:"type"`
	Config   map[string]interface{} `json:"config"`
	Position Position               `json:"position"`
}

// Position stores the X/Y coordinates of a node in the visual editor.
type Position struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
}

// GraphEdge represents a directed edge between two nodes in the pipeline DAG.
type GraphEdge struct {
	Source string `json:"source"`
	Target string `json:"target"`
	Label  string `json:"label"`
}

// GraphData is the complete DAG structure returned to the frontend.
type GraphData struct {
	Nodes []GraphNode `json:"nodes"`
	Edges []GraphEdge `json:"edges"`
}

// GraphResponse is the API response for GET /pipelines/:id/graph.
type GraphResponse struct {
	PipelineID   string    `json:"pipelineId"`
	PipelineName string    `json:"pipelineName"`
	Graph        GraphData `json:"graph"`
}

// YamlParseRequest is the request body for POST /pipelines/parse-yaml.
type YamlParseRequest struct {
	YamlDefinition string `json:"yamlDefinition" binding:"required"`
}

// YamlParseResponse is the response for POST /pipelines/parse-yaml.
type YamlParseResponse struct {
	Graph    GraphData `json:"graph"`
	Valid    bool      `json:"valid"`
	Errors   []string  `json:"errors"`
	Warnings []string  `json:"warnings"`
}

// YamlToJsonRequest is the request body for POST /pipelines/to-yaml.
type YamlToJsonRequest struct {
	Graph GraphData `json:"graph" binding:"required"`
}

// YamlToJsonResponse is the response for POST /pipelines/to-yaml.
type YamlToJsonResponse struct {
	Yaml     string   `json:"yaml"`
	Valid    bool     `json:"valid"`
	Errors   []string `json:"errors"`
	Warnings []string `json:"warnings"`
}

// ValidateRequest is the request body for POST /pipelines/validate.
type ValidateRequest struct {
	YamlDefinition string `json:"yamlDefinition" binding:"required"`
}

// ValidateResponse is the response for POST /pipelines/validate.
type ValidateResponse struct {
	Valid    bool     `json:"valid"`
	Errors   []string `json:"errors"`
	Warnings []string `json:"warnings"`
}
