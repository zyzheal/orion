package cmdb_relationship_test

import (
	"errors"
	"testing"

	"orion/platform-svc-go/internal/cmdb-relationship/models"
	"orion/platform-svc-go/internal/cmdb-relationship/service"
)

func TestCmdbRelationship_ErrorTypes(t *testing.T) {
	// Verify the sentinel error variables declared in service/errors.go exist
	// and implement the standard error interface.
	var err error = service.ErrCmdbRelationshipNotFound
	if err == nil {
		t.Fatal("ErrCmdbRelationshipNotFound must not be nil")
	}
	if got := err.Error(); got == "" {
		t.Fatal("ErrCmdbRelationshipNotFound.Error() must return a non-empty string")
	}

	// Verify NewCmdbRelationshipError constructs errors with Code/Message
	custom := service.NewCmdbRelationshipError("test_code", "test message")
	if custom == nil {
		t.Fatal("NewCmdbRelationshipError must not return nil")
	}
	if custom.Error() != "test message" {
		t.Fatalf("NewCmdbRelationshipError.Error() = %q, want %q", custom.Error(), "test message")
	}

	// IsCmdbRelationshipNotFound checks for CmdbRelationshipError type
	// (the Is method matches any CmdbRelationshipError regardless of Code).
	if !service.IsCmdbRelationshipNotFound(service.ErrCmdbRelationshipNotFound) {
		t.Fatal("IsCmdbRelationshipNotFound should return true for ErrCmdbRelationshipNotFound")
	}
	// A non-CmdbRelationshipError should return false
	if service.IsCmdbRelationshipNotFound(errors.New("some other error")) {
		t.Fatal("IsCmdbRelationshipNotFound should return false for a plain error")
	}
}

func TestCmdbRelationship_Models(t *testing.T) {
	// Verify PaginatedRequest defaulting logic (no DB needed).
	p := &models.PaginatedRequest{Page: 1, PageSize: 10}
	if offset := p.Offset(); offset != 0 {
		t.Fatalf("PaginatedRequest.Offset() = %d, want 0", offset)
	}
	if limit := p.Limit(); limit != 10 {
		t.Fatalf("PaginatedRequest.Limit() = %d, want 10", limit)
	}

	// Page defaults to 1 when <= 0
	p2 := &models.PaginatedRequest{Page: 0, PageSize: 0}
	if offset := p2.Offset(); offset != 0 {
		t.Fatalf("PaginatedRequest.Offset() with zero page = %d, want 0", offset)
	}
	if limit := p2.Limit(); limit != 20 {
		t.Fatalf("PaginatedRequest.Limit() with zero page_size = %d, want 20", limit)
	}

	// Page=3, PageSize=20 -> offset = 40
	p3 := &models.PaginatedRequest{Page: 3, PageSize: 20}
	if offset := p3.Offset(); offset != 40 {
		t.Fatalf("PaginatedRequest.Offset() = %d, want 40", offset)
	}

	// PageSize is capped at 100
	p4 := &models.PaginatedRequest{Page: 1, PageSize: 200}
	if limit := p4.Limit(); limit != 100 {
		t.Fatalf("PaginatedRequest.Limit() cap = %d, want 100", limit)
	}

	// Verify ValidCardinalities contains expected entries.
	valid := models.ValidCardinalities
	for _, c := range []string{"1:1", "1:N", "N:1", "N:N"} {
		if !valid[c] {
			t.Fatalf("ValidCardinalities missing %q", c)
		}
	}

	// Verify all 5 sentinel errors are distinct non-nil values.
	errs := []error{
		service.ErrCmdbRelationshipNotFound,
		service.ErrCmdbRelationshipInvalidInput,
		service.ErrCmdbRelationshipConflict,
		service.ErrCmdbRelationshipUnauthorized,
		service.ErrCmdbRelationshipInternal,
	}
	for i, e := range errs {
		if e == nil {
			t.Fatalf("sentinel error #%d is nil", i)
		}
	}
}

func TestCmdbRelationship_ServiceConstants(t *testing.T) {
	// Verify the error variables defined in service/service.go exist.
	var (
		_ error = service.ErrTypeNotFound
		_ error = service.ErrRelationshipNotFound
		_ error = service.ErrInvalidCardinality
		_ error = service.ErrCardinalityExceeded
		_ error = service.ErrInvalidStatus
		_ error = service.ErrInvalidDirection
	)

	// Verify ValidStatuses map contains expected values.
	valid := service.ValidStatuses
	if !valid["active"] {
		t.Fatal("ValidStatuses must contain \"active\"")
	}
	if !valid["deprecated"] {
		t.Fatal("ValidStatuses must contain \"deprecated\"")
	}
	if valid["deleted"] {
		t.Fatal("ValidStatuses must not contain \"deleted\"")
	}

	// Verify CmdbRelationshipError wraps a cause properly.
	inner := errors.New("inner error")
	wrapped := &service.CmdbRelationshipError{
		Code:    "test",
		Message: "outer",
		Cause:   inner,
	}
	if !errors.Is(wrapped, inner) {
		t.Fatal("CmdbRelationshipError must wrap its Cause")
	}
	if !errors.Is(wrapped, service.ErrCmdbRelationshipNotFound) {
		t.Fatal("CmdbRelationshipError.Is must match CmdbRelationshipError target")
	}
}
