package handler

import "fmt"

type InspectionValidator struct {
    MaxNameLength int
    AllowedTypes  []string
}

func DefaultInspectionValidator() *InspectionValidator {
    return &InspectionValidator{MaxNameLength: 256}
}

func (v *InspectionValidator) ValidateName(name string) error {
    if name == "" { return ErrInspectionInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("inspection: name too long") }
    return nil
}
