package models

import (
	"encoding/json"
	"testing"
)

func TestMiddlewareInstance_Fields(t *testing.T) {
	inst := MiddlewareInstance{
		ID:       "inst-1",
		TenantID: "t1",
		Name:     "redis-prod",
		Type:     "redis",
		Version:  "7.0",
		Host:     "10.0.0.1",
		Port:     6379,
		Status:   "active",
		Config:   JSONB{"maxmemory": "2gb"},
		Labels:   JSONB{"env": "prod"},
	}
	if inst.Type != "redis" {
		t.Errorf("expected redis, got %s", inst.Type)
	}
	if inst.Port != 6379 {
		t.Errorf("expected 6379, got %d", inst.Port)
	}
	if inst.Config["maxmemory"] != "2gb" {
		t.Errorf("expected 2gb, got %v", inst.Config["maxmemory"])
	}
}

func TestBackupRecord_Fields(t *testing.T) {
	rec := BackupRecord{
		ID:         "bak-1",
		TenantID:   "t1",
		InstanceID: "inst-1",
		Status:     "completed",
		SizeBytes:  1048576,
		Location:   "s3://backups/inst-1/dump.rdb",
	}
	if rec.Status != "completed" {
		t.Errorf("expected completed, got %s", rec.Status)
	}
	if rec.SizeBytes != 1048576 {
		t.Errorf("expected 1048576, got %d", rec.SizeBytes)
	}
}

func TestCreateInstanceRequest_JSON(t *testing.T) {
	raw := `{"name":"kafka-staging","type":"kafka","version":"3.5","host":"10.0.0.2","port":9092,"config":{"partitions":12},"labels":{"env":"staging"}}`
	var req CreateInstanceRequest
	if err := json.Unmarshal([]byte(raw), &req); err != nil {
		t.Fatalf("unmarshal failed: %v", err)
	}
	if req.Name != "kafka-staging" {
		t.Errorf("expected kafka-staging, got %s", req.Name)
	}
	if req.Type != "kafka" {
		t.Errorf("expected kafka, got %s", req.Type)
	}
	if req.Port != 9092 {
		t.Errorf("expected 9092, got %d", req.Port)
	}
}

func TestCreateBackupRequest_JSON(t *testing.T) {
	raw := `{"instance_id":"inst-1"}`
	var req CreateBackupRequest
	if err := json.Unmarshal([]byte(raw), &req); err != nil {
		t.Fatalf("unmarshal failed: %v", err)
	}
	if req.InstanceID != "inst-1" {
		t.Errorf("expected inst-1, got %s", req.InstanceID)
	}
}
