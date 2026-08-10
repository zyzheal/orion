package handler

import (
    "fmt"
    "regexp"
    "strings"
)

type AlertCorrelationValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultAlertCorrelationValidator() *AlertCorrelationValidator {
    return &AlertCorrelationValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *AlertCorrelationValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrAlertCorrelationInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("alert-correlation: name too long") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("alert-correlation: invalid name")
    }
    return nil
}

func (v *AlertCorrelationValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("alert-correlation: description too long") }
    return nil
}

func (v *AlertCorrelationValidator) ValidateType(typ string) error {
    if typ == "" { return ErrAlertCorrelationInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("alert-correlation: unsupported type")
}

func (v *AlertCorrelationValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrAlertCorrelationInvalidInput }
    return nil
}

type AlertCorrelationValidationResult struct { Valid bool; Errors []string }

func (v *AlertCorrelationValidator) Validate(name, desc, typ, id string) *AlertCorrelationValidationResult {
    r := &AlertCorrelationValidationResult{}
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
