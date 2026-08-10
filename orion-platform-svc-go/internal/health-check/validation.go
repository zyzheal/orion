package healthcheck

import (
    "fmt"
    "regexp"
    "strings"
)

type HealthCheckValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultHealthCheckValidator() *HealthCheckValidator {
    return &HealthCheckValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *HealthCheckValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrHealthCheckInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("health-check: name too long") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("health-check: invalid name")
    }
    return nil
}

func (v *HealthCheckValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("health-check: description too long") }
    return nil
}

func (v *HealthCheckValidator) ValidateType(typ string) error {
    if typ == "" { return ErrHealthCheckInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("health-check: unsupported type")
}

func (v *HealthCheckValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrHealthCheckInvalidInput }
    return nil
}

type HealthCheckValidationResult struct { Valid bool; Errors []string }

func (v *HealthCheckValidator) Validate(name, desc, typ, id string) *HealthCheckValidationResult {
    r := &HealthCheckValidationResult{}
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
