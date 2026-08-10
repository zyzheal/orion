package workflowtrigger

import (
    "fmt"
    "regexp"
    "strings"
)

type WorkflowTriggerValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultWorkflowTriggerValidator() *WorkflowTriggerValidator {
    return &WorkflowTriggerValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *WorkflowTriggerValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrWorkflowTriggerInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("workflow-trigger: name too long") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("workflow-trigger: invalid name")
    }
    return nil
}

func (v *WorkflowTriggerValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("workflow-trigger: description too long") }
    return nil
}

func (v *WorkflowTriggerValidator) ValidateType(typ string) error {
    if typ == "" { return ErrWorkflowTriggerInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("workflow-trigger: unsupported type")
}

func (v *WorkflowTriggerValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrWorkflowTriggerInvalidInput }
    return nil
}

type WorkflowTriggerValidationResult struct { Valid bool; Errors []string }

func (v *WorkflowTriggerValidator) Validate(name, desc, typ, id string) *WorkflowTriggerValidationResult {
    r := &WorkflowTriggerValidationResult{}
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
