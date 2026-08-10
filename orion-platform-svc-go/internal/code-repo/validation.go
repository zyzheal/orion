package coderepo

import (
    "fmt"
    "regexp"
    "strings"
)

type CodeRepoValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultCodeRepoValidator() *CodeRepoValidator {
    return &CodeRepoValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *CodeRepoValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrCodeRepoInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("code-repo: name exceeds max length") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("code-repo: invalid name characters")
    }
    return nil
}

func (v *CodeRepoValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("code-repo: description too long") }
    return nil
}

func (v *CodeRepoValidator) ValidateType(typ string) error {
    if typ == "" { return ErrCodeRepoInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("code-repo: unsupported type")
}

func (v *CodeRepoValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrCodeRepoInvalidInput }
    return nil
}

type CodeRepoValidationResult struct { Valid bool; Errors []string }

func (v *CodeRepoValidator) Validate(name, desc, typ, id string) *CodeRepoValidationResult {
    r := &CodeRepoValidationResult{}
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
