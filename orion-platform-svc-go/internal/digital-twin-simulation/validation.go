package digitaltwinsimulation

import (
    "fmt"
    "regexp"
    "strings"
)

type DigitalTwinSimulationValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultDigitalTwinSimulationValidator() *DigitalTwinSimulationValidator {
    return &DigitalTwinSimulationValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *DigitalTwinSimulationValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrDigitalTwinSimulationInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("digital-twin-simulation: name exceeds max length") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("digital-twin-simulation: invalid name characters")
    }
    return nil
}

func (v *DigitalTwinSimulationValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("digital-twin-simulation: description too long") }
    return nil
}

func (v *DigitalTwinSimulationValidator) ValidateType(typ string) error {
    if typ == "" { return ErrDigitalTwinSimulationInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("digital-twin-simulation: unsupported type")
}

func (v *DigitalTwinSimulationValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrDigitalTwinSimulationInvalidInput }
    return nil
}

type DigitalTwinSimulationValidationResult struct { Valid bool; Errors []string }

func (v *DigitalTwinSimulationValidator) Validate(name, desc, typ, id string) *DigitalTwinSimulationValidationResult {
    r := &DigitalTwinSimulationValidationResult{}
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
