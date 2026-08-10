package approval

import (
    "fmt"
    "regexp"
    "strings"
)

type ApprovalValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultApprovalValidator() *ApprovalValidator {
    return &ApprovalValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *ApprovalValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrApprovalInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("approval: name exceeds max length") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("approval: invalid name characters")
    }
    return nil
}

func (v *ApprovalValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("approval: description too long") }
    return nil
}

func (v *ApprovalValidator) ValidateType(typ string) error {
    if typ == "" { return ErrApprovalInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("approval: unsupported type")
}

func (v *ApprovalValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrApprovalInvalidInput }
    return nil
}

type ApprovalValidationResult struct { Valid bool; Errors []string }

func (v *ApprovalValidator) Validate(name, desc, typ, id string) *ApprovalValidationResult {
    r := &ApprovalValidationResult{}
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
