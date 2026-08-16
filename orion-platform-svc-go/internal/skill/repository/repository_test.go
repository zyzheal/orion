package repository

import (
	"testing"
)

func Test_NewRepository_Nil(t *testing.T) {
	r := NewRepository(nil)
	if r == nil {
		t.Fatal("expected non-nil repository")
	}
	if r.db != nil {
		t.Fatal("expected nil db when constructed with nil")
	}
}

func Test_NewRepository_NonNilPointer(t *testing.T) {
	// Two constructions should produce independent pointers.
	r1 := NewRepository(nil)
	r2 := NewRepository(nil)
	if r1 == r2 {
		t.Fatal("NewRepository should return distinct pointers")
	}
}

func Test_RepositoryInterface_Contract(t *testing.T) {
	// Compile-time check: *Repository implements RepositoryInterface.
	var _ RepositoryInterface = (*Repository)(nil)
}
