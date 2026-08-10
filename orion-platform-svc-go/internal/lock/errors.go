package lock

type LockError struct { Code string; Message string; Cause error }

func (e *LockError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}
func (e *LockError) Is(target error) bool { _, ok := target.(*LockError); return ok }
func (e *LockError) Unwrap() error { return e.Cause }

var (
    ErrLockNotFound     = &LockError{Code: "lock_not_found", Message: "lock: not found"}
    ErrLockInvalidInput = &LockError{Code: "lock_invalid_input", Message: "lock: invalid input"}
    ErrLockConflict     = &LockError{Code: "lock_conflict", Message: "lock: conflict"}
)
