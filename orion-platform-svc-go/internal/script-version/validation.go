package scriptversion

import (
    "fmt"
    "regexp"
    "strings"
)

type ScriptVersionValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultScriptVersionValidator() *ScriptVersionValidator {
    return &ScriptVersionValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *ScriptVersionValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrScriptVersionInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("script-version: name too long") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("script-version: invalid name")
    }
    return nil
}

func (v *ScriptVersionValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("script-version: description too long") }
    return nil
}

func (v *ScriptVersionValidator) ValidateType(typ string) error {
    if typ == "" { return ErrScriptVersionInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("script-version: unsupported type")
}

func (v *ScriptVersionValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrScriptVersionInvalidInput }
    return nil
}

type ScriptVersionValidationResult struct { Valid bool; Errors []string }

func (v *ScriptVersionValidator) Validate(name, desc, typ, id string) *ScriptVersionValidationResult {
    r := &ScriptVersionValidationResult{}
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
