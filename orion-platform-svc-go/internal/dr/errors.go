package dr

type DRError struct { Code string; Message string; Cause error }

func (e *DRError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}
func (e *DRError) Is(target error) bool { _, ok := target.(*DRError); return ok }
func (e *DRError) Unwrap() error { return e.Cause }

var (
    ErrDRNotFound     = &DRError{Code: "dr_not_found", Message: "dr: not found"}
    ErrDRInvalidInput = &DRError{Code: "dr_invalid_input", Message: "dr: invalid input"}
)
