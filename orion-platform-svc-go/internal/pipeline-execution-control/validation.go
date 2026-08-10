package pipelineexecutioncontrol

import (
    "fmt"
    "regexp"
    "strings"
)

type PipelineExecutionControlValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultPipelineExecutionControlValidator() *PipelineExecutionControlValidator {
    return &PipelineExecutionControlValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *PipelineExecutionControlValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrPipelineExecutionControlInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("pipeline-execution-control: name too long") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("pipeline-execution-control: invalid name")
    }
    return nil
}

func (v *PipelineExecutionControlValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("pipeline-execution-control: description too long") }
    return nil
}

func (v *PipelineExecutionControlValidator) ValidateType(typ string) error {
    if typ == "" { return ErrPipelineExecutionControlInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("pipeline-execution-control: unsupported type")
}

func (v *PipelineExecutionControlValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrPipelineExecutionControlInvalidInput }
    return nil
}

type PipelineExecutionControlValidationResult struct { Valid bool; Errors []string }

func (v *PipelineExecutionControlValidator) Validate(name, desc, typ, id string) *PipelineExecutionControlValidationResult {
    r := &PipelineExecutionControlValidationResult{}
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
