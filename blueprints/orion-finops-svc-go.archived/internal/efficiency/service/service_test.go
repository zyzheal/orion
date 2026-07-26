package service

import "testing"

func TestServiceErrors(t *testing.T) {
	if ErrEfficiencyMetricNotFound.Error() != "metric not found" { t.Errorf("unexpected: %s", ErrEfficiencyMetricNotFound.Error()) }
}
