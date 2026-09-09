package gitmerge

import (
	"fmt"
	"sort"
	"strings"
)

// ParseMergeTreeOutput parses the stdout of `git merge-tree --write-tree`.
// The output layout (git >= 2.38) is:
//
//	<tree-hash>\n
//	<mode> <oid> <stage>\t<filename>\n          (repeated for each conflict entry)
//	\n
//	<merge messages>\n                          (informational, ignored)
//
// We extract unique filenames from the conflict entries. A file appearing in
// stages 1/2/3 is a conflict; a file appearing only in stage 0 (the merged
// result) is not a conflict and is not listed in the conflict section.
//
// Empty input is treated as "no conflicts" (an empty Result) rather than an
// error — this lets the caller distinguish "git ran and produced no output"
// from "git failed".
func ParseMergeTreeOutput(output []byte) (*Result, error) {
	res := &Result{
		ConflictFiles: []string{},
		AddedFiles:    []string{},
		ModifiedFiles: []string{},
		DeletedFiles:  []string{},
	}
	if len(output) == 0 {
		return res, nil
	}
	lines := splitLines(output)
	inConflictSection := false
	for _, raw := range lines {
		line := strings.TrimRight(raw, "\r\n")
		if line == "" {
			// Blank line marks the transition from the structured conflict
			// entries to the free-form merge messages. Stop collecting
			// conflicts once we cross it.
			if inConflictSection {
				break
			}
			continue
		}
		// First non-empty line is the tree hash — skip it.
		if !inConflictSection {
			inConflictSection = true
			// Check if the first line looks like a conflict entry or a hash.
			if isTreeHashLine(line) {
				continue
			}
			// Otherwise it's already a conflict entry — fall through.
		}
		filename, ok := parseConflictEntry(line)
		if !ok {
			// Not a conflict entry — could be a merge message that appeared
			// before the blank line (rare, but git versions vary). Skip.
			continue
		}
		res.ConflictFiles = append(res.ConflictFiles, filename)
	}
	res.ConflictFiles = dedupeSorted(res.ConflictFiles)
	return res, nil
}

// isTreeHashLine returns true when the line is a 40-char hex SHA (the tree
// hash emitted by --write-tree). It is heuristic but sufficient: a conflict
// entry always contains a space followed by a tab.
func isTreeHashLine(line string) bool {
	if len(line) != 40 {
		return false
	}
	for _, c := range line {
		if (c < '0' || c > '9') && (c < 'a' || c > 'f') {
			return false
		}
	}
	return true
}

// parseConflictEntry extracts the filename from a structured conflict entry
// of the form "<mode> <oid> <stage>\t<filename>". Returns ok=false for any
// line that does not match.
func parseConflictEntry(line string) (string, bool) {
	// Split on tab — the filename is always on the right side of the tab.
	parts := strings.SplitN(line, "\t", 2)
	if len(parts) != 2 {
		return "", false
	}
	filename := strings.TrimSpace(parts[1])
	if filename == "" {
		return "", false
	}
	// Sanity-check the left side: must be "<mode> <oid> <stage>".
	fields := strings.Fields(parts[0])
	if len(fields) != 3 {
		return "", false
	}
	// Mode and oid are hex, stage is a small integer. We don't strictly
	// validate — git's output is well-formed, but we guard against a
	// malformed line being mistaken for a conflict entry.
	if !isHex(fields[0]) || !isHex(fields[1]) {
		return "", false
	}
	return filename, true
}

func isHex(s string) bool {
	for _, c := range s {
		if (c < '0' || c > '9') && (c < 'a' || c > 'f') && (c < 'A' || c > 'F') {
			return false
		}
	}
	return len(s) > 0
}

func splitLines(b []byte) []string {
	return strings.Split(string(b), "\n")
}

func dedupeSorted(in []string) []string {
	seen := make(map[string]struct{}, len(in))
	out := make([]string, 0, len(in))
	for _, s := range in {
		if _, ok := seen[s]; ok {
			continue
		}
		seen[s] = struct{}{}
		out = append(out, s)
	}
	sort.Strings(out)
	return out
}

// classifyAddedModifiedDeleted is a best-effort splitter that takes a single
// filename list and tries to bucket it into Added / Modified / Deleted. The
// current git merge-tree --write-tree output does not distinguish these
// categories, so this is a no-op placeholder that returns the conflict list
// as ModifiedFiles (the most common case). Callers that need real
// classification should invoke `git diff --name-status` after the merge-tree
// run.
func classifyAddedModifiedDeleted(conflictFiles []string) (added, modified, deleted []string) {
	// Default: everything is "modified". This is conservative — it avoids
	// misclassifying a rename or delete as an add.
	modified = append(modified, conflictFiles...)
	return nil, modified, nil
}

// validateRefs is a small guard used by tests to confirm the executor
// rejects empty refs without invoking git.
func validateRefs(sourceRef, targetRef string) error {
	if sourceRef == "" || targetRef == "" {
		return fmt.Errorf("gitmerge: sourceRef and targetRef are required")
	}
	return nil
}
