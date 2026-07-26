package service

import "testing"

func TestServiceErrors(t *testing.T) {
	if ErrSecurityScanNotFound.Error() != "scan not found" { t.Errorf("unexpected: %s", ErrSecurityScanNotFound.Error()) }
}
