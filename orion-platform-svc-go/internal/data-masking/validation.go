package datamasking

import "fmt"

type DataMaskingValidator struct {
    MaxNameLength int
    AllowedTypes  []string
}

func DefaultDataMaskingValidator() *DataMaskingValidator {
    return &DataMaskingValidator{MaxNameLength: 256}
}

func (v *DataMaskingValidator) ValidateName(name string) error {
    if name == "" { return ErrDataMaskingInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("data-masking: name too long") }
    return nil
}
