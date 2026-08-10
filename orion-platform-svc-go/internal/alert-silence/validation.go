package alertsilence

import (
    "fmt"
    "regexp"
    "strings"
)

type AlertSilenceValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultAlertSilenceValidator() *AlertSilenceValidator {
    return &AlertSilenceValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *AlertSilenceValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrAlertSilenceInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("alert-silence: name too long") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("alert-silence: invalid name")
    }
    return nil
}

func (v *AlertSilenceValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("alert-silence: description too long") }
    return nil
}

func (v *AlertSilenceValidator) ValidateType(typ string) error {
    if typ == "" { return ErrAlertSilenceInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("alert-silence: unsupported type")
}

func (v *AlertSilenceValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrAlertSilenceInvalidInput }
    return nil
}

type AlertSilenceValidationResult struct { Valid bool; Errors []string }

func (v *AlertSilenceValidator) Validate(name, desc, typ, id string) *AlertSilenceValidationResult {
    r := &AlertSilenceValidationResult{}
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
