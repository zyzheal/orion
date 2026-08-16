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

func Test_IsNotFound_Nil(t *testing.T) {
	if IsNotFound(nil) {
		t.Fatal("IsNotFound(nil) should return false")
	}
}

func Test_RepositoryInterface_Contract(t *testing.T) {
	// Compile-time check: *Repository implements RepositoryInterface.
	var _ RepositoryInterface = (*Repository)(nil)
}
