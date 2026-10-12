package script

import (
	"testing"
)

func TestWhitelist_DenyByDefault(t *testing.T) {
	w := NewWhitelist()
	if w.Allow("t1", "bash") {
		t.Error("expected empty whitelist to deny bash")
	}
	if w.Allow("t1", "") {
		t.Error("expected empty scriptType to be denied")
	}
	if w.Allow("t1", "   ") {
		t.Error("expected whitespace scriptType to be denied")
	}
}

func TestWhitelist_AllowAfterAdd(t *testing.T) {
	w := NewWhitelist()
	w.Add("t1", "bash")
	if !w.Allow("t1", "bash") {
		t.Error("expected bash allowed")
	}
	if w.Allow("t1", "python") {
		t.Error("expected python denied (not added)")
	}
	if w.Allow("t2", "bash") {
		t.Error("expected bash denied for unknown tenant")
	}
}

func TestWhitelist_CaseInsensitiveAndTrim(t *testing.T) {
	w := NewWhitelist()
	w.Add("t1", "  Bash  ")
	if !w.Allow("t1", "bash") {
		t.Error("expected Bash (case-insensitive) to allow bash")
	}
	if !w.Allow("t1", "BASH") {
		t.Error("expected BASH to normalize and allow")
	}
}

func TestWhitelist_IdempotentAdd(t *testing.T) {
	w := NewWhitelist()
	w.Add("t1", "bash")
	w.Add("t1", "bash")
	if !w.Allow("t1", "bash") {
		t.Error("idempotent Add should still allow")
	}
}

func TestWhitelist_AddAll(t *testing.T) {
	w := NewWhitelist()
	w.AddAll("t1", "bash", "python3", "python2")
	for _, st := range []string{"bash", "python3", "python2"} {
		if !w.Allow("t1", st) {
			t.Errorf("expected %s allowed", st)
		}
	}
}

func TestWhitelist_PermissiveMode(t *testing.T) {
	w := NewWhitelistPermissive()
	if !w.Allow("anyone", "bash") {
		t.Error("permissive should allow unknown tenant")
	}
	if !w.Allow("anyone", "python") {
		t.Error("permissive should allow any type")
	}
}

func TestWhitelist_EmptyTypeDeniedEvenInPermissive(t *testing.T) {
	w := NewWhitelistPermissive()
	if w.Allow("anyone", "") {
		t.Error("permissive must still deny empty type")
	}
}
