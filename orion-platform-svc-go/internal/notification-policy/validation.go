package notificationpolicy

import (
    "fmt"
    "regexp"
    "strings"
)

type NotificationPolicyValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultNotificationPolicyValidator() *NotificationPolicyValidator {
    return &NotificationPolicyValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *NotificationPolicyValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrNotificationPolicyInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("notification-policy: name too long") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("notification-policy: invalid name")
    }
    return nil
}

func (v *NotificationPolicyValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("notification-policy: description too long") }
    return nil
}

func (v *NotificationPolicyValidator) ValidateType(typ string) error {
    if typ == "" { return ErrNotificationPolicyInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("notification-policy: unsupported type")
}

func (v *NotificationPolicyValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrNotificationPolicyInvalidInput }
    return nil
}

type NotificationPolicyValidationResult struct { Valid bool; Errors []string }

func (v *NotificationPolicyValidator) Validate(name, desc, typ, id string) *NotificationPolicyValidationResult {
    r := &NotificationPolicyValidationResult{}
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
