package pipelinesse

import (
    "fmt"
    "regexp"
    "strings"
)

type PipelineSseValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultPipelineSseValidator() *PipelineSseValidator {
    return &PipelineSseValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *PipelineSseValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrPipelineSseInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("pipeline-sse: name too long") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("pipeline-sse: invalid name")
    }
    return nil
}

func (v *PipelineSseValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("pipeline-sse: description too long") }
    return nil
}

func (v *PipelineSseValidator) ValidateType(typ string) error {
    if typ == "" { return ErrPipelineSseInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("pipeline-sse: unsupported type")
}

func (v *PipelineSseValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrPipelineSseInvalidInput }
    return nil
}

type PipelineSseValidationResult struct { Valid bool; Errors []string }

func (v *PipelineSseValidator) Validate(name, desc, typ, id string) *PipelineSseValidationResult {
    r := &PipelineSseValidationResult{}
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
