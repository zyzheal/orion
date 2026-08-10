package pipelinebatch

import (
    "fmt"
    "regexp"
    "strings"
)

type PipelineBatchValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultPipelineBatchValidator() *PipelineBatchValidator {
    return &PipelineBatchValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *PipelineBatchValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrPipelineBatchInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("pipeline-batch: name too long") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("pipeline-batch: invalid name")
    }
    return nil
}

func (v *PipelineBatchValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("pipeline-batch: description too long") }
    return nil
}

func (v *PipelineBatchValidator) ValidateType(typ string) error {
    if typ == "" { return ErrPipelineBatchInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("pipeline-batch: unsupported type")
}

func (v *PipelineBatchValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrPipelineBatchInvalidInput }
    return nil
}

type PipelineBatchValidationResult struct { Valid bool; Errors []string }

func (v *PipelineBatchValidator) Validate(name, desc, typ, id string) *PipelineBatchValidationResult {
    r := &PipelineBatchValidationResult{}
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
