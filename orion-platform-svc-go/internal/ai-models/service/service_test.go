package service

import (
	"testing"
)

func TestService_NilRepo(t *testing.T) {
	s := NewService(nil, nil)
	if s == nil {
		t.Fatal("expected non-nil service")
	}
}
