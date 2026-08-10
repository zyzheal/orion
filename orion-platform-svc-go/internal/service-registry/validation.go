package serviceregistry

import (
    "fmt"
    "regexp"
    "strings"
)

type ServiceRegistryValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultServiceRegistryValidator() *ServiceRegistryValidator {
    return &ServiceRegistryValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *ServiceRegistryValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrServiceRegistryInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("service-registry: name too long") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("service-registry: invalid name")
    }
    return nil
}

func (v *ServiceRegistryValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("service-registry: description too long") }
    return nil
}

func (v *ServiceRegistryValidator) ValidateType(typ string) error {
    if typ == "" { return ErrServiceRegistryInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("service-registry: unsupported type")
}

func (v *ServiceRegistryValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrServiceRegistryInvalidInput }
    return nil
}

type ServiceRegistryValidationResult struct { Valid bool; Errors []string }

func (v *ServiceRegistryValidator) Validate(name, desc, typ, id string) *ServiceRegistryValidationResult {
    r := &ServiceRegistryValidationResult{}
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
