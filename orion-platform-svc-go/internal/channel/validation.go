package channel

import (
    "fmt"
    "regexp"
    "strings"
)

type ChannelValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultChannelValidator() *ChannelValidator {
    return &ChannelValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *ChannelValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrChannelInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("channel: name too long") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("channel: invalid name")
    }
    return nil
}

func (v *ChannelValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("channel: description too long") }
    return nil
}

func (v *ChannelValidator) ValidateType(typ string) error {
    if typ == "" { return ErrChannelInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("channel: unsupported type")
}

func (v *ChannelValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrChannelInvalidInput }
    return nil
}

type ChannelValidationResult struct { Valid bool; Errors []string }

func (v *ChannelValidator) Validate(name, desc, typ, id string) *ChannelValidationResult {
    r := &ChannelValidationResult{}
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
