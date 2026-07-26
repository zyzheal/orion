package models

// GraphNode represents a node in a pipeline dependency graph.
type GraphNode struct {
	ID       string   `json:"id"`
	Label    string   `json:"label"`
	Type     string   `json:"type"`
	Status   string   `json:"status,omitempty"`
	Sequence int      `json:"sequence,omitempty"`
}

// GraphEdge represents an edge (dependency) between two graph nodes.
type GraphEdge struct {
	From   string `json:"from"`
	To     string `json:"to"`
	Label  string `json:"label,omitempty"`
	Type   string `json:"type,omitempty"`
}

// PipelineGraph represents a full pipeline dependency graph.
type PipelineGraph struct {
	Nodes []GraphNode `json:"nodes"`
	Edges []GraphEdge `json:"edges"`
}

// PipelineYAMLDef represents a pipeline definition in YAML format.
type PipelineYAMLDef struct {
	APIVersion string            `yaml:"apiVersion" json:"apiVersion"`
	Kind       string            `yaml:"kind" json:"kind"`
	Metadata   PipelineYAMLMeta  `yaml:"metadata" json:"metadata"`
	Spec       PipelineYAMLSpec  `yaml:"spec" json:"spec"`
}

// PipelineYAMLMeta holds metadata for a pipeline YAML definition.
type PipelineYAMLMeta struct {
	Name        string `yaml:"name" json:"name"`
	Description string `yaml:"description" json:"description,omitempty"`
	Labels      map[string]string `yaml:"labels,omitempty" json:"labels,omitempty"`
}

// PipelineYAMLSpec holds the spec for a pipeline YAML definition.
type PipelineYAMLSpec struct {
	Triggers  []YAMLTriggerDef  `yaml:"triggers,omitempty" json:"triggers,omitempty"`
	Stages    []YAMLStageDef    `yaml:"stages" json:"stages"`
	Env       map[string]string `yaml:"env,omitempty" json:"env,omitempty"`
	Timeout   int               `yaml:"timeout,omitempty" json:"timeout,omitempty"`
}

// YAMLTriggerDef defines a trigger in YAML.
type YAMLTriggerDef struct {
	Type   string            `yaml:"type" json:"type"`
	Name   string            `yaml:"name" json:"name"`
	Config map[string]any    `yaml:"config,omitempty" json:"config,omitempty"`
}

// YAMLStageDef defines a stage in YAML.
type YAMLStageDef struct {
	Name       string            `yaml:"name" json:"name"`
	DependsOn  []string          `yaml:"dependsOn,omitempty" json:"dependsOn,omitempty"`
	Tasks      []YAMLTaskDef     `yaml:"tasks" json:"tasks"`
	Timeout    int               `yaml:"timeout,omitempty" json:"timeout,omitempty"`
	Retry      *YAMLRetryDef     `yaml:"retry,omitempty" json:"retry,omitempty"`
	Env        map[string]string `yaml:"env,omitempty" json:"env,omitempty"`
}

// YAMLTaskDef defines a task within a stage.
type YAMLTaskDef struct {
	Name    string         `yaml:"name" json:"name"`
	Type    string         `yaml:"type" json:"type"`
	Config  map[string]any `yaml:"config,omitempty" json:"config,omitempty"`
	Run     string         `yaml:"run,omitempty" json:"run,omitempty"`
	Image   string         `yaml:"image,omitempty" json:"image,omitempty"`
}

// YAMLRetryDef defines retry configuration.
type YAMLRetryDef struct {
	MaxRetries int `yaml:"maxRetries" json:"maxRetries"`
	Delay      int `yaml:"delay,omitempty" json:"delay,omitempty"`
}

// YAMLValidationResult holds validation results for a pipeline YAML.
type YAMLValidationResult struct {
	Valid   bool                `json:"valid"`
	Errors  []YAMLValidationErr `json:"errors,omitempty"`
	Warnings []string           `json:"warnings,omitempty"`
}

// YAMLValidationErr represents a single validation error.
type YAMLValidationErr struct {
	Field   string `json:"field"`
	Message string `json:"message"`
	Line    int    `json:"line,omitempty"`
}