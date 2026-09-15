package service

// ErrInvalidState is declared here (with the workflow methods that used it) and
// is mapped onto HTTP 400 by the handler's respondServiceError. The workflow
// methods themselves live in service.go next to the other service methods so
// there is one place to read the error handling.
var _ = ErrInvalidState
