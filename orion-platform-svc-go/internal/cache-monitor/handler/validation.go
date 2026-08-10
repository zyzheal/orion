package handler

import (
    "fmt"
    "regexp"
    "strings"
)

type CacheMonitorValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultCacheMonitorValidator() *CacheMonitorValidator {
    return &CacheMonitorValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *CacheMonitorValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrCacheMonitorInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("cache-monitor: name too long") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("cache-monitor: invalid name")
    }
    return nil
}

func (v *CacheMonitorValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("cache-monitor: description too long") }
    return nil
}

func (v *CacheMonitorValidator) ValidateType(typ string) error {
    if typ == "" { return ErrCacheMonitorInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("cache-monitor: unsupported type")
}

func (v *CacheMonitorValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrCacheMonitorInvalidInput }
    return nil
}

type CacheMonitorValidationResult struct { Valid bool; Errors []string }

func (v *CacheMonitorValidator) Validate(name, desc, typ, id string) *CacheMonitorValidationResult {
    r := &CacheMonitorValidationResult{}
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
