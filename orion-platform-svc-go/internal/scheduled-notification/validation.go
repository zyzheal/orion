package schedulednotification

import (
    "fmt"
    "regexp"
    "strings"
)

type ScheduledNotificationValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultScheduledNotificationValidator() *ScheduledNotificationValidator {
    return &ScheduledNotificationValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *ScheduledNotificationValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrScheduledNotificationInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("scheduled-notification: name too long") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("scheduled-notification: invalid name")
    }
    return nil
}

func (v *ScheduledNotificationValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("scheduled-notification: description too long") }
    return nil
}

func (v *ScheduledNotificationValidator) ValidateType(typ string) error {
    if typ == "" { return ErrScheduledNotificationInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("scheduled-notification: unsupported type")
}

func (v *ScheduledNotificationValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrScheduledNotificationInvalidInput }
    return nil
}

type ScheduledNotificationValidationResult struct { Valid bool; Errors []string }

func (v *ScheduledNotificationValidator) Validate(name, desc, typ, id string) *ScheduledNotificationValidationResult {
    r := &ScheduledNotificationValidationResult{}
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
