package service

import (
	"testing"
	"time"

	"orion/platform-svc-go/internal/infrastructure/backup/models"
)

func TestArchiveScheduler_AddPlanRegisters(t *testing.T) {
	s := NewArchiveScheduler(&Archiver{seen: map[string]time.Time{}}, nil)
	defer s.Stop()
	s.Start()

	s.AddPlan(&ArchivePlanSpec{
		TenantID:    "t1",
		PlanID:      "p1",
		SourceDir:   "/tmp/wal",
		ArchiveType: models.ArchiveTypeWAL,
		Schedule:    "* * * * * *", // every second
		Enabled:     true,
	})
	if got := s.List(); len(got) != 1 || got[0] != "t1/p1" {
		t.Fatalf("expected [t1/p1], got %v", got)
	}
}

func TestArchiveScheduler_RequiresEnabledAndSchedule(t *testing.T) {
	s := NewArchiveScheduler(&Archiver{seen: map[string]time.Time{}}, nil)
	defer s.Stop()
	s.Start()
	s.AddPlan(&ArchivePlanSpec{TenantID: "t", PlanID: "p", Enabled: false, Schedule: "* * * * * *"})
	if got := s.List(); len(got) != 0 {
		t.Fatalf("expected empty, got %v", got)
	}
	s.AddPlan(&ArchivePlanSpec{TenantID: "t", PlanID: "p", Enabled: true, Schedule: ""})
	if got := s.List(); len(got) != 0 {
		t.Fatalf("expected empty for no schedule, got %v", got)
	}
}

func TestArchiveScheduler_RemovePlan(t *testing.T) {
	s := NewArchiveScheduler(&Archiver{seen: map[string]time.Time{}}, nil)
	defer s.Stop()
	s.Start()
	s.AddPlan(&ArchivePlanSpec{TenantID: "t", PlanID: "p", Enabled: true, Schedule: "* * * * * *"})
	if len(s.List()) != 1 {
		t.Fatal("expected 1 after add")
	}
	s.RemovePlan("t", "p")
	if len(s.List()) != 0 {
		t.Fatalf("expected empty after remove, got %v", s.List())
	}
}

func TestArchiveScheduler_UpdatePlanReplaces(t *testing.T) {
	s := NewArchiveScheduler(&Archiver{seen: map[string]time.Time{}}, nil)
	defer s.Stop()
	s.Start()
	s.AddPlan(&ArchivePlanSpec{TenantID: "t", PlanID: "p", Enabled: true, Schedule: "* * * * * *"})
	// Update should not duplicate.
	s.UpdatePlan(&ArchivePlanSpec{TenantID: "t", PlanID: "p", Enabled: true, Schedule: "*/2 * * * * *"})
	if got := s.List(); len(got) != 1 {
		t.Fatalf("expected 1 after update, got %v", got)
	}
	// Disable should remove.
	s.UpdatePlan(&ArchivePlanSpec{TenantID: "t", PlanID: "p", Enabled: false, Schedule: "* * * * * *"})
	if len(s.List()) != 0 {
		t.Fatalf("expected empty after disable, got %v", s.List())
	}
}
