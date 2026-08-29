package main

import (
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"

	"orion/go-common/pkg/auth"
)

// TestPermissionGuardAudit is a source-level audit of every permission guard in
// internal/. It exists because two whole classes of RBAC bug were invisible to
// go build, go vet and every unit test:
//
//  1. Unsatisfiable guard — "data-mashing" instead of "data-masking" in
//     internal/data-masking/handler/handler.go:30. The typo compiled fine and
//     every one of the 5 sibling guards that used the right name was ignored,
//     because no role held "data-mashing:*" and the 6 affected routes degraded
//     to super_admin-only.
//  2. Super_admin-only guard — the dba role defined no "dba:*" permission at
//     all (PERM-3), so all 34 dba guards rejected real DBA users with 403 while
//     reads leaked through "*:read". Ten further guard pairs (67 call sites) had
//     no grant from any non-super_admin role at all.
//
// Four assertions:
//
//	R1 every guard pair is satisfied by at least one non-super_admin role
//	R2 resource spelling cannot change the outcome ("_"/"-" are equivalent)
//	R3 every guard-bearing module is guarded under its own directory name
//	R4 no guard resource is one substitution away from a module directory name
//
// R4 is what catches "data-mashing"↔"data-masking" without needing the audit to
// know which of the two is correct.
func TestPermissionGuardAudit(t *testing.T) {
	guardRe := regexp.MustCompile(`RequirePermission\(\s*"([^"]+)"\s*,\s*"([^"]+)"\s*\)`)

	pairs := map[string]int{}             // "resource:action" -> call sites
	resources := map[string]bool{}        // guard resource -> used
	byDir := map[string]map[string]bool{} // top-level module dir -> resources
	moduleDirs := map[string]bool{}

	// The test binary runs with cwd == cmd/server, and the module root is the
	// directory holding go.mod — walk up to find it rather than hard-coding the
	// depth (this repo nests cmd/server two levels below the root).
	root, e := findModuleRoot()
	if e != nil {
		t.Fatalf("locate module root: %v", e)
	}
	t.Logf("module root: %s", root)

	err := filepath.WalkDir(root, func(p string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() {
			if rel, e := filepath.Rel(root, p); e == nil && rel == "internal" {
				ents, _ := os.ReadDir(p)
				for _, e2 := range ents {
					if e2.IsDir() {
						moduleDirs[e2.Name()] = true
					}
				}
			}
			return nil
		}
		if d.Name() == ".git" || !strings.HasSuffix(d.Name(), ".go") || strings.HasSuffix(d.Name(), "_test.go") {
			return nil
		}
		rel, e := filepath.Rel(root, p)
		if e != nil || !strings.HasPrefix(rel, "internal/") {
			return nil
		}
		dir := strings.SplitN(rel, "/", 2)[0]
		data, e := os.ReadFile(p)
		if e != nil {
			return nil
		}
		for _, m := range guardRe.FindAllStringSubmatch(string(data), -1) {
			res, act := m[1], m[2]
			res = normRes(res)
			act = normRes(act)
			key := res + ":" + act
			pairs[key]++
			resources[res] = true
			if byDir[dir] == nil {
				byDir[dir] = map[string]bool{}
			}
			byDir[dir][res] = true
		}
		return nil
	})
	if err != nil {
		t.Fatalf("walk %s: %v", root, err)
	}

	t.Logf("audited %d guard pairs over %d call sites, %d distinct resources, %d module dirs",
		len(pairs), countSites(pairs), len(resources), len(moduleDirs))
	if len(pairs) < 500 {
		t.Fatalf("only %d guard pairs found — the regex or the scan root is wrong", len(pairs))
	}

	// R1 — every guard must be reachable by a role a real user can actually hold.
	roles := auth.GetAllRoles()
	unreachable := map[string][]string{} // "resource:action" -> super_admin-only witnesses
	for pair := range pairs {
		res, act := splitPair(pair)
		holders := 0
		for _, r := range roles {
			if r == "super_admin" {
				continue
			}
			if auth.HasPermission(r, res, act) {
				holders++
			}
		}
		if holders == 0 {
			unreachable[pair] = []string{pair}
		}
	}
	if len(unreachable) > 0 {
		msg := fmt.Sprintf("R1: %d guard pairs are reachable only by super_admin — no other role\nholds the grant, so the endpoints silently 403 for every real user.\nFix by granting the resource to a role in pkg/auth/permission.go:\n", len(unreachable))
		for pair := range unreachable {
			msg += fmt.Sprintf("  %-40s (%d call sites)\n", pair, pairs[pair])
		}
		t.Error(msg)
	}

	// R2 — "_"/"-" must not change the authorization outcome. The audit found
	// four resources spelled both ways: audit-log(25)/audit_log(4),
	// middleware-ops(196)/middleware_ops(289), oci-registry(16)/oci_registry(64),
	// report-designer(256)/report_designer(256). A role granted the hyphenated
	// form 403'd on the underscored guards.
	spelling := map[string][]string{}
	for res := range resources {
		alt := strings.ReplaceAll(res, "-", "_")
		if alt == res {
			continue
		}
		for _, act := range []string{"read", "write", "execute", "delete", "approve", "manage", "admin"} {
			for _, r := range roles {
				if (auth.HasPermission(r, res, act) && !auth.HasPermission(r, alt, act)) ||
					(!auth.HasPermission(r, res, act) && auth.HasPermission(r, alt, act)) {
					spelling[res] = append(spelling[res], fmt.Sprintf("role=%-24s %s:%s=%v vs %s:%s=%v",
						r, res, act, auth.HasPermission(r, res, act), alt, act, auth.HasPermission(r, alt, act)))
					break
				}
			}
		}
	}
	for res, msgs := range spelling {
		t.Errorf("R2: resource %q has different outcomes under the two spellings — grant the resource to a role consistently:\n  %s", res, strings.Join(msgs, "\n  "))
	}

	// R3 — a module that has guards must have at least one guard under its own
	// directory name; otherwise the module is unguarded under the name anyone
	// granting access would look for.
	missingName := []string{}
	for dir, res := range byDir {
		if dir == "internal" {
			// Files living directly in internal/ (not in a module subdir) have no
			// module to be guarded under; they are cross-cutting helpers.
			continue
		}
		if !resources[dir] {
			used := make([]string, 0, len(res))
			for r := range res {
				used = append(used, r)
			}
			missingName = append(missingName, fmt.Sprintf("  module %s guards use %v — never %q", dir, used, dir))
		}
	}
	if len(missingName) > 0 {
		t.Errorf("R3: %d guard-bearing modules never guard under their own directory name:\n%s", len(missingName), strings.Join(missingName, "\n"))
	}

	// R5 — a role named after a resource must not be locked out of it. R1 only
	// proves that *some* role can reach a guard; removing "dba:*" from the dba
	// role still passes R1 because data_admin also grants it, and the 34 dba
	// guards would 403 for real DBA users (the original PERM-3 bug).
	owning := map[string][]string{} // role -> guard pairs it owns but cannot satisfy
	for _, r := range roles {
		if len(r) < 3 {
			continue
		}
		name := normRes(r)
		for pair := range pairs {
			res, act := splitPair(pair)
			if res != name || act == "" {
				continue
			}
			if !auth.HasPermission(r, res, act) {
				owning[r] = append(owning[r], pair)
			}
		}
	}
	for r, ps := range owning {
		t.Errorf("R5: role %q is locked out of its own resource by %d guard pairs:\n  %s",
			r, len(ps), strings.Join(ps, ", "))
	}

	// R4 — a guard resource one substitution away from a module directory name is
	// a typo (data-mashing vs data-masking). Substitutions only: pluralisation
	// such as "agent" vs the agents/ directory is legitimate.
	typos := []string{}
	for res := range resources {
		if moduleDirs[res] {
			continue
		}
		for dir := range moduleDirs {
			if oneSubstitutionApart(res, dir) {
				// Short acronyms legitimately sit one letter apart ("api" vs the
				// apm/ module, "sla" vs slo/, "sso" vs slo/). They are excluded:
				// all three are len 3, and every real typo found so far — the
				// data-mashing/data-masking pair — is long enough to be unambiguous.
				if len(res) < 5 {
					continue
				}
				typos = append(typos, fmt.Sprintf("  guard %q vs module %s (used %d times) — likely a typo", res, dir, resourceSites(resources, pairs, res)))
			}
		}
	}
	if len(typos) > 0 {
		t.Errorf("R4: %d guard resources are one character substitution away from a module directory name:\n%s", len(typos), strings.Join(typos, "\n"))
	}
}

func normRes(s string) string { return strings.ReplaceAll(s, "_", "-") }

func splitPair(pair string) (string, string) {
	p := strings.SplitN(pair, ":", 2)
	if len(p) == 2 {
		return p[0], p[1]
	}
	return p[0], ""
}

func countSites(pairs map[string]int) int {
	n := 0
	for _, v := range pairs {
		n += v
	}
	return n
}

func resourceSites(resources map[string]bool, pairs map[string]int, res string) int {
	n := 0
	for pair, c := range pairs {
		if strings.SplitN(pair, ":", 2)[0] == res {
			n += c
		}
	}
	return n
}

// oneSubstitutionApart reports whether s and d have equal length and differ in
// exactly one rune.
func oneSubstitutionApart(s, d string) bool {
	if len(s) != len(d) || s == d {
		return false
	}
	diff := 0
	for i := 0; i < len(s); i++ {
		if s[i] != d[i] {
			diff++
			if diff > 1 {
				return false
			}
		}
	}
	return diff == 1
}

// findModuleRoot walks up from the current directory to the one holding go.mod.
func findModuleRoot() (string, error) {
	d, err := os.Getwd()
	if err != nil {
		return "", err
	}
	for {
		if _, e := os.Stat(filepath.Join(d, "go.mod")); e == nil {
			return d, nil
		}
		parent := filepath.Dir(d)
		if parent == d {
			return "", fmt.Errorf("no go.mod above %s", d)
		}
		d = parent
	}
}
