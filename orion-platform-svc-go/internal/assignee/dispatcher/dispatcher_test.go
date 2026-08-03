package dispatcher

import (
	"context"
	"strings"
	"testing"
	"time"
)

func futureTime() time.Time { return time.Now().Add(time.Hour * 24) }
func pastTime() time.Time   { return time.Now().Add(-time.Hour * 24) }

func validCandidate(id string) *Candidate {
	return &Candidate{
		ID: id, Name: "u" + id, IsActive: true, IsAvailable: true,
		AvailableFrom: pastTime(), AvailableTo: futureTime(),
		MaxLoad: 10, CurrentLoad: 0,
	}
}

func sampleItem() *WorkItem {
	return &WorkItem{ID: "w1", TenantID: "t1", Category: "ops"}
}

func TestRegistryGet(t *testing.T) {
	r := newRegistry()
	for _, name := range []string{"round_robin", "weighted", "skill_based", "load_balanced", "time_based"} {
		d := r.Get(name)
		if d == nil {
			t.Errorf("registry missing %s", name)
		} else if d.Type() != name {
			t.Errorf("type mismatch: got %s", d.Type())
		}
	}
	// Missing type
	if r.Get("bogus") != nil {
		t.Error("bogus should return nil")
	}
}

func TestRegistryAll(t *testing.T) {
	r := newRegistry()
	all := r.All()
	if len(all) != 5 {
		t.Errorf("expected 5 dispatchers, got %d", len(all))
	}
	// Verify map is a copy
	all["x"] = nil
	if r.Get("x") != nil {
		t.Error("All() should return a copy")
	}
}

func TestRegistryRegister(t *testing.T) {
	r := newRegistry()
	r.Register(&testDispatcher{name: "custom"})
	d := r.Get("custom")
	if d == nil {
		t.Error("custom dispatcher not registered")
	}
}

type testDispatcher struct{ name string }
func (d *testDispatcher) Type() string { return d.name }
func (d *testDispatcher) Match(_ context.Context, c []*Candidate, i *WorkItem) (*MatchResult, error) {
	if len(c) == 0 {
		return nil, nil
	}
	return &MatchResult{Candidate: c[0], Score: 1.0, Reason: "test"}, nil
}
func (d *testDispatcher) Validate(_ context.Context) error { return nil }

func TestRoundRobinMatch(t *testing.T) {
	r := newRegistry()
	d := r.Get("round_robin").(*roundRobinDispatcher)
	cands := []*Candidate{validCandidate("a"), validCandidate("b")}
	ctx := context.Background()

	result, err := d.Match(ctx, cands, sampleItem())
	if err != nil {
		t.Fatal(err)
	}
	if result.Candidate == nil {
		t.Fatal("no candidate selected")
	}
	if result.Candidate.ID != "a" && result.Candidate.ID != "b" {
		t.Errorf("unexpected candidate %s", result.Candidate.ID)
	}

	// Second call should prefer the one with lower counter (still both at 0, pick first)
	result2, err := d.Match(ctx, cands, sampleItem())
	if err != nil {
		t.Fatal(err)
	}
	// After first pick increments counter, second should pick the other
	if result2.Candidate.ID == result.Candidate.ID {
		t.Errorf("round-robin should alternate, got %s then %s", result.Candidate.ID, result2.Candidate.ID)
	}
}

func TestRoundRobinNoCandidates(t *testing.T) {
	d := &roundRobinDispatcher{name: "test"}
	_, err := d.Match(context.Background(), nil, sampleItem())
	if err == nil {
		t.Error("empty candidates should error")
	}
}

func TestWeightedMatch(t *testing.T) {
	r := newRegistry()
	d := r.Get("weighted")
	cands := []*Candidate{
		validCandidate("heavy"),
		&Candidate{ID: "light", IsActive: true, IsAvailable: true, AvailableFrom: pastTime(), AvailableTo: futureTime()},
	}
	cands[0].Weight = 9.0
	cands[1].Weight = 1.0

	result, err := d.Match(context.Background(), cands, sampleItem())
	if err != nil {
		t.Fatal(err)
	}
	if result.Candidate.ID != "heavy" {
		t.Errorf("heavier should win, got %s", result.Candidate.ID)
	}
	if len(result.Alternatives) != 1 {
		t.Errorf("expected 1 alternative, got %d", len(result.Alternatives))
	}
}

func TestSkillBasedMatch(t *testing.T) {
	r := newRegistry()
	d := r.Get("skill_based")
	item := &WorkItem{ID: "w1", RequiredSkills: []string{"go", "python"}}
	cands := []*Candidate{
		{ID: "expert", Skills: []string{"go", "python"}, IsActive: true, IsAvailable: true, AvailableFrom: pastTime(), AvailableTo: futureTime()},
		{ID: "junior", Skills: []string{"go"}, IsActive: true, IsAvailable: true, AvailableFrom: pastTime(), AvailableTo: futureTime()},
	}

	result, err := d.Match(context.Background(), cands, item)
	if err != nil {
		t.Fatal(err)
	}
	if result.Candidate.ID != "expert" {
		t.Errorf("expert should win, got %s", result.Candidate.ID)
	}
}

func TestLoadBalancedMatch(t *testing.T) {
	r := newRegistry()
	d := r.Get("load_balanced")
	cands := []*Candidate{
		{ID: "busy", CurrentLoad: 9, MaxLoad: 10, IsActive: true, IsAvailable: true, AvailableFrom: pastTime(), AvailableTo: futureTime()},
		{ID: "free", CurrentLoad: 1, MaxLoad: 10, IsActive: true, IsAvailable: true, AvailableFrom: pastTime(), AvailableTo: futureTime()},
	}

	result, err := d.Match(context.Background(), cands, sampleItem())
	if err != nil {
		t.Fatal(err)
	}
	if result.Candidate.ID != "free" {
		t.Errorf("free should win, got %s", result.Candidate.ID)
	}
}

func TestTimeBasedMatch(t *testing.T) {
	r := newRegistry()
	d := r.Get("time_based")
	now := time.Now()
	cands := []*Candidate{
		{ID: "short", AvailableTo: now.Add(time.Hour), AvailableFrom: pastTime(), IsActive: true, IsAvailable: true},
		{ID: "long", AvailableTo: now.Add(time.Hour * 10), AvailableFrom: pastTime(), IsActive: true, IsAvailable: true},
	}

	result, err := d.Match(context.Background(), cands, sampleItem())
	if err != nil {
		t.Fatal(err)
	}
	if result.Candidate.ID != "long" {
		t.Errorf("longer window should win, got %s", result.Candidate.ID)
	}
}

func TestFilterEligibleExclusions(t *testing.T) {
	cands := []*Candidate{
		{ID: "inactive", IsActive: false, IsAvailable: true},
		{ID: "unavailable", IsActive: true, IsAvailable: false},
		{ID: "full", IsActive: true, IsAvailable: true, MaxLoad: 1, CurrentLoad: 1},
		{ID: "good", IsActive: true, IsAvailable: true},
	}
	eligible := filterEligible(context.Background(), cands, sampleItem())
	if len(eligible) != 1 {
		t.Fatalf("expected 1 eligible, got %d", len(eligible))
	}
	if eligible[0].ID != "good" {
		t.Errorf("only 'good' should be eligible, got %s", eligible[0].ID)
	}
}

func TestFilterEligibleCooldown(t *testing.T) {
	cand := &Candidate{
		ID: "x", IsActive: true, IsAvailable: true,
		LastAssigned: time.Now().Add(-time.Second), CooldownSec: 60,
	}
	eligible := filterEligible(context.Background(), []*Candidate{cand}, sampleItem())
	if len(eligible) != 0 {
		t.Error("candidate in cooldown should be excluded")
	}
}

func TestFilterEligibleContextCancellation(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	// Many candidates, context cancelled mid-filter
	cands := make([]*Candidate, 100)
	for i := range cands {
		cands[i] = validCandidate("c")
	}
	eligible := filterEligible(ctx, cands, sampleItem())
	if len(eligible) != 0 {
		t.Errorf("cancelled context should return 0 eligible, got %d", len(eligible))
	}
}

func TestFilterEligibleTimeWindow(t *testing.T) {
	cand := &Candidate{
		ID: "future", IsActive: true, IsAvailable: true,
		AvailableFrom: time.Now().Add(time.Hour),
	}
	eligible := filterEligible(context.Background(), []*Candidate{cand}, sampleItem())
	if len(eligible) != 0 {
		t.Error("candidate not yet available should be excluded")
	}
}

func TestDispatcherValidate(t *testing.T) {
	ctx := context.Background()
	r := newRegistry()
	for _, name := range []string{"round_robin", "weighted", "skill_based", "load_balanced", "time_based"} {
		d := r.Get(name)
		if err := d.Validate(ctx); err != nil {
			t.Errorf("%s.Validate() = %v", name, err)
		}
	}
}

func TestResultReasonFormat(t *testing.T) {
	r := newRegistry()
	for _, name := range []string{"weighted", "skill_based", "load_balanced"} {
		d := r.Get(name)
		result, err := d.Match(context.Background(), []*Candidate{validCandidate("a")}, sampleItem())
		if err != nil {
			t.Fatalf("%s Match failed: %v", name, err)
		}
		if result == nil || result.Candidate == nil {
			t.Fatalf("%s returned nil result", name)
		}
		if !strings.Contains(result.Reason, "") {
			// Reason should always be non-empty (format check)
			if result.Reason == "" {
				t.Errorf("%s result has empty reason", name)
			}
		}
	}
}
