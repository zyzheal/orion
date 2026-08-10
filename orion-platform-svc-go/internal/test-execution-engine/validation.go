package testexecutionengine

import (
    "fmt"
    "regexp"
    "strings"
)

type TestExecutionEngineValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultTestExecutionEngineValidator() *TestExecutionEngineValidator {
    return &TestExecutionEngineValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *TestExecutionEngineValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrTestExecutionEngineInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("test-execution-engine: name too long") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("test-execution-engine: invalid name")
    }
    return nil
}

func (v *TestExecutionEngineValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("test-execution-engine: description too long") }
    return nil
}

func (v *TestExecutionEngineValidator) ValidateType(typ string) error {
    if typ == "" { return ErrTestExecutionEngineInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("test-execution-engine: unsupported type")
}

func (v *TestExecutionEngineValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrTestExecutionEngineInvalidInput }
    return nil
}

type TestExecutionEngineValidationResult struct { Valid bool; Errors []string }

func (v *TestExecutionEngineValidator) Validate(name, desc, typ, id string) *TestExecutionEngineValidationResult {
    r := &TestExecutionEngineValidationResult{}
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
