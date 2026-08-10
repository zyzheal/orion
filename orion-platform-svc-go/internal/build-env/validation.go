package buildenv

import (
    "fmt"
    "regexp"
    "strings"
)

type BuildEnvValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultBuildEnvValidator() *BuildEnvValidator {
    return &BuildEnvValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *BuildEnvValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrBuildEnvInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("build-env: name exceeds max length") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("build-env: invalid name characters")
    }
    return nil
}

func (v *BuildEnvValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("build-env: description too long") }
    return nil
}

func (v *BuildEnvValidator) ValidateType(typ string) error {
    if typ == "" { return ErrBuildEnvInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("build-env: unsupported type")
}

func (v *BuildEnvValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrBuildEnvInvalidInput }
    return nil
}

type BuildEnvValidationResult struct { Valid bool; Errors []string }

func (v *BuildEnvValidator) Validate(name, desc, typ, id string) *BuildEnvValidationResult {
    r := &BuildEnvValidationResult{}
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
