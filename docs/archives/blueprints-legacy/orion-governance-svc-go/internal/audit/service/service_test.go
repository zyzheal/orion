package service

import "testing"

func TestServiceInit(t *testing.T) {
	// Service has no error constants, just verify it compiles
	s := &Service{}
	if s == nil { t.Error("expected non-nil") }
}
