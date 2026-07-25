package processor

import (
	"fmt"
	"strings"
	"sync"
)

// ---------------------------------------------------------------------------
// Transformation Engine — maps data between integration-specific formats
// ---------------------------------------------------------------------------

// FieldMapping describes how one source field maps to a destination field.
type FieldMapping struct {
	// Source is a dotted-path expression in the input (e.g. "user.name").
	Source string `json:"source"`
	// Dest is the field path in the output.
	Dest string `json:"dest"`
	// Fn is an optional transformation function name ("upper", "lower", "trim",
	// "default:<value>", "prefix:<value>", "suffix:<value>").
	Fn string `json:"fn,omitempty"`
	// Type is the target Go type ("string", "int", "float", "bool", "json").
	Type string `json:"type,omitempty"`
}

// TransformRule is a named mapping from one schema to another.
type TransformRule struct {
	Name     string         `json:"name"`
	From     string         `json:"from"` // source format (e.g. "github.event")
	To       string         `json:"to"`   // target format (e.g. "orion.payload")
	Mappings []FieldMapping `json:"mappings"`
}

// Transformer applies registered TransformRules.
type Transformer struct {
	mu     sync.RWMutex
	rules  map[string]*TransformRule
	logger logger
}

// logger is a minimal logging interface to avoid a hard dependency on zap.
type logger interface {
	Debug(msg string, fields ...interface{})
	Error(msg string, err error, fields ...interface{})
}

// TransformerOption configures a Transformer.
type TransformerOption func(*Transformer)

// WithTransformerLogger sets a logger that satisfies the logger interface.
func WithTransformerLogger(l logger) TransformerOption {
	return func(t *Transformer) {
		t.logger = l
	}
}

// NewTransformer creates an empty transformation engine.
func NewTransformer(opts ...TransformerOption) *Transformer {
	tr := &Transformer{
		rules:  make(map[string]*TransformRule),
		logger: noopLogger{},
	}
	for _, o := range opts {
		o(tr)
	}
	return tr
}

type noopLogger struct{}

func (noopLogger) Debug(string, ...interface{})        {}
func (noopLogger) Error(string, error, ...interface{}) {}

// Register stores a transform rule.
func (tr *Transformer) Register(rule *TransformRule) {
	tr.mu.Lock()
	defer tr.mu.Unlock()

	key := fmt.Sprintf("%s->%s", rule.From, rule.To)
	tr.rules[key] = rule
	tr.rules[rule.Name] = rule // also index by name
	tr.logger.Debug("transform rule registered", "name", rule.Name, "from", rule.From, "to", rule.To)
}

// Get returns a transform rule by key (name or "from->to").
func (tr *Transformer) Get(key string) (*TransformRule, error) {
	tr.mu.RLock()
	defer tr.mu.RUnlock()

	rule, ok := tr.rules[key]
	if !ok {
		return nil, ErrTransformNotFound
	}
	return rule, nil
}

// Transform applies the rule identified by key to the input data and returns
// the transformed output.
func (tr *Transformer) Transform(ctxKey string, input map[string]interface{}) (map[string]interface{}, error) {
	rule, err := tr.Get(ctxKey)
	if err != nil {
		return nil, fmt.Errorf("%w: %q", err, ctxKey)
	}
	return tr.apply(input, rule)
}

// ApplyInbound performs an inbound transform (external format → canonical).
func (tr *Transformer) ApplyInbound(from, to string, input map[string]interface{}) (map[string]interface{}, error) {
	key := fmt.Sprintf("%s->%s", from, to)
	return tr.Transform(key, input)
}

// ApplyOutbound performs an outbound transform (canonical → external format).
func (tr *Transformer) ApplyOutbound(from, to string, input map[string]interface{}) (map[string]interface{}, error) {
	key := fmt.Sprintf("%s->%s", to, from)
	return tr.Transform(key, input)
}

// ---------------------------------------------------------------------------
// Field-level helpers
// ---------------------------------------------------------------------------

// GetNested retrieves a value from a dotted-path on a nested map.
// e.g. GetNested(data, "user.profile.name")
func GetNested(data map[string]interface{}, path string) (interface{}, bool) {
	current := interface{}(data)
	for _, segment := range strings.Split(path, ".") {
		if segment == "" {
			continue
		}
		switch v := current.(type) {
		case map[string]interface{}:
			val, exists := v[segment]
			if !exists {
				return nil, false
			}
			current = val
		case map[interface{}]interface{}:
			val, exists := v[segment]
			if !exists {
				return nil, false
			}
			current = val
		default:
			return nil, false
		}
	}
	return current, true
}

// SetNested writes a value into a nested map using dotted-path notation,
// creating intermediate maps as needed.
func SetNested(data map[string]interface{}, path string, value interface{}) {
	segments := strings.Split(path, ".")
	current := data
	for _, seg := range segments[:len(segments)-1] {
		if _, ok := current[seg]; !ok {
			current[seg] = make(map[string]interface{})
		}
		var ok bool
		current, ok = current[seg].(map[string]interface{})
		if !ok {
			return
		}
	}
	current[segments[len(segments)-1]] = value
}

// ---------------------------------------------------------------------------
// Internal apply logic
// ---------------------------------------------------------------------------

func (tr *Transformer) apply(input map[string]interface{}, rule *TransformRule) (map[string]interface{}, error) {
	if input == nil {
		return nil, ErrInvalidInput
	}

	output := make(map[string]interface{})

	for _, m := range rule.Mappings {
		src, ok := GetNested(input, m.Source)
		if !ok {
			// Source field not present; skip silently unless using "default:" fn.
			if strings.HasPrefix(m.Fn, "default:") {
				def := strings.TrimPrefix(m.Fn, "default:")
				src = def
			} else {
				continue
			}
		}

		// Apply function.
		val, err := tr.applyFn(src, m.Fn)
		if err != nil {
			tr.logger.Error("transform: function failed", err, "fn", m.Fn, "source", m.Source)
			return nil, err
		}

		// Apply type coercion.
		if m.Type != "" {
			val, err = tr.coerce(val, m.Type)
			if err != nil {
				tr.logger.Error("transform: coercion failed", err, "type", m.Type)
				return nil, err
			}
		}

		SetNested(output, m.Dest, val)
	}

	return output, nil
}

func (tr *Transformer) applyFn(val interface{}, fn string) (interface{}, error) {
	if fn == "" {
		return val, nil
	}

	switch fn {
	case "upper":
		if s, ok := val.(string); ok {
			return strings.ToUpper(s), nil
		}
	case "lower":
		if s, ok := val.(string); ok {
			return strings.ToLower(s), nil
		}
	case "trim":
		if s, ok := val.(string); ok {
			return strings.TrimSpace(s), nil
		}
	default:
		if strings.HasPrefix(fn, "prefix:") {
			if s, ok := val.(string); ok {
				return strings.TrimPrefix(fn, "prefix:") + s, nil
			}
		}
		if strings.HasPrefix(fn, "suffix:") {
			if s, ok := val.(string); ok {
				return s + strings.TrimPrefix(fn, "suffix:"), nil
			}
		}
		// unknown function: treat "default:<v>" already handled; error on others
		return nil, fmt.Errorf("%w: unknown function %q", ErrInvalidTransform, fn)
	}
	return val, nil
}

func (tr *Transformer) coerce(val interface{}, typ string) (interface{}, error) {
	if val == nil {
		return nil, nil
	}

	switch typ {
	case "string":
		switch v := val.(type) {
		case string:
			return v, nil
		case []byte:
			return string(v), nil
		default:
			return fmt.Sprintf("%v", v), nil
		}
	case "bool":
		switch v := val.(type) {
		case bool:
			return v, nil
		case string:
			return v == "true" || v == "1", nil
		default:
			return false, fmt.Errorf("%w: cannot coerce to bool from %T", ErrInvalidTransform, val)
		}
	case "json":
		// Accept any value as-is for downstream JSON marshalling.
		return val, nil
	default:
		// For int/float, attempt a generic approach.
		if typ == "int" || typ == "float" {
			return coerceNumber(val, typ)
		}
		return val, fmt.Errorf("%w: unknown type %q", ErrInvalidTransform, typ)
	}
}

func coerceNumber(val interface{}, typ string) (interface{}, error) {
	switch v := val.(type) {
	case int:
		if typ == "float" {
			return float64(v), nil
		}
		return v, nil
	case int64:
		if typ == "float" {
			return float64(v), nil
		}
		return int(v), nil
	case float64:
		if typ == "int" {
			return int(v), nil
		}
		return v, nil
	case string:
		if typ == "int" {
			var n int
			fmt.Sscanf(v, "%d", &n)
			return n, nil
		}
		var n float64
		fmt.Sscanf(v, "%f", &n)
		return n, nil
	default:
		return nil, fmt.Errorf("%w: cannot coerce %T to number", ErrInvalidTransform, val)
	}
}

// ---------------------------------------------------------------------------
// Rule helpers
// ---------------------------------------------------------------------------

// NewRule creates a TransformRule with the given name, from/to pair, and
// field mappings.
func NewRule(name, from, to string, mappings ...FieldMapping) *TransformRule {
	return &TransformRule{
		Name:     name,
		From:     from,
		To:       to,
		Mappings: mappings,
	}
}

// Map adds a field mapping to a rule.
func (r *TransformRule) Map(source, dest string) *TransformRule {
	r.Mappings = append(r.Mappings, FieldMapping{Source: source, Dest: dest})
	return r
}

// MapFn adds a field mapping with a transformation function.
func (r *TransformRule) MapFn(source, dest, fn string) *TransformRule {
	r.Mappings = append(r.Mappings, FieldMapping{Source: source, Dest: dest, Fn: fn})
	return r
}

// MapTyped adds a field mapping with a target type.
func (r *TransformRule) MapTyped(source, dest, typ string) *TransformRule {
	r.Mappings = append(r.Mappings, FieldMapping{Source: source, Dest: dest, Type: typ})
	return r
}

// RuleSet groups a named set of related rules.
type RuleSet struct {
	Name  string          `json:"name"`
	Rules []TransformRule `json:"rules"`
}

// NewRuleSet creates an empty rule set.
func NewRuleSet(name string) *RuleSet {
	return &RuleSet{Name: name}
}

// AddRule registers a rule into the set.
func (rs *RuleSet) AddRule(r *TransformRule) {
	rs.Rules = append(rs.Rules, *r)
}

// LoadInto registers all rules in the set into a Transformer.
func (rs *RuleSet) LoadInto(tr *Transformer) {
	for i := range rs.Rules {
		rule := &rs.Rules[i]
		tr.Register(rule)
	}
}

// ---------------------------------------------------------------------------
// Built-in rules
// ---------------------------------------------------------------------------

// StandardInboundRuleSet returns common inbound transform rules (JSON body → canonical).
func StandardInboundRuleSet() *RuleSet {
	rs := NewRuleSet("standard-inbound")
	rs.AddRule(NewRule("json-flat-inbound", "json", "canonical").
		Map("id", "id").
		Map("name", "name").
		Map("timestamp", "timestamp"))
	rs.AddRule(NewRule("json-nested-inbound", "json_nested", "canonical").
		Map("data.id", "id").
		Map("data.name", "name").
		Map("meta.timestamp", "timestamp"))
	return rs
}

// StandardOutboundRuleSet returns common outbound transform rules (canonical → JSON body).
func StandardOutboundRuleSet() *RuleSet {
	rs := NewRuleSet("standard-outbound")
	rs.AddRule(NewRule("json-flat-outbound", "canonical", "json").
		Map("id", "id").
		Map("name", "name").
		Map("message", "message"))
	return rs
}

// CanonicalToEvent transforms a canonical payload into an event envelope.
func CanonicalToEvent() *TransformRule {
	return NewRule("canonical-event", "canonical", "event").
		Map("id", "event.id").
		Map("name", "event.name").
		Map("timestamp", "event.timestamp").
		MapFn("name", "event.summary", "upper").
		Map("message", "event.body")
}
