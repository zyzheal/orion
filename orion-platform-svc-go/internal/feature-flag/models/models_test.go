package models

import "testing"

func TestFeatureFlagFields(t *testing.T) {
	f := FeatureFlag{ID: "f1", TenantID: "t1", Name: "Dark Mode", Key: "dark_mode", DefaultValue: true, RolloutPct: 50}
	if f.Key != "dark_mode" {
		t.Errorf("expected dark_mode, got %s", f.Key)
	}
	if f.RolloutPct != 50 {
		t.Errorf("expected 50, got %d", f.RolloutPct)
	}
}
