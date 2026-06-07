package auth

import (
	"context"
	"testing"
	"time"
)

func TestABACEngine_DenyOnly(t *testing.T) {
	engine := NewABACEngine(DefaultABACPolicies())

	tests := []struct {
		name     string
		req      AuthZRequest
		wantDeny bool
	}{
		{
			name: "super_admin skips ABAC",
			req: AuthZRequest{
				UserID:   "admin1",
				TenantID: "t1",
				Roles:    []string{"super_admin"},
				Resource: "pipeline",
				Action:   "delete",
				ResourceAttrs: map[string]interface{}{
					"tenant_mismatch": true,
				},
			},
			wantDeny: false,
		},
		{
			name: "tenant mismatch denies",
			req: AuthZRequest{
				UserID:   "user1",
				TenantID: "t1",
				Roles:    []string{"developer"},
				Resource: "pipeline",
				Action:   "read",
				ResourceAttrs: map[string]interface{}{
					"tenant_mismatch": true,
				},
			},
			wantDeny: true,
		},
		{
			name: "no matching deny policy allows",
			req: AuthZRequest{
				UserID:   "user1",
				TenantID: "t1",
				Roles:    []string{"developer"},
				Resource: "pipeline",
				Action:   "read",
				ResourceAttrs: map[string]interface{}{},
			},
			wantDeny: false,
		},
		{
			name: "external network write denies",
			req: AuthZRequest{
				UserID:   "user1",
				TenantID: "t1",
				Roles:    []string{"developer"},
				Resource: "pipeline",
				Action:   "write",
				ResourceAttrs: map[string]interface{}{
					"action_impact": "write",
				},
				Environment: map[string]interface{}{
					"network": "external",
				},
			},
			wantDeny: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			denied, _ := engine.Evaluate(context.Background(), tt.req)
			if denied != tt.wantDeny {
				t.Errorf("Evaluate() denied = %v, want %v", denied, tt.wantDeny)
			}
		})
	}
}

func TestABACEngine_DisabledPolicyIgnored(t *testing.T) {
	policies := []ABACPolicy{
		{
			ID:           "disabled-policy",
			Name:         "Disabled policy",
			Effect:       ABACDeny,
			ResourceType: "*",
			ActionType:   "*",
			ResourceConditions: map[string]interface{}{
				"tenant_mismatch": true,
			},
			Priority: 100,
			Enabled:  false, // disabled
		},
	}
	engine := NewABACEngine(policies)

	req := AuthZRequest{
		UserID:   "user1",
		TenantID: "t1",
		Roles:    []string{"developer"},
		Resource: "pipeline",
		Action:   "read",
		ResourceAttrs: map[string]interface{}{
			"tenant_mismatch": true,
		},
	}

	denied, _ := engine.Evaluate(context.Background(), req)
	if denied {
		t.Error("disabled policy should not deny")
	}
}

func TestABACEngine_AllowEffectNotBlocking(t *testing.T) {
	policies := []ABACPolicy{
		{
			ID:           "allow-policy",
			Name:         "Allow policy",
			Effect:       ABACAllow,
			ResourceType: "*",
			ActionType:   "*",
			ResourceConditions: map[string]interface{}{
				"special": true,
			},
			Priority: 100,
			Enabled:  true,
		},
	}
	engine := NewABACEngine(policies)

	req := AuthZRequest{
		UserID:   "user1",
		TenantID: "t1",
		Roles:    []string{"developer"},
		Resource: "pipeline",
		Action:   "read",
		ResourceAttrs: map[string]interface{}{
			"special": true,
		},
	}

	denied, _ := engine.Evaluate(context.Background(), req)
	if denied {
		t.Error("allow policy should not deny (ABAC is deny-only)")
	}
}

func TestIsWorkingHours(t *testing.T) {
	tests := []struct {
		hour int
		want bool
	}{
		{8, false},
		{9, true},
		{12, true},
		{17, true},
		{18, false},
		{23, false},
	}
	for _, tt := range tests {
		// Create a time at the given hour
		tm := time.Date(2026, 1, 1, tt.hour, 0, 0, 0, time.UTC)
		got := IsWorkingHours(tm)
		if got != tt.want {
			t.Errorf("IsWorkingHours(hour=%d) = %v, want %v", tt.hour, got, tt.want)
		}
	}
}
