package notificationtemplate

import (
    "fmt"
    "regexp"
    "strings"
)

type NotificationTemplateValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultNotificationTemplateValidator() *NotificationTemplateValidator {
    return &NotificationTemplateValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *NotificationTemplateValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrNotificationTemplateInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("notification-template: name too long") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("notification-template: invalid name")
    }
    return nil
}

func (v *NotificationTemplateValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("notification-template: description too long") }
    return nil
}

func (v *NotificationTemplateValidator) ValidateType(typ string) error {
    if typ == "" { return ErrNotificationTemplateInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("notification-template: unsupported type")
}

func (v *NotificationTemplateValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrNotificationTemplateInvalidInput }
    return nil
}

type NotificationTemplateValidationResult struct { Valid bool; Errors []string }

func (v *NotificationTemplateValidator) Validate(name, desc, typ, id string) *NotificationTemplateValidationResult {
    r := &NotificationTemplateValidationResult{}
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
