package models

import (
	"encoding/json"
	"time"
)

// ==================== Builder Image ====================

// BuilderImage represents a builder container image.
type BuilderImage struct {
	ID          string            `db:"id" json:"id"`
	TenantID    string            `db:"tenant_id" json:"tenant_id"`
	Name        string            `db:"name" json:"name"`
	DisplayName string            `db:"display_name" json:"display_name"`
	Image       string            `db:"image" json:"image"`
	Type        PresetImageType   `db:"type" json:"type"`
	Version     string            `db:"version" json:"version"`
	Description string            `db:"description" json:"description"`
	PullPolicy  ImagePullPolicy   `db:"pull_policy" json:"pull_policy"`
	Status      BuilderImageStatus `db:"status" json:"status"`
	IsPreset    bool              `db:"is_preset" json:"is_preset"`
	Env         json.RawMessage   `db:"env" json:"env,omitempty"`
	Labels      json.RawMessage   `db:"labels" json:"labels,omitempty"`
	CreatedBy   string            `db:"created_by" json:"created_by"`
	CreatedAt   time.Time         `db:"created_at" json:"created_at"`
	UpdatedAt   time.Time         `db:"updated_at" json:"updated_at"`
}

// CreateBuilderImageInput is the payload for creating a builder image.
type CreateBuilderImageInput struct {
	Name        string          `json:"name" binding:"required"`
	DisplayName string          `json:"display_name" binding:"required"`
	Image       string          `json:"image" binding:"required"`
	Type        PresetImageType `json:"type" binding:"required"`
	Version     string          `json:"version"`
	Description string          `json:"description"`
	PullPolicy  ImagePullPolicy `json:"pull_policy"`
	Status      BuilderImageStatus `json:"status"`
	IsPreset    bool            `json:"is_preset"`
	Env         json.RawMessage `json:"env,omitempty"`
	Labels      json.RawMessage `json:"labels,omitempty"`
	CreatedBy   string          `json:"created_by"`
}

// ==================== Domain types ====================

// PresetImageDef defines a built-in preset builder image.
type PresetImageDef struct {
	Name        string
	DisplayName string
	Image       string
	Type        PresetImageType
	Version     string
	Description string
	Env         map[string]string
}

// ImagePullPolicy defines how images are pulled.
type ImagePullPolicy string

const (
	ImagePullPolicyAlways      ImagePullPolicy = "Always"
	ImagePullPolicyIfNotPresent ImagePullPolicy = "IfNotPresent"
	ImagePullPolicyNever       ImagePullPolicy = "Never"
)

// BuilderImageStatus defines the lifecycle state of a builder image.
type BuilderImageStatus string

const (
	BuilderImageStatusActive     BuilderImageStatus = "active"
	BuilderImageStatusDeprecated BuilderImageStatus = "deprecated"
	BuilderImageStatusDisabled   BuilderImageStatus = "disabled"
)

// PresetImageType categorizes a builder image.
type PresetImageType string

const (
	PresetImageTypeNode    PresetImageType = "node"
	PresetImageTypePython  PresetImageType = "python"
	PresetImageTypeGo      PresetImageType = "go"
	PresetImageTypeJava    PresetImageType = "java"
	PresetImageTypeDotnet  PresetImageType = "dotnet"
	PresetImageTypeRust    PresetImageType = "rust"
	PresetImageTypeCustom  PresetImageType = "custom"
)

// BuilderImageQueryOptions filters builder images.
type BuilderImageQueryOptions struct {
	Type     PresetImageType
	Status   BuilderImageStatus
	IsPreset *bool
	Limit    int
	Offset   int
}

// UpdateBuilderImageInput is the payload for updating a builder image.
type UpdateBuilderImageInput struct {
	DisplayName string          `json:"display_name,omitempty"`
	Description string          `json:"description,omitempty"`
	PullPolicy  string          `json:"pull_policy,omitempty"`
	Status      string          `json:"status,omitempty"`
	Env         json.RawMessage `json:"env,omitempty"`
	Labels      json.RawMessage `json:"labels,omitempty"`
}

// DefaultPresetImages returns the list of default preset builder images.
func DefaultPresetImages() []PresetImageDef {
	return []PresetImageDef{
		{Name: "node-20", DisplayName: "Node.js 20 Builder", Image: "node:20-slim", Type: PresetImageTypeNode, Version: "20-slim", Description: "Node.js 20 slim builder image", Env: map[string]string{"NODE_ENV": "production"}},
		{Name: "node-18", DisplayName: "Node.js 18 Builder", Image: "node:18-slim", Type: PresetImageTypeNode, Version: "18-slim", Description: "Node.js 18 slim builder image", Env: map[string]string{"NODE_ENV": "production"}},
		{Name: "python-312", DisplayName: "Python 3.12 Builder", Image: "python:3.12-slim", Type: PresetImageTypePython, Version: "3.12-slim", Description: "Python 3.12 slim builder image"},
		{Name: "python-311", DisplayName: "Python 3.11 Builder", Image: "python:3.11-slim", Type: PresetImageTypePython, Version: "3.11-slim", Description: "Python 3.11 slim builder image"},
		{Name: "go-122", DisplayName: "Go 1.22 Builder", Image: "golang:1.22-slim", Type: PresetImageTypeGo, Version: "1.22-alpine", Description: "Go 1.22 Alpine builder image", Env: map[string]string{"GOPATH": "/go", "GONOSUMCHECK": "*"}},
		{Name: "go-121", DisplayName: "Go 1.21 Builder", Image: "golang:1.21-slim", Type: PresetImageTypeGo, Version: "1.21-alpine", Description: "Go 1.21 Alpine builder image", Env: map[string]string{"GOPATH": "/go", "GONOSUMCHECK": "*"}},
		{Name: "java-21", DisplayName: "Java 21 Builder", Image: "eclipse-temurin:21-jdk-slim", Type: PresetImageTypeJava, Version: "21-jdk-alpine", Description: "Java 21 Temurin Alpine builder image", Env: map[string]string{"JAVA_HOME": "/opt/java/openjdk"}},
		{Name: "java-17", DisplayName: "Java 17 Builder", Image: "eclipse-temurin:17-jdk-slim", Type: PresetImageTypeJava, Version: "17-jdk-alpine", Description: "Java 17 Temurin Alpine builder image", Env: map[string]string{"JAVA_HOME": "/opt/java/openjdk"}},
		{Name: "dotnet-8", DisplayName: ".NET 8 Builder", Image: "mcr.microsoft.com/dotnet/sdk:8.0-slim", Type: PresetImageTypeDotnet, Version: "8.0-alpine", Description: ".NET 8 SDK Alpine builder image"},
		{Name: "rust-177", DisplayName: "Rust 1.77 Builder", Image: "rust:1.77-slim", Type: PresetImageTypeRust, Version: "1.77-slim", Description: "Rust 1.77 slim builder image"},
	}
}
