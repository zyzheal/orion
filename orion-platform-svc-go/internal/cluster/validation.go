package cluster

import (
    "fmt"
    "regexp"
    "strings"
)

type ClusterValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultClusterValidator() *ClusterValidator {
    return &ClusterValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *ClusterValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrClusterInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("cluster: name too long") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("cluster: invalid name")
    }
    return nil
}

func (v *ClusterValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("cluster: description too long") }
    return nil
}

func (v *ClusterValidator) ValidateType(typ string) error {
    if typ == "" { return ErrClusterInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("cluster: unsupported type")
}

func (v *ClusterValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrClusterInvalidInput }
    return nil
}

type ClusterValidationResult struct { Valid bool; Errors []string }

func (v *ClusterValidator) Validate(name, desc, typ, id string) *ClusterValidationResult {
    r := &ClusterValidationResult{}
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
