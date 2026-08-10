package datapipeline

import (
    "fmt"
    "regexp"
    "strings"
)

type DataPipelineValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultDataPipelineValidator() *DataPipelineValidator {
    return &DataPipelineValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *DataPipelineValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrDataPipelineInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("data-pipeline: name too long") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("data-pipeline: invalid name")
    }
    return nil
}

func (v *DataPipelineValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("data-pipeline: description too long") }
    return nil
}

func (v *DataPipelineValidator) ValidateType(typ string) error {
    if typ == "" { return ErrDataPipelineInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("data-pipeline: unsupported type")
}

func (v *DataPipelineValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrDataPipelineInvalidInput }
    return nil
}

type DataPipelineValidationResult struct { Valid bool; Errors []string }

func (v *DataPipelineValidator) Validate(name, desc, typ, id string) *DataPipelineValidationResult {
    r := &DataPipelineValidationResult{}
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
