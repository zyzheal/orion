package pipelineerrordetail

import (
    "fmt"
    "regexp"
    "strings"
)

type PipelineErrorDetailValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultPipelineErrorDetailValidator() *PipelineErrorDetailValidator {
    return &PipelineErrorDetailValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *PipelineErrorDetailValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrPipelineErrorDetailInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("pipeline-error-detail: name too long") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("pipeline-error-detail: invalid name")
    }
    return nil
}

func (v *PipelineErrorDetailValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("pipeline-error-detail: description too long") }
    return nil
}

func (v *PipelineErrorDetailValidator) ValidateType(typ string) error {
    if typ == "" { return ErrPipelineErrorDetailInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("pipeline-error-detail: unsupported type")
}

func (v *PipelineErrorDetailValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrPipelineErrorDetailInvalidInput }
    return nil
}

type PipelineErrorDetailValidationResult struct { Valid bool; Errors []string }

func (v *PipelineErrorDetailValidator) Validate(name, desc, typ, id string) *PipelineErrorDetailValidationResult {
    r := &PipelineErrorDetailValidationResult{}
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
