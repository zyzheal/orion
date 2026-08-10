package workflowtask

import (
    "fmt"
    "regexp"
    "strings"
)

type WorkflowTaskValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultWorkflowTaskValidator() *WorkflowTaskValidator {
    return &WorkflowTaskValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *WorkflowTaskValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrWorkflowTaskInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("workflow-task: name too long") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("workflow-task: invalid name")
    }
    return nil
}

func (v *WorkflowTaskValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("workflow-task: description too long") }
    return nil
}

func (v *WorkflowTaskValidator) ValidateType(typ string) error {
    if typ == "" { return ErrWorkflowTaskInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("workflow-task: unsupported type")
}

func (v *WorkflowTaskValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrWorkflowTaskInvalidInput }
    return nil
}

type WorkflowTaskValidationResult struct { Valid bool; Errors []string }

func (v *WorkflowTaskValidator) Validate(name, desc, typ, id string) *WorkflowTaskValidationResult {
    r := &WorkflowTaskValidationResult{}
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
