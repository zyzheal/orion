// Package engine implements the assignee dispatch engine.
//
// The engine coordinates:
// 1. Rule evaluation (conditions → eligible rules)
// 2. Dispatch selection (pick target within a rule)
// 3. Escalation (trigger when no match within time limit)
//
// Public API:
//   engine.NewEngine() → *Engine
//   engine.Dispatch(ctx, item, candidates) → *DispatchResult
//   engine.EvaluateRules(ctx, item, rules) → []*EvaluatedRule
package engine

import (
	"context"
	"fmt"
	"regexp"
	"sort"
	"strings"
	"sync"
	"time"

	"orion/platform-svc-go/internal/assignee/dispatcher"
	"orion/platform-svc-go/internal/assignee/types"
)

// --- Engine ---

// Engine is the assignment engine that matches work items to assignees based on rules.
type Engine struct {
	mu          sync.RWMutex
	dispatchers dispatcher.Registry
	rules       []*types.AssigneeRule
	escPolicies []*types.EscalationPolicy
	cooldownMap map[string]time.Time // targetID → last dispatch time
	capacityMap map[string]int       // ruleID → active assignments
}

// NewEngine creates a new dispatch engine.
func NewEngine() *Engine {
	return &Engine{
		dispatchers: dispatcher.GetInstance(),
		rules:       make([]*types.AssigneeRule, 0),
		escPolicies: make([]*types.EscalationPolicy, 0),
		cooldownMap: make(map[string]time.Time),
		capacityMap: make(map[string]int),
	}
}

// SetRules loads a set of assignment rules into the engine.
func (e *Engine) SetRules(rules []*types.AssigneeRule) {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.rules = rules
}

// SetEscalationPolicies loads escalation policies into the engine.
func (e *Engine) SetEscalationPolicies(policies []*types.EscalationPolicy) {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.escPolicies = policies
}

// --- Core dispatch ---

// DispatchItem routes a work item to the best assignee using the configured rules.
func (e *Engine) DispatchItem(ctx context.Context, item *types.WorkItem, candidates []*types.AssignmentTarget) (*types.DispatchResult, error) {
	e.mu.Lock()
	defer e.mu.Unlock()

	// 1. Evaluate all rules to find applicable ones
	evaluated := e.evaluateRules(item, e.rules)
	if len(evaluated) == 0 {
		return nil, fmt.Errorf("%w", types.ErrNoMatchingRule)
	}

	// 2. For each evaluated rule, pick the best candidate
	for _, ev := range evaluated {
		if !ev.Matched {
			continue
		}
		rule := ev.Rule

			// Check rule capacity
		active := e.capacityMap[rule.StringID()]
		if rule.Capacity > 0 && active >= rule.Capacity {
			continue
		}

		// 3. Build candidate list from rule targets
		targetCandidates := e.selectRuleCandidates(rule, candidates)
		if len(targetCandidates) == 0 {
			continue
		}

		// 4. Dispatch using the rule's strategy
		result := e.dispatchRule(ctx, item, rule, targetCandidates)
		if result != nil {
			e.capacityMap[rule.StringID()]++
			e.cooldownMap[result.Target.ID] = time.Now()
			return result, nil
		}
	}

	return nil, fmt.Errorf("%w: all rules exhausted for item %s", types.ErrNoAvailableAssignee, item.ID)
}

// evaluateRules returns all rules whose conditions match the work item, sorted by priority desc.
func (e *Engine) evaluateRules(item *types.WorkItem, rules []*types.AssigneeRule) []*EvaluatedRule {
	var out []*EvaluatedRule
	now := time.Now()
	for _, rule := range rules {
		if !rule.Enabled {
			continue
		}
		// Check rule-level cooldown
		inCooldown := false
		if rule.CooldownSec > 0 {
			for _, tid := range rule.TargetIDs {
				last := e.cooldownMap[tid]
				if !last.IsZero() && now.Sub(last) < time.Duration(rule.CooldownSec)*time.Second {
					inCooldown = true
					break
				}
			}
		}
		var match bool
		if !inCooldown {
			match = e.matchConditions(item, rule.Conditions)
		}
		out = append(out, &EvaluatedRule{
			Rule:     rule,
			Matched:  match,
			Score:    e.ruleScore(rule),
			Item:     item,
			MatchedAt: now,
		})
	}
	sort.Slice(out, func(i, j int) bool {
		// Higher priority first, then higher score
		if out[i].Rule.Priority != out[j].Rule.Priority {
			return out[i].Rule.Priority > out[j].Rule.Priority
		}
		return out[i].Score > out[j].Score
	})
	return out
}

type EvaluatedRule struct {
	Rule      *types.AssigneeRule
	Matched   bool
	Score     float64
	Item      *types.WorkItem
	MatchedAt time.Time
}

// matchConditions checks whether all conditions match the work item.
func (e *Engine) matchConditions(item *types.WorkItem, conditions []types.Condition) bool {
	for _, cond := range conditions {
		if !e.evaluateCondition(item, cond) {
			return false
		}
	}
	return true
}

func (e *Engine) evaluateCondition(item *types.WorkItem, cond types.Condition) bool {
	var value string
	switch cond.Field {
	case types.ConditionFieldCategory:
		value = item.Category
	case types.ConditionFieldPriority:
		value = item.Priority
	case types.ConditionFieldType:
		value = item.Type
	case types.ConditionFieldSource:
		value = item.Source
	case types.ConditionFieldTargetStatus:
		value = item.Status
	case types.ConditionFieldAssignee:
		// If rule specifies an assignee field, it means "match if current assignee matches"
		// For new items, this is effectively empty; treat as match when value is empty
		value = ""
	case types.ConditionFieldCreatedAfter:
		// Time-based: parse the value as a time and compare
		t, err := time.Parse(time.RFC3339, cond.Value)
		if err != nil {
			return true // malformed timestamp => skip (don't block)
		}
		switch cond.Operator {
		case types.ConditionOperatorGt, types.ConditionOperatorNeq:
			return item.CreatedAt.After(t)
		case types.ConditionOperatorLt:
			return item.CreatedAt.Before(t)
		default:
			return true
		}
	default:
		return true
	}

	return e.applyOperator(value, cond.Operator, cond.Value, cond.ValueList)
}

func (e *Engine) applyOperator(value string, op types.ConditionOperator, val string, valList []string) bool {
	v := strings.ToLower(strings.TrimSpace(value))
	switch op {
	case types.ConditionOperatorEq:
		return strings.EqualFold(v, strings.ToLower(val))
	case types.ConditionOperatorNeq:
		return !strings.EqualFold(v, strings.ToLower(val))
	case types.ConditionOperatorIn:
		lowerList := make([]string, len(valList))
		for i, x := range valList {
			lowerList[i] = strings.ToLower(x)
		}
		for _, lv := range lowerList {
			if strings.EqualFold(v, lv) {
				return true
			}
		}
		return false
	case types.ConditionOperatorNotIn:
		return !e.containsLower(valList, v)
	case types.ConditionOperatorGt, types.ConditionOperatorLt:
		return true // numeric operators handled by caller for time fields
	case types.ConditionOperatorContains:
		return strings.Contains(strings.ToLower(v), strings.ToLower(val))
	case types.ConditionOperatorRegex:
		re, err := regexp.Compile(val)
		if err != nil {
			return false
		}
		return re.MatchString(v)
	default:
		return true
	}
}

func (e *Engine) containsLower(list []string, target string) bool {
	for _, s := range list {
		if strings.EqualFold(s, target) {
			return true
		}
	}
	return false
}

func (e *Engine) ruleScore(rule *types.AssigneeRule) float64 {
	s := float64(rule.Priority)
	s += rule.Weight * 0.1
	if rule.Enabled {
		s += 10.0
	}
	return s
}

// selectRuleCandidates filters the global candidate pool to the targets referenced by the rule.
func (e *Engine) selectRuleCandidates(rule *types.AssigneeRule, candidates []*types.AssignmentTarget) []*types.AssignmentTarget {
	var out []*types.AssignmentTarget
	for _, c := range candidates {
		for _, tid := range rule.TargetIDs {
			if c.ID == tid {
				out = append(out, c)
				break
			}
		}
	}
	return out
}

// dispatchRule uses the rule's strategy to pick the best target from candidates.
func (e *Engine) dispatchRule(ctx context.Context, item *types.WorkItem, rule *types.AssigneeRule, candidates []*types.AssignmentTarget) *types.DispatchResult {
	// Convert to dispatcher candidates
	dCandidates := make([]*dispatcher.Candidate, len(candidates))
	for i, c := range candidates {
		dCandidates[i] = &dispatcher.Candidate{
			ID:            c.ID,
			Name:          c.Name,
			Skills:        c.Skills,
			CurrentLoad:   c.CurrentLoad,
			MaxLoad:       c.MaxLoad,
			Weight:        c.Weight,
			IsActive:      c.IsActive,
			IsAvailable:   c.IsAvailable,
			AvailableFrom: c.AvailableFrom,
			AvailableTo:   c.AvailableTo,
			Timezone:      c.Timezone,
			CooldownSec:   rule.CooldownSec,
		}
	}

	dItem := &dispatcher.WorkItem{
		ID:             item.ID,
		TenantID:       item.TenantID,
		TargetType:     item.TargetType,
		Category:       item.Category,
		Priority:       item.Priority,
		Type:           item.Type,
		Source:         item.Source,
		Status:         item.Status,
		RequiredSkills: item.RequiredSkills,
		Metadata:       item.Metadata,
		IsEscalated:    item.IsEscalated,
		PriorityWeight: item.PriorityWeight,
		CreatedAt:      item.CreatedAt,
	}

	disp := e.dispatchers.Get(rule.Strategy)
	if disp == nil {
		// Fallback to round-robin
		disp = e.dispatchers.Get(types.DispatcherTypeRoundRobin)
	}
	if disp == nil {
		return nil
	}

	result, err := disp.Match(ctx, dCandidates, dItem)
	if err != nil {
		return nil
	}

	return &types.DispatchResult{
		RuleID:   rule.ID,
		RuleName: rule.Name,
		Strategy: rule.Strategy,
		Target:   e.dispatcherCandidateToTarget(result.Candidate),
		Score:    result.Score,
		Reason:   result.Reason,
		DispatchedAt: time.Now(),
		Alternatives: e.dispatcherAlternativesToTypes(result.Alternatives, candidates),
	}
}

func (e *Engine) dispatcherCandidateToTarget(c *dispatcher.Candidate) *types.AssignmentTarget {
	return &types.AssignmentTarget{
		ID:            c.ID,
		Name:          c.Name,
		Skills:        c.Skills,
		CurrentLoad:   c.CurrentLoad,
		MaxLoad:       c.MaxLoad,
		IsActive:      c.IsActive,
		IsAvailable:   c.IsAvailable,
		Weight:        c.Weight,
		AvailableFrom: c.AvailableFrom,
		AvailableTo:   c.AvailableTo,
		Timezone:      c.Timezone,
	}
}

func (e *Engine) dispatcherAlternativesToTypes(alts []dispatcher.Alternative, allCandidates []*types.AssignmentTarget) []types.AlternativeMatch {
	out := make([]types.AlternativeMatch, len(alts))
	for i, a := range alts {
		out[i] = types.AlternativeMatch{
			Target: e.dispatcherCandidateToTarget(a.Candidate),
			Score:  a.Score,
			Reason: a.Reason,
		}
	}
	return out
}

// --- Escalation ---

// CheckEscalation evaluates whether the given unassigned item should be escalated.
// Returns the next escalation level if applicable, or nil.
func (e *Engine) CheckEscalation(ctx context.Context, item *types.WorkItem, created time.Time, currentLevel int) *types.EscalationLevel {
	elapsed := time.Since(created)
	for _, policy := range e.escPolicies {
		if !policy.Enabled {
			continue
		}
		if currentLevel >= len(policy.Levels) {
			continue
		}
		lev := policy.Levels[currentLevel]
		if elapsed >= lev.TriggerAfter {
			return &lev
		}
	}
	return nil
}

// --- Utilities ---

// AllCapabilities returns the dispatcher capabilities summary.
func (e *Engine) AllCapabilities() *types.DispatcherCapabilities {
	return &types.DispatcherCapabilities{
		Types:          types.AllDispatcherTypes(),
		Strategies:     types.AllDispatcherTypes(),
		HasEscalation:  len(e.escPolicies) > 0,
		HasCooldown:    true,
		HasCapacityLimit: true,
	}
}

// GetAvailableStrategies returns the currently registered dispatcher strategies.
func (e *Engine) GetAvailableStrategies() []string {
	out := make([]string, 0)
	for name := range e.dispatchers.All() {
		out = append(out, name)
	}
	sort.Strings(out)
	return out
}

// --- Random seed (for weighted dispatcher fairness testing) ---

func init() {
	// rand.Seed was called here previously but is no longer needed since Go 1.20
	// auto-seeds the global random source. Left as a no-op for backward compatibility.
}
