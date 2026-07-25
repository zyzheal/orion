package validators

import (
	"context"
	"encoding/json"
)

// RelationshipValidator checks referential integrity between CMDB objects.
type RelationshipValidator struct {
	name      string
	condition *RuleCondition
	errorMsg  string
}

func NewRelationshipValidator(name, condition, errorMsg string) *RelationshipValidator {
	return &RelationshipValidator{name: name, condition: ParseConditionOrEmpty(condition), errorMsg: errorMsg}
}

// Type returns the validator type identifier.
func (v *RelationshipValidator) Type() string { return "relationship" }

// Validate checks the relationship data against configured constraints.
func (v *RelationshipValidator) Validate(ctx context.Context, data map[string]interface{}) (bool, string) {
	_ = ctx
	if v.condition == nil {
		return true, "no condition configured"
	}

	// Check required relationship fields
	for _, rf := range []string{"source_type", "source_id", "target_type", "target_id", "relation_type"} {
		if _, ok := getFieldValue(data, rf); !ok {
			return false, v.relError(rf, "required field is missing")
		}
	}

	// Validate source_id is a valid UUID
	sourceID := asString(data["source_id"])
	if sourceID == "" || !isValidUUID(sourceID) {
		return false, v.relError("source_id", "must be a valid UUID")
	}

	// Validate target_id is a valid UUID
	targetID := asString(data["target_id"])
	if targetID == "" || !isValidUUID(targetID) {
		return false, v.relError("target_id", "must be a valid UUID")
	}

	// Prevent self-referencing
	if sourceID == targetID {
		return false, v.relError("relationship", "source and target cannot be the same object")
	}

	// Validate relation_type against allowed values
	if len(v.condition.EnumValues) > 0 {
		relationType := asString(data["relation_type"])
		found := false
		for _, ev := range v.condition.EnumValues {
			if relationType == ev {
				found = true
				break
			}
		}
		if !found {
			allowed, _ := json.Marshal(v.condition.EnumValues)
			return false, v.relError("relation_type", "must be one of "+string(allowed))
		}
	}

	return true, ""
}

func (v *RelationshipValidator) relError(field, detail string) string {
	msg := v.errorMsg
	if msg == "" {
		msg = field + " " + detail
	}
	return msg
}
