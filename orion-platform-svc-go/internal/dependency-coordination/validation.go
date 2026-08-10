package dependencycoordination

import (
    "fmt"
    "regexp"
    "strings"
)

type DependencyCoordinationValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultDependencyCoordinationValidator() *DependencyCoordinationValidator {
    return &DependencyCoordinationValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *DependencyCoordinationValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrDependencyCoordinationInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("dependency-coordination: name too long") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("dependency-coordination: invalid name")
    }
    return nil
}

func (v *DependencyCoordinationValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("dependency-coordination: description too long") }
    return nil
}

func (v *DependencyCoordinationValidator) ValidateType(typ string) error {
    if typ == "" { return ErrDependencyCoordinationInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("dependency-coordination: unsupported type")
}

func (v *DependencyCoordinationValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrDependencyCoordinationInvalidInput }
    return nil
}

type DependencyCoordinationValidationResult struct { Valid bool; Errors []string }

func (v *DependencyCoordinationValidator) Validate(name, desc, typ, id string) *DependencyCoordinationValidationResult {
    r := &DependencyCoordinationValidationResult{}
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
