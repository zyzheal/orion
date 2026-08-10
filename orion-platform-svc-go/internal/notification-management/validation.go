package notificationmanagement

import (
    "fmt"
    "regexp"
    "strings"
)

type NotificationManagementValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultNotificationManagementValidator() *NotificationManagementValidator {
    return &NotificationManagementValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *NotificationManagementValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrNotificationManagementInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("notification-management: name too long") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("notification-management: invalid name")
    }
    return nil
}

func (v *NotificationManagementValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("notification-management: description too long") }
    return nil
}

func (v *NotificationManagementValidator) ValidateType(typ string) error {
    if typ == "" { return ErrNotificationManagementInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("notification-management: unsupported type")
}

func (v *NotificationManagementValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrNotificationManagementInvalidInput }
    return nil
}

type NotificationManagementValidationResult struct { Valid bool; Errors []string }

func (v *NotificationManagementValidator) Validate(name, desc, typ, id string) *NotificationManagementValidationResult {
    r := &NotificationManagementValidationResult{}
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
