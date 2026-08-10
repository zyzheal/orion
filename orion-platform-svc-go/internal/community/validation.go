package community

import (
    "fmt"
    "regexp"
    "strings"
)

type CommunityValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultCommunityValidator() *CommunityValidator {
    return &CommunityValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *CommunityValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrCommunityInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("community: name too long") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("community: invalid name")
    }
    return nil
}

func (v *CommunityValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("community: description too long") }
    return nil
}

func (v *CommunityValidator) ValidateType(typ string) error {
    if typ == "" { return ErrCommunityInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("community: unsupported type")
}

func (v *CommunityValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrCommunityInvalidInput }
    return nil
}

type CommunityValidationResult struct { Valid bool; Errors []string }

func (v *CommunityValidator) Validate(name, desc, typ, id string) *CommunityValidationResult {
    r := &CommunityValidationResult{}
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
