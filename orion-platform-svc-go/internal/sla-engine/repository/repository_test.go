package repository

import (
	"testing"
)

func Test_NewRepository_Nil(t *testing.T) {
	r := NewRepository(nil)
	if r == nil {
		t.Fatal("expected non-nil repository")
	}
}

func Test_RepositoryImplementsRepositoryInterface(t *testing.T) {
	// Compile-time check: *Repository implements RepositoryInterface.
	var _ RepositoryInterface = (*Repository)(nil)
}

func Test_RepositoryImplementsViolationRepository(t *testing.T) {
	// Compile-time check: *Repository implements ViolationRepository.
	var _ ViolationRepository = (*Repository)(nil)
}

func Test_NewRepository_ReturnsDistinctPointers(t *testing.T) {
	r1 := NewRepository(nil)
	r2 := NewRepository(nil)
	if r1 == r2 {
		t.Fatal("NewRepository should return distinct pointers")
	}
}
