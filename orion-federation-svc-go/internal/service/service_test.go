package service

import "testing"

func TestServiceErrors(t *testing.T) {
	if ErrFederatedClusterNotFound.Error() != "cluster not found" { t.Errorf("unexpected: %s", ErrFederatedClusterNotFound.Error()) }
}
