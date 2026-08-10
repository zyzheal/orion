package repository

import (
	"context"
	"encoding/json"
	"sync"

	alertruleengine "orion/platform-svc-go/internal/alert-rule-engine"
)

// Repository provides persistent storage for alert rules.
// In production this would use PostgreSQL via sqlx; here we use an in-memory
// store keyed by tenantID so tests and non-DB deployments still work.
type Repository struct {
	mu     sync.RWMutex
	rules  map[string][]*alertruleengine.Rule
}

func NewRepository() *Repository {
	return &Repository{rules: make(map[string][]*alertruleengine.Rule)}
}

func (r *Repository) Save(ctx context.Context, tenantID string, rule *alertruleengine.Rule) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	rules := r.rules[tenantID]
	for i, existing := range rules {
		if existing.ID == rule.ID {
			rules[i] = rule
			return nil
		}
	}
	rules = append(rules, rule)
	r.rules[tenantID] = rules
	return nil
}

func (r *Repository) Get(ctx context.Context, tenantID, ruleID string) (*alertruleengine.Rule, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	for _, rule := range r.rules[tenantID] {
		if rule.ID == ruleID {
			return rule, nil
		}
	}
	return nil, nil
}

func (r *Repository) ListByTenant(ctx context.Context, tenantID string) []*alertruleengine.Rule {
	r.mu.RLock()
	defer r.mu.RUnlock()
	rules := r.rules[tenantID]
	result := make([]*alertruleengine.Rule, len(rules))
	copy(result, rules)
	return result
}

func (r *Repository) Delete(ctx context.Context, tenantID, ruleID string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	rules := r.rules[tenantID]
	for i, rule := range rules {
		if rule.ID == ruleID {
			r.rules[tenantID] = append(rules[:i], rules[i+1:]...)
			return nil
		}
	}
	return nil
}

func (r *Repository) ListByGroup(ctx context.Context, tenantID, group string) []*alertruleengine.Rule {
	r.mu.RLock()
	defer r.mu.RUnlock()
	var result []*alertruleengine.Rule
	for _, rule := range r.rules[tenantID] {
		if rule.Group == group {
			result = append(result, rule)
		}
	}
	return result
}

func (r *Repository) MarshalJSON() ([]byte, error) {
	return json.Marshal(r.rules)
}
