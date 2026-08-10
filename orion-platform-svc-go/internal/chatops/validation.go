package chatops

import (
    "fmt"
    "regexp"
    "strings"
)

type ChatopsValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultChatopsValidator() *ChatopsValidator {
    return &ChatopsValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *ChatopsValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrChatopsInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("chatops: name exceeds max length") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("chatops: invalid name characters")
    }
    return nil
}

func (v *ChatopsValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("chatops: description too long") }
    return nil
}

func (v *ChatopsValidator) ValidateType(typ string) error {
    if typ == "" { return ErrChatopsInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("chatops: unsupported type")
}

func (v *ChatopsValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrChatopsInvalidInput }
    return nil
}

type ChatopsValidationResult struct { Valid bool; Errors []string }

func (v *ChatopsValidator) Validate(name, desc, typ, id string) *ChatopsValidationResult {
    r := &ChatopsValidationResult{}
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
