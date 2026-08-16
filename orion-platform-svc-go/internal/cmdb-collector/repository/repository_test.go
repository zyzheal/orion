package repository

import (
	"database/sql"
	"errors"
	"testing"
)

func Test_NewRepository_Nil(t *testing.T) {
	r := NewRepository(nil)
	if r == nil {
		t.Fatal("NewRepository(nil) returned nil")
	}
}

func Test_ErrNotFound_Value(t *testing.T) {
	if ErrNotFound != sql.ErrNoRows {
		t.Fatal("ErrNotFound should equal sql.ErrNoRows")
	}
}

func Test_ErrDuplicate_Message(t *testing.T) {
	if ErrDuplicate.Error() != "duplicate key" {
		t.Fatalf("ErrDuplicate.Error() = %q, want 'duplicate key'", ErrDuplicate.Error())
	}
}

func Test_ErrNotUnique_Message(t *testing.T) {
	if ErrNotUnique.Error() != "duplicate entry" {
		t.Fatalf("ErrNotUnique.Error() = %q, want 'duplicate entry'", ErrNotUnique.Error())
	}
}

func Test_ErrDuplicate_Is(t *testing.T) {
	if !errors.Is(ErrDuplicate, ErrDuplicate) {
		t.Fatal("ErrDuplicate should be Is-comparable to itself")
	}
}

func Test_ErrNotUnique_Is(t *testing.T) {
	if !errors.Is(ErrNotUnique, ErrNotUnique) {
		t.Fatal("ErrNotUnique should be Is-comparable to itself")
	}
}
