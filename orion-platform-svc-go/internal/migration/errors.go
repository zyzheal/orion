package migration

type MigrationError struct { Code string; Message string; Cause error }

func (e *MigrationError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}
func (e *MigrationError) Is(target error) bool { _, ok := target.(*MigrationError); return ok }
func (e *MigrationError) Unwrap() error { return e.Cause }

var (
    ErrMigrationNotFound     = &MigrationError{Code: "migration_not_found", Message: "migration: not found"}
    ErrMigrationInvalidInput = &MigrationError{Code: "migration_invalid_input", Message: "migration: invalid input"}
    ErrMigrationConflict     = &MigrationError{Code: "migration_conflict", Message: "migration: conflict"}
)

func NewMigrationError(code, msg string) error { return &MigrationError{Code: code, Message: msg} }
