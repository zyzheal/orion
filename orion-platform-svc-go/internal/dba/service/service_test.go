package service

import (
	"testing"
)

func TestService_NilRepo(t *testing.T) {
	s := NewService(nil)
	if s == nil {
		t.Fatal("expected non-nil service")
	}
}

func TestIsReadOnlySQL_Select(t *testing.T) {
	if !isReadOnlySQL("SELECT 1") {
		t.Fatal("expected SELECT to be read-only")
	}
	if isReadOnlySQL("INSERT INTO t VALUES (1)") {
		t.Fatal("expected INSERT to be write-only")
	}
}
