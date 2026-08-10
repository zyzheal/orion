package terminalaudit

import (
    "fmt"
    "regexp"
    "strings"
)

type TerminalAuditValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultTerminalAuditValidator() *TerminalAuditValidator {
    return &TerminalAuditValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *TerminalAuditValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrTerminalAuditInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("terminal-audit: name too long") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("terminal-audit: invalid name")
    }
    return nil
}

func (v *TerminalAuditValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("terminal-audit: description too long") }
    return nil
}

func (v *TerminalAuditValidator) ValidateType(typ string) error {
    if typ == "" { return ErrTerminalAuditInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("terminal-audit: unsupported type")
}

func (v *TerminalAuditValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrTerminalAuditInvalidInput }
    return nil
}

type TerminalAuditValidationResult struct { Valid bool; Errors []string }

func (v *TerminalAuditValidator) Validate(name, desc, typ, id string) *TerminalAuditValidationResult {
    r := &TerminalAuditValidationResult{}
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
