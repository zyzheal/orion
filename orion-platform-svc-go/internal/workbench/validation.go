package workbench

import (
    "fmt"
    "regexp"
    "strings"
)

type WorkbenchValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultWorkbenchValidator() *WorkbenchValidator {
    return &WorkbenchValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *WorkbenchValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrWorkbenchInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("workbench: name too long") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("workbench: invalid name")
    }
    return nil
}

func (v *WorkbenchValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("workbench: description too long") }
    return nil
}

func (v *WorkbenchValidator) ValidateType(typ string) error {
    if typ == "" { return ErrWorkbenchInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("workbench: unsupported type")
}

func (v *WorkbenchValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrWorkbenchInvalidInput }
    return nil
}

type WorkbenchValidationResult struct { Valid bool; Errors []string }

func (v *WorkbenchValidator) Validate(name, desc, typ, id string) *WorkbenchValidationResult {
    r := &WorkbenchValidationResult{}
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
