package incidentaction

import (
    "fmt"
    "regexp"
    "strings"
)

type IncidentActionValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultIncidentActionValidator() *IncidentActionValidator {
    return &IncidentActionValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *IncidentActionValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrIncidentActionInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("incident-action: name too long") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("incident-action: invalid name")
    }
    return nil
}

func (v *IncidentActionValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("incident-action: description too long") }
    return nil
}

func (v *IncidentActionValidator) ValidateType(typ string) error {
    if typ == "" { return ErrIncidentActionInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("incident-action: unsupported type")
}

func (v *IncidentActionValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrIncidentActionInvalidInput }
    return nil
}

type IncidentActionValidationResult struct { Valid bool; Errors []string }

func (v *IncidentActionValidator) Validate(name, desc, typ, id string) *IncidentActionValidationResult {
    r := &IncidentActionValidationResult{}
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
