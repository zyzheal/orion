package releasemanagement

import (
    "fmt"
    "regexp"
    "strings"
)

type ReleaseManagementValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultReleaseManagementValidator() *ReleaseManagementValidator {
    return &ReleaseManagementValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *ReleaseManagementValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrReleaseManagementInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("release-management: name too long") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("release-management: invalid name")
    }
    return nil
}

func (v *ReleaseManagementValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("release-management: description too long") }
    return nil
}

func (v *ReleaseManagementValidator) ValidateType(typ string) error {
    if typ == "" { return ErrReleaseManagementInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("release-management: unsupported type")
}

func (v *ReleaseManagementValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrReleaseManagementInvalidInput }
    return nil
}

type ReleaseManagementValidationResult struct { Valid bool; Errors []string }

func (v *ReleaseManagementValidator) Validate(name, desc, typ, id string) *ReleaseManagementValidationResult {
    r := &ReleaseManagementValidationResult{}
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
