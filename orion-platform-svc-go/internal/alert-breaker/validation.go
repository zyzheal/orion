package alertbreaker

import (
    "fmt"
    "regexp"
    "strings"
)

type AlertBreakerValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultAlertBreakerValidator() *AlertBreakerValidator {
    return &AlertBreakerValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *AlertBreakerValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrAlertBreakerInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("alert-breaker: name too long") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("alert-breaker: invalid name")
    }
    return nil
}

func (v *AlertBreakerValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("alert-breaker: description too long") }
    return nil
}

func (v *AlertBreakerValidator) ValidateType(typ string) error {
    if typ == "" { return ErrAlertBreakerInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("alert-breaker: unsupported type")
}

func (v *AlertBreakerValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrAlertBreakerInvalidInput }
    return nil
}

type AlertBreakerValidationResult struct { Valid bool; Errors []string }

func (v *AlertBreakerValidator) Validate(name, desc, typ, id string) *AlertBreakerValidationResult {
    r := &AlertBreakerValidationResult{}
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
