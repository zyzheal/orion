package runbook

import (
    "fmt"
    "regexp"
    "strings"
)

type RunbookValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultRunbookValidator() *RunbookValidator {
    return &RunbookValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *RunbookValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrRunbookInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("runbook: name too long") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("runbook: invalid name")
    }
    return nil
}

func (v *RunbookValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("runbook: description too long") }
    return nil
}

func (v *RunbookValidator) ValidateType(typ string) error {
    if typ == "" { return ErrRunbookInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("runbook: unsupported type")
}

func (v *RunbookValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrRunbookInvalidInput }
    return nil
}

type RunbookValidationResult struct { Valid bool; Errors []string }

func (v *RunbookValidator) Validate(name, desc, typ, id string) *RunbookValidationResult {
    r := &RunbookValidationResult{}
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
