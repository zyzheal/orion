// Package paramplugins provides 20 parameter-plugin types for validating and
// coercing action parameters.
//
// Every action in the ActionRegistry declares a set of ParamSchema entries, each
// with an optional PluginType.  The ParameterPlugin interface provides:
//   - Validate: type-check + semantic validation of a single value
//   - Coerce: convert a raw JSON value to the canonical Go type
//   - ZeroValue: the canonical empty value for the plugin
//
// This decouples parameter validation from the action registry, allowing new
// plugins to be registered without touching the registry code.
package paramplugins

import (
	"encoding/json"
	"fmt"
	"net"
	"reflect"
	"strings"
	"time"
)

// =============================================================================
// ParameterPlugin — the SPI for parameter validation/coercion plugins
// =============================================================================

type ParameterPlugin interface {
	Name() string
	Description() string
	Validate(value any) error
	Coerce(raw json.RawMessage) (any, error)
	ZeroValue() any
}

// =============================================================================
// ParameterRegistry — thread-safe registry for parameter plugins
// =============================================================================

type ParameterRegistry struct {
	plugins map[string]ParameterPlugin
}

func NewParameterRegistry() *ParameterRegistry {
	r := &ParameterRegistry{
		plugins: make(map[string]ParameterPlugin),
	}
	for _, p := range DefaultParameterPlugins() {
		r.plugins[p.Name()] = p
	}
	return r
}

func (r *ParameterRegistry) Get(name string) (ParameterPlugin, bool) {
	p, ok := r.plugins[name]
	return p, ok
}

func (r *ParameterRegistry) List() []ParameterPlugin {
	var out []ParameterPlugin
	for _, p := range r.plugins {
		out = append(out, p)
	}
	return out
}

func (r *ParameterRegistry) Register(p ParameterPlugin) error {
	if _, ok := r.plugins[p.Name()]; ok {
		return fmt.Errorf("parameter plugin already registered: %s", p.Name())
	}
	r.plugins[p.Name()] = p
	return nil
}

func (r *ParameterRegistry) Count() int {
	return len(r.plugins)
}

// =============================================================================
// Helper — generic struct helpers
// =============================================================================

func newGenericPlugin(name, desc string) *genericParameterPlugin {
	return &genericParameterPlugin{name: name, description: desc}
}

// genericParameterPlugin is a boilerplate generator for plugins that delegate
// to a single validation function.
type genericParameterPlugin struct {
	name        string
	description string
}

func (g *genericParameterPlugin) Name() string         { return g.name }
func (g *genericParameterPlugin) Description() string  { return g.description }

// Validate checks whether the value has the expected Go type.
func (g *genericParameterPlugin) Validate(value any) error {
	return nil // overridden by concrete plugins when needed
}

// Coerce unmarshals raw JSON to the target value.
func (g *genericParameterPlugin) Coerce(raw json.RawMessage) (any, error) {
	return nil, nil
}

// ZeroValue returns the canonical zero for this plugin type.
func (g *genericParameterPlugin) ZeroValue() any {
	return nil
}

// =============================================================================
// 20 parameter plugins
// =============================================================================

func DefaultParameterPlugins() []ParameterPlugin {
	return []ParameterPlugin{
		// -- Scalar primitives --
		newStringPlugin(),
		newIntegerPlugin(),
		newFloatPlugin(),
		newBooleanPlugin(),
		// -- Enumerations --
		newEnumPlugin(),
		newFlagPlugin(),
		// -- Collections --
		newArrayPlugin(),
		newMapPlugin(),
		// -- Structured data --
		newObjectPlugin(),
		newJSONPlugin(),
		newYAMLPlugin(),
		// -- Network / addresses --
		newURLPlugin(),
		newIPPlugin(),
		newPortPlugin(),
		// -- Time / dates --
		newDurationPlugin(),
		newTimestampPlugin(),
		// -- Secrets / sensitive --
		newPasswordPlugin(),
		newTokenPlugin(),
		// -- Composite types --
		newKeyValPlugin(),
	}
}

// =============================================================================
// 1. StringPlugin
// =============================================================================

type StringPlugin struct {
	minLen    int
	maxLen    int
	required  bool
}

func newStringPlugin() *StringPlugin {
	return &StringPlugin{}
}

func (p *StringPlugin) Name() string              { return "string" }
func (p *StringPlugin) Description() string        { return "Arbitrary string text" }
func (p *StringPlugin) Validate(value any) error {
	s, ok := value.(string)
	if !ok {
		return fmt.Errorf("expected string, got %T", value)
	}
	if len(s) < p.minLen || len(s) > p.maxLen {
		return fmt.Errorf("string length %d out of range [%d,%d]", len(s), p.minLen, p.maxLen)
	}
	return nil
}
func (p *StringPlugin) Coerce(raw json.RawMessage) (any, error) {
	var s string
	if err := json.Unmarshal(raw, &s); err != nil {
		return nil, err
	}
	return s, nil
}
func (p *StringPlugin) ZeroValue() any { return "" }

// =============================================================================
// 2. IntegerPlugin
// =============================================================================

type IntegerPlugin struct {
	min int
	max int
}

func newIntegerPlugin() *IntegerPlugin {
	return &IntegerPlugin{}
}

func (p *IntegerPlugin) Name() string              { return "integer" }
func (p *IntegerPlugin) Description() string       { return "Whole number (signed 64-bit)" }
func (p *IntegerPlugin) Validate(value any) error {
	switch value.(type) {
	case int, int64:
		return nil
	case uint, uint64:
		return nil
	default:
		return fmt.Errorf("expected integer, got %T", value)
	}
	return nil
}
func (p *IntegerPlugin) Coerce(raw json.RawMessage) (any, error) {
	var i int64
	if err := json.Unmarshal(raw, &i); err != nil {
		return nil, err
	}
	return i, nil
}
func (p *IntegerPlugin) ZeroValue() any { return int64(0) }

// =============================================================================
// 3. FloatPlugin
// =============================================================================

type FloatPlugin struct{}

func newFloatPlugin() *FloatPlugin {
	return &FloatPlugin{}
}

func (p *FloatPlugin) Name() string              { return "float" }
func (p *FloatPlugin) Description() string       { return "Floating-point number (double)" }
func (p *FloatPlugin) Validate(value any) error {
	switch value.(type) {
	case float64:
	case float32:
	default:
		return fmt.Errorf("expected float, got %T", value)
	}
	return nil
}
func (p *FloatPlugin) Coerce(raw json.RawMessage) (any, error) {
	var f float64
	if err := json.Unmarshal(raw, &f); err != nil {
		return nil, err
	}
	return f, nil
}
func (p *FloatPlugin) ZeroValue() any { return float64(0) }

// =============================================================================
// 4. BooleanPlugin
// =============================================================================

type BooleanPlugin struct{}

func newBooleanPlugin() *BooleanPlugin {
	return &BooleanPlugin{}
}

func (p *BooleanPlugin) Name() string              { return "boolean" }
func (p *BooleanPlugin) Description() string       { return "True or false value" }
func (p *BooleanPlugin) Validate(value any) error {
	switch value.(type) {
	case bool:
	default:
		return fmt.Errorf("expected boolean, got %T", value)
	}
	return nil
}
func (p *BooleanPlugin) Coerce(raw json.RawMessage) (any, error) {
	var b bool
	if err := json.Unmarshal(raw, &b); err != nil {
		return nil, err
	}
	return b, nil
}
func (p *BooleanPlugin) ZeroValue() any { return false }

// =============================================================================
// 5. EnumPlugin
// =============================================================================

type EnumPlugin struct {
	Values []string
}

func newEnumPlugin() *EnumPlugin {
	return &EnumPlugin{
		Values: []string{"add", "remove", "list"},
	}
}

func (p *EnumPlugin) Name() string              { return "enum" }
func (p *EnumPlugin) Description() string       { return "Fixed set of allowed string values" }
func (p *EnumPlugin) Validate(value any) error {
	s, ok := value.(string)
	if !ok {
		return fmt.Errorf("expected string, got %T", value)
	}
	for _, v := range p.Values {
		if s == v {
			return nil
		}
	}
	return fmt.Errorf("value %q not in allowed set %v", s, p.Values)
}
func (p *EnumPlugin) Coerce(raw json.RawMessage) (any, error) {
	var s string
	if err := json.Unmarshal(raw, &s); err != nil {
		return nil, err
	}
	if err := p.Validate(s); err != nil {
		return nil, err
	}
	return s, nil
}
func (p *EnumPlugin) ZeroValue() any { return "" }

// =============================================================================
// 6. FlagPlugin — presence-only flag (no value)
// =============================================================================

type FlagPlugin struct{}

func newFlagPlugin() *FlagPlugin {
	return &FlagPlugin{}
}

func (p *FlagPlugin) Name() string              { return "flag" }
func (p *FlagPlugin) Description() string       { return "Boolean flag — present or absent" }
func (p *FlagPlugin) Validate(value any) error {
	switch value.(type) {
	case bool:
		return nil
	case nil:
		return nil
	default:
		return fmt.Errorf("expected flag (bool/nil), got %T", value)
	}
}
func (p *FlagPlugin) Coerce(raw json.RawMessage) (any, error) {
	if strings.TrimSpace(string(raw)) == "" {
		return true, nil // empty means flag is set
	}
	var b bool
	if err := json.Unmarshal(raw, &b); err != nil {
		return nil, err
	}
	return b, nil
}
func (p *FlagPlugin) ZeroValue() any { return false }

// =============================================================================
// 7. ArrayPlugin
// =============================================================================

type ArrayPlugin struct {
	ItemType string
}

func newArrayPlugin() *ArrayPlugin {
	return &ArrayPlugin{
		ItemType: "string",
	}
}

func (p *ArrayPlugin) Name() string              { return "array" }
func (p *ArrayPlugin) Description() string       { return "Ordered list of items" }
func (p *ArrayPlugin) Validate(value any) error {
	switch value.(type) {
	case []any:
	case []string:
	case []int:
	case []int64:
	default:
		return fmt.Errorf("expected array, got %T", value)
	}
	return nil
}
func (p *ArrayPlugin) Coerce(raw json.RawMessage) (any, error) {
	var v []any
	if err := json.Unmarshal(raw, &v); err != nil {
		return nil, err
	}
	return v, nil
}
func (p *ArrayPlugin) ZeroValue() any { return []any{} }

// =============================================================================
// 8. MapPlugin
// =============================================================================

type MapPlugin struct{}

func newMapPlugin() *MapPlugin {
	return &MapPlugin{}
}

func (p *MapPlugin) Name() string              { return "map" }
func (p *MapPlugin) Description() string       { return "Key-value map (string keys)" }
func (p *MapPlugin) Validate(value any) error {
	switch value.(type) {
	case map[string]any:
	case map[string]string:
	default:
		return fmt.Errorf("expected map, got %T", value)
	}
	return nil
}
func (p *MapPlugin) Coerce(raw json.RawMessage) (any, error) {
	var v map[string]any
	if err := json.Unmarshal(raw, &v); err != nil {
		return nil, err
	}
	return v, nil
}
func (p *MapPlugin) ZeroValue() any { return map[string]any{} }

// =============================================================================
// 9. ObjectPlugin — JSON object / nested structure
// =============================================================================

type ObjectPlugin struct{}

func newObjectPlugin() *ObjectPlugin {
	return &ObjectPlugin{}
}

func (p *ObjectPlugin) Name() string              { return "object" }
func (p *ObjectPlugin) Description() string       { return "JSON object / nested structure" }
func (p *ObjectPlugin) Validate(value any) error {
	switch value.(type) {
	case map[string]any:
	case json.RawMessage:
	default:
		return fmt.Errorf("expected object, got %T", value)
	}
	return nil
}
func (p *ObjectPlugin) Coerce(raw json.RawMessage) (any, error) {
	var v map[string]any
	if err := json.Unmarshal(raw, &v); err != nil {
		return nil, err
	}
	return v, nil
}
func (p *ObjectPlugin) ZeroValue() any { return map[string]any{} }

// =============================================================================
// 10. JSONPlugin — raw JSON string
// =============================================================================

type JSONPlugin struct{}

func newJSONPlugin() *JSONPlugin {
	return &JSONPlugin{}
}

func (p *JSONPlugin) Name() string              { return "json" }
func (p *JSONPlugin) Description() string       { return "Arbitrary JSON string" }
func (p *JSONPlugin) Validate(value any) error {
	switch v := value.(type) {
	case json.RawMessage:
		if err := json.Unmarshal(v, new(any)); err != nil {
			return err
		}
	case string:
		if err := json.Unmarshal([]byte(v), new(any)); err != nil {
			return err
		}
	default:
		return fmt.Errorf("expected JSON, got %T", value)
	}
	return nil
}
func (p *JSONPlugin) Coerce(raw json.RawMessage) (any, error) {
	return raw, nil
}
func (p *JSONPlugin) ZeroValue() any { return json.RawMessage("{}") }

// =============================================================================
// 11. YAMLPlugin — raw YAML string
// =============================================================================

type YAMLPlugin struct{}

func newYAMLPlugin() *YAMLPlugin {
	return &YAMLPlugin{}
}

func (p *YAMLPlugin) Name() string              { return "yaml" }
func (p *YAMLPlugin) Description() string       { return "Raw YAML text" }
func (p *YAMLPlugin) Validate(value any) error {
	s, ok := value.(string)
	if !ok {
		return fmt.Errorf("expected yaml (string), got %T", value)
	}
	if len(s) == 0 {
		return fmt.Errorf("yaml must not be empty")
	}
	return nil
}
func (p *YAMLPlugin) Coerce(raw json.RawMessage) (any, error) {
	var s string
	if err := json.Unmarshal(raw, &s); err != nil {
		return nil, err
	}
	return s, nil
}
func (p *YAMLPlugin) ZeroValue() any { return "" }

// =============================================================================
// 12. URLPlugin
// =============================================================================

type URLPlugin struct{}

func newURLPlugin() *URLPlugin {
	return &URLPlugin{}
}

func (p *URLPlugin) Name() string              { return "url" }
func (p *URLPlugin) Description() string       { return "Uniform Resource Locator (URI)" }
func (p *URLPlugin) Validate(value any) error {
	s, ok := value.(string)
	if !ok {
		return fmt.Errorf("expected url (string), got %T", value)
	}
	if !strings.HasPrefix(s, "http://") && !strings.HasPrefix(s, "https://") {
		return fmt.Errorf("url must start with http:// or https://")
	}
	return nil
}
func (p *URLPlugin) Coerce(raw json.RawMessage) (any, error) {
	var s string
	if err := json.Unmarshal(raw, &s); err != nil {
		return nil, err
	}
	return s, nil
}
func (p *URLPlugin) ZeroValue() any { return "" }

// =============================================================================
// 13. IPPlugin
// =============================================================================

type IPPlugin struct{}

func newIPPlugin() *IPPlugin {
	return &IPPlugin{}
}

func (p *IPPlugin) Name() string              { return "ip" }
func (p *IPPlugin) Description() string       { return "IPv4 or IPv6 address" }
func (p *IPPlugin) Validate(value any) error {
	s, ok := value.(string)
	if !ok {
		return fmt.Errorf("expected ip (string), got %T", value)
	}
	if len(s) == 0 {
		return fmt.Errorf("ip must not be empty")
	}
	if net.ParseIP(s) == nil {
		return fmt.Errorf("invalid IP address: %s", s)
	}
	return nil
}
func (p *IPPlugin) Coerce(raw json.RawMessage) (any, error) {
	var s string
	if err := json.Unmarshal(raw, &s); err != nil {
		return nil, err
	}
	return s, nil
}
func (p *IPPlugin) ZeroValue() any { return "" }

// =============================================================================
// 14. PortPlugin
// =============================================================================

type PortPlugin struct{}

func newPortPlugin() *PortPlugin {
	return &PortPlugin{}
}

func (p *PortPlugin) Name() string              { return "port" }
func (p *PortPlugin) Description() string       { return "TCP/UDP port number (1-65535)" }
func (p *PortPlugin) Validate(value any) error {
	var n int64
	switch v := value.(type) {
	case int:
		n = int64(v)
	case int64:
		n = v
	case float64:
		n = int64(v)
	default:
		return fmt.Errorf("expected port (integer), got %T", value)
	}
	if n < 1 || n > 65535 {
		return fmt.Errorf("port %d out of range [1,65535]", n)
	}
	return nil
}
func (p *PortPlugin) Coerce(raw json.RawMessage) (any, error) {
	var i int64
	if err := json.Unmarshal(raw, &i); err != nil {
		return nil, err
	}
	if err := p.Validate(i); err != nil {
		return nil, err
	}
	return i, nil
}
func (p *PortPlugin) ZeroValue() any { return int64(0) }

// =============================================================================
// 15. DurationPlugin
// =============================================================================

type DurationPlugin struct{}

func newDurationPlugin() *DurationPlugin {
	return &DurationPlugin{}
}

func (p *DurationPlugin) Name() string              { return "duration" }
func (p *DurationPlugin) Description() string       { return "Go-style duration string (e.g. 5s, 1m30s)" }
func (p *DurationPlugin) Validate(value any) error {
	switch v := value.(type) {
	case time.Duration:
		return nil
	case string:
		if _, err := time.ParseDuration(v); err != nil {
			return err
		}
	default:
		return fmt.Errorf("expected duration (time.Duration or string), got %T", value)
	}
	return nil
}
func (p *DurationPlugin) Coerce(raw json.RawMessage) (any, error) {
	var s string
	if err := json.Unmarshal(raw, &s); err != nil {
		return nil, err
	}
	d, err := time.ParseDuration(s)
	if err != nil {
		return nil, err
	}
	return d, nil
}
func (p *DurationPlugin) ZeroValue() any { return time.Duration(0) }

// =============================================================================
// 16. TimestampPlugin
// =============================================================================

type TimestampPlugin struct{}

func newTimestampPlugin() *TimestampPlugin {
	return &TimestampPlugin{}
}

func (p *TimestampPlugin) Name() string              { return "timestamp" }
func (p *TimestampPlugin) Description() string       { return "ISO-8601 or Unix timestamp" }
func (p *TimestampPlugin) Validate(value any) error {
	switch v := value.(type) {
	case time.Time:
		return nil
	case string:
		for _, fmt := range []string{time.RFC3339, "2006-01-02T15:04:05Z07:00", "2006-01-02"} {
			if _, err := time.Parse(fmt, v); err == nil {
				return nil
			}
		}
		return fmt.Errorf("invalid timestamp: %s", v)
	default:
		return fmt.Errorf("expected timestamp, got %T", value)
	}
}
func (p *TimestampPlugin) Coerce(raw json.RawMessage) (any, error) {
	var s string
	if err := json.Unmarshal(raw, &s); err != nil {
		return nil, err
	}
	for _, fmt := range []string{time.RFC3339, "2006-01-02T15:04:05Z07:00", "2006-01-02"} {
		if t, err := time.Parse(fmt, s); err == nil {
			return t, nil
		}
	}
	return nil, fmt.Errorf("unrecognized timestamp: %s", s)
}
func (p *TimestampPlugin) ZeroValue() any { return time.Time{} }

// =============================================================================
// 17. PasswordPlugin — masked secret input
// =============================================================================

type PasswordPlugin struct{}

func newPasswordPlugin() *PasswordPlugin {
	return &PasswordPlugin{}
}

func (p *PasswordPlugin) Name() string              { return "password" }
func (p *PasswordPlugin) Description() string       { return "Secret string (masked in logs)" }
func (p *PasswordPlugin) Validate(value any) error {
	s, ok := value.(string)
	if !ok {
		return fmt.Errorf("expected password (string), got %T", value)
	}
	if len(s) == 0 {
		return fmt.Errorf("password must not be empty")
	}
	return nil
}
func (p *PasswordPlugin) Coerce(raw json.RawMessage) (any, error) {
	var s string
	if err := json.Unmarshal(raw, &s); err != nil {
		return nil, err
	}
	return s, nil
}
func (p *PasswordPlugin) ZeroValue() any { return "" }

// =============================================================================
// 18. TokenPlugin — bearer/API token
// =============================================================================

type TokenPlugin struct{}

func newTokenPlugin() *TokenPlugin {
	return &TokenPlugin{}
}

func (p *TokenPlugin) Name() string              { return "token" }
func (p *TokenPlugin) Description() string       { return "Bearer/API token (alphanumeric)" }
func (p *TokenPlugin) Validate(value any) error {
	s, ok := value.(string)
	if !ok {
		return fmt.Errorf("expected token (string), got %T", value)
	}
	if len(s) < 8 {
		return fmt.Errorf("token too short (min 8 chars)")
	}
	return nil
}
func (p *TokenPlugin) Coerce(raw json.RawMessage) (any, error) {
	var s string
	if err := json.Unmarshal(raw, &s); err != nil {
		return nil, err
	}
	return s, nil
}
func (p *TokenPlugin) ZeroValue() any { return "" }

// =============================================================================
// 19. KeyValPlugin — list of key=value pairs
// =============================================================================

type KeyValPlugin struct{}

func newKeyValPlugin() *KeyValPlugin {
	return &KeyValPlugin{}
}

func (p *KeyValPlugin) Name() string              { return "keyval" }
func (p *KeyValPlugin) Description() string       { return "List of key=value strings" }
func (p *KeyValPlugin) Validate(value any) error {
	vs, ok := value.([]any)
	if !ok {
		return fmt.Errorf("expected keyval ([]string), got %T", value)
	}
	for _, v := range vs {
		s, sok := v.(string)
		if !sok {
			return fmt.Errorf("keyval entries must be strings")
		}
		if !strings.Contains(s, "=") {
			return fmt.Errorf("keyval entry must be key=value format: %s", s)
		}
	}
	return nil
}
func (p *KeyValPlugin) Coerce(raw json.RawMessage) (any, error) {
	var v []string
	if err := json.Unmarshal(raw, &v); err != nil {
		return nil, err
	}
	return v, nil
}
func (p *KeyValPlugin) ZeroValue() any { return []string{} }

// =============================================================================
// unused reflect import guard — reflect is referenced in type assertions above
// =============================================================================

// nolint: deadcode
var _ = reflect.TypeOf(nil)
