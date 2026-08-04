package alertruleengine

import (
	"sort"
	"sync"
	"time"

	"go.uber.org/zap"
)

// Engine is the central rule engine. It manages registered rules, evaluates
// them against incoming metric snapshots, and enforces cooldown periods.
type Engine struct {
	mu        sync.RWMutex
	logger    *zap.Logger
	rules     map[string]*Rule   // ID -> rule
	byGroup   map[string][]string // group -> []ruleID (sorted by priority)
	cooldown  *CooldownTracker
	severity  map[Severity]int  // severity -> rule count
}

// EngineOption configures the engine.
type EngineOption func(*Engine)

// WithLogger sets the logger for the engine.
func WithLogger(logger *zap.Logger) EngineOption {
	return func(e *Engine) {
		e.logger = logger.With(zap.String("component", "alert-rule-engine"))
	}
}

// NewEngine creates a new rule engine.
func NewEngine(opts ...EngineOption) *Engine {
	e := &Engine{
		rules:     make(map[string]*Rule),
		byGroup:   make(map[string][]string),
		cooldown:  NewCooldownTracker(),
		severity:  make(map[Severity]int),
		logger:    zap.NewNop(),
	}
	for _, opt := range opts {
		opt(e)
	}
	return e
}

// Register compiles and registers a rule. Returns an error if the expression
// is invalid or the rule ID already exists.
func (e *Engine) Register(raw *Rule) error {
	compiled, err := CompileRule(raw)
	if err != nil {
		return err
	}

	e.mu.Lock()
	defer e.mu.Unlock()

	if _, exists := e.rules[compiled.ID]; exists {
		return ErrRuleExists
	}

	e.rules[compiled.ID] = compiled

	// Rebuild group index
	e.rebuildGroups()
	e.severity[compiled.Severity]++

	e.logger.Info("rule registered",
		zap.String("ruleId", compiled.ID),
		zap.String("name", compiled.Name),
		zap.String("severity", string(compiled.Severity)),
		zap.Duration("cooldown", compiled.Cooldown),
	)
	return nil
}

// Unregister removes a rule by ID.
func (e *Engine) Unregister(id string) error {
	e.mu.Lock()
	defer e.mu.Unlock()

	rule, ok := e.rules[id]
	if !ok {
		return ErrRuleNotFound
	}

	delete(e.rules, id)
	e.severity[rule.Severity]--
	e.cooldown.Reset(id)

	e.rebuildGroups()

	e.logger.Info("rule unregistered",
		zap.String("ruleId", id),
		zap.String("name", rule.Name),
	)
	return nil
}

// GetRule returns a rule by ID (read-only copy of metadata).
func (e *Engine) GetRule(id string) (*Rule, error) {
	e.mu.RLock()
	defer e.mu.RUnlock()

	rule, ok := e.rules[id]
	if !ok {
		return nil, ErrRuleNotFound
	}
	return rule, nil
}

// ListRules returns all rules sorted by priority (lower first) and group.
func (e *Engine) ListRules() []*Rule {
	e.mu.RLock()
	defer e.mu.RUnlock()

	var list []*Rule
	for _, rule := range e.rules {
		list = append(list, rule)
	}
	sort.Slice(list, func(i, j int) bool {
		if list[i].Group != list[j].Group {
			return list[i].Group < list[j].Group
		}
		return list[i].Priority < list[j].Priority
	})
	return list
}

// ListRulesByGroup returns rule IDs within a group, ordered by priority.
func (e *Engine) ListRulesByGroup(group string) []string {
	e.mu.RLock()
	defer e.mu.RUnlock()
	return e.byGroup[group]
}

// Evaluate evaluates all enabled rules against a MetricSnapshot and returns
// results for all triggered rules (respecting cooldowns).
func (e *Engine) Evaluate(snapshot *MetricSnapshot) []*RuleResult {
	e.mu.RLock()
	defer e.mu.RUnlock()

	var results []*RuleResult

	for _, rule := range e.rules {
		if !rule.Enabled || rule.Expr == nil {
			continue
		}

		result := e.evaluateRule(rule, snapshot)
		if result.Triggered {
			results = append(results, result)
		}
	}

	// Sort triggered results by severity (critical first) then priority
	sort.Slice(results, func(i, j int) bool {
		if results[i].Severity != results[j].Severity {
			return severityRank(results[i].Severity) < severityRank(results[j].Severity)
		}
		return results[i].RuleID < results[j].RuleID
	})

	e.logger.Debug("evaluation complete",
		zap.Int("triggered", len(results)),
	)
	return results
}

// evaluateRule evaluates a single rule and checks cooldown.
func (e *Engine) evaluateRule(rule *Rule, snapshot *MetricSnapshot) *RuleResult {
	result := &RuleResult{
		RuleID:    rule.ID,
		RuleName:  rule.Name,
		Severity:  rule.Severity,
		Labels:    rule.Labels,
		Annotations: rule.Annotations,
	}

	// Check cooldown
	if rule.Cooldown > 0 && e.cooldown.InCooldown(rule.ID, rule.Cooldown) {
		result.Message = "in cooldown"
		return result
	}

	eval := NewEvaluator(snapshot)
	_, ok, err := eval.Evaluate(rule.Expr)
	if err != nil {
		result.Error = err.Error()
		result.Message = "evaluation error"
		e.logger.Error("rule evaluation failed",
			zap.String("ruleId", rule.ID),
			zap.Error(err),
		)
		return result
	}

	result.Triggered = ok
	if ok {
		result.Message = "rule triggered"
		e.cooldown.Record(rule.ID)
		e.logger.Warn("rule triggered",
			zap.String("ruleId", rule.ID),
			zap.String("name", rule.Name),
			zap.String("severity", string(rule.Severity)),
		)
	} else {
		result.Message = "condition not met"
	}
	return result
}

// evaluateExpr evaluates a single expression against the snapshot.
func (e *Engine) evaluateExpr(exprStr string, snapshot *MetricSnapshot) (float64, bool, error) {
	return NewEvaluator(snapshot).EvaluateString(exprStr)
}

// UpdateRule updates a rule. Re-compiles the expression if it changed.
func (e *Engine) UpdateRule(id string, updates func(*Rule)) error {
	e.mu.Lock()
	defer e.mu.Unlock()

	rule, ok := e.rules[id]
	if !ok {
		return ErrRuleNotFound
	}

	updates(rule)
	rule.UpdatedAt = time.Now().UTC()

	// Re-compile expression
	compiled, err := CompileRule(rule)
	if err != nil {
		return err
	}
	e.rules[id] = compiled
	e.rebuildGroups()

	e.logger.Info("rule updated",
		zap.String("ruleId", id),
		zap.String("name", compiled.Name),
	)
	return nil
}

// ResetCooldown removes the cooldown record for a rule (forces re-evaluation).
func (e *Engine) ResetCooldown(id string) error {
	e.mu.Lock()
	defer e.mu.Unlock()

	if _, ok := e.rules[id]; !ok {
		return ErrRuleNotFound
	}

	e.cooldown.Reset(id)
	e.logger.Info("cooldown reset", zap.String("ruleId", id))
	return nil
}

// Stats returns summary statistics about the engine.
func (e *Engine) Stats() map[string]interface{} {
	e.mu.RLock()
	defer e.mu.RUnlock()

	counts := map[Severity]int{}
	enabled := 0
	for _, rule := range e.rules {
		counts[rule.Severity]++
		if rule.Enabled {
			enabled++
		}
	}

	return map[string]interface{}{
		"total":   len(e.rules),
		"enabled": enabled,
		"groups":  len(e.byGroup),
		"by_severity": counts,
	}
}

// rebuildGroups rebuilds the byGroup index and sorts each group by priority.
func (e *Engine) rebuildGroups() {
	e.byGroup = make(map[string][]string)
	for _, rule := range e.rules {
		g := rule.Group
		if g == "" {
			g = "default"
		}
		e.byGroup[g] = append(e.byGroup[g], rule.ID)
	}
	// Sort each group by priority
	for g, ids := range e.byGroup {
		e.byGroup[g] = sortRuleIDsByPriority(ids, e.rules)
	}
}

func sortRuleIDsByPriority(ids []string, rules map[string]*Rule) []string {
	sort.Slice(ids, func(i, j int) bool {
		ri := rules[ids[i]]
		rj := rules[ids[j]]
		if ri.Priority != rj.Priority {
			return ri.Priority < rj.Priority
		}
		return ri.ID < rj.ID
	})
	return ids
}

func severityRank(s Severity) int {
	switch s {
	case SeverityCritical:
		return 0
	case SeverityWarning:
		return 1
	case SeverityInfo:
		return 2
	default:
		return 3
	}
}

// ErrRuleExists is returned when trying to register a rule with an existing ID.
var ErrRuleExists = NewRuleEngineError("rule already exists")
// ErrRuleNotFound is returned when trying to access a non-existent rule.
var ErrRuleNotFound = NewRuleEngineError("rule not found")

// RuleEngineError wraps a rule engine error with a descriptive message.
type RuleEngineError struct {
	msg string
}

func (e *RuleEngineError) Error() string {
	return "alert-rule-engine: " + e.msg
}

// NewRuleEngineError creates a new RuleEngineError.
func NewRuleEngineError(msg string) *RuleEngineError {
	return &RuleEngineError{msg: msg}
}
