package digitaltwinsimulation

import "errors"

// DigitalTwinSimulationError represents domain errors for the digital-twin-simulation module.
type DigitalTwinSimulationError struct {
    Code    string
    Message string
    Cause   error
}

func (e *DigitalTwinSimulationError) Error() string {
    if e.Cause != nil {
        return e.Message + ": " + e.Cause.Error()
    }
    return e.Message
}

func (e *DigitalTwinSimulationError) Is(target error) bool {
    _, ok := target.(*DigitalTwinSimulationError)
    return ok
}

func (e *DigitalTwinSimulationError) Unwrap() error {
    return e.Cause
}

var (
    ErrDigitalTwinSimulationNotFound     = &DigitalTwinSimulationError{Code: "digitaltwinsimulation_not_found", Message: "digital-twin-simulation: resource not found"}
    ErrDigitalTwinSimulationInvalidInput = &DigitalTwinSimulationError{Code: "digitaltwinsimulation_invalid_input", Message: "digital-twin-simulation: invalid input"}
    ErrDigitalTwinSimulationConflict     = &DigitalTwinSimulationError{Code: "digitaltwinsimulation_conflict", Message: "digital-twin-simulation: resource conflict"}
    ErrDigitalTwinSimulationUnauthorized = &DigitalTwinSimulationError{Code: "digitaltwinsimulation_unauthorized", Message: "digital-twin-simulation: unauthorized access"}
    ErrDigitalTwinSimulationInternal     = &DigitalTwinSimulationError{Code: "digitaltwinsimulation_internal", Message: "digital-twin-simulation: internal error"}
)

func NewDigitalTwinSimulationError(code, message string) error {
    return &DigitalTwinSimulationError{Code: code, Message: message}
}

func IsDigitalTwinSimulationNotFound(err error) bool {
    return errors.Is(err, ErrDigitalTwinSimulationNotFound)
}
