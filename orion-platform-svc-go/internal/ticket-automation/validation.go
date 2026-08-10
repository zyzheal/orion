package ticketautomation

import (
    "fmt"
    "regexp"
    "strings"
)

type TicketAutomationValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultTicketAutomationValidator() *TicketAutomationValidator {
    return &TicketAutomationValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *TicketAutomationValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrTicketAutomationInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("ticket-automation: name too long") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("ticket-automation: invalid name")
    }
    return nil
}

func (v *TicketAutomationValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("ticket-automation: description too long") }
    return nil
}

func (v *TicketAutomationValidator) ValidateType(typ string) error {
    if typ == "" { return ErrTicketAutomationInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("ticket-automation: unsupported type")
}

func (v *TicketAutomationValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrTicketAutomationInvalidInput }
    return nil
}

type TicketAutomationValidationResult struct { Valid bool; Errors []string }

func (v *TicketAutomationValidator) Validate(name, desc, typ, id string) *TicketAutomationValidationResult {
    r := &TicketAutomationValidationResult{}
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
