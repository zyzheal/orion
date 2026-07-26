package models

import (
	"encoding/json"
	"testing"
)

func TestResourcePool_Fields(t *testing.T) {
	p := ResourcePool{
		ID:           "pool-1",
		TenantID:     "t1",
		Name:         "k8s-prod",
		ResourceType: "k8s",
		TotalCPU:     64.0,
		TotalMemory:  256.0,
		UsedCPU:      32.0,
		UsedMemory:   128.0,
		NodeCount:    8,
		Labels:       JSONB{"env": "prod"},
	}
	if p.ID != "pool-1" {
		t.Errorf("expected pool-1, got %s", p.ID)
	}
	if p.TotalCPU != 64.0 {
		t.Errorf("expected 64.0, got %f", p.TotalCPU)
	}
	if p.NodeCount != 8 {
		t.Errorf("expected 8, got %d", p.NodeCount)
	}
	if p.Labels["env"] != "prod" {
		t.Errorf("expected prod, got %v", p.Labels["env"])
	}
}

func TestCapacityForecast_Fields(t *testing.T) {
	f := CapacityForecast{
		ID:            "fc-1",
		TenantID:      "t1",
		ResourceType:  "cpu",
		CurrentUsage:  65.5,
		Predicted:     82.3,
		Threshold:     80.0,
		DaysUntilFull: 14,
		Recommendation: "Scale up cluster",
	}
	if f.DaysUntilFull != 14 {
		t.Errorf("expected 14, got %d", f.DaysUntilFull)
	}
	if f.Predicted != 82.3 {
		t.Errorf("expected 82.3, got %f", f.Predicted)
	}
}

func TestScalingPolicy_Fields(t *testing.T) {
	p := ScalingPolicy{
		ID:                 "pol-1",
		TenantID:           "t1",
		Name:               "cpu-scale",
		ResourceType:       "cpu",
		MinReplicas:        2,
		MaxReplicas:        20,
		ScaleUpThreshold:   80.0,
		ScaleDownThreshold: 30.0,
		CooldownSec:        300,
		Enabled:            true,
	}
	if p.MinReplicas != 2 {
		t.Errorf("expected 2, got %d", p.MinReplicas)
	}
	if p.MaxReplicas != 20 {
		t.Errorf("expected 20, got %d", p.MaxReplicas)
	}
	if !p.Enabled {
		t.Error("expected enabled")
	}
}

func TestCreatePoolRequest_JSON(t *testing.T) {
	raw := `{"name":"test","resource_type":"k8s","total_cpu":16,"total_memory":64,"node_count":4,"labels":{"zone":"us-east"}}`
	var req CreatePoolRequest
	if err := json.Unmarshal([]byte(raw), &req); err != nil {
		t.Fatalf("unmarshal failed: %v", err)
	}
	if req.Name != "test" {
		t.Errorf("expected test, got %s", req.Name)
	}
	if req.TotalCPU != 16 {
		t.Errorf("expected 16, got %f", req.TotalCPU)
	}
	if req.Labels["zone"] != "us-east" {
		t.Errorf("expected us-east, got %v", req.Labels["zone"])
	}
}

func TestCreatePolicyRequest_JSON(t *testing.T) {
	raw := `{"name":"mem-scale","resource_type":"memory","min_replicas":1,"max_replicas":10,"scale_up_threshold":75,"scale_down_threshold":25,"cooldown_sec":120}`
	var req CreatePolicyRequest
	if err := json.Unmarshal([]byte(raw), &req); err != nil {
		t.Fatalf("unmarshal failed: %v", err)
	}
	if req.Name != "mem-scale" {
		t.Errorf("expected mem-scale, got %s", req.Name)
	}
	if req.ScaleUpThreshold != 75 {
		t.Errorf("expected 75, got %f", req.ScaleUpThreshold)
	}
}
