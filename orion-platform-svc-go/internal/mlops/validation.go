package mlops

import (
    "fmt"
    "regexp"
    "strings"
)

type MlopsValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultMlopsValidator() *MlopsValidator {
    return &MlopsValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *MlopsValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrMlopsInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("mlops: name too long") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("mlops: invalid name")
    }
    return nil
}

func (v *MlopsValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("mlops: description too long") }
    return nil
}

func (v *MlopsValidator) ValidateType(typ string) error {
    if typ == "" { return ErrMlopsInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("mlops: unsupported type")
}

func (v *MlopsValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrMlopsInvalidInput }
    return nil
}

type MlopsValidationResult struct { Valid bool; Errors []string }

func (v *MlopsValidator) Validate(name, desc, typ, id string) *MlopsValidationResult {
    r := &MlopsValidationResult{}
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
