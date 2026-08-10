package sprint

import (
    "fmt"
    "regexp"
    "strings"
)

type SprintValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultSprintValidator() *SprintValidator {
    return &SprintValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *SprintValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrSprintInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("sprint: name too long") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("sprint: invalid name")
    }
    return nil
}

func (v *SprintValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("sprint: description too long") }
    return nil
}

func (v *SprintValidator) ValidateType(typ string) error {
    if typ == "" { return ErrSprintInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("sprint: unsupported type")
}

func (v *SprintValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrSprintInvalidInput }
    return nil
}

type SprintValidationResult struct { Valid bool; Errors []string }

func (v *SprintValidator) Validate(name, desc, typ, id string) *SprintValidationResult {
    r := &SprintValidationResult{}
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
