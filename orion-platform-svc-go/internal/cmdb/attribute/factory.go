// AttrValueHandlerFactory — registry for CI attribute validators
// (ADR-013 §4.2, 对标 NL AttrValueHandlerFactory).
//
// This is a domain-specific registry. It reuses the *pattern* of
// ADR-012's generic factory.HandlerFactory[T] (thread-safe, order-preserving,
// register-if-absent) but does not reuse the type, because validators are
// *built from a config map*, not dispatched by event. Forcing them into
// Handler[T] would require a Handle() no-op on every validator.
package attribute

import (
	"errors"
	"fmt"
	"regexp"
	"sync"
)

// ErrNoValidator is returned when no validator is registered for the
// attribute type. Callers check with errors.Is.
var ErrNoValidator = errors.New("attribute: no validator for type")

// ErrInvalidValidatorConfig is returned when the validator config
// (attribute.Validator map) cannot be parsed.
var ErrInvalidValidatorConfig = errors.New("attribute: invalid validator config")

// ValidatorHandler builds a Validator from an Attribute's config map.
// The Type() string must match one of the AttributeType constants so
// the factory can route by attribute type.
type ValidatorHandler interface {
	// Type returns the AttributeType string this handler builds for.
	Type() string
	// Build constructs a configured Validator from the attribute.
	Build(a *Attribute) (Validator, error)
}

// AttrValueHandlerFactory is a thread-safe registry mapping
// AttributeType → ValidatorHandler.
type AttrValueHandlerFactory struct {
	mu       sync.RWMutex
	handlers map[string]ValidatorHandler
	order    []string
}

// NewAttrValueHandlerFactory returns an empty factory.
func NewAttrValueHandlerFactory() *AttrValueHandlerFactory {
	return &AttrValueHandlerFactory{
		handlers: make(map[string]ValidatorHandler),
	}
}

// WithDefaults returns a factory pre-populated with the 4 built-in
// validators (enum, range, regex, ci-ref) plus passthroughs for
// string and json. Chainable.
func WithDefaults(f *AttrValueHandlerFactory) *AttrValueHandlerFactory {
	if f == nil {
		return nil
	}
	for _, h := range []ValidatorHandler{
		&EnumValidatorHandler{},
		&RangeValidatorHandler{},
		&RegexValidatorHandler{},
		&CIRefValidatorHandler{},
		&PassValidatorHandler{},
	} {
		f.Register(h)
	}
	return f
}

// NewWithDefaults is a convenience constructor for WithDefaults.
func NewWithDefaults() *AttrValueHandlerFactory {
	return WithDefaults(NewAttrValueHandlerFactory())
}

// Register adds a handler. Fails on duplicate type key.
func (f *AttrValueHandlerFactory) Register(h ValidatorHandler) error {
	if h == nil {
		return errors.New("attribute: cannot register nil handler")
	}
	t := h.Type()
	if t == "" {
		return errors.New("attribute: handler.Type() returned empty string")
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	if _, ok := f.handlers[t]; ok {
		return fmt.Errorf("attribute: duplicate validator type %q", t)
	}
	f.handlers[t] = h
	f.order = append(f.order, t)
	return nil
}

// RegisterIfAbsent adds a handler only if no handler of the same type
// is registered. Returns true if added, false if skipped.
func (f *AttrValueHandlerFactory) RegisterIfAbsent(h ValidatorHandler) bool {
	if h == nil {
		return false
	}
	t := h.Type()
	if t == "" {
		return false
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	if _, ok := f.handlers[t]; ok {
		return false
	}
	f.handlers[t] = h
	f.order = append(f.order, t)
	return true
}

// Get returns the handler for the given attribute type.
func (f *AttrValueHandlerFactory) Get(t AttributeType) (ValidatorHandler, bool) {
	f.mu.RLock()
	defer f.mu.RUnlock()
	h, ok := f.handlers[string(t)]
	return h, ok
}

// Has reports whether a handler is registered for the given attribute type.
func (f *AttrValueHandlerFactory) Has(t AttributeType) bool {
	_, ok := f.Get(t)
	return ok
}

// Unregister removes the handler for t. Returns true if present.
func (f *AttrValueHandlerFactory) Unregister(t AttributeType) bool {
	key := string(t)
	f.mu.Lock()
	defer f.mu.Unlock()
	if _, ok := f.handlers[key]; !ok {
		return false
	}
	delete(f.handlers, key)
	out := f.order[:0]
	for _, k := range f.order {
		if k != key {
			out = append(out, k)
		}
	}
	f.order = out
	return true
}

// List returns registered types in insertion order.
func (f *AttrValueHandlerFactory) List() []AttributeType {
	f.mu.RLock()
	defer f.mu.RUnlock()
	out := make([]AttributeType, len(f.order))
	for i, k := range f.order {
		out[i] = AttributeType(k)
	}
	return out
}

// Count returns the number of registered handlers.
func (f *AttrValueHandlerFactory) Count() int {
	f.mu.RLock()
	defer f.mu.RUnlock()
	return len(f.handlers)
}

// BuildValidator returns a Validator configured for the given Attribute.
// Returns ErrNoValidator if the type is unregistered.
func (f *AttrValueHandlerFactory) BuildValidator(a *Attribute) (Validator, error) {
	if f == nil {
		return nil, errors.New("attribute: nil factory")
	}
	if a == nil {
		return nil, errors.New("attribute: nil attribute")
	}
	h, ok := f.Get(a.AttributeType)
	if !ok {
		return nil, fmt.Errorf("%w: %s", ErrNoValidator, a.AttributeType)
	}
	return h.Build(a)
}

// --- Enum handler ---

// EnumValidatorHandler builds EnumValidator from Attribute.Validator["values"].
type EnumValidatorHandler struct{}

func (h *EnumValidatorHandler) Type() string { return string(AttrTypeEnum) }

func (h *EnumValidatorHandler) Build(a *Attribute) (Validator, error) {
	cfg := a.Validator
	if cfg == nil {
		return nil, fmt.Errorf("%w: missing 'values'", ErrInvalidValidatorConfig)
	}
	raw, ok := cfg["values"]
	if !ok {
		return nil, fmt.Errorf("%w: missing 'values'", ErrInvalidValidatorConfig)
	}
	list, ok := raw.([]any)
	if !ok {
		// Tolerate []string from hand-built configs.
		if strList, ok := raw.([]string); ok {
			return &EnumValidator{Allowed: strList}, nil
		}
		return nil, fmt.Errorf("%w: 'values' is not a list", ErrInvalidValidatorConfig)
	}
	allowed := make([]string, 0, len(list))
	for _, v := range list {
		s, ok := v.(string)
		if !ok {
			return nil, fmt.Errorf("%w: 'values' element %v is not a string", ErrInvalidValidatorConfig, v)
		}
		allowed = append(allowed, s)
	}
	return &EnumValidator{Allowed: allowed}, nil
}

// --- Range handler ---

// RangeValidatorHandler builds RangeValidator from Attribute.Validator["min"]
// and ["max"].
type RangeValidatorHandler struct{}

func (h *RangeValidatorHandler) Type() string { return string(AttrTypeInt) }

func (h *RangeValidatorHandler) Build(a *Attribute) (Validator, error) {
	cfg := a.Validator
	if cfg == nil {
		return nil, fmt.Errorf("%w: missing 'min'/'max'", ErrInvalidValidatorConfig)
	}
	minV, ok := cfg["min"]
	if !ok {
		return nil, fmt.Errorf("%w: missing 'min'", ErrInvalidValidatorConfig)
	}
	maxV, ok := cfg["max"]
	if !ok {
		return nil, fmt.Errorf("%w: missing 'max'", ErrInvalidValidatorConfig)
	}
	min, ok := toFloat64(minV)
	if !ok {
		return nil, fmt.Errorf("%w: 'min' is not a number", ErrInvalidValidatorConfig)
	}
	max, ok := toFloat64(maxV)
	if !ok {
		return nil, fmt.Errorf("%w: 'max' is not a number", ErrInvalidValidatorConfig)
	}
	return &RangeValidator{Min: min, Max: max}, nil
}

// --- Regex handler ---

// RegexValidatorHandler builds RegexValidator from Attribute.Validator["pattern"].
// The pattern is compiled at build time; syntax errors surface immediately.
type RegexValidatorHandler struct{}

func (h *RegexValidatorHandler) Type() string { return "regex" }

func (h *RegexValidatorHandler) Build(a *Attribute) (Validator, error) {
	cfg := a.Validator
	if cfg == nil {
		return nil, fmt.Errorf("%w: missing 'pattern'", ErrInvalidValidatorConfig)
	}
	src, ok := cfg["pattern"].(string)
	if !ok {
		return nil, fmt.Errorf("%w: 'pattern' is not a string", ErrInvalidValidatorConfig)
	}
	re, err := regexp.Compile(src)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrInvalidValidatorConfig, err)
	}
	return &RegexValidator{Pattern: re, Source: src}, nil
}

// --- CIRef handler ---

// CIRefValidatorHandler builds a CIRefValidator. The attribute config is
// ignored — FK existence is enforced at the DB layer.
type CIRefValidatorHandler struct{}

func (h *CIRefValidatorHandler) Type() string { return string(AttrTypeCIRef) }

func (h *CIRefValidatorHandler) Build(_ *Attribute) (Validator, error) {
	return &CIRefValidator{}, nil
}

// --- Pass handler ---

// PassValidatorHandler builds a PassValidator. Registered for AttrTypeString
// and AttrTypeJSON — types that accept any value shape.
type PassValidatorHandler struct {
	TypeAttr AttributeType
}

// NewPassValidatorHandlerFor creates a PassValidatorHandler bound to a
// specific attribute type.
func NewPassValidatorHandlerFor(t AttributeType) *PassValidatorHandler {
	return &PassValidatorHandler{TypeAttr: t}
}

func (h *PassValidatorHandler) Type() string { return string(h.TypeAttr) }

func (h *PassValidatorHandler) Build(_ *Attribute) (Validator, error) {
	return &PassValidator{}, nil
}
