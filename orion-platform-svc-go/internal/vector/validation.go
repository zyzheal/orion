package vector

import (
    "fmt"
    "regexp"
    "strings"
)

type VectorValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultVectorValidator() *VectorValidator {
    return &VectorValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *VectorValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrVectorInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("vector: name too long") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("vector: invalid name")
    }
    return nil
}

func (v *VectorValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("vector: description too long") }
    return nil
}

func (v *VectorValidator) ValidateType(typ string) error {
    if typ == "" { return ErrVectorInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("vector: unsupported type")
}

func (v *VectorValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrVectorInvalidInput }
    return nil
}

type VectorValidationResult struct { Valid bool; Errors []string }

func (v *VectorValidator) Validate(name, desc, typ, id string) *VectorValidationResult {
    r := &VectorValidationResult{}
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
