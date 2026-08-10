package pandawiki

import (
    "fmt"
    "regexp"
    "strings"
)

type PandawikiValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultPandawikiValidator() *PandawikiValidator {
    return &PandawikiValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *PandawikiValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrPandawikiInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("pandawiki: name too long") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("pandawiki: invalid name")
    }
    return nil
}

func (v *PandawikiValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("pandawiki: description too long") }
    return nil
}

func (v *PandawikiValidator) ValidateType(typ string) error {
    if typ == "" { return ErrPandawikiInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("pandawiki: unsupported type")
}

func (v *PandawikiValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrPandawikiInvalidInput }
    return nil
}

type PandawikiValidationResult struct { Valid bool; Errors []string }

func (v *PandawikiValidator) Validate(name, desc, typ, id string) *PandawikiValidationResult {
    r := &PandawikiValidationResult{}
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
