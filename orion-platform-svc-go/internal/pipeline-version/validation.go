package pipelineversion

import (
    "fmt"
    "regexp"
    "strings"
)

type PipelineVersionValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultPipelineVersionValidator() *PipelineVersionValidator {
    return &PipelineVersionValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *PipelineVersionValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrPipelineVersionInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("pipeline-version: name too long") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("pipeline-version: invalid name")
    }
    return nil
}

func (v *PipelineVersionValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("pipeline-version: description too long") }
    return nil
}

func (v *PipelineVersionValidator) ValidateType(typ string) error {
    if typ == "" { return ErrPipelineVersionInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("pipeline-version: unsupported type")
}

func (v *PipelineVersionValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrPipelineVersionInvalidInput }
    return nil
}

type PipelineVersionValidationResult struct { Valid bool; Errors []string }

func (v *PipelineVersionValidator) Validate(name, desc, typ, id string) *PipelineVersionValidationResult {
    r := &PipelineVersionValidationResult{}
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
