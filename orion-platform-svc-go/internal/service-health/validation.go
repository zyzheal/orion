package servicehealth

import (
    "fmt"
    "regexp"
    "strings"
)

type ServiceHealthValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultServiceHealthValidator() *ServiceHealthValidator {
    return &ServiceHealthValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *ServiceHealthValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrServiceHealthInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("service-health: name too long") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("service-health: invalid name")
    }
    return nil
}

func (v *ServiceHealthValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("service-health: description too long") }
    return nil
}

func (v *ServiceHealthValidator) ValidateType(typ string) error {
    if typ == "" { return ErrServiceHealthInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("service-health: unsupported type")
}

func (v *ServiceHealthValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrServiceHealthInvalidInput }
    return nil
}

type ServiceHealthValidationResult struct { Valid bool; Errors []string }

func (v *ServiceHealthValidator) Validate(name, desc, typ, id string) *ServiceHealthValidationResult {
    r := &ServiceHealthValidationResult{}
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
