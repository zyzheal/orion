// Package abac implements an Attribute-Based Access Control policy engine
// for the Orion API Gateway.
//
// It evaluates policies with AND/OR/NOT condition rules, supports variable
// references (${user.id}), and includes system-level policies for resource
// ownership, tenant isolation, network restrictions, and working-hours limits.
package abac

import (
	"fmt"
	"reflect"
	"regexp"
	"sort"
	"strings"
	"time"
)

// Context holds all attributes for a single policy evaluation.
type Context struct {
	User        UserAttrs
	Resource    ResourceAttrs
	Environment EnvAttrs
	Action      ActionAttrs
}

// UserAttrs holds user-related attributes.
type UserAttrs struct {
	ID         string
	Role       string
	Department string
	Level      string
	Teams      []string
	TenantID   string
	Attributes map[string]interface{}
}

// ResourceAttrs holds resource-related attributes.
type ResourceAttrs struct {
	Type        string
	ID          string
	Owner       string
	OwnerID     string
	Department  string
	TenantID    string
	Sensitivity string
	Status      string
	Attributes  map[string]interface{}
}

// EnvAttrs holds environment attributes.
type EnvAttrs struct {
	Time       time.Time
	IP         string
	Location   string
	Device     string
	UserAgent  string
	Network    string
	SessionID  string
}

// ActionAttrs holds action attributes.
type ActionAttrs struct {
	Type    string
	Impact  string
	Reason  string
}

// Operator defines condition comparison operators.
type Operator string

const (
	OpEquals              Operator = "equals"
	OpNotEquals           Operator = "notEquals"
	OpContains            Operator = "contains"
	OpNotContains         Operator = "notContains"
	OpStartsWith          Operator = "startsWith"
	OpEndsWith            Operator = "endsWith"
	OpIn                  Operator = "in"
	OpNotIn               Operator = "notIn"
	OpGreaterThan         Operator = "greaterThan"
	OpLessThan            Operator = "lessThan"
	OpGreaterThanOrEqual  Operator = "greaterThanOrEqual"
	OpLessThanOrEqual     Operator = "lessThanOrEqual"
	OpMatches             Operator = "matches"
	OpExists              Operator = "exists"
	OpNotExists           Operator = "notExists"
	OpBetween             Operator = "between"
	OpTimeInRange         Operator = "timeInRange"
)

// Condition is a single attribute comparison.
type Condition struct {
	Attribute string      `json:"attribute"`
	Operator  Operator    `json:"operator"`
	Value     interface{} `json:"value,omitempty"`
	Value2    interface{} `json:"value2,omitempty"`
}

// Rule is a recursive condition tree supporting AND/OR/NOT.
type Rule struct {
	Condition   *Condition `json:"condition,omitempty"`
	And         []Rule     `json:"and,omitempty"`
	Or          []Rule     `json:"or,omitempty"`
	Not         *Rule      `json:"not,omitempty"`
	Description string     `json:"description,omitempty"`
}

// Policy defines an ABAC policy.
type Policy struct {
	ID           string      `json:"id"`
	Name         string      `json:"name"`
	Description  string      `json:"description,omitempty"`
	ResourceType interface{} `json:"resourceType"` // string or []string
	ActionType   interface{} `json:"actionType"`   // string or []string
	Conditions   Rule        `json:"conditions"`
	Effect       string      `json:"effect"` // "allow" or "deny"
	Priority     int         `json:"priority,omitempty"`
	Enabled      bool        `json:"enabled"`
	CreatedAt    time.Time   `json:"createdAt,omitempty"`
	UpdatedAt    time.Time   `json:"updatedAt,omitempty"`
}

// EvalResult is the output of a policy evaluation.
type EvalResult struct {
	Allowed          bool
	Denied           bool
	MatchedPolicies  []*Policy
	MatchedConditions []string
	DenialReason     string
	EvaluationTime   time.Duration
}

// SystemPolicies are the predefined ABAC policies.
var SystemPolicies = []*Policy{
	{
		ID: "resource-owner-full-control", Name: "Resource Owner Full Control",
		Description: "资源所有者对其拥有的资源拥有完全控制权限",
		ResourceType: []string{"pipeline", "deployment", "cmdb", "artifact"},
		ActionType:   []string{"read", "update", "delete"},
		Conditions: Rule{
			Condition: &Condition{Attribute: "resource.owner", Operator: OpEquals, Value: "${user.id}"},
			Description: "用户是资源所有者",
		},
		Effect: "allow", Priority: 100, Enabled: true,
	},
	{
		ID: "tenant-isolation", Name: "Tenant Isolation",
		Description: "用户只能访问自己租户的资源",
		ResourceType: "*",
		ActionType:   "*",
		Conditions: Rule{
			And: []Rule{
				{Condition: &Condition{Attribute: "resource.tenantId", Operator: OpExists}},
				{Condition: &Condition{Attribute: "resource.tenantId", Operator: OpNotEquals, Value: "${user.tenantId}"}},
			},
		},
		Effect: "deny", Priority: 99, Enabled: true,
	},
	{
		ID: "restricted-resource-access", Name: "Restricted Resource Access",
		Description: "限制级别资源只有特定角色可以访问",
		ResourceType: "*",
		ActionType:   []string{"read", "update", "delete"},
		Conditions: Rule{
			And: []Rule{
				{Condition: &Condition{Attribute: "resource.sensitivity", Operator: OpEquals, Value: "restricted"}},
				{Or: []Rule{
					{Condition: &Condition{Attribute: "user.role", Operator: OpIn, Value: []string{"admin", "security"}}},
					{Condition: &Condition{Attribute: "user.department", Operator: OpEquals, Value: "${resource.department}"}},
				}},
			},
		},
		Effect: "allow", Priority: 90, Enabled: true,
	},
	{
		ID: "external-network-restriction", Name: "External Network Restriction",
		Description: "外部网络只能进行读取操作",
		ResourceType: "*",
		ActionType:   []string{"create", "update", "delete", "execute"},
		Conditions: Rule{
			Condition: &Condition{Attribute: "environment.network", Operator: OpEquals, Value: "external"},
			Description: "来自外部网络",
		},
		Effect: "deny", Priority: 80, Enabled: true,
	},
	{
		ID: "working-hours-restriction", Name: "Working Hours Restriction",
		Description: "关键操作只能在工作时间进行",
		ResourceType: []string{"deployment", "pipeline"},
		ActionType:   []string{"execute", "approve"},
		Conditions: Rule{
			And: []Rule{
				{Condition: &Condition{Attribute: "action.impact", Operator: OpIn, Value: []string{"high", "critical"}}},
				{Not: &Rule{Condition: &Condition{Attribute: "environment.time", Operator: OpTimeInRange, Value: map[string]int{"startHour": 9, "endHour": 18}}}},
				{Condition: &Condition{Attribute: "user.role", Operator: OpNotEquals, Value: "admin"}},
			},
		},
		Effect: "deny", Priority: 70, Enabled: true,
	},
	{
		ID: "cross-department-restriction", Name: "Cross Department Restriction",
		Description: "非管理员不能访问其他部门的资源",
		ResourceType: []string{"pipeline", "deployment", "cmdb"},
		ActionType:   []string{"read", "update", "delete"},
		Conditions: Rule{
			And: []Rule{
				{Condition: &Condition{Attribute: "resource.department", Operator: OpExists}},
				{Condition: &Condition{Attribute: "resource.department", Operator: OpNotEquals, Value: "${user.department}"}},
				{Condition: &Condition{Attribute: "user.role", Operator: OpNotEquals, Value: "admin"}},
			},
		},
		Effect: "deny", Priority: 60, Enabled: true,
	},
}

// Engine is the ABAC policy engine.
type Engine struct {
	policies map[string]*Policy
}

// NewEngine creates a fully initialised ABAC engine.
func NewEngine() *Engine {
	e := &Engine{policies: make(map[string]*Policy)}
	for _, p := range SystemPolicies {
		p.CreatedAt = time.Now()
		p.UpdatedAt = time.Now()
		e.policies[p.ID] = p
	}
	return e
}

// RegisterPolicy adds or updates a policy.
func (e *Engine) RegisterPolicy(p *Policy) {
	if p.CreatedAt.IsZero() {
		p.CreatedAt = time.Now()
	}
	p.UpdatedAt = time.Now()
	e.policies[p.ID] = p
}

// UnregisterPolicy removes a policy.
func (e *Engine) UnregisterPolicy(id string) {
	delete(e.policies, id)
}

// GetPolicy returns a policy by ID.
func (e *Engine) GetPolicy(id string) *Policy {
	return e.policies[id]
}

// GetAllPolicies returns all registered policies.
func (e *Engine) GetAllPolicies() []*Policy {
	result := make([]*Policy, 0, len(e.policies))
	for _, p := range e.policies {
		result = append(result, p)
	}
	return result
}

// Evaluate runs all matching policies against the context.
func (e *Engine) Evaluate(ctx Context) EvalResult {
	start := time.Now()

	matching := make([]*Policy, 0)
	for _, p := range e.policies {
		if !p.Enabled || !matchesResourceAction(p, ctx) {
			continue
		}
		matching = append(matching, p)
	}

	sort.Slice(matching, func(i, j int) bool {
		return matching[i].Priority > matching[j].Priority
	})

	var matchedAllow []*Policy
	var matchedConditions []string
	var denialReason string

	for _, p := range matching {
		result, desc := evaluateRule(p.Conditions, ctx)
		if !result {
			continue
		}
		if p.Effect == "deny" {
			denialReason = fmt.Sprintf("%s: %s", p.Name, desc)
			return EvalResult{
				Allowed:          false,
				Denied:           true,
				MatchedPolicies:  []*Policy{p},
				MatchedConditions: []string{desc},
				DenialReason:     denialReason,
				EvaluationTime:   time.Since(start),
			}
		}
		matchedAllow = append(matchedAllow, p)
		matchedConditions = append(matchedConditions, desc)
	}

	return EvalResult{
		Allowed:          len(matchedAllow) > 0,
		Denied:           false,
		MatchedPolicies:  matchedAllow,
		MatchedConditions: matchedConditions,
		DenialReason:     ifEmpty(len(matchedAllow) == 0, "No matching policy allows this action", ""),
		EvaluationTime:   time.Since(start),
	}
}

// IsAllowed is a convenience wrapper.
func (e *Engine) IsAllowed(ctx Context) bool {
	return e.Evaluate(ctx).Allowed
}

// IsDenied is a convenience wrapper.
func (e *Engine) IsDenied(ctx Context) bool {
	return e.Evaluate(ctx).Denied
}

// GetAvailableActions returns which actions are allowed for the given context.
func (e *Engine) GetAvailableActions(ctx Context, actionTypes []string) []string {
	var allowed []string
	for _, at := range actionTypes {
		fullCtx := ctx
		fullCtx.Action = ActionAttrs{Type: at}
		if e.IsAllowed(fullCtx) {
			allowed = append(allowed, at)
		}
	}
	return allowed
}

// --- internal helpers ---

func matchesResourceAction(p *Policy, ctx Context) bool {
	if !matchField(p.ResourceType, ctx.Resource.Type) {
		return false
	}
	if !matchField(p.ActionType, ctx.Action.Type) {
		return false
	}
	return true
}

func matchField(field interface{}, value string) bool {
	switch v := field.(type) {
	case string:
		return v == "*" || v == value
	case []string:
		for _, s := range v {
			if s == "*" || s == value {
				return true
			}
		}
		return false
	default:
		return false
	}
}

func evaluateRule(rule Rule, ctx Context) (bool, string) {
	if rule.Condition != nil {
		result := evaluateCondition(rule.Condition, ctx)
		desc := rule.Description
		if desc == "" {
			desc = fmt.Sprintf("%s %s", rule.Condition.Attribute, rule.Condition.Operator)
		}
		return result, desc
	}

	if len(rule.And) > 0 {
		descs := []string{}
		for _, r := range rule.And {
			result, desc := evaluateRule(r, ctx)
			descs = append(descs, desc)
			if !result {
				return false, rule.Description
			}
		}
		desc := rule.Description
		if desc == "" {
			desc = "AND(" + strings.Join(descs, ", ") + ")"
		}
		return true, desc
	}

	if len(rule.Or) > 0 {
		descs := []string{}
		for _, r := range rule.Or {
			result, desc := evaluateRule(r, ctx)
			descs = append(descs, desc)
			if result {
				return true, rule.Description
			}
		}
		return false, rule.Description
	}

	if rule.Not != nil {
		result, desc := evaluateRule(*rule.Not, ctx)
		return !result, "NOT(" + desc + ")"
	}

	return true, rule.Description
}

func evaluateCondition(cond *Condition, ctx Context) bool {
	attrVal := getAttributeValue(cond.Attribute, ctx)
	compareVal := resolveValue(cond.Value, ctx)
	compareVal2 := resolveValue(cond.Value2, ctx)

	switch cond.Operator {
	case OpEquals:
		return reflect.DeepEqual(attrVal, compareVal) || fmt.Sprintf("%v", attrVal) == fmt.Sprintf("%v", compareVal)
	case OpNotEquals:
		return !(reflect.DeepEqual(attrVal, compareVal) || fmt.Sprintf("%v", attrVal) == fmt.Sprintf("%v", compareVal))
	case OpContains:
		return containsValue(attrVal, compareVal)
	case OpNotContains:
		return !containsValue(attrVal, compareVal)
	case OpStartsWith:
		return strings.HasPrefix(fmt.Sprintf("%v", attrVal), fmt.Sprintf("%v", compareVal))
	case OpEndsWith:
		return strings.HasSuffix(fmt.Sprintf("%v", attrVal), fmt.Sprintf("%v", compareVal))
	case OpIn:
		if arr, ok := compareVal.([]interface{}); ok {
			for _, item := range arr {
				if fmt.Sprintf("%v", attrVal) == fmt.Sprintf("%v", item) {
					return true
				}
			}
		}
		if arr, ok := compareVal.([]string); ok {
			for _, item := range arr {
				if fmt.Sprintf("%v", attrVal) == item {
					return true
				}
			}
		}
		return false
	case OpNotIn:
		if arr, ok := compareVal.([]interface{}); ok {
			for _, item := range arr {
				if fmt.Sprintf("%v", attrVal) == fmt.Sprintf("%v", item) {
					return false
				}
			}
			return true
		}
		return true
	case OpGreaterThan:
		return toFloat(attrVal) > toFloat(compareVal)
	case OpLessThan:
		return toFloat(attrVal) < toFloat(compareVal)
	case OpGreaterThanOrEqual:
		return toFloat(attrVal) >= toFloat(compareVal)
	case OpLessThanOrEqual:
		return toFloat(attrVal) <= toFloat(compareVal)
	case OpMatches:
		re, err := regexp.Compile(fmt.Sprintf("%v", compareVal))
		if err != nil {
			return false
		}
		return re.MatchString(fmt.Sprintf("%v", attrVal))
	case OpExists:
		return attrVal != nil
	case OpNotExists:
		return attrVal == nil
	case OpBetween:
		return toFloat(attrVal) >= toFloat(compareVal) && toFloat(attrVal) <= toFloat(compareVal2)
	case OpTimeInRange:
		return evalTimeInRange(attrVal, compareVal)
	default:
		return false
	}
}

func getAttributeValue(path string, ctx Context) interface{} {
	parts := strings.Split(path, ".")
	if len(parts) == 0 {
		return nil
	}
	var current interface{}
	switch parts[0] {
	case "user":
		current = ctx.User
	case "resource":
		current = ctx.Resource
	case "environment":
		current = ctx.Environment
	case "action":
		current = ctx.Action
	default:
		return nil
	}
	for _, part := range parts[1:] {
		current = getField(current, part)
		if current == nil {
			return nil
		}
	}
	return current
}

func getField(obj interface{}, field string) interface{} {
	v := reflect.ValueOf(obj)
	if v.Kind() == reflect.Ptr {
		v = v.Elem()
	}
	if v.Kind() == reflect.Struct {
		f := v.FieldByName(field)
		if !f.IsValid() {
			// Check map attributes
			if field == "Attributes" || field == "attributes" {
				return nil
			}
			return nil
		}
		if f.Kind() == reflect.Ptr && f.IsNil() {
			return nil
		}
		return f.Interface()
	}
	if v.Kind() == reflect.Map {
		return v.MapIndex(reflect.ValueOf(field)).Interface()
	}
	return nil
}

func resolveValue(val interface{}, ctx Context) interface{} {
	s, ok := val.(string)
	if !ok {
		return val
	}
	if strings.HasPrefix(s, "${") && strings.HasSuffix(s, "}") {
		path := s[2 : len(s)-1]
		return getAttributeValue(path, ctx)
	}
	return val
}

func containsValue(haystack interface{}, needle interface{}) bool {
	if haystack == nil {
		return false
	}
	hv := reflect.ValueOf(haystack)
	if hv.Kind() == reflect.Slice || hv.Kind() == reflect.Array {
		for i := 0; i < hv.Len(); i++ {
			if reflect.DeepEqual(hv.Index(i).Interface(), needle) {
				return true
			}
		}
		return false
	}
	return strings.Contains(fmt.Sprintf("%v", haystack), fmt.Sprintf("%v", needle))
}

func toFloat(v interface{}) float64 {
	switch n := v.(type) {
	case float64:
		return n
	case float32:
		return float64(n)
	case int:
		return float64(n)
	case int64:
		return float64(n)
	default:
		return 0
	}
}

func evalTimeInRange(timeVal interface{}, rangeConfig interface{}) bool {
	var t time.Time
	switch v := timeVal.(type) {
	case time.Time:
		t = v
	default:
		return false
	}
	cfg, ok := rangeConfig.(map[string]int)
	if !ok {
		return false
	}
	startHour := cfg["startHour"]
	endHour := cfg["endHour"]
	if startHour == 0 && endHour == 0 {
		startHour = 9
		endHour = 18
	}
	hour := t.UTC().Hour()
	return hour >= startHour && hour < endHour
}

func ifEmpty(cond bool, ifTrue, ifFalse string) string {
	if cond {
		return ifTrue
	}
	return ifFalse
}
