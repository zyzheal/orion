package abac

import (
	"testing"
	"time"
)

func TestNewEngine(t *testing.T) {
	e := NewEngine()
	if e == nil {
		t.Fatal("expected non-nil engine")
	}
	if len(e.GetAllPolicies()) != len(SystemPolicies) {
		t.Errorf("expected %d system policies, got %d", len(SystemPolicies), len(e.GetAllPolicies()))
	}
}

func TestRegisterAndUnregisterPolicy(t *testing.T) {
	e := NewEngine()
	p := &Policy{ID: "p1", Name: "Test", Effect: "allow", Enabled: true,
		ResourceType: "document", ActionType: "read",
		Conditions: Rule{Condition: &Condition{Attribute: "user.Role", Operator: OpEquals, Value: "admin"}},
	}
	e.RegisterPolicy(p)
	if e.GetPolicy("p1") == nil {
		t.Error("expected to find registered policy")
	}
	if len(e.GetAllPolicies()) != len(SystemPolicies)+1 {
		t.Errorf("expected %d policies, got %d", len(SystemPolicies)+1, len(e.GetAllPolicies()))
	}
	e.UnregisterPolicy("p1")
	if e.GetPolicy("p1") != nil {
		t.Error("expected nil after unregister")
	}
	if len(e.GetAllPolicies()) != len(SystemPolicies) {
		t.Errorf("expected %d policies after unregister, got %d", len(SystemPolicies), len(e.GetAllPolicies()))
	}
}

func TestEvaluateAdminPolicy(t *testing.T) {
	e := NewEngine()
	e.RegisterPolicy(&Policy{ID: "admin-policy", Name: "Admin Access", Effect: "allow", Enabled: true,
		ResourceType: "document", ActionType: "read",
		Conditions: Rule{Condition: &Condition{Attribute: "user.Role", Operator: OpEquals, Value: "admin"}}})
	ctx := Context{User: UserAttrs{ID: "u1", Role: "admin", Department: "engineering"},
		Resource: ResourceAttrs{Type: "document", ID: "doc-1", Owner: "u1"}, Action: ActionAttrs{Type: "read"}}
	result := e.Evaluate(ctx)
	if !result.Allowed {
		t.Error("admin should be allowed")
	}
	if len(result.MatchedPolicies) != 1 {
		t.Errorf("expected 1 matched policy, got %d", len(result.MatchedPolicies))
	}
}

func TestEvaluateDenyPolicy(t *testing.T) {
	e := NewEngine()
	e.RegisterPolicy(&Policy{ID: "deny-policy", Name: "Deny Guest", Effect: "deny", Enabled: true,
		ResourceType: "document", ActionType: "read",
		Conditions: Rule{Condition: &Condition{Attribute: "user.Role", Operator: OpEquals, Value: "guest"}}})
	ctx := Context{User: UserAttrs{Role: "guest"}, Resource: ResourceAttrs{Type: "document"}, Action: ActionAttrs{Type: "read"}}
	result := e.Evaluate(ctx)
	if result.Allowed {
		t.Error("guest should not be allowed")
	}
	if !result.Denied {
		t.Error("guest should be denied")
	}
}

func TestDenyOverridesAllow(t *testing.T) {
	e := NewEngine()
	e.RegisterPolicy(&Policy{ID: "allow", Effect: "allow", Enabled: true, ResourceType: "document", ActionType: "read",
		Conditions: Rule{Condition: &Condition{Attribute: "user.Role", Operator: OpNotEquals, Value: "blocked"}}})
	e.RegisterPolicy(&Policy{ID: "deny", Effect: "deny", Enabled: true, ResourceType: "document", ActionType: "read",
		Conditions: Rule{Condition: &Condition{Attribute: "user.Role", Operator: OpEquals, Value: "guest"}}})
	ctx := Context{User: UserAttrs{Role: "guest"}, Resource: ResourceAttrs{Type: "document"}, Action: ActionAttrs{Type: "read"}}
	result := e.Evaluate(ctx)
	if result.Allowed {
		t.Error("deny should override allow")
	}
}

func TestIsAllowed(t *testing.T) {
	e := NewEngine()
	e.RegisterPolicy(&Policy{ID: "p1", Effect: "allow", Enabled: true, ResourceType: "document", ActionType: "read",
		Conditions: Rule{Condition: &Condition{Attribute: "user.Role", Operator: OpEquals, Value: "admin"}}})
	ctx := Context{User: UserAttrs{Role: "admin"}, Resource: ResourceAttrs{Type: "document"}, Action: ActionAttrs{Type: "read"}}
	if !e.IsAllowed(ctx) {
		t.Error("admin should be allowed")
	}
}

func TestIsDenied(t *testing.T) {
	e := NewEngine()
	e.RegisterPolicy(&Policy{ID: "p1", Effect: "deny", Enabled: true, ResourceType: "document", ActionType: "delete",
		Conditions: Rule{Condition: &Condition{Attribute: "user.Role", Operator: OpNotEquals, Value: "admin"}}})
	ctx := Context{User: UserAttrs{Role: "developer"}, Resource: ResourceAttrs{Type: "document"}, Action: ActionAttrs{Type: "delete"}}
	if !e.IsDenied(ctx) {
		t.Error("developer should be denied from delete")
	}
}

func TestGetAvailableActions(t *testing.T) {
	e := NewEngine()
	e.RegisterPolicy(&Policy{ID: "p1", Effect: "allow", Enabled: true, ResourceType: "document", ActionType: "read",
		Conditions: Rule{Condition: &Condition{Attribute: "user.Role", Operator: OpEquals, Value: "admin"}}})
	e.RegisterPolicy(&Policy{ID: "p2", Effect: "allow", Enabled: true, ResourceType: "document", ActionType: "write",
		Conditions: Rule{Condition: &Condition{Attribute: "user.Role", Operator: OpEquals, Value: "admin"}}})
	ctx := Context{User: UserAttrs{Role: "admin"}, Resource: ResourceAttrs{Type: "document"}, Action: ActionAttrs{Type: "read"}}
	actions := e.GetAvailableActions(ctx, []string{"read", "write", "delete"})
	if len(actions) != 2 {
		t.Errorf("expected 2 available actions, got %d: %v", len(actions), actions)
	}
}

func TestDisabledPolicyIgnored(t *testing.T) {
	e := NewEngine()
	e.RegisterPolicy(&Policy{ID: "p1", Effect: "allow", Enabled: false, ResourceType: "document", ActionType: "read",
		Conditions: Rule{Condition: &Condition{Attribute: "user.Role", Operator: OpEquals, Value: "admin"}}})
	ctx := Context{User: UserAttrs{Role: "admin"}, Resource: ResourceAttrs{Type: "document"}, Action: ActionAttrs{Type: "read"}}
	if e.IsAllowed(ctx) {
		t.Error("disabled policy should not grant access")
	}
}

func TestOpEquals(t *testing.T) {
	e := NewEngine()
	e.RegisterPolicy(&Policy{ID: "p1", Effect: "allow", Enabled: true, ResourceType: "document", ActionType: "read",
		Conditions: Rule{Condition: &Condition{Attribute: "user.Role", Operator: OpEquals, Value: "admin"}}})
	ctx := Context{User: UserAttrs{Role: "admin"}, Resource: ResourceAttrs{Type: "document"}, Action: ActionAttrs{Type: "read"}}
	if !e.IsAllowed(ctx) {
		t.Error("OpEquals should match admin role")
	}
}

func TestOpNotEquals(t *testing.T) {
	e := NewEngine()
	e.RegisterPolicy(&Policy{ID: "p1", Effect: "allow", Enabled: true, ResourceType: "document", ActionType: "read",
		Conditions: Rule{Condition: &Condition{Attribute: "user.Role", Operator: OpNotEquals, Value: "guest"}}})
	ctx := Context{User: UserAttrs{Role: "admin"}, Resource: ResourceAttrs{Type: "document"}, Action: ActionAttrs{Type: "read"}}
	if !e.IsAllowed(ctx) {
		t.Error("OpNotEquals should match non-guest role")
	}
}

func TestOpContains(t *testing.T) {
	e := NewEngine()
	e.RegisterPolicy(&Policy{ID: "p1", Effect: "allow", Enabled: true, ResourceType: "document", ActionType: "read",
		Conditions: Rule{Condition: &Condition{Attribute: "user.Department", Operator: OpContains, Value: "eng"}}})
	ctx := Context{User: UserAttrs{Department: "engineering"}, Resource: ResourceAttrs{Type: "document"}, Action: ActionAttrs{Type: "read"}}
	if !e.IsAllowed(ctx) {
		t.Error("OpContains should match eng in engineering")
	}
}

func TestOpIn(t *testing.T) {
	e := NewEngine()
	e.RegisterPolicy(&Policy{ID: "p1", Effect: "allow", Enabled: true, ResourceType: "document", ActionType: "read",
		Conditions: Rule{Condition: &Condition{Attribute: "user.Role", Operator: OpIn, Value: []string{"admin", "developer"}}}})
	ctx := Context{User: UserAttrs{Role: "developer"}, Resource: ResourceAttrs{Type: "document"}, Action: ActionAttrs{Type: "read"}}
	if !e.IsAllowed(ctx) {
		t.Error("OpIn should match developer")
	}
}

func TestOpNotIn(t *testing.T) {
	e := NewEngine()
	e.RegisterPolicy(&Policy{ID: "p1", Effect: "allow", Enabled: true, ResourceType: "document", ActionType: "read",
		Conditions: Rule{Condition: &Condition{Attribute: "user.Role", Operator: OpNotIn, Value: []string{"guest"}}}})
	ctx := Context{User: UserAttrs{Role: "developer"}, Resource: ResourceAttrs{Type: "document"}, Action: ActionAttrs{Type: "read"}}
	if !e.IsAllowed(ctx) {
		t.Error("OpNotIn should match developer not in guest")
	}
}

func TestOpGreaterThan(t *testing.T) {
	e := NewEngine()
	e.RegisterPolicy(&Policy{ID: "p1", Effect: "allow", Enabled: true, ResourceType: "document", ActionType: "read",
		Conditions: Rule{Condition: &Condition{Attribute: "user.Level", Operator: OpGreaterThan, Value: 3}}})
	ctx := Context{User: UserAttrs{Level: "5"}, Resource: ResourceAttrs{Type: "document"}, Action: ActionAttrs{Type: "read"}}
	if !e.IsAllowed(ctx) {
		t.Error("OpGreaterThan should match 5 > 3")
	}
}

func TestOpLessThan(t *testing.T) {
	e := NewEngine()
	e.RegisterPolicy(&Policy{ID: "p1", Effect: "allow", Enabled: true, ResourceType: "document", ActionType: "read",
		Conditions: Rule{Condition: &Condition{Attribute: "user.Level", Operator: OpLessThan, Value: 3}}})
	ctx := Context{User: UserAttrs{Level: "1"}, Resource: ResourceAttrs{Type: "document"}, Action: ActionAttrs{Type: "read"}}
	if !e.IsAllowed(ctx) {
		t.Error("OpLessThan should match 1 < 3")
	}
}

func TestOpStartsWith(t *testing.T) {
	e := NewEngine()
	e.RegisterPolicy(&Policy{ID: "p1", Effect: "allow", Enabled: true, ResourceType: "document", ActionType: "read",
		Conditions: Rule{Condition: &Condition{Attribute: "resource.Type", Operator: OpStartsWith, Value: "do"}}})
	ctx := Context{User: UserAttrs{Role: "admin"}, Resource: ResourceAttrs{Type: "document"}, Action: ActionAttrs{Type: "read"}}
	if !e.IsAllowed(ctx) {
		t.Error("OpStartsWith should match")
	}
}

func TestOpEndsWith(t *testing.T) {
	e := NewEngine()
	e.RegisterPolicy(&Policy{ID: "p1", Effect: "allow", Enabled: true, ResourceType: "document", ActionType: "read",
		Conditions: Rule{Condition: &Condition{Attribute: "resource.Type", Operator: OpEndsWith, Value: "ent"}}})
	ctx := Context{User: UserAttrs{Role: "admin"}, Resource: ResourceAttrs{Type: "document"}, Action: ActionAttrs{Type: "read"}}
	if !e.IsAllowed(ctx) {
		t.Error("OpEndsWith should match")
	}
}

func TestOpExists(t *testing.T) {
	e := NewEngine()
	e.RegisterPolicy(&Policy{ID: "p1", Effect: "allow", Enabled: true, ResourceType: "document", ActionType: "read",
		Conditions: Rule{Condition: &Condition{Attribute: "user.Department", Operator: OpExists, Value: nil}}})
	ctx := Context{User: UserAttrs{Department: "engineering"}, Resource: ResourceAttrs{Type: "document"}, Action: ActionAttrs{Type: "read"}}
	if !e.IsAllowed(ctx) {
		t.Error("OpExists should match when attribute exists")
	}
}

func TestOpNotExists(t *testing.T) {
	e := NewEngine()
	e.RegisterPolicy(&Policy{ID: "p1", Effect: "allow", Enabled: true, ResourceType: "document", ActionType: "read",
		Conditions: Rule{Condition: &Condition{Attribute: "user.Department", Operator: OpNotExists, Value: nil}}})
	ctx := Context{User: UserAttrs{Department: ""}, Resource: ResourceAttrs{Type: "document"}, Action: ActionAttrs{Type: "read"}}
	if !e.IsAllowed(ctx) {
		t.Error("OpNotExists should match when empty")
	}
}

func TestOpBetween(t *testing.T) {
	e := NewEngine()
	e.RegisterPolicy(&Policy{ID: "p1", Effect: "allow", Enabled: true, ResourceType: "document", ActionType: "read",
		Conditions: Rule{Condition: &Condition{Attribute: "user.Level", Operator: OpBetween, Value: 1, Value2: 5}}})
	ctx := Context{User: UserAttrs{Level: "3"}, Resource: ResourceAttrs{Type: "document"}, Action: ActionAttrs{Type: "read"}}
	if !e.IsAllowed(ctx) {
		t.Error("OpBetween should match 3 between 1 and 5")
	}
}

func TestOpTimeInRange(t *testing.T) {
	e := NewEngine()
	e.RegisterPolicy(&Policy{ID: "p1", Effect: "allow", Enabled: true, ResourceType: "document", ActionType: "read",
		Conditions: Rule{Condition: &Condition{Attribute: "environment.Time", Operator: OpTimeInRange,
			Value: map[string]interface{}{"startHour": 9, "endHour": 18}}}})
	// During working hours (10:00 UTC)
	ctx := Context{User: UserAttrs{Role: "admin"}, Resource: ResourceAttrs{Type: "document"},
		Environment: EnvAttrs{Time: time.Date(2024, 1, 1, 10, 0, 0, 0, time.UTC)}, Action: ActionAttrs{Type: "read"}}
	if !e.IsAllowed(ctx) {
		t.Error("should be allowed during working hours (10:00 UTC)")
	}
	// Outside working hours (22:00 UTC)
	ctx2 := Context{User: UserAttrs{Role: "admin"}, Resource: ResourceAttrs{Type: "document"},
		Environment: EnvAttrs{Time: time.Date(2024, 1, 1, 22, 0, 0, 0, time.UTC)}, Action: ActionAttrs{Type: "read"}}
	if e.IsAllowed(ctx2) {
		t.Error("should not be allowed outside working hours (22:00 UTC)")
	}
}

func TestOpMatches(t *testing.T) {
	e := NewEngine()
	e.RegisterPolicy(&Policy{ID: "p1", Effect: "allow", Enabled: true, ResourceType: "document", ActionType: "read",
		Conditions: Rule{Condition: &Condition{Attribute: "user.ID", Operator: OpMatches, Value: "u[0-9]+"}}})
	ctx := Context{User: UserAttrs{ID: "u123"}, Resource: ResourceAttrs{Type: "document"}, Action: ActionAttrs{Type: "read"}}
	if !e.IsAllowed(ctx) {
		t.Error("OpMatches should match u123 against u[0-9]+")
	}
}

func TestANDLogic(t *testing.T) {
	e := NewEngine()
	e.RegisterPolicy(&Policy{ID: "p1", Effect: "allow", Enabled: true, ResourceType: "document", ActionType: "read",
		Conditions: Rule{And: []Rule{
			{Condition: &Condition{Attribute: "user.Role", Operator: OpEquals, Value: "admin"}},
			{Condition: &Condition{Attribute: "user.Department", Operator: OpEquals, Value: "engineering"}}}}})
	ctx := Context{User: UserAttrs{Role: "admin", Department: "engineering"}, Resource: ResourceAttrs{Type: "document"}, Action: ActionAttrs{Type: "read"}}
	if !e.IsAllowed(ctx) {
		t.Error("AND should match when both true")
	}
	ctx2 := Context{User: UserAttrs{Role: "admin", Department: "sales"}, Resource: ResourceAttrs{Type: "document"}, Action: ActionAttrs{Type: "read"}}
	if e.IsAllowed(ctx2) {
		t.Error("AND should fail when one false")
	}
}

func TestORLogic(t *testing.T) {
	e := NewEngine()
	e.RegisterPolicy(&Policy{ID: "p1", Effect: "allow", Enabled: true, ResourceType: "document", ActionType: "read",
		Conditions: Rule{Or: []Rule{
			{Condition: &Condition{Attribute: "user.Role", Operator: OpEquals, Value: "admin"}},
			{Condition: &Condition{Attribute: "user.Role", Operator: OpEquals, Value: "developer"}}}}})
	ctx := Context{User: UserAttrs{Role: "developer"}, Resource: ResourceAttrs{Type: "document"}, Action: ActionAttrs{Type: "read"}}
	if !e.IsAllowed(ctx) {
		t.Error("OR should match when either true")
	}
}

func TestNotLogic(t *testing.T) {
	e := NewEngine()
	e.RegisterPolicy(&Policy{ID: "p1", Effect: "allow", Enabled: true, ResourceType: "document", ActionType: "read",
		Conditions: Rule{Not: &Rule{Condition: &Condition{Attribute: "user.Role", Operator: OpEquals, Value: "guest"}}}})
	ctx := Context{User: UserAttrs{Role: "admin"}, Resource: ResourceAttrs{Type: "document"}, Action: ActionAttrs{Type: "read"}}
	if !e.IsAllowed(ctx) {
		t.Error("NOT should match when inner false")
	}
	ctx2 := Context{User: UserAttrs{Role: "guest"}, Resource: ResourceAttrs{Type: "document"}, Action: ActionAttrs{Type: "read"}}
	if e.IsAllowed(ctx2) {
		t.Error("NOT should fail when inner true")
	}
}

func TestMultiplePoliciesPriority(t *testing.T) {
	e := NewEngine()
	e.RegisterPolicy(&Policy{ID: "low", Effect: "allow", Enabled: true, Priority: 1, ResourceType: "document", ActionType: "read",
		Conditions: Rule{Condition: &Condition{Attribute: "user.Role", Operator: OpNotEquals, Value: "blocked"}}})
	e.RegisterPolicy(&Policy{ID: "high", Effect: "deny", Enabled: true, Priority: 100, ResourceType: "document", ActionType: "read",
		Conditions: Rule{Condition: &Condition{Attribute: "user.Role", Operator: OpEquals, Value: "developer"}}})
	ctx := Context{User: UserAttrs{Role: "developer"}, Resource: ResourceAttrs{Type: "document"}, Action: ActionAttrs{Type: "read"}}
	result := e.Evaluate(ctx)
	if result.Allowed {
		t.Error("high priority deny should override low priority allow")
	}
}

func TestEvaluationTimeMeasured(t *testing.T) {
	e := NewEngine()
	e.RegisterPolicy(&Policy{ID: "p1", Effect: "allow", Enabled: true, ResourceType: "document", ActionType: "read",
		Conditions: Rule{Condition: &Condition{Attribute: "user.Role", Operator: OpEquals, Value: "admin"}}})
	ctx := Context{User: UserAttrs{Role: "admin"}, Resource: ResourceAttrs{Type: "document"}, Action: ActionAttrs{Type: "read"}}
	result := e.Evaluate(ctx)
	if result.EvaluationTime < 0 {
		t.Errorf("expected non-negative eval time, got %v", result.EvaluationTime)
	}
}

func TestNilConditionHandling(t *testing.T) {
	e := NewEngine()
	e.RegisterPolicy(&Policy{ID: "p1", Effect: "allow", Enabled: true, ResourceType: "document", ActionType: "read", Conditions: Rule{}})
	ctx := Context{User: UserAttrs{Role: "admin"}, Resource: ResourceAttrs{Type: "document"}, Action: ActionAttrs{Type: "read"}}
	result := e.Evaluate(ctx)
	if !result.Allowed {
		t.Error("empty rule should be treated as allow")
	}
}

func TestConcurrentEngineAccess(t *testing.T) {
	e := NewEngine()
	e.RegisterPolicy(&Policy{ID: "p1", Effect: "allow", Enabled: true, ResourceType: "document", ActionType: "read",
		Conditions: Rule{Condition: &Condition{Attribute: "user.Role", Operator: OpEquals, Value: "admin"}}})
	done := make(chan bool, 2)
	for g := 0; g < 2; g++ {
		go func() {
			for i := 0; i < 100; i++ {
				ctx := Context{User: UserAttrs{Role: "admin"}, Resource: ResourceAttrs{Type: "document"}, Action: ActionAttrs{Type: "read"}}
				_ = e.Evaluate(ctx)
			}
			done <- true
		}()
	}
	<-done
	<-done
}
