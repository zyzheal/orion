package configmgmtenhanced

import (
    "fmt"
    "regexp"
    "strings"
)

type ConfigMgmtEnhancedValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultConfigMgmtEnhancedValidator() *ConfigMgmtEnhancedValidator {
    return &ConfigMgmtEnhancedValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *ConfigMgmtEnhancedValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrConfigMgmtEnhancedInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("config-mgmt-enhanced: name exceeds max length") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("config-mgmt-enhanced: invalid name characters")
    }
    return nil
}

func (v *ConfigMgmtEnhancedValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("config-mgmt-enhanced: description too long") }
    return nil
}

func (v *ConfigMgmtEnhancedValidator) ValidateType(typ string) error {
    if typ == "" { return ErrConfigMgmtEnhancedInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("config-mgmt-enhanced: unsupported type")
}

func (v *ConfigMgmtEnhancedValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrConfigMgmtEnhancedInvalidInput }
    return nil
}

type ConfigMgmtEnhancedValidationResult struct { Valid bool; Errors []string }

func (v *ConfigMgmtEnhancedValidator) Validate(name, desc, typ, id string) *ConfigMgmtEnhancedValidationResult {
    r := &ConfigMgmtEnhancedValidationResult{}
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
