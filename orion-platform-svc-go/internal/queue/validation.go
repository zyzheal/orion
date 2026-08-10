package queue

import (
    "fmt"
    "regexp"
    "strings"
)

type QueueValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultQueueValidator() *QueueValidator {
    return &QueueValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *QueueValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrQueueInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("queue: name too long") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("queue: invalid name")
    }
    return nil
}

func (v *QueueValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("queue: description too long") }
    return nil
}

func (v *QueueValidator) ValidateType(typ string) error {
    if typ == "" { return ErrQueueInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("queue: unsupported type")
}

func (v *QueueValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrQueueInvalidInput }
    return nil
}

type QueueValidationResult struct { Valid bool; Errors []string }

func (v *QueueValidator) Validate(name, desc, typ, id string) *QueueValidationResult {
    r := &QueueValidationResult{}
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
