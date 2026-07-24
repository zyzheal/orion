package condition

import (
	"encoding/json"
	"fmt"
)

// ParseDSL parses a JSON DSL string into a ConditionGroup AST.
// Example DSL:
//   {"operator": "AND", "conditions": [
//     {"field": "alert.severity", "operator": "in", "values": ["P0", "P1"]}
//   ]}
func ParseDSL(dsl string) (*ConditionGroup, error) {
	if dsl == "" {
		return nil, fmt.Errorf("condition: empty DSL string")
	}

	var raw RawDSL
	if err := json.Unmarshal([]byte(dsl), &raw); err != nil {
		return nil, fmt.Errorf("condition: failed to parse DSL JSON: %w", err)
	}

	group, err := raw.toGroup()
	if err != nil {
		return nil, err
	}

	return group, nil
}

// ParseDSLBytes is like ParseDSL but takes raw bytes.
func ParseDSLBytes(data []byte) (*ConditionGroup, error) {
	if len(data) == 0 {
		return nil, fmt.Errorf("condition: empty DSL bytes")
	}

	var raw RawDSL
	if err := json.Unmarshal(data, &raw); err != nil {
		return nil, fmt.Errorf("condition: failed to parse DSL JSON: %w", err)
	}

	return raw.toGroup()
}

// ---------------------------------------------------------------------------
// Raw DSL structures for JSON parsing
// ---------------------------------------------------------------------------

// RawDSL is the raw JSON input structure.
type RawDSL struct {
	Operator   string           `json:"operator"`
	Conditions []json.RawMessage `json:"conditions"`
}

// toGroup converts raw DSL to a ConditionGroup.
func (r *RawDSL) toGroup() (*ConditionGroup, error) {
	if r.Operator == "" {
		return nil, ErrMissingOperator
	}

	op := LogicalOperator(r.Operator)
	if op != LogicalAnd && op != LogicalOr {
		return nil, ErrInvalidLogicalOperator
	}

	exprs, err := r.toExprs()
	if err != nil {
		return nil, err
	}

	return &ConditionGroup{
		Operator:   op,
		Conditions: exprs,
	}, nil
}

// toExprs converts raw conditions to ConditionExpr slice.
func (r *RawDSL) toExprs() ([]ConditionExpr, error) {
	exprs := make([]ConditionExpr, len(r.Conditions))

	for i, raw := range r.Conditions {
		// Try to parse as Condition first
		var cond Condition
		if err := json.Unmarshal(raw, &cond); err == nil {
			exprs[i] = ConditionExpr{
				IsGroup: false,
				Cond:    &cond,
			}
			continue
		}

		// Try to parse as nested ConditionGroup
		var nested RawDSL
		if err := json.Unmarshal(raw, &nested); err != nil {
			return nil, fmt.Errorf("condition: condition[%d] is not a valid condition or group: %w", i, err)
		}

		group, err := nested.toGroup()
		if err != nil {
			return nil, fmt.Errorf("condition: condition[%d] group parse failed: %w", i, err)
		}

		exprs[i] = ConditionExpr{
			IsGroup: true,
			Group:   group,
		}
	}

	return exprs, nil
}

// ParseExpr parses a single condition expression (Condition or ConditionGroup).
func ParseExpr(raw json.RawMessage) (*ConditionExpr, error) {
	// Try Condition first
	var cond Condition
	if err := json.Unmarshal(raw, &cond); err == nil {
		return &ConditionExpr{IsGroup: false, Cond: &cond}, nil
	}

	// Try ConditionGroup
	var group RawDSL
	if err := json.Unmarshal(raw, &group); err == nil {
		g, err := group.toGroup()
		if err != nil {
			return nil, err
		}
		return &ConditionExpr{IsGroup: true, Group: g}, nil
	}

	return nil, fmt.Errorf("condition: cannot parse expression")
}

// Serialize converts a ConditionGroup back to JSON bytes.
func (g *ConditionGroup) Serialize() ([]byte, error) {
	if g == nil {
		return nil, nil
	}
	return json.Marshal(g)
}

// String returns a pretty-printed DSL string.
func (g *ConditionGroup) String() string {
	data, err := json.MarshalIndent(g, "", "  ")
	if err != nil {
		return ""
	}
	return string(data)
}

// ParseCondition parses a single Condition from JSON.
func ParseCondition(raw json.RawMessage) (*Condition, error) {
	var cond Condition
	if err := json.Unmarshal(raw, &cond); err != nil {
		return nil, err
	}
	return &cond, nil
}
