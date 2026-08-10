package i18n

import (
    "fmt"
    "regexp"
    "strings"
)

type I18nValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultI18nValidator() *I18nValidator {
    return &I18nValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *I18nValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrI18nInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("i18n: name too long") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("i18n: invalid name")
    }
    return nil
}

func (v *I18nValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("i18n: description too long") }
    return nil
}

func (v *I18nValidator) ValidateType(typ string) error {
    if typ == "" { return ErrI18nInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("i18n: unsupported type")
}

func (v *I18nValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrI18nInvalidInput }
    return nil
}

type I18nValidationResult struct { Valid bool; Errors []string }

func (v *I18nValidator) Validate(name, desc, typ, id string) *I18nValidationResult {
    r := &I18nValidationResult{}
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
