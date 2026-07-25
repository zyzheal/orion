// Package dispatcher implements the pluggable dispatch strategies.
//
// Each dispatcher type (round-robin, weighted, skill-based, load-balanced,
// time-based) implements the IDispatcher interface and is registered in the
// engine at startup.
package dispatcher

import (
	"context"
	"fmt"
	"sort"
	"strings"
	"sync"
	"time"
)

// IDispatcher is the contract every dispatch strategy must fulfil.
type IDispatcher interface {
	// Type returns the canonical type key.
	Type() string
	// Match selects the best assignee from candidates given a work item.
	// Returns the chosen target and a human-readable reason.
	Match(ctx context.Context, candidates []*Candidate, item *WorkItem) (*MatchResult, error)
	// Validate checks the strategy's prerequisites.
	Validate(ctx context.Context) error
}

// --- Internal models ---

// Candidate is an assignee under evaluation.
type Candidate struct {
	ID          string     `json:"id"`
	Name        string     `json:"name"`
	Skills      []string   `json:"skills"`
	CurrentLoad int        `json:"current_load"`
	MaxLoad     int        `json:"max_load"`
	Weight      float64    `json:"weight"`
	IsActive    bool       `json:"is_active"`
	IsAvailable bool       `json:"is_available"`
	// Time window
	AvailableFrom time.Time `json:"available_from"`
	AvailableTo   time.Time `json:"available_to"`
	Timezone      string    `json:"timezone"`
	// Cooldown tracking
	LastAssigned time.Time `json:"last_assigned"`
	CooldownSec  int       `json:"cooldown_sec"`
}

// WorkItem is the unit of work (alias for engine-level type).
type WorkItem struct {
	ID             string
	TenantID       string
	TargetType     string
	Category       string
	Priority       string
	Type           string
	Source         string
	Status         string
	RequiredSkills []string
	Metadata       map[string]string
	IsEscalated    bool
	PriorityWeight int
	CreatedAt      time.Time
}

// MatchResult carries the dispatcher's decision.
type MatchResult struct {
	Candidate    *Candidate `json:"candidate"`
	Score        float64    `json:"score"`
	Reason       string     `json:"reason"`
	Alternatives []Alternative `json:"alternatives"`
}

// Alternative is a ranked candidate that did not win.
type Alternative struct {
	Candidate *Candidate `json:"candidate"`
	Score     float64    `json:"score"`
	Reason    string     `json:"reason"`
}

// --- Registry ---

// Registry exposes the registered dispatchers.
type Registry interface {
	// Get returns a dispatcher by its type name.
	Get(name string) IDispatcher
	// Register adds a custom dispatcher.
	Register(d IDispatcher)
	// All returns a copy of the registry map.
	All() map[string]IDispatcher
}

// registry is the internal implementation.
type registry struct {
	mu       sync.RWMutex
	types    map[string]IDispatcher
	singleton map[string]bool // types that share state (round_robin)
}

func newRegistry() *registry {
	r := &registry{
		types:     make(map[string]IDispatcher),
		singleton: make(map[string]bool),
	}
	// Built-in dispatchers
	for _, d := range []IDispatcher{
		&roundRobinDispatcher{name: "round_robin"},
		&weightedDispatcher{name: "weighted"},
		&skillBasedDispatcher{name: "skill_based"},
		&loadBalancedDispatcher{name: "load_balanced"},
		&timeBasedDispatcher{name: "time_based"},
	} {
		r.types[d.Type()] = d
		if strings.Contains(d.Type(), "round_robin") {
			r.singleton[d.Type()] = true
		}
	}
	return r
}

func (r *registry) Get(name string) IDispatcher {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.types[name]
}

func (r *registry) Register(d IDispatcher) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.types[d.Type()] = d
}

func (r *registry) All() map[string]IDispatcher {
	r.mu.RLock()
	defer r.mu.RUnlock()
	out := make(map[string]IDispatcher, len(r.types))
	for k, v := range r.types {
		out[k] = v
	}
	return out
}

// Default registry used by GetInstance.
var defaultRegistry = newRegistry()

// GetInstance returns the default dispatcher registry.
func GetInstance() *registry {
	return defaultRegistry
}

// --- Filter helpers ---

func filterEligible(ctx context.Context, candidates []*Candidate, item *WorkItem) []*Candidate {
	now := time.Now()
	out := make([]*Candidate, 0, len(candidates))
	for _, c := range candidates {
		select {
		case <-ctx.Done():
			return out
		default:
		}
		// Must be active and available
		if !c.IsActive || !c.IsAvailable {
			continue
		}
		// Capacity check
		if c.MaxLoad > 0 && c.CurrentLoad >= c.MaxLoad {
			continue
		}
		// Time window check
		if !c.AvailableFrom.IsZero() && now.Before(c.AvailableFrom) {
			continue
		}
		if !c.AvailableTo.IsZero() && now.After(c.AvailableTo) {
			continue
		}
		// Cooldown check
		if c.CooldownSec > 0 {
			elapsed := now.Sub(c.LastAssigned)
			if elapsed < time.Duration(c.CooldownSec)*time.Second {
				continue
			}
		}
		out = append(out, c)
	}
	return out
}

// --- Round Robin ---

type roundRobinDispatcher struct {
	name    string
	mu      sync.Mutex
	counters map[string]int
}

func (d *roundRobinDispatcher) Type() string { return d.name }
func (d *roundRobinDispatcher) Validate(ctx context.Context) error { return nil }

func (d *roundRobinDispatcher) Match(ctx context.Context, candidates []*Candidate, item *WorkItem) (*MatchResult, error) {
	eligible := filterEligible(ctx, candidates, item)
	if len(eligible) == 0 {
		return nil, fmt.Errorf("no eligible candidates for round-robin")
	}
	d.mu.Lock()
	if d.counters == nil {
		d.counters = make(map[string]int)
	}
	// Pick the candidate with the lowest counter, increment it
	idx := 0
	min := d.counters[eligible[0].ID]
	for i, c := range eligible {
		if d.counters[c.ID] < min {
			min = d.counters[c.ID]
			idx = i
		}
	}
	choice := eligible[idx]
	d.counters[choice.ID]++
	d.mu.Unlock()
	return &MatchResult{
		Candidate: choice,
		Score:     1.0,
		Reason:    fmt.Sprintf("round-robin: next in rotation (%s)", choice.Name),
	}, nil
}

// --- Weighted ---

type weightedDispatcher struct {
	name string
}

func (d *weightedDispatcher) Type() string { return d.name }
func (d *weightedDispatcher) Validate(ctx context.Context) error { return nil }

func (d *weightedDispatcher) Match(ctx context.Context, candidates []*Candidate, item *WorkItem) (*MatchResult, error) {
	eligible := filterEligible(ctx, candidates, item)
	if len(eligible) == 0 {
		return nil, fmt.Errorf("no eligible candidates for weighted dispatch")
	}
	var totalWeight float64
	for _, c := range eligible {
		if c.Weight <= 0 {
			c.Weight = 1.0
		}
		totalWeight += c.Weight
	}
	var matches []MatchScore
	for _, c := range eligible {
		s := c.Weight / totalWeight
		matches = append(matches, MatchScore{Candidate: c, Score: s, Reason: fmt.Sprintf("weight %.2f / %.2f", c.Weight, totalWeight)})
	}
	sort.Slice(matches, func(i, j int) bool { return matches[i].Score > matches[j].Score })
	winner := matches[0]
	alts := make([]Alternative, len(matches)-1)
	for i, m := range matches[1:] {
		alts[i] = Alternative{Candidate: m.Candidate, Score: m.Score, Reason: m.Reason}
	}
	return &MatchResult{
		Candidate:    winner.Candidate,
		Score:        winner.Score,
		Reason:       winner.Reason,
		Alternatives: alts,
	}, nil
}

// --- Skill Based ---

type skillBasedDispatcher struct {
	name string
}

func (d *skillBasedDispatcher) Type() string { return d.name }
func (d *skillBasedDispatcher) Validate(ctx context.Context) error { return nil }

func (d *skillBasedDispatcher) Match(ctx context.Context, candidates []*Candidate, item *WorkItem) (*MatchResult, error) {
	eligible := filterEligible(ctx, candidates, item)
	if len(eligible) == 0 {
		return nil, fmt.Errorf("no eligible candidates for skill-based dispatch")
	}
	scores := make([]MatchScore, 0, len(eligible))
	for _, c := range eligible {
		s := d.skillScore(c, item)
		reason := fmt.Sprintf("skill overlap: %d/%d required", s.MatchCount, len(item.RequiredSkills))
		scores = append(scores, MatchScore{Candidate: c, Score: s.Score, Reason: reason, MatchCount: s.MatchCount})
	}
	sort.Slice(scores, func(i, j int) bool { return scores[i].Score > scores[j].Score })
	winner := scores[0]
	alts := make([]Alternative, len(scores)-1)
	for i, s := range scores[1:] {
		alts[i] = Alternative{Candidate: s.Candidate, Score: s.Score, Reason: s.Reason}
	}
	return &MatchResult{
		Candidate:    winner.Candidate,
		Score:        winner.Score,
		Reason:       winner.Reason,
		Alternatives: alts,
	}, nil
}

type skillScoreResult struct {
	Score      float64
	MatchCount int
}

func (d *skillBasedDispatcher) skillScore(c *Candidate, item *WorkItem) skillScoreResult {
	var total, matched float64
	matchCount := 0
	for _, req := range item.RequiredSkills {
		total++
		for _, s := range c.Skills {
			if strings.EqualFold(s, req) {
				matched++
				matchCount++
				break
			}
		}
	}
	if total == 0 {
		return skillScoreResult{Score: 0.5, MatchCount: 0}
	}
	return skillScoreResult{Score: matched / total, MatchCount: matchCount}
}

// --- Load Balanced ---

type loadBalancedDispatcher struct {
	name string
}

func (d *loadBalancedDispatcher) Type() string { return d.name }
func (d *loadBalancedDispatcher) Validate(ctx context.Context) error { return nil }

func (d *loadBalancedDispatcher) Match(ctx context.Context, candidates []*Candidate, item *WorkItem) (*MatchResult, error) {
	eligible := filterEligible(ctx, candidates, item)
	if len(eligible) == 0 {
		return nil, fmt.Errorf("no eligible candidates for load-balanced dispatch")
	}
	scores := make([]MatchScore, 0, len(eligible))
	for _, c := range eligible {
		utilization := 0.0
		if c.MaxLoad > 0 {
			utilization = float64(c.CurrentLoad) / float64(c.MaxLoad)
		}
		// Inverse utilization = higher score
		s := 1.0 - utilization
		reason := fmt.Sprintf("load %.1f%% utilized (%d/%d)", utilization*100, c.CurrentLoad, c.MaxLoad)
		scores = append(scores, MatchScore{Candidate: c, Score: s, Reason: reason})
	}
	sort.Slice(scores, func(i, j int) bool { return scores[i].Score > scores[j].Score })
	winner := scores[0]
	alts := make([]Alternative, len(scores)-1)
	for i, s := range scores[1:] {
		alts[i] = Alternative{Candidate: s.Candidate, Score: s.Score, Reason: s.Reason}
	}
	return &MatchResult{
		Candidate:    winner.Candidate,
		Score:        winner.Score,
		Reason:       winner.Reason,
		Alternatives: alts,
	}, nil
}

// --- Time Based ---

type timeBasedDispatcher struct {
	name string
}

func (d *timeBasedDispatcher) Type() string { return d.name }
func (d *timeBasedDispatcher) Validate(ctx context.Context) error { return nil }

func (d *timeBasedDispatcher) Match(ctx context.Context, candidates []*Candidate, item *WorkItem) (*MatchResult, error) {
	eligible := filterEligible(ctx, candidates, item)
	if len(eligible) == 0 {
		return nil, fmt.Errorf("no eligible candidates in availability window")
	}
	now := time.Now()
	scores := make([]MatchScore, 0, len(eligible))
	for _, c := range eligible {
		// Score based on how much time remains in availability window
		windowHours := 0.0
		if !c.AvailableFrom.IsZero() && !c.AvailableTo.IsZero() {
			windowHours = c.AvailableTo.Sub(c.AvailableFrom).Hours()
		}
		if windowHours <= 0 {
			windowHours = 24 // full day fallback
		}
		remainingHours := c.AvailableTo.Sub(now).Hours()
		if remainingHours < 0 {
			remainingHours = 0
		}
		s := remainingHours / windowHours
		reason := fmt.Sprintf("available for %.1fh more (window %.1fh)", remainingHours, windowHours)
		scores = append(scores, MatchScore{Candidate: c, Score: s, Reason: reason})
	}
	sort.Slice(scores, func(i, j int) bool { return scores[i].Score > scores[j].Score })
	winner := scores[0]
	alts := make([]Alternative, len(scores)-1)
	for i, s := range scores[1:] {
		alts[i] = Alternative{Candidate: s.Candidate, Score: s.Score, Reason: s.Reason}
	}
	return &MatchResult{
		Candidate:    winner.Candidate,
		Score:        winner.Score,
		Reason:       winner.Reason,
		Alternatives: alts,
	}, nil
}

// --- Internal scoring helper ---

type MatchScore struct {
	Candidate  *Candidate
	Score      float64
	Reason     string
	MatchCount int
}
