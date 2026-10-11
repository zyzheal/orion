package service

import (
	"errors"
	"regexp"
	"testing"
)

// ---------------------------------------------------------------------------
// NullErr — the "success, no error" sentinel
// ---------------------------------------------------------------------------

func TestNullErrIsNonNil(t *testing.T) {
	if NullErr == nil {
		t.Error("NullErr must be non-nil so handlers can distinguish success from errors")
	}
}

func TestNullErrErrorStringIsEmpty(t *testing.T) {
	if got := NullErr.Error(); got != "" {
		t.Errorf("NullErr.Error() = %q, want empty string", got)
	}
}

func TestNullErrIsSelf(t *testing.T) {
	if !errors.Is(NullErr, NullErr) {
		t.Error("errors.Is(NullErr, NullErr) must be true")
	}
}

func TestNullErrIsAnyNonNilErrorIsTrue(t *testing.T) {
	// nullError.Is is defined as `target == NullErr`; any pointer comparison to NullErr is false,
	// but NullErr is a distinct sentinel that compares with itself.
	if errors.Is(NullErr, errors.New("some other error")) {
		t.Error("NullErr must not match arbitrary errors")
	}
}

func TestNullErrWrapping(t *testing.T) {
	wrapped := fmtErrorWrap(NullErr)
	if !errors.Is(wrapped, NullErr) {
		t.Error("errors.Is(wrapped-NullErr, NullErr) should be true")
	}
}

// fmtErrorWrap wraps NullErr in an fmt.Errorf(...) chain to verify Is() works through wrapping.
func fmtErrorWrap(err error) error {
	return errors.Join(err, nil)
}

// ---------------------------------------------------------------------------
// ErrFederatedClusterNotFound / ErrExecutorNotFound / ErrResourcePoolNotFound
// ---------------------------------------------------------------------------

func TestFederationSentinelErrorsAreDistinct(t *testing.T) {
	errs := []error{ErrFederatedClusterNotFound, ErrExecutorNotFound, ErrResourcePoolNotFound}
	for i := range errs {
		for j := range errs {
			if i == j {
				if !errors.Is(errs[i], errs[j]) {
					t.Errorf("same error should match itself: %v", errs[i])
				}
			} else if errors.Is(errs[i], errs[j]) {
				t.Errorf("distinct sentinels should not match: %v == %v", errs[i], errs[j])
			}
		}
	}
}

func TestFederationSentinelErrorStrings(t *testing.T) {
	cases := []struct {
		err  error
		want string
	}{
		{ErrFederatedClusterNotFound, "cluster not found"},
		{ErrExecutorNotFound, "executor not found"},
		{ErrResourcePoolNotFound, "resource pool not found"},
	}
	for _, tc := range cases {
		if got := tc.err.Error(); got != tc.want {
			t.Errorf("err.Error() = %q, want %q", got, tc.want)
		}
	}
}

// ---------------------------------------------------------------------------
// generateID — the "prefix-<uuid-8>" format
// ---------------------------------------------------------------------------

func TestGenerateIDFormat(t *testing.T) {
	s := NewService(nil)
	id := s.generateID("cluster")
	re := regexp.MustCompile(`^cluster-[0-9a-f]{8}$`)
	if !re.MatchString(id) {
		t.Errorf("generateID('cluster') = %q, want to match %v", id, re)
	}
}

func TestGenerateIDDifferentPrefixes(t *testing.T) {
	s := NewService(nil)
	for _, prefix := range []string{"cluster", "config", "exec", "pool"} {
		id := s.generateID(prefix)
		if !regexp.MustCompile(`^`+regexp.QuoteMeta(prefix)+`-[0-9a-f]{8}$`).MatchString(id) {
			t.Errorf("prefix=%s id=%q doesn't match", prefix, id)
		}
	}
}

func TestGenerateIDUnique(t *testing.T) {
	s := NewService(nil)
	seen := map[string]bool{}
	for i := 0; i < 100; i++ {
		id := s.generateID("x")
		if seen[id] {
			t.Fatalf("duplicate ID: %s", id)
		}
		seen[id] = true
	}
}
