package circuitbreaker

import (
    "fmt"
    "regexp"
    "strings"
)

type CircuitBreakerValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultCircuitBreakerValidator() *CircuitBreakerValidator {
    return &CircuitBreakerValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *CircuitBreakerValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrCircuitBreakerInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("circuit-breaker: name too long") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("circuit-breaker: invalid name")
    }
    return nil
}

func (v *CircuitBreakerValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("circuit-breaker: description too long") }
    return nil
}

func (v *CircuitBreakerValidator) ValidateType(typ string) error {
    if typ == "" { return ErrCircuitBreakerInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("circuit-breaker: unsupported type")
}

func (v *CircuitBreakerValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrCircuitBreakerInvalidInput }
    return nil
}

type CircuitBreakerValidationResult struct { Valid bool; Errors []string }

func (v *CircuitBreakerValidator) Validate(name, desc, typ, id string) *CircuitBreakerValidationResult {
    r := &CircuitBreakerValidationResult{}
    checks := []struct{ field string; fn func() error }{
        {"name", func() error { return v.ValidateName(name) } },
        {"description", func() error { return v.ValidateDescription(desc) } },
        {"type", func() error { return v.ValidateType(typ) } },
        {"id", func() error { return v.ValidateID(id) } },
    }
    for _, c := range checks {
        if err := c.fn(); err != nil { r.Errors = append(r.Errors, c.field+": "+err.Error()) }
    }
    r.Valid = len(r.Errors) == 0
    return r
}
