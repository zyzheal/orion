package repository

import (
	"testing"
)

func Test_NewRepository_Nil(t *testing.T) {
	r := NewRepository(nil)
	if r == nil {
		t.Fatal("NewRepository(nil) returned nil")
	}
}

func Test_NewRepository_ReturnsNonNil(t *testing.T) {
	r := NewRepository(nil)
	if r == nil {
		t.Fatal("repo should never be nil")
	}
}

func Test_NewRepository_SameType(t *testing.T) {
	r1 := NewRepository(nil)
	r2 := NewRepository(nil)
	if r1 == r2 {
		t.Fatal("each NewRepository call should return a distinct instance")
	}
}
