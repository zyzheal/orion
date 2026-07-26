package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"strings"

	"orion/ci-cd-svc-go/internal/pipeline-template/models"
	"orion/ci-cd-svc-go/internal/pipeline-template/repository"

	"github.com/google/uuid"
)

// ---------------------------------------------------------------------------
// Sentinel errors
// ---------------------------------------------------------------------------

var (
	ErrNotFound         = errors.New("template not found")
	ErrPipelineNotFound = errors.New("pipeline not found")
	ErrInvalidYAML      = errors.New("yaml definition is required")
	ErrMissingParam     = errors.New("required parameter missing")
)

// Backwards-compatible alias used by the existing test.
var ErrPipelineTemplateNotFound = ErrNotFound

// ---------------------------------------------------------------------------
// Built-in templates seeded on first startup.
// ---------------------------------------------------------------------------

type builtinDef struct {
	Name        string
	Description string
	Category    string
	Tags        []string
	YAML        string
	Parameters  []models.TemplateParameter
}

var builtins = []builtinDef{
	{
		Name:        "Node.js Build & Test",
		Description: "Standard Node.js CI pipeline with install, test, and build stages",
		Category:    "language",
		Tags:        []string{"nodejs", "build", "test", "javascript"},
		YAML: `apiVersion: orion/v1
kind: Pipeline
metadata:
  name: nodejs-build-test
spec:
  stages:
    - name: install
      type: shell
      config:
        script: npm install
      timeout: 300000
    - name: test
      type: shell
      config:
        script: npm test
      depends_on: [install]
    - name: build
      type: shell
      config:
        script: npm run build
      depends_on: [test]`,
		Parameters: []models.TemplateParameter{
			{Name: "nodeVersion", Type: "string", Description: "Node.js version", DefaultValue: "18", Required: false},
			{Name: "testCommand", Type: "string", Description: "Test command", DefaultValue: "npm test", Required: false},
		},
	},
	{
		Name:        "Go Build & Test",
		Description: "Go CI pipeline with build, test, and vet stages",
		Category:    "language",
		Tags:        []string{"go", "golang", "build", "test"},
		YAML: `apiVersion: orion/v1
kind: Pipeline
metadata:
  name: go-build-test
spec:
  stages:
    - name: build
      type: shell
      config:
        script: go build -v ./...
    - name: test
      type: shell
      config:
        script: go test -v ./...
      depends_on: [build]
    - name: vet
      type: shell
      config:
        script: go vet ./...
      depends_on: [test]`,
		Parameters: []models.TemplateParameter{
			{Name: "goVersion", Type: "string", Description: "Go version", DefaultValue: "1.21", Required: false},
		},
	},
	{
		Name:        "Java Maven Build",
		Description: "Java Maven build pipeline with compile, test, and package",
		Category:    "language",
		Tags:        []string{"java", "maven", "build", "test"},
		YAML: `apiVersion: orion/v1
kind: Pipeline
metadata:
  name: java-maven-build
spec:
  stages:
    - name: compile
      type: shell
      config:
        script: mvn compile
    - name: test
      type: shell
      config:
        script: mvn test
      depends_on: [compile]
    - name: package
      type: shell
      config:
        script: mvn package -DskipTests
      depends_on: [test]`,
		Parameters: []models.TemplateParameter{
			{Name: "javaVersion", Type: "string", Description: "Java version", DefaultValue: "17", Required: false},
			{Name: "mavenArgs", Type: "string", Description: "Additional Maven arguments", DefaultValue: "", Required: false},
		},
	},
	{
		Name:        "Docker Build & Push",
		Description: "Build Docker image and push to registry",
		Category:    "platform",
		Tags:        []string{"docker", "container", "build", "push"},
		YAML: `apiVersion: orion/v1
kind: Pipeline
metadata:
  name: docker-build-push
spec:
  stages:
    - name: build
      type: docker
      config:
        dockerfile: Dockerfile
        context: .
        tags:
          - "$IMAGE_NAME:$VERSION"
    - name: push
      type: docker
      config:
        registry: "$REGISTRY"
        tags:
          - "$IMAGE_NAME:$VERSION"
      depends_on: [build]`,
		Parameters: []models.TemplateParameter{
			{Name: "imageName", Type: "string", Description: "Image name", Required: true},
			{Name: "version", Type: "string", Description: "Image version/tag", DefaultValue: "latest", Required: false},
			{Name: "registry", Type: "string", Description: "Docker registry URL", Required: true},
		},
	},
	{
		Name:        "Frontend Deploy",
		Description: "Build and deploy frontend application to static hosting",
		Category:    "purpose",
		Tags:        []string{"frontend", "deploy", "static", "web"},
		YAML: `apiVersion: orion/v1
kind: Pipeline
metadata:
  name: frontend-deploy
spec:
  stages:
    - name: build
      type: shell
      config:
        script: npm run build
    - name: deploy
      type: deploy
      config:
        provider: "$PROVIDER"
        target: "$TARGET"
      depends_on: [build]`,
		Parameters: []models.TemplateParameter{
			{Name: "buildCommand", Type: "string", Description: "Build command", DefaultValue: "npm run build", Required: false},
			{Name: "provider", Type: "string", Description: "Deployment provider (s3, gcs, azure)", Required: true},
			{Name: "target", Type: "string", Description: "Deployment target/bucket", Required: true},
		},
	},
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

type Service struct {
	repo *repository.Repository
}

func NewService(repo *repository.Repository) *Service {
	return &Service{repo: repo}
}

// ---------------------------------------------------------------------------
// InitializeBuiltinTemplates – idempotent seeding of built-in templates.
// ---------------------------------------------------------------------------

func (s *Service) InitializeBuiltinTemplates(ctx context.Context) {
	for _, b := range builtins {
		if _, err := s.repo.FindByNameAndTenant(ctx, "system", b.Name); err == nil {
			continue // already exists
		}

		paramsJSON, _ := json.Marshal(b.Parameters)
		tagsJSON, _ := json.Marshal(b.Tags)

		tpl := &models.PipelineTemplate{
			ID:          uuid.New().String(),
			TenantID:    "system",
			Name:        b.Name,
			Description: b.Description,
			Category:    b.Category,
			YAMLContent: b.YAML,
			Parameters:  models.JSONB(paramsJSON),
			Version:     1,
			IsPublic:    true,
			Tags:        models.JSONB(tagsJSON),
			CreatedBy:   strPtr("system"),
		}
		if err := s.repo.Create(ctx, tpl); err != nil {
			log.Printf("pipeline-template-svc: seed %q failed: %v", b.Name, err)
		}
	}
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

func (s *Service) Create(ctx context.Context, tenantID string, req *models.CreatePipelineTemplateRequest) (*models.PipelineTemplate, error) {
	if strings.TrimSpace(req.YAMLContent) == "" {
		return nil, ErrInvalidYAML
	}

	category := req.Category
	if category == "" {
		category = "custom"
	}
	tags := req.Tags
	if tags == nil {
		tags = models.JSONB("[]")
	}
	params := req.Parameters
	if params == nil {
		params = models.JSONB("[]")
	}

	tpl := &models.PipelineTemplate{
		ID:          uuid.New().String(),
		TenantID:    tenantID,
		Name:        req.Name,
		Description: req.Description,
		Category:    category,
		YAMLContent: req.YAMLContent,
		Parameters:  params,
		Version:     1,
		IsPublic:    req.IsPublic,
		Tags:        tags,
	}
	if err := s.repo.Create(ctx, tpl); err != nil {
		return nil, err
	}
	return tpl, nil
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

func (s *Service) Update(ctx context.Context, tenantID, id string, req *models.UpdatePipelineTemplateRequest) (*models.PipelineTemplate, error) {
	if _, err := s.repo.GetByID(ctx, tenantID, id); err != nil {
		return nil, ErrNotFound
	}
	if err := s.repo.Update(ctx, tenantID, id, req); err != nil {
		return nil, err
	}
	return s.repo.GetByID(ctx, tenantID, id)
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

func (s *Service) List(ctx context.Context, tenantID string, filter repository.ListFilter, page, pageSize int) (*models.ListResult, error) {
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = 20
	}
	offset := (page - 1) * pageSize

	items, total, err := s.repo.ListWithTotal(ctx, filter, offset, pageSize)
	if err != nil {
		return nil, err
	}
	return &models.ListResult{Data: items, Total: total, Page: page, Limit: pageSize}, nil
}

// ---------------------------------------------------------------------------
// GetByID
// ---------------------------------------------------------------------------

func (s *Service) GetByID(ctx context.Context, tenantID, id string) (*models.PipelineTemplate, error) {
	tpl, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, ErrNotFound
	}
	return tpl, nil
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

func (s *Service) Delete(ctx context.Context, tenantID, id string) error {
	if _, err := s.repo.GetByID(ctx, tenantID, id); err != nil {
		return ErrNotFound
	}
	return s.repo.Delete(ctx, tenantID, id)
}

// ---------------------------------------------------------------------------
// Count
// ---------------------------------------------------------------------------

func (s *Service) Count(ctx context.Context, tenantID string) (int, error) {
	return s.repo.Count(ctx, tenantID)
}

// ---------------------------------------------------------------------------
// InstantiateTemplate – creates a new pipeline from a template, replacing
// ${PARAM} placeholders with user-supplied values.
// ---------------------------------------------------------------------------

func (s *Service) InstantiateTemplate(ctx context.Context, tenantID, templateID string, req *models.InstantiateTemplateRequest) (*models.InstantiateResult, error) {
	tpl, err := s.repo.GetByID(ctx, tenantID, templateID)
	if err != nil {
		return nil, ErrNotFound
	}

	yaml := tpl.YAMLContent
	params := req.Params
	if params == nil {
		params = map[string]interface{}{}
	}

	// Replace ${PARAM} and $PARAM placeholders.
	for key, val := range params {
		upper := strings.ToUpper(key)
		yaml = strings.ReplaceAll(yaml, "${"+upper+"}", fmt.Sprintf("%v", val))
		yaml = strings.ReplaceAll(yaml, "${"+key+"}", fmt.Sprintf("%v", val))
	}

	// Validate required parameters.
	tplParams, _ := models.ParseParameters(tpl.Parameters)
	for _, p := range tplParams {
		if !p.Required {
			continue
		}
		if _, ok := params[p.Name]; ok {
			continue
		}
		if p.DefaultValue != nil {
			continue
		}
		return nil, fmt.Errorf("%w: %s", ErrMissingParam, p.Name)
	}

	// Persist the new pipeline.
	pipelineID, err := s.repo.InsertPipeline(ctx, tenantID, req.ProjectID, req.Name, "", yaml)
	if err != nil {
		return nil, err
	}

	return &models.InstantiateResult{
		PipelineID: pipelineID,
		Name:       req.Name,
		Version:    1,
	}, nil
}

// ---------------------------------------------------------------------------
// SavePipelineAsTemplate – reads an existing pipeline and stores it as a new
// template.
// ---------------------------------------------------------------------------

func (s *Service) SavePipelineAsTemplate(ctx context.Context, tenantID, pipelineID string, req *models.CreatePipelineTemplateRequest) (*models.PipelineTemplate, error) {
	cfg, err := s.repo.GetPipelineConfig(ctx, tenantID, pipelineID)
	if err != nil {
		return nil, ErrPipelineNotFound
	}

	// Extract yamlDefinition from the config JSON.
	yamlDef := extractYAMLFromConfig(cfg)
	if strings.TrimSpace(yamlDef) == "" {
		return nil, ErrInvalidYAML
	}

	req.YAMLContent = yamlDef
	return s.Create(ctx, tenantID, req)
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

func strPtr(s string) *string { return &s }

// extractYAMLFromConfig pulls the "yamlDefinition" field from a pipeline config JSONB.
func extractYAMLFromConfig(cfg models.JSONB) string {
	if cfg == nil {
		return ""
	}
	var m map[string]interface{}
	if err := json.Unmarshal(cfg, &m); err != nil {
		return ""
	}
	if v, ok := m["yamlDefinition"]; ok {
		if s, ok := v.(string); ok {
			return s
		}
	}
	return ""
}
