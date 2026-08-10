package pipelinerunhistory

import (
    "fmt"
    "regexp"
    "strings"
)

type PipelineRunHistoryValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultPipelineRunHistoryValidator() *PipelineRunHistoryValidator {
    return &PipelineRunHistoryValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *PipelineRunHistoryValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrPipelineRunHistoryInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("pipeline-run-history: name too long") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("pipeline-run-history: invalid name")
    }
    return nil
}

func (v *PipelineRunHistoryValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("pipeline-run-history: description too long") }
    return nil
}

func (v *PipelineRunHistoryValidator) ValidateType(typ string) error {
    if typ == "" { return ErrPipelineRunHistoryInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("pipeline-run-history: unsupported type")
}

func (v *PipelineRunHistoryValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrPipelineRunHistoryInvalidInput }
    return nil
}

type PipelineRunHistoryValidationResult struct { Valid bool; Errors []string }

func (v *PipelineRunHistoryValidator) Validate(name, desc, typ, id string) *PipelineRunHistoryValidationResult {
    r := &PipelineRunHistoryValidationResult{}
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
