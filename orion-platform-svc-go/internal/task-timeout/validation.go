package tasktimeout

import (
    "fmt"
    "regexp"
    "strings"
)

type TaskTimeoutValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultTaskTimeoutValidator() *TaskTimeoutValidator {
    return &TaskTimeoutValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *TaskTimeoutValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrTaskTimeoutInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("task-timeout: name too long") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("task-timeout: invalid name")
    }
    return nil
}

func (v *TaskTimeoutValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("task-timeout: description too long") }
    return nil
}

func (v *TaskTimeoutValidator) ValidateType(typ string) error {
    if typ == "" { return ErrTaskTimeoutInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("task-timeout: unsupported type")
}

func (v *TaskTimeoutValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrTaskTimeoutInvalidInput }
    return nil
}

type TaskTimeoutValidationResult struct { Valid bool; Errors []string }

func (v *TaskTimeoutValidator) Validate(name, desc, typ, id string) *TaskTimeoutValidationResult {
    r := &TaskTimeoutValidationResult{}
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
