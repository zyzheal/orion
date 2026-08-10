package globalparam

import (
    "fmt"
    "regexp"
    "strings"
)

type GlobalParamValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultGlobalParamValidator() *GlobalParamValidator {
    return &GlobalParamValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *GlobalParamValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrGlobalParamInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("global-param: name too long") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("global-param: invalid name")
    }
    return nil
}

func (v *GlobalParamValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("global-param: description too long") }
    return nil
}

func (v *GlobalParamValidator) ValidateType(typ string) error {
    if typ == "" { return ErrGlobalParamInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("global-param: unsupported type")
}

func (v *GlobalParamValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrGlobalParamInvalidInput }
    return nil
}

type GlobalParamValidationResult struct { Valid bool; Errors []string }

func (v *GlobalParamValidator) Validate(name, desc, typ, id string) *GlobalParamValidationResult {
    r := &GlobalParamValidationResult{}
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
