package relation

import (
	"time"
)

type RelationType string

const (
	RelationTypeDependsOn     RelationType = "DEPENDS_ON"
	RelationTypeHostedOn      RelationType = "HOSTED_ON"
	RelationTypeConnectsTo    RelationType = "CONNECTS_TO"
	RelationTypeBelongsTo     RelationType = "BELONGS_TO"
	RelationTypeUses          RelationType = "USES"
	RelationTypeContains      RelationType = "CONTAINS"
	RelationTypeVersionOf     RelationType = "VERSION_OF"
	RelationTypeDeployedTo    RelationType = "DEPLOYED_TO"
	RelationTypeMonitoredBy   RelationType = "MONITORED_BY"
)

// ValidRelationTypes returns all valid relation type values
func ValidRelationTypes() []RelationType {
	return []RelationType{
		RelationTypeDependsOn,
		RelationTypeHostedOn,
		RelationTypeConnectsTo,
		RelationTypeBelongsTo,
		RelationTypeUses,
		RelationTypeContains,
		RelationTypeVersionOf,
		RelationTypeDeployedTo,
		RelationTypeMonitoredBy,
	}
}

// IsValidRelationType checks if the given relationType is valid
func IsValidRelationType(relationType string) bool {
	for _, valid := range ValidRelationTypes() {
		if string(valid) == relationType {
			return true
		}
	}
	return false
}

// Relation represents a relationship between two CIs in CMDB
type Relation struct {
	ID           string       `json:"id" gorm:"primaryKey"`
	TenantID     int64        `json:"tenant_id" gorm:"index;not null"`
	FromCiID     string       `json:"from_ci_id" gorm:"index;not null"`
	ToCiID       string       `json:"to_ci_id" gorm:"index;not null"`
	RelationType string       `json:"relation_type" gorm:"not null"`
	Description  string       `json:"description"`
	CreatedBy    string       `json:"created_by"`
	CreatedAt    time.Time    `json:"created_at"`
	DeletedAt    *time.Time   `json:"deleted_at"`
}

// TableName returns the table name for Relation model
func (Relation) TableName() string {
	return "cmdb_relations"
}

// CreateRelationInput represents the input for creating a new relation
type CreateRelationInput struct {
	FromCiID     string `json:"from_ci_id" validate:"required"`
	ToCiID       string `json:"to_ci_id" validate:"required"`
	RelationType string `json:"relation_type" validate:"required"`
	Description  string `json:"description"`
	TenantID     int64  `json:"-"`
	CreatedBy    string `json:"-"`
}