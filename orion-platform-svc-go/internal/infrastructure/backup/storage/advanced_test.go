package storage

import (
	"errors"
	"testing"

	"github.com/minio/minio-go/v7/pkg/lifecycle"
)

// TestS3_ImplementsAdvanced verifies S3 reports the full G8 capability set
// and satisfies the AdvancedBackend interface.
func TestS3_ImplementsAdvanced(t *testing.T) {
	// compile-time check
	var _ AdvancedBackend = (*S3)(nil)

	s := &S3{}
	if s.Type() != "s3" {
		t.Fatalf("unexpected type %q", s.Type())
	}
	caps := s.Capabilities()
	if !caps.MultipartUpload || !caps.LifecycleRules || !caps.ColdStorage {
		t.Fatalf("s3 caps incomplete: %+v", caps)
	}
}

// TestLocal_DoesNotImplementAdvancedPrefix verifies Local does not present S3-only
// capabilities through the advanced interface — consumers must type-assert, so the
// absence is the expected capability signal.
func TestLocal_DoesNotImplementAdvancedPrefix(t *testing.T) {
	var b StorageBackend = &Local{BasePath: t.TempDir()}
	if _, ok := b.(AdvancedBackend); ok {
		t.Fatal("local backend must not implement AdvancedBackend")
	}
}

// TestLifecycleRuleSet_ExpirationRule verifies a retention policy converts
// into a minio lifecycle rule carrying the expected prefix + expiry.
func TestLifecycleRuleSet_ExpirationRule(t *testing.T) {
	p := LifecyclePolicy{
		ID:              "retain-90d",
		Prefix:          "backup/2026/",
		ExpireAfterDays: 90,
	}
	cfg, err := LifecycleRuleSet([]LifecyclePolicy{p})
	if err != nil {
		t.Fatal(err)
	}
	if cfg == nil || len(cfg.Rules) != 1 {
		t.Fatalf("expected 1 rule, got %v", cfg)
	}
	r := cfg.Rules[0]
	if r.ID != "retain-90d" {
		t.Fatalf("rule id = %q", r.ID)
	}
	if r.RuleFilter.Prefix != "backup/2026/" {
		t.Fatalf("prefix = %q", r.RuleFilter.Prefix)
	}
	if r.Expiration.Days != lifecycle.ExpirationDays(90) {
		t.Fatalf("expiration days = %v", r.Expiration.Days)
	}
	if r.Transition.Days != 0 {
		t.Fatalf("unexpected transition days %v", r.Transition.Days)
	}
}

// TestLifecycleRuleSet_ColdStorageTransition verifies class transition (cold
// tiering) is carried into the rule.
func TestLifecycleRuleSet_ColdStorageTransition(t *testing.T) {
	p := LifecyclePolicy{
		ID:              "tier-glacier",
		Prefix:          "archive/",
		ExpireAfterDays: 30,
		StorageClass:    "GLACIER",
	}
	cfg, err := LifecycleRuleSet([]LifecyclePolicy{p})
	if err != nil {
		t.Fatal(err)
	}
	r := cfg.Rules[0]
	if r.Transition.Days != lifecycle.ExpirationDays(30) || r.Transition.StorageClass != "GLACIER" {
		t.Fatalf("transition mismatch: %+v", r.Transition)
	}
}

// TestLifecycleRuleSet_NoopRejected verifies a policy that expires nothing
// and tiers nowhere is rejected before touching the backend.
func TestLifecycleRuleSet_NoopRejected(t *testing.T) {
	_, err := LifecycleRuleSet([]LifecyclePolicy{{ID: "noop"}})
	if !errors.Is(err, ErrLifecycleNoop) {
		t.Fatalf("expected ErrLifecycleNoop, got %v", err)
	}
}

// TestLifecycleRuleSet_MissingIDRejected verifies fail-closed on missing id.
func TestLifecycleRuleSet_MissingIDRejected(t *testing.T) {
	_, err := LifecycleRuleSet([]LifecyclePolicy{{Prefix: "x/", ExpireAfterDays: 30}})
	if err == nil {
		t.Fatal("expected error for missing rule id")
	}
}

// TestLifecycleRuleSet_NegativeDaysRejected verifies negative expiry is
// rejected at the policy boundary.
func TestLifecycleRuleSet_NegativeDaysRejected(t *testing.T) {
	_, err := LifecycleRuleSet([]LifecyclePolicy{{ID: "neg", ExpireAfterDays: -5}})
	if err == nil {
		t.Fatal("expected error for negative days")
	}
}

// TestLifecycleRuleSet_MultipleRulesPreservesOrder verifies multi-policy
// configs retain input order (oldest retention first, per operator intent).
func TestLifecycleRuleSet_MultipleRulesPreservesOrder(t *testing.T) {
	cfgs := []LifecyclePolicy{
		{ID: "hot-7d", Prefix: "hot/", ExpireAfterDays: 7},
		{ID: "warm-30d", Prefix: "warm/", ExpireAfterDays: 30},
		{ID: "cold-1y", Prefix: "cold/", ExpireAfterDays: 365, StorageClass: "DEEP_ARCHIVE"},
	}
	cfg, err := LifecycleRuleSet(cfgs)
	if err != nil {
		t.Fatal(err)
	}
	if len(cfg.Rules) != 3 {
		t.Fatalf("expected 3 rules, got %d", len(cfg.Rules))
	}
	for i, want := range []string{"hot/", "warm/", "cold/"} {
		if got := cfg.Rules[i].RuleFilter.Prefix; got != want {
			t.Fatalf("rule %d prefix = %q want %q", i, got, want)
		}
	}
}

// TestNew_LocalCapabilities reports the zero caps for the local constructor.
func TestNew_LocalCapabilities(t *testing.T) {
	s, err := New(Config{Type: "local", BasePath: t.TempDir()})
	if err != nil {
		t.Fatal(err)
	}
	if _, ok := s.(AdvancedBackend); ok {
		t.Fatal("local must not satisfy AdvancedBackend")
	}
}