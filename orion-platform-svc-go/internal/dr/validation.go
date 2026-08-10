package dr

import "fmt"

type DRValidator struct { MaxNameLength int }

func DefaultDRValidator() *DRValidator { return &DRValidator{MaxNameLength: 256} }

func (v *DRValidator) ValidateName(name string) error {
    if name == "" { return ErrDRInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("dr: name too long") }
    return nil
}
