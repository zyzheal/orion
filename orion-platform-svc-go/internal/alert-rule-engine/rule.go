package alertruleengine

import (
	"fmt"
	"time"
)

// Severity represents the alert severity level.
type Severity string

const (
	SeverityCritical Severity = "critical"
	SeverityWarning  Severity = "warning"
	SeverityInfo     Severity = "info"
)

// Rule defines an alert rule with an expression, severity, cooldown period,
// and metadata.
type Rule struct {
	ID           string            // unique rule identifier
	Name         string            // human-readable name
	Expression   string            // raw expression string
	Expr         *BoolExpr         // parsed expression tree
	Severity     Severity          // critical | warning | info
	Cooldown     time.Duration     // minimum time between successive firings
	Labels       map[string]string // extra labels attached to the rule
	Annotations  map[string]string // extra annotations (e.g. description)
	Enabled      bool              // whether the rule is active
	Group        string            // grouping key for rules
	Priority     int               // evaluation priority (lower = higher priority)
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

// RuleResult is returned after evaluating a rule.
type RuleResult struct {
	RuleID    string
	RuleName  string
	Triggered bool
	Value     float64
	Message   string
	Severity  Severity
	Labels    map[string]string
	Annotations map[string]string
	Error     string
}

// CooldownTracker tracks the last firing time per rule ID to enforce cooldowns.
type CooldownTracker struct {
	lastFired   map[string]time.Time
	globalLock  bool
}

// NewCooldownTracker creates a new cooldown tracker.
func NewCooldownTracker() *CooldownTracker {
	return &CooldownTracker{
		lastFired: make(map[string]time.Time),
	}
}

// InCooldown returns true if the rule is still within its cooldown period.
func (t *CooldownTracker) InCooldown(ruleID string, cooldown time.Duration) bool {
	last, ok := t.lastFired[ruleID]
	if !ok {
		return false
	}
	return time.Since(last) < cooldown
}

// Record records a firing for the given rule.
func (t *CooldownTracker) Record(ruleID string) {
	t.lastFired[ruleID] = time.Now().UTC()
}

// Reset removes the cooldown record for a rule.
func (t *CooldownTracker) Reset(ruleID string) {
	delete(t.lastFired, ruleID)
}

// CompileRule parses and validates a Rule's expression, returning the compiled
// rule or an error.
func CompileRule(raw *Rule) (*Rule, error) {
	if raw == nil {
		return nil, fmt.Errorf("rule is nil")
	}
	if raw.ID == "" {
		return nil, fmt.Errorf("rule ID is empty")
	}
	if raw.Expression == "" {
		return nil, fmt.Errorf("rule %s: expression is empty", raw.ID)
	}

	expr, err := ParseExpression(raw.Expression)
	if err != nil {
		return nil, fmt.Errorf("rule %s: failed to parse expression %q: %w", raw.ID, raw.Expression, err)
	}

	compiled := *raw
	compiled.Expr = expr
	compiled.UpdatedAt = time.Now().UTC()
	return &compiled, nil
}
