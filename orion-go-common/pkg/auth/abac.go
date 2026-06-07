package auth

import (
	"context"
	"time"
)

// ABACEffect represents the effect of an ABAC policy.
type ABACEffect string

const (
	ABACAllow ABACEffect = "allow"
	ABACDeny  ABACEffect = "deny"
)

// ABACPolicy represents an attribute-based access control policy.
type ABACPolicy struct {
	ID                    string                 `json:"id"`
	Name                  string                 `json:"name"`
	Effect                ABACEffect             `json:"effect"`
	ResourceType          string                 `json:"resource_type"`
	ActionType            string                 `json:"action_type"`
	SubjectConditions     map[string]interface{} `json:"subject_conditions"`
	ResourceConditions    map[string]interface{} `json:"resource_conditions"`
	EnvironmentConditions map[string]interface{} `json:"environment_conditions"`
	Priority              int                    `json:"priority"`
	Enabled               bool                   `json:"enabled"`
}

// AuthZRequest represents an authorization request.
type AuthZRequest struct {
	UserID      string                 `json:"user_id"`
	TenantID    string                 `json:"tenant_id"`
	Roles       []string               `json:"roles"`
	Resource    string                 `json:"resource"`
	Action      string                 `json:"action"`
	ResourceID  string                 `json:"resource_id"`
	Environment map[string]interface{} `json:"environment"`
	// Resource attributes for ABAC evaluation
	ResourceAttrs map[string]interface{} `json:"resource_attrs"`
	// UserStatus is the account status: "active", "disabled", "suspended".
	// If "disabled" or "suspended", authorization is denied immediately.
	UserStatus string `json:"user_status,omitempty"`
}

// AuthZDecision represents an authorization decision.
type AuthZDecision struct {
	Allowed bool   `json:"allowed"`
	Reason  string `json:"reason"`
	Source  string `json:"source"` // "rbac", "abac", "relationship"
}

// ABACEngine evaluates ABAC deny-only policies.
// ABAC is a deny-only constraint layer on top of RBAC:
// - RBAC is the base admission (role has permission → pass)
// - ABAC only denies (matching deny policy → reject)
// - No matching allow policy does NOT reject (unlike full ABAC)
// - super_admin (*:*) skips ABAC checks
type ABACEngine struct {
	policies []ABACPolicy
}

// NewABACEngine creates a new ABAC engine with the given policies.
func NewABACEngine(policies []ABACPolicy) *ABACEngine {
	return &ABACEngine{policies: policies}
}

// Evaluate evaluates ABAC deny-only policies against a request.
// Returns (denied bool, reason string).
// If denied is false, the request should proceed (ABAC doesn't block).
func (e *ABACEngine) Evaluate(ctx context.Context, req AuthZRequest) (bool, string) {
	// super_admin skips ABAC checks
	for _, role := range req.Roles {
		if role == "super_admin" {
			return false, ""
		}
	}

	// Evaluate all enabled deny policies in priority order (highest first)
	// Only deny policies can block; allow policies are informational
	for _, policy := range e.policies {
		if !policy.Enabled || policy.Effect != ABACDeny {
			continue
		}
		if policy.ResourceType != "*" && policy.ResourceType != req.Resource {
			continue
		}
		if policy.ActionType != "*" && policy.ActionType != req.Action {
			continue
		}

		if e.matchConditions(policy, req) {
			return true, "ABAC deny policy: " + policy.Name
		}
	}

	return false, ""
}

// matchConditions checks if all conditions of a policy match the request.
func (e *ABACEngine) matchConditions(policy ABACPolicy, req AuthZRequest) bool {
	// Check subject conditions (user attributes)
	if !matchMap(policy.SubjectConditions, map[string]interface{}{
		"user_id":  req.UserID,
		"tenant_id": req.TenantID,
		"roles":    req.Roles,
	}) {
		return false
	}

	// Check resource conditions
	if !matchMap(policy.ResourceConditions, req.ResourceAttrs) {
		return false
	}

	// Check environment conditions
	if !matchMap(policy.EnvironmentConditions, req.Environment) {
		return false
	}

	return true
}

// matchMap checks if all required conditions match actual values.
func matchMap(conditions, actual map[string]interface{}) bool {
	if len(conditions) == 0 {
		return true
	}
	for key, expected := range conditions {
		actualVal, ok := actual[key]
		if !ok {
			return false
		}
		if !matchValue(expected, actualVal) {
			return false
		}
	}
	return true
}

// matchValue checks if actual matches expected.
func matchValue(expected, actual interface{}) bool {
	// Simple equality check
	if expected == actual {
		return true
	}
	// String comparison
	if eStr, ok := expected.(string); ok {
		if aStr, ok := actual.(string); ok {
			return eStr == aStr
		}
	}
	return false
}

// DefaultABACPolicies returns the 6 preset ABAC deny policies from the spec.
func DefaultABACPolicies() []ABACPolicy {
	return []ABACPolicy{
		{
			ID:           "tenant-isolation",
			Name:         "Tenant isolation",
			Effect:       ABACDeny,
			ResourceType: "*",
			ActionType:   "*",
			ResourceConditions: map[string]interface{}{
				"tenant_mismatch": true,
			},
			Priority: 99,
			Enabled:  true,
		},
		{
			ID:           "external-network-restriction",
			Name:         "External network write restriction",
			Effect:       ABACDeny,
			ResourceType: "*",
			ActionType:   "*",
			EnvironmentConditions: map[string]interface{}{
				"network": "external",
			},
			ResourceConditions: map[string]interface{}{
				"action_impact": "write",
			},
			Priority: 80,
			Enabled:  true,
		},
		{
			ID:           "working-hours-restriction",
			Name:         "Working hours restriction for critical ops",
			Effect:       ABACDeny,
			ResourceType: "*",
			ActionType:   "*",
			ResourceConditions: map[string]interface{}{
				"action_impact": "critical",
			},
			EnvironmentConditions: map[string]interface{}{
				"working_hours": false,
			},
			Priority: 70,
			Enabled:  true,
		},
		{
			ID:           "max-session-duration",
			Name:         "Max session duration for write operations",
			Effect:       ABACDeny,
			ResourceType: "*",
			ActionType:   "*",
			ResourceConditions: map[string]interface{}{
				"action_impact": "write",
			},
			EnvironmentConditions: map[string]interface{}{
				"session_expired": true,
			},
			Priority: 60,
			Enabled:  true,
		},
		{
			ID:           "ip-range-restriction",
			Name:         "IP range restriction for admin operations",
			Effect:       ABACDeny,
			ResourceType: "*",
			ActionType:   "manage",
			EnvironmentConditions: map[string]interface{}{
				"ip_allowed": false,
			},
			Priority: 50,
			Enabled:  true,
		},
		{
			ID:           "approval-required",
			Name:         "Approval required for destructive operations",
			Effect:       ABACDeny,
			ResourceType: "*",
			ActionType:   "delete",
			ResourceConditions: map[string]interface{}{
				"has_approval": false,
			},
			Priority: 40,
			Enabled:  true,
		},
	}
}

// IsWorkingHours checks if the current time is within working hours (9-18).
func IsWorkingHours(t time.Time) bool {
	hour := t.Hour()
	return hour >= 9 && hour < 18
}
