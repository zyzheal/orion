package handler

import "fmt"

type GenericHandlerValidator struct { MaxNameLength int }

func DefaultGenericHandlerValidator() *GenericHandlerValidator { return &GenericHandlerValidator{MaxNameLength: 256} }

func (v *GenericHandlerValidator) ValidateName(name string) error {
    if name == "" { return ErrGenericHandlerInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("handler: name too long") }
    return nil
}
