package pipelineauditlog

import (
    "fmt"
    "regexp"
    "strings"
)

type PipelineAuditLogValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultPipelineAuditLogValidator() *PipelineAuditLogValidator {
    return &PipelineAuditLogValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *PipelineAuditLogValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrPipelineAuditLogInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("pipeline-audit-log: name too long") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("pipeline-audit-log: invalid name")
    }
    return nil
}

func (v *PipelineAuditLogValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("pipeline-audit-log: description too long") }
    return nil
}

func (v *PipelineAuditLogValidator) ValidateType(typ string) error {
    if typ == "" { return ErrPipelineAuditLogInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("pipeline-audit-log: unsupported type")
}

func (v *PipelineAuditLogValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrPipelineAuditLogInvalidInput }
    return nil
}

type PipelineAuditLogValidationResult struct { Valid bool; Errors []string }

func (v *PipelineAuditLogValidator) Validate(name, desc, typ, id string) *PipelineAuditLogValidationResult {
    r := &PipelineAuditLogValidationResult{}
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
