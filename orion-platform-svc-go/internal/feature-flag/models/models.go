package models

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"
)

// JSONB is a PostgreSQL JSONB-compatible map type.
type JSONB map[string]interface{}

func (j JSONB) Value() (driver.Value, error) {
	if j == nil {
		return nil, nil
	}
	return json.Marshal(j)
}

func (j *JSONB) Scan(src interface{}) error {
	if src == nil {
		*j = nil
		return nil
	}
	switch v := src.(type) {
	case []byte:
		return json.Unmarshal(v, j)
	case string:
		return json.Unmarshal([]byte(v), j)
	default:
		return fmt.Errorf("cannot scan %T into JSONB", src)
	}
}

// JSONArray is a PostgreSQL JSONB-compatible slice type for targeting_rules.
type JSONArray []interface{}

func (a JSONArray) Value() (driver.Value, error) {
	if a == nil {
		return "[]", nil
	}
	return json.Marshal(a)
}

func (a *JSONArray) Scan(src interface{}) error {
	if src == nil {
		*a = JSONArray{}
		return nil
	}
	switch v := src.(type) {
	case []byte:
		return json.Unmarshal(v, a)
	case string:
		return json.Unmarshal([]byte(v), a)
	default:
		return fmt.Errorf("cannot scan %T into JSONArray", src)
	}
}

// StringArray is a PostgreSQL JSONB-compatible string slice type for environments and tags.
type StringArray []string

func (a StringArray) Value() (driver.Value, error) {
	if a == nil {
		return "[]", nil
	}
	return json.Marshal(a)
}

func (a *StringArray) Scan(src interface{}) error {
	if src == nil {
		*a = StringArray{}
		return nil
	}
	switch v := src.(type) {
	case []byte:
		return json.Unmarshal(v, a)
	case string:
		return json.Unmarshal([]byte(v), a)
	default:
		return fmt.Errorf("cannot scan %T into StringArray", src)
	}
}

// FeatureFlagStatus represents the lifecycle state of a feature flag.
type FeatureFlagStatus string

const (
	FlagStatusActive   FeatureFlagStatus = "active"
	FlagStatusInactive FeatureFlagStatus = "inactive"
	FlagStatusArchived FeatureFlagStatus = "archived"
)

// RolloutStrategy determines how rollout percentage is applied.
type RolloutStrategy string

const (
	RolloutPercentage RolloutStrategy = "percentage"
	RolloutTargeted   RolloutStrategy = "targeted"
	RolloutGradual    RolloutStrategy = "gradual"
)

// TargetingRuleOperator defines the comparison operator for a targeting rule.
type TargetingRuleOperator string

const (
	OpEquals   TargetingRuleOperator = "equals"
	OpContains TargetingRuleOperator = "contains"
	OpIn       TargetingRuleOperator = "in"
	OpRegex    TargetingRuleOperator = "regex"
	OpGt       TargetingRuleOperator = "gt"
	OpLt       TargetingRuleOperator = "lt"
)

// TargetingRule defines a single targeting rule for flag evaluation.
type TargetingRule struct {
	Attribute string                `json:"attribute"`
	Operator  TargetingRuleOperator `json:"operator"`
	Value     interface{}           `json:"value"`
}

// FeatureFlag is the core domain model persisted in PostgreSQL.
type FeatureFlag struct {
	ID              string            `db:"id" json:"id"`
	TenantID        string            `db:"tenant_id" json:"tenant_id"`
	Name            string            `db:"name" json:"name"`
	Key             string            `db:"key" json:"key"`
	Description     string            `db:"description" json:"description"`
	Status          FeatureFlagStatus `db:"status" json:"status"`
	DefaultValue    bool              `db:"default_value" json:"default_value"`
	RolloutPct      int               `db:"rollout_pct" json:"rollout_pct"`
	RolloutStrategy RolloutStrategy   `db:"rollout_strategy" json:"rollout_strategy"`
	TargetingRules  JSONArray         `db:"targeting_rules" json:"targeting_rules"`
	Environments    StringArray       `db:"environments" json:"environments"`
	Tags            StringArray       `db:"tags" json:"tags"`
	CreatedBy       string            `db:"created_by" json:"created_by"`
	UpdatedBy       string            `db:"updated_by" json:"updated_by"`
	CreatedAt       time.Time         `db:"created_at" json:"created_at"`
	UpdatedAt       time.Time         `db:"updated_at" json:"updated_at"`
}

// CreateFlagRequest is the input for creating a new feature flag.
type CreateFlagRequest struct {
	Name            string           `json:"name" binding:"required"`
	Key             string           `json:"key" binding:"required"`
	Description     string           `json:"description"`
	DefaultValue    *bool            `json:"default_value"`
	RolloutPct      *int             `json:"rollout_pct"`
	RolloutStrategy *RolloutStrategy `json:"rollout_strategy"`
	TargetingRules  []TargetingRule  `json:"targeting_rules"`
	Environments    []string         `json:"environments"`
	Tags            []string         `json:"tags"`
}

// UpdateFlagRequest is the input for updating an existing feature flag.
type UpdateFlagRequest struct {
	Name            *string            `json:"name"`
	Description     *string            `json:"description"`
	Status          *FeatureFlagStatus `json:"status"`
	DefaultValue    *bool              `json:"default_value"`
	RolloutPct      *int               `json:"rollout_pct"`
	RolloutStrategy *RolloutStrategy   `json:"rollout_strategy"`
	TargetingRules  []TargetingRule    `json:"targeting_rules"`
	Environments    []string           `json:"environments"`
	Tags            []string           `json:"tags"`
}

// SetRolloutRequest is the input for setting the rollout percentage.
type SetRolloutRequest struct {
	Percentage int `json:"percentage" binding:"required,min=0,max=100"`
}

// EvaluateFlagRequest is the input for evaluating a feature flag.
type EvaluateFlagRequest struct {
	FlagKey     string                 `json:"flag_key" binding:"required"`
	Environment string                 `json:"environment"`
	UserID      string                 `json:"user_id"`
	Attributes  map[string]interface{} `json:"attributes"`
}

// FlagEvaluationResult is the output of flag evaluation.
type FlagEvaluationResult struct {
	FlagID      string    `json:"flag_id"`
	Key         string    `json:"key"`
	Enabled     bool      `json:"enabled"`
	Reason      string    `json:"reason"`
	EvaluatedAt time.Time `json:"evaluated_at"`
}

// FlagToggleRecord records a change to a flag's enabled state.
type FlagToggleRecord struct {
	ID        string    `db:"id" json:"id"`
	FlagID    string    `db:"flag_id" json:"flag_id"`
	OldValue  bool      `db:"old_value" json:"old_value"`
	NewValue  bool      `db:"new_value" json:"new_value"`
	ChangedBy string    `db:"changed_by" json:"changed_by"`
	Reason    string    `db:"reason" json:"reason"`
	ChangedAt time.Time `db:"changed_at" json:"changed_at"`
}

// ListFilter carries optional filter criteria for listing flags.
type ListFilter struct {
	Status      *FeatureFlagStatus
	Environment *string
}

// RecordToggleRequest is the input for recording a flag toggle event.
type RecordToggleRequest struct {
	OldValue bool   `json:"old_value"`
	NewValue bool   `json:"new_value"`
	Reason   string `json:"reason"`
}
