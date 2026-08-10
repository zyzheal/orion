package workflowdependency

import (
    "fmt"
    "regexp"
    "strings"
)

type WorkflowDependencyValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultWorkflowDependencyValidator() *WorkflowDependencyValidator {
    return &WorkflowDependencyValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *WorkflowDependencyValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrWorkflowDependencyInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("workflow-dependency: name too long") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("workflow-dependency: invalid name")
    }
    return nil
}

func (v *WorkflowDependencyValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("workflow-dependency: description too long") }
    return nil
}

func (v *WorkflowDependencyValidator) ValidateType(typ string) error {
    if typ == "" { return ErrWorkflowDependencyInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("workflow-dependency: unsupported type")
}

func (v *WorkflowDependencyValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrWorkflowDependencyInvalidInput }
    return nil
}

type WorkflowDependencyValidationResult struct { Valid bool; Errors []string }

func (v *WorkflowDependencyValidator) Validate(name, desc, typ, id string) *WorkflowDependencyValidationResult {
    r := &WorkflowDependencyValidationResult{}
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
