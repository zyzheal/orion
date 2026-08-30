package models

import (
	"encoding/json"
	"time"
)

// SchemaType is the target system for the schema.
type SchemaType string

const (
	SchemaTypeProtobuf    SchemaType = "protobuf"
	SchemaTypeAvro        SchemaType = "avro"
	SchemaTypeJSON        SchemaType = "json"
	SchemaTypePostgreSQL  SchemaType = "postgresql"
	SchemaTypeMongoDB     SchemaType = "mongodb"
	SchemaTypeKafkaAvro   SchemaType = "kafka-avro"
	SchemaTypeEventBridge SchemaType = "event-bridge"
)

// CompatibilityMode controls how evolution checks treat breaking changes.
type CompatibilityMode string

const (
	CompatibilityNone     CompatibilityMode = "none"
	CompatibilityBackward CompatibilityMode = "backward"
	CompatibilityForward  CompatibilityMode = "forward"
	CompatibilityFull     CompatibilityMode = "full"
)

// SchemaStatus tracks lifecycle state.
type SchemaStatus string

const (
	SchemaDraft      SchemaStatus = "draft"
	SchemaActive     SchemaStatus = "active"
	SchemaDeprecated SchemaStatus = "deprecated"
	SchemaArchived   SchemaStatus = "archived"
)

// SchemaField describes one column or message field.
type SchemaField struct {
	Name        string                 `json:"name"`
	Type        string                 `json:"type"`
	Nullable    bool                   `json:"nullable"`
	Default     json.RawMessage        `json:"default,omitempty"`
	Length      int                    `json:"length,omitempty"`
	Scale       int                    `json:"scale,omitempty"`
	Precision   int                    `json:"precision,omitempty"`
	PrimaryKey  bool                   `json:"primaryKey"`
	Unique      bool                   `json:"unique"`
	Index       bool                   `json:"index"`
	Description string                 `json:"description,omitempty"`
	Constraints map[string]interface{} `json:"constraints,omitempty"`
	EnumValues  []string               `json:"enumValues,omitempty"`
}

// SchemaRelationship defines a link between schemas.
type SchemaRelationship struct {
	Type        string `json:"type"` // one-to-one, one-to-many, many-to-many
	SourceField string `json:"sourceField"`
	TargetField string `json:"targetField"`
	Target      string `json:"target"`   // target schema name
	OnDelete    string `json:"onDelete"` // cascade, set-null, restrict
	OnUpdate    string `json:"onUpdate"`
}

// IndexDefinition describes a composite index.
type IndexDefinition struct {
	Name    string   `json:"name"`
	Fields  []string `json:"fields"`
	Unique  bool     `json:"unique"`
	Partial string   `json:"partial,omitempty"`
}

// Schema is the core registry entry.
type Schema struct {
	ID            string                 `json:"id"`
	TenantID      string                 `json:"tenantId,omitempty"`
	Name          string                 `json:"name"`
	Namespace     string                 `json:"namespace"`
	Type          SchemaType             `json:"type"`
	Version       int                    `json:"version"`
	Status        SchemaStatus           `json:"status"`
	Owner         string                 `json:"owner"`
	Description   string                 `json:"description,omitempty"`
	Fields        []SchemaField          `json:"fields"`
	Relationships []SchemaRelationship   `json:"relationships,omitempty"`
	Indexes       []IndexDefinition      `json:"indexes,omitempty"`
	Compatibility CompatibilityMode      `json:"compatibility"`
	Metadata      map[string]interface{} `json:"metadata,omitempty"`
	CreatedAt     time.Time              `json:"createdAt"`
	UpdatedAt     time.Time              `json:"updatedAt"`
}

// FullName returns namespace/name.
func (s *Schema) FullName() string {
	if s.Namespace != "" {
		return s.Namespace + "/" + s.Name
	}
	return s.Name
}

// CanonicalKey returns a namespace-qualified key for cross-tenant lookups.
func (s *Schema) CanonicalKey() string {
	return s.Namespace + ":" + s.Name
}

// --- Evolution ---

// EvolutionChangeType describes the kind of change detected.
type EvolutionChangeType string

const (
	ChangeAddField    EvolutionChangeType = "add_field"
	ChangeRemoveField EvolutionChangeType = "remove_field"
	ChangeAlterField  EvolutionChangeType = "alter_field"
	ChangeRenameField EvolutionChangeType = "rename_field"
	ChangeAddIndex    EvolutionChangeType = "add_index"
	ChangeRemoveIndex EvolutionChangeType = "remove_index"
)

// EvolutionBreakingLevel classifies severity.
type EvolutionBreakingLevel string

const (
	BreakingNone     EvolutionBreakingLevel = "none"
	BreakingMinor    EvolutionBreakingLevel = "minor"
	BreakingMajor    EvolutionBreakingLevel = "major"
	BreakingCritical EvolutionBreakingLevel = "critical"
)

// EvolutionChange describes one detected change.
type EvolutionChange struct {
	Type     EvolutionChangeType    `json:"type"`
	Field    string                 `json:"field"`
	Severity EvolutionBreakingLevel `json:"severity"`
	Detail   string                 `json:"detail"`
	Fixable  bool                   `json:"fixable"`
}

// EvolutionResult holds the comparison of two schema versions.
type EvolutionResult struct {
	Compatible        bool                   `json:"compatible"`
	Breaking          bool                   `json:"breaking"`
	WorstLevel        EvolutionBreakingLevel `json:"worstLevel"`
	Changes           []EvolutionChange      `json:"changes"`
	TargetMode        CompatibilityMode      `json:"targetMode"`
	RecommendedAction string                 `json:"recommendedAction,omitempty"`
}

// --- Registration request/response ---

type RegisterRequest struct {
	Name          string                 `json:"name"`
	Namespace     string                 `json:"namespace"`
	Type          SchemaType             `json:"type"`
	Owner         string                 `json:"owner"`
	Description   string                 `json:"description,omitempty"`
	Fields        []SchemaField          `json:"fields"`
	Relationships []SchemaRelationship   `json:"relationships,omitempty"`
	Indexes       []IndexDefinition      `json:"indexes,omitempty"`
	Compatibility CompatibilityMode      `json:"compatibility"`
	Metadata      map[string]interface{} `json:"metadata,omitempty"`
}

type RegisterResponse struct {
	Schema  *Schema `json:"schema"`
	Version int     `json:"version"`
}

type QueryRequest struct {
	Namespace string       `json:"namespace"`
	Type      SchemaType   `json:"type,omitempty"`
	Status    SchemaStatus `json:"status,omitempty"`
	Owner     string       `json:"owner,omitempty"`
}

type QueryResponse struct {
	Schemas []*Schema `json:"schemas"`
	Total   int       `json:"total"`
}

type CompatibilityResponse struct {
	Result     *EvolutionResult `json:"result"`
	Breaking   bool             `json:"breaking"`
	Compatible bool             `json:"compatible"`
}

// --- Version history ---

type SchemaVersion struct {
	JSON       json.RawMessage   `json:"schemaJSON"`
	Version    int               `json:"version"`
	Changes    []EvolutionChange `json:"changes,omitempty"`
	ReleasedAt time.Time         `json:"releasedAt"`
	ReleasedBy string            `json:"releasedBy"`
}

type VersionHistoryResponse struct {
	Schema   string              `json:"schema"`
	Versions []*SchemaVersion `json:"versions"`
}
