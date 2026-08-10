package alertdeduplication

import (
    "fmt"
    "regexp"
    "strings"
)

type AlertDeduplicationValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultAlertDeduplicationValidator() *AlertDeduplicationValidator {
    return &AlertDeduplicationValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *AlertDeduplicationValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrAlertDeduplicationInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("alert-deduplication: name too long") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("alert-deduplication: invalid name")
    }
    return nil
}

func (v *AlertDeduplicationValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("alert-deduplication: description too long") }
    return nil
}

func (v *AlertDeduplicationValidator) ValidateType(typ string) error {
    if typ == "" { return ErrAlertDeduplicationInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("alert-deduplication: unsupported type")
}

func (v *AlertDeduplicationValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrAlertDeduplicationInvalidInput }
    return nil
}

type AlertDeduplicationValidationResult struct { Valid bool; Errors []string }

func (v *AlertDeduplicationValidator) Validate(name, desc, typ, id string) *AlertDeduplicationValidationResult {
    r := &AlertDeduplicationValidationResult{}
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
