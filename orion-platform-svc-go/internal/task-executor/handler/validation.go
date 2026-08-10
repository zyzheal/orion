package handler

import (
    "fmt"
    "regexp"
    "strings"
)

type TaskExecutorValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultTaskExecutorValidator() *TaskExecutorValidator {
    return &TaskExecutorValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *TaskExecutorValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrTaskExecutorInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("task-executor: name too long") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("task-executor: invalid name")
    }
    return nil
}

func (v *TaskExecutorValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("task-executor: description too long") }
    return nil
}

func (v *TaskExecutorValidator) ValidateType(typ string) error {
    if typ == "" { return ErrTaskExecutorInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("task-executor: unsupported type")
}

func (v *TaskExecutorValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrTaskExecutorInvalidInput }
    return nil
}

type TaskExecutorValidationResult struct { Valid bool; Errors []string }

func (v *TaskExecutorValidator) Validate(name, desc, typ, id string) *TaskExecutorValidationResult {
    r := &TaskExecutorValidationResult{}
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
