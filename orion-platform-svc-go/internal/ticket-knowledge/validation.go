package ticketknowledge

import (
    "fmt"
    "regexp"
    "strings"
)

type TicketKnowledgeValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultTicketKnowledgeValidator() *TicketKnowledgeValidator {
    return &TicketKnowledgeValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *TicketKnowledgeValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrTicketKnowledgeInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("ticket-knowledge: name too long") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("ticket-knowledge: invalid name")
    }
    return nil
}

func (v *TicketKnowledgeValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("ticket-knowledge: description too long") }
    return nil
}

func (v *TicketKnowledgeValidator) ValidateType(typ string) error {
    if typ == "" { return ErrTicketKnowledgeInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("ticket-knowledge: unsupported type")
}

func (v *TicketKnowledgeValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrTicketKnowledgeInvalidInput }
    return nil
}

type TicketKnowledgeValidationResult struct { Valid bool; Errors []string }

func (v *TicketKnowledgeValidator) Validate(name, desc, typ, id string) *TicketKnowledgeValidationResult {
    r := &TicketKnowledgeValidationResult{}
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
