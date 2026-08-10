package migration

import "fmt"

type MigrationValidator struct { MaxNameLength int }

func DefaultMigrationValidator() *MigrationValidator { return &MigrationValidator{MaxNameLength: 256} }

func (v *MigrationValidator) ValidateName(name string) error {
    if name == "" { return ErrMigrationInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("migration: name too long") }
    return nil
}
