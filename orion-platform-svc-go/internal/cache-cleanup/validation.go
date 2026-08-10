package cachecleanup

import (
    "fmt"
    "regexp"
    "strings"
)

type CacheCleanupValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultCacheCleanupValidator() *CacheCleanupValidator {
    return &CacheCleanupValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *CacheCleanupValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrCacheCleanupInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("cache-cleanup: name too long") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("cache-cleanup: invalid name")
    }
    return nil
}

func (v *CacheCleanupValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("cache-cleanup: description too long") }
    return nil
}

func (v *CacheCleanupValidator) ValidateType(typ string) error {
    if typ == "" { return ErrCacheCleanupInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("cache-cleanup: unsupported type")
}

func (v *CacheCleanupValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrCacheCleanupInvalidInput }
    return nil
}

type CacheCleanupValidationResult struct { Valid bool; Errors []string }

func (v *CacheCleanupValidator) Validate(name, desc, typ, id string) *CacheCleanupValidationResult {
    r := &CacheCleanupValidationResult{}
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
