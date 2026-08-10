package multicloud

import (
    "fmt"
    "regexp"
    "strings"
)

type MultiCloudValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultMultiCloudValidator() *MultiCloudValidator {
    return &MultiCloudValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *MultiCloudValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrMultiCloudInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("multi-cloud: name exceeds max length") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("multi-cloud: invalid name characters")
    }
    return nil
}

func (v *MultiCloudValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("multi-cloud: description too long") }
    return nil
}

func (v *MultiCloudValidator) ValidateType(typ string) error {
    if typ == "" { return ErrMultiCloudInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("multi-cloud: unsupported type")
}

func (v *MultiCloudValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrMultiCloudInvalidInput }
    return nil
}

type MultiCloudValidationResult struct { Valid bool; Errors []string }

func (v *MultiCloudValidator) Validate(name, desc, typ, id string) *MultiCloudValidationResult {
    r := &MultiCloudValidationResult{}
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
