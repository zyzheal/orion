package models

import "orion/platform-svc-go/internal/shared/crud"

// Record, CreateRequest, ListQuery are type aliases to the shared CRUD types.
// Kept for backward compatibility with existing domain code.
type (
	Record = crud.Record
	CreateRequest = crud.CreateRequest
	ListQuery = crud.ListQuery
)
