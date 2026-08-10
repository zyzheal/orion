package topology

import (
    "fmt"
    "regexp"
    "strings"
)

type TopologyValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultTopologyValidator() *TopologyValidator {
    return &TopologyValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *TopologyValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrTopologyInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("topology: name too long") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("topology: invalid name")
    }
    return nil
}

func (v *TopologyValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("topology: description too long") }
    return nil
}

func (v *TopologyValidator) ValidateType(typ string) error {
    if typ == "" { return ErrTopologyInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("topology: unsupported type")
}

func (v *TopologyValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrTopologyInvalidInput }
    return nil
}

type TopologyValidationResult struct { Valid bool; Errors []string }

func (v *TopologyValidator) Validate(name, desc, typ, id string) *TopologyValidationResult {
    r := &TopologyValidationResult{}
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
