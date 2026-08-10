package apikey

import (
    "fmt"
    "regexp"
    "strings"
)

type ApiKeyValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultApiKeyValidator() *ApiKeyValidator {
    return &ApiKeyValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *ApiKeyValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrApiKeyInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("api-key: name too long") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("api-key: invalid name")
    }
    return nil
}

func (v *ApiKeyValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("api-key: description too long") }
    return nil
}

func (v *ApiKeyValidator) ValidateType(typ string) error {
    if typ == "" { return ErrApiKeyInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("api-key: unsupported type")
}

func (v *ApiKeyValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrApiKeyInvalidInput }
    return nil
}

type ApiKeyValidationResult struct { Valid bool; Errors []string }

func (v *ApiKeyValidator) Validate(name, desc, typ, id string) *ApiKeyValidationResult {
    r := &ApiKeyValidationResult{}
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
