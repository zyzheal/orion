package dataclassification

import (
    "fmt"
    "regexp"
    "strings"
)

type DataClassificationValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultDataClassificationValidator() *DataClassificationValidator {
    return &DataClassificationValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *DataClassificationValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrDataClassificationInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("data-classification: name too long") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("data-classification: invalid name")
    }
    return nil
}

func (v *DataClassificationValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("data-classification: description too long") }
    return nil
}

func (v *DataClassificationValidator) ValidateType(typ string) error {
    if typ == "" { return ErrDataClassificationInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("data-classification: unsupported type")
}

func (v *DataClassificationValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrDataClassificationInvalidInput }
    return nil
}

type DataClassificationValidationResult struct { Valid bool; Errors []string }

func (v *DataClassificationValidator) Validate(name, desc, typ, id string) *DataClassificationValidationResult {
    r := &DataClassificationValidationResult{}
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
