package maintenancewindow

import (
    "fmt"
    "regexp"
    "strings"
)

type MaintenanceWindowValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultMaintenanceWindowValidator() *MaintenanceWindowValidator {
    return &MaintenanceWindowValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *MaintenanceWindowValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrMaintenanceWindowInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("maintenance-window: name too long") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("maintenance-window: invalid name")
    }
    return nil
}

func (v *MaintenanceWindowValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("maintenance-window: description too long") }
    return nil
}

func (v *MaintenanceWindowValidator) ValidateType(typ string) error {
    if typ == "" { return ErrMaintenanceWindowInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("maintenance-window: unsupported type")
}

func (v *MaintenanceWindowValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrMaintenanceWindowInvalidInput }
    return nil
}

type MaintenanceWindowValidationResult struct { Valid bool; Errors []string }

func (v *MaintenanceWindowValidator) Validate(name, desc, typ, id string) *MaintenanceWindowValidationResult {
    r := &MaintenanceWindowValidationResult{}
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
