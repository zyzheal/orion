package messagequeue

import (
    "fmt"
    "regexp"
    "strings"
)

type MessageQueueValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultMessageQueueValidator() *MessageQueueValidator {
    return &MessageQueueValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *MessageQueueValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrMessageQueueInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("message-queue: name too long") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("message-queue: invalid name")
    }
    return nil
}

func (v *MessageQueueValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("message-queue: description too long") }
    return nil
}

func (v *MessageQueueValidator) ValidateType(typ string) error {
    if typ == "" { return ErrMessageQueueInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("message-queue: unsupported type")
}

func (v *MessageQueueValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrMessageQueueInvalidInput }
    return nil
}

type MessageQueueValidationResult struct { Valid bool; Errors []string }

func (v *MessageQueueValidator) Validate(name, desc, typ, id string) *MessageQueueValidationResult {
    r := &MessageQueueValidationResult{}
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
