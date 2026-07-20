package service

import (
	"context"
	"database/sql"
	"errors"
	"strings"
	"testing"

	"orion/platform-svc-go/internal/pipeline-graph/models"
	"orion/platform-svc-go/internal/pipeline-graph/repository"
)

// ---- Mock ----

type mockGraphRepo struct {
	def    *repository.PipelineDefinition
	dbErr  error
	noRows bool
}

func (m *mockGraphRepo) GetPipelineByID(_ context.Context, id string) (*repository.PipelineDefinition, error) {
	if m.dbErr != nil {
		return nil, m.dbErr
	}
	if m.noRows {
		return nil, sql.ErrNoRows
	}
	return m.def, nil
}

func newTestService(def *repository.PipelineDefinition, err error, noRows bool) *Service {
	return NewService(&mockGraphRepo{def: def, dbErr: err, noRows: noRows})
}

var (
	testDef = &repository.PipelineDefinition{
		ID:          "pipe-001",
		TenantID:    "t1",
		Name:        "test-pipeline",
		YamlContent: "apiVersion: v1\nkind: Pipeline\nmetadata:\n  name: build\n",
		Status:      "active",
	}
	dbErr = errors.New("connection refused")
)

// ---- GetPipeline ----

func TestGetPipelineSuccess(t *testing.T) {
	s := newTestService(testDef, nil, false)
	p, err := s.GetPipeline(context.Background(), "pipe-001")
	if err != nil {
		t.Fatalf("GetPipeline returned error: %v", err)
	}
	if p == nil {
		t.Fatal("GetPipeline returned nil")
	}
	if p.ID != testDef.ID {
		t.Fatalf("expected ID %q, got %q", testDef.ID, p.ID)
	}
	if p.Name != testDef.Name {
		t.Fatalf("expected Name %q, got %q", testDef.Name, p.Name)
	}
}

func TestGetPipelineNotFound(t *testing.T) {
	s := newTestService(nil, nil, true)
	_, err := s.GetPipeline(context.Background(), "missing")
	if !errors.Is(err, ErrPipelineNotFound) {
		t.Fatalf("expected ErrPipelineNotFound, got %v", err)
	}
}

func TestGetPipelineDBError(t *testing.T) {
	s := newTestService(nil, dbErr, false)
	_, err := s.GetPipeline(context.Background(), "pipe-001")
	if err != dbErr {
		t.Fatalf("expected wrapped db error, got %v", err)
	}
}

// ---- BuildGraph (no repo dependency, but verify service method exists and works) ----

func TestBuildGraphSuccess(t *testing.T) {
	s := newTestService(nil, nil, false)
	validYaml := `
apiVersion: v1
kind: Pipeline
metadata:
  name: build-pipeline
spec:
  stages:
    - name: Build
      type: build
      steps:
        - name: compile
          uses: actions/checkout@v4
    - name: Test
      type: test
      dependsOn:
        - Build
      steps:
        - name: unit-tests
          uses: actions/setup-node@v4
`
	graph, err := s.BuildGraph("pipe-001", validYaml)
	if err != nil {
		t.Fatalf("BuildGraph returned error: %v", err)
	}
	if graph == nil {
		t.Fatal("BuildGraph returned nil")
	}
	if len(graph.Nodes) < 2 {
		t.Fatalf("expected at least 2 nodes, got %d", len(graph.Nodes))
	}
	if len(graph.Edges) < 1 {
		t.Fatalf("expected at least 1 edge, got %d", len(graph.Edges))
	}
	// Check for a stage node
	hasStage := false
	for _, n := range graph.Nodes {
		if n.Type == "stage" {
			hasStage = true
			break
		}
	}
	if !hasStage {
		t.Fatal("expected at least one stage node")
	}
}

func TestBuildGraphInvalidYaml(t *testing.T) {
	s := newTestService(nil, nil, false)
	_, err := s.BuildGraph("pipe-001", "{{{invalid yaml")
	if err == nil {
		t.Fatal("expected error for invalid YAML")
	}
}

// ---- YamlToJson ----

func TestYamlToJsonValid(t *testing.T) {
	s := newTestService(nil, nil, false)
	validYaml := `
apiVersion: v1
kind: Pipeline
metadata:
  name: deploy
spec:
  stages:
    - name: Deploy
      type: deploy
      steps:
        - name: kubectl
          uses: azure/k8s-deploy@v2
`
	resp, err := s.YamlToJson(validYaml)
	if err != nil {
		t.Fatalf("YamlToJson returned error: %v", err)
	}
	if !resp.Valid {
		t.Fatalf("expected valid parse, got invalid with errors: %v", resp.Errors)
	}
	if len(resp.Graph.Nodes) == 0 {
		t.Fatal("expected nodes in graph")
	}
}

func TestYamlToJsonInvalid(t *testing.T) {
	s := newTestService(nil, nil, false)
	badYaml := `
apiVersion: v1
kind: NotPipeline
metadata:
  name: bad
spec:
  stages:
    - name: Stage
      type: build
`
	resp, err := s.YamlToJson(badYaml)
	if err != nil {
		t.Fatalf("YamlToJson returned error: %v", err)
	}
	if resp.Valid {
		t.Fatal("expected invalid result for bad YAML")
	}
	if len(resp.Errors) == 0 {
		t.Fatal("expected validation errors")
	}
}

// ---- JsonToYaml ----

func TestJsonToYaml(t *testing.T) {
	s := newTestService(nil, nil, false)
	graph := graphDataWithStages()
	resp, err := s.JsonToYaml(graph)
	if err != nil {
		t.Fatalf("JsonToYaml returned error: %v", err)
	}
	if resp == nil {
		t.Fatal("JsonToYaml returned nil")
	}
	if resp.Yaml == "" {
		t.Fatal("expected non-empty YAML output")
	}
	// The generated YAML should re-parse as valid
	if !resp.Valid {
		t.Fatalf("expected generated YAML to be valid, got errors: %v", resp.Errors)
	}
}

func graphDataWithStages() models.GraphData {
	return models.GraphData{
		Nodes: []models.GraphNode{
			{ID: "build", Name: "Build", Type: "stage", Config: map[string]interface{}{"type": "build"}},
			{ID: "build::compile", Name: "compile", Type: "task", Config: map[string]interface{}{"uses": "actions/checkout@v4"}},
		},
		Edges: []models.GraphEdge{{Source: "build", Target: "build::compile"}},
	}
}

// ---- Validate ----

func TestValidateValid(t *testing.T) {
	s := newTestService(nil, nil, false)
	validYaml := `
apiVersion: v1
kind: Pipeline
metadata:
  name: valid
spec:
  stages:
    - name: Build
      type: build
      steps:
        - name: step1
          uses: foo/bar@v1
`
	resp, err := s.Validate(validYaml)
	if err != nil {
		t.Fatalf("Validate returned error: %v", err)
	}
	if resp == nil {
		t.Fatal("Validate returned nil")
	}
	if !resp.Valid {
		t.Fatalf("expected valid, got errors: %v", resp.Errors)
	}
}

func TestValidateMissingFields(t *testing.T) {
	s := newTestService(nil, nil, false)
	badYaml := "name: hello"
	resp, err := s.Validate(badYaml)
	if err != nil {
		t.Fatalf("Validate returned error: %v", err)
	}
	if resp.Valid {
		t.Fatal("expected invalid for missing fields")
	}
	if len(resp.Errors) == 0 {
		t.Fatal("expected validation errors")
	}
}

func TestValidateCyclicDependency(t *testing.T) {
	s := newTestService(nil, nil, false)
	cycleYaml := `
apiVersion: v1
kind: Pipeline
metadata:
  name: cycle
spec:
  stages:
    - name: A
      type: build
      dependsOn:
        - B
      steps:
        - name: s
          uses: x
    - name: B
      type: build
      dependsOn:
        - A
      steps:
        - name: s
          uses: x
`
	resp, err := s.Validate(cycleYaml)
	if err != nil {
		t.Fatalf("Validate returned error: %v", err)
	}
	if resp.Valid {
		t.Fatal("expected invalid for cyclic dependency")
	}
	hasCycle := false
	for _, e := range resp.Errors {
		if errorsIsContains(e, "CYCLIC") {
			hasCycle = true
			break
		}
	}
	if !hasCycle {
		t.Fatalf("expected CYCLIC error, got: %v", resp.Errors)
	}
}

// ---- Helpers ----

func errorsIsContains(errMsg, substr string) bool {
	return strings.Contains(errMsg, substr)
}
