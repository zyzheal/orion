package eventtriggerregistry

import (
    "fmt"
    "regexp"
    "strings"
)

type EventTriggerRegistryValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultEventTriggerRegistryValidator() *EventTriggerRegistryValidator {
    return &EventTriggerRegistryValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *EventTriggerRegistryValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrEventTriggerRegistryInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("event-trigger-registry: name too long") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("event-trigger-registry: invalid name")
    }
    return nil
}

func (v *EventTriggerRegistryValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("event-trigger-registry: description too long") }
    return nil
}

func (v *EventTriggerRegistryValidator) ValidateType(typ string) error {
    if typ == "" { return ErrEventTriggerRegistryInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("event-trigger-registry: unsupported type")
}

func (v *EventTriggerRegistryValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrEventTriggerRegistryInvalidInput }
    return nil
}

type EventTriggerRegistryValidationResult struct { Valid bool; Errors []string }

func (v *EventTriggerRegistryValidator) Validate(name, desc, typ, id string) *EventTriggerRegistryValidationResult {
    r := &EventTriggerRegistryValidationResult{}
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
