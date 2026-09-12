package main

import (
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
)

// similarity(text, text) is not a Postgres built-in: it comes from the pg_trgm
// extension. knowledge.Repository.Retrieve and ai/knowledge.Repository both
// ORDER BY it on live retrieve routes, so if no migration creates the extension
// every RAG retrieval fails at runtime with
// "function similarity(character varying, character varying) does not exist".
//
// That failure is invisible to go build and go vet — the code compiles and the
// server starts fine, and only fails once a request reaches the query. This test
// pins the closure: if any Go file calls similarity(), some forward migration
// must install the extension that provides it.
func TestMigrationsCreateTheExtensionsTheQueriesNeed(t *testing.T) {
	created := map[string]bool{}
	re := regexp.MustCompile(`(?i)CREATE\s+EXTENSION\s+IF\s+NOT\s+EXISTS\s+["']?([A-Za-z_]+)["']?`)

	entries, err := os.ReadDir("../../migrations")
	if err != nil {
		t.Fatalf("read migrations dir: %v", err)
	}
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".sql") {
			continue
		}
		// Rollbacks are applied only on explicit MIGRATE_DOWN_TO and would
		// remove the extension; the invariant is about the forward path.
		if strings.HasSuffix(e.Name(), "_down.sql") {
			continue
		}
		b, rerr := os.ReadFile(filepath.Join("../../migrations", e.Name()))
		if rerr != nil {
			continue
		}
		for _, m := range re.FindAllStringSubmatch(string(b), -1) {
			created[m[1]] = true
		}
	}

	// Count the callers so the assertion is anchored on real usage rather than
	// on a hardcoded belief that someone still calls similarity().
	callers := 0
	_ = filepath.WalkDir("../../internal", func(path string, d os.DirEntry, err error) error {
		if err != nil || d.IsDir() || !strings.HasSuffix(path, ".go") || strings.HasSuffix(path, "_test.go") {
			return nil
		}
		b, rerr := os.ReadFile(path)
		if rerr != nil {
			return nil
		}
		if strings.Contains(string(b), "similarity(") {
			callers++
		}
		return nil
	})

	if callers == 0 {
		t.Skip("no Go code calls similarity(), so pg_trgm is not required")
	}
	if !created["pg_trgm"] {
		t.Errorf("%d Go files call similarity() but no forward migration runs CREATE EXTENSION pg_trgm; "+
			"RAG retrieve fails at runtime with \"function similarity does not exist\"", callers)
	}
	if len(created) == 0 {
		t.Error("no forward migration creates any extension")
	}
}
