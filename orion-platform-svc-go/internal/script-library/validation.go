package scriptlibrary

import (
    "fmt"
    "regexp"
    "strings"
)

type ScriptLibraryValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultScriptLibraryValidator() *ScriptLibraryValidator {
    return &ScriptLibraryValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *ScriptLibraryValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrScriptLibraryInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("script-library: name too long") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("script-library: invalid name")
    }
    return nil
}

func (v *ScriptLibraryValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("script-library: description too long") }
    return nil
}

func (v *ScriptLibraryValidator) ValidateType(typ string) error {
    if typ == "" { return ErrScriptLibraryInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("script-library: unsupported type")
}

func (v *ScriptLibraryValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrScriptLibraryInvalidInput }
    return nil
}

type ScriptLibraryValidationResult struct { Valid bool; Errors []string }

func (v *ScriptLibraryValidator) Validate(name, desc, typ, id string) *ScriptLibraryValidationResult {
    r := &ScriptLibraryValidationResult{}
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
