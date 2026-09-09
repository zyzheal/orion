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

// isTreeHashLine returns true when the line is a lowercase hex OID of the
// length emitted by the configured repository (40 for SHA-1, 64 for SHA-256).
// It is heuristic but sufficient: a conflict entry always contains a space
// followed by a tab, and a merge message contains punctuation.
func isTreeHashLine(line string) bool {
	if len(line) != 40 && len(line) != 64 {
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

// ExtractTreeHash returns the tree hash emitted on the first non-empty line
// of `git merge-tree --write-tree` output, or an empty string when no valid
// hash is present. The hash is a 40-char (or 64-char) lowercase hex OID.
func ExtractTreeHash(output []byte) string {
	if len(output) == 0 {
		return ""
	}
	for _, raw := range strings.Split(string(output), "\n") {
		line := strings.TrimSpace(raw)
		if line == "" {
			continue
		}
		if isTreeHashLine(line) {
			return line
		}
		// First non-empty line is not a hash — malformed output, stop early.
		return ""
	}
	return ""
}

// ParseDiffNameStatus parses the stdout of `git diff --name-status`. Each
// line has the form "<status>\t<path>" where status starts with one of:
//   - A: added file
//   - M: modified file
//   - D: deleted file
//   - R: rename (RNN with similarity percentage, e.g. "R100"); treated as
//     modified because the destination path is new.
//   - C: copy (CNN with similarity); treated as modified.
//   - U: unmerged (only from --name-status on index state, not from a
//     diff between two trees); treated as modified conservatively.
//   - T: type change (e.g. file → symlink); treated as modified.
//
// Unknown statuses are also treated as modified — being conservative avoids
// silently dropping a file from the classification. Rename/copy entries
// have a second tab-separated path; the destination (rightmost) is used.
//
// All returned slices are deduped and sorted. Empty input yields three
// empty non-nil slices.
func ParseDiffNameStatus(output []byte) (added, modified, deleted []string) {
	added = []string{}
	modified = []string{}
	deleted = []string{}
	if len(output) == 0 {
		return added, modified, deleted
	}
	for _, raw := range strings.Split(string(output), "\n") {
		line := strings.TrimRight(raw, "\r\n")
		if line == "" {
			continue
		}
		parts := strings.SplitN(line, "\t", 3)
		if len(parts) < 2 {
			// Malformed line — no tab. Skip rather than misclassify.
			continue
		}
		status := strings.TrimSpace(parts[0])
		// For renames/copies (R/C), parts has 3 entries: [status, fromPath, toPath].
		// Use the destination path (last tab-separated field) as the "new" name.
		path := parts[len(parts)-1]
		path = strings.TrimSpace(path)
		if path == "" {
			continue
		}
		switch {
		case strings.HasPrefix(status, "A"):
			added = append(added, path)
		case strings.HasPrefix(status, "D"):
			deleted = append(deleted, path)
		case strings.HasPrefix(status, "M"):
			modified = append(modified, path)
		case strings.HasPrefix(status, "R"), strings.HasPrefix(status, "C"),
			strings.HasPrefix(status, "U"), strings.HasPrefix(status, "T"):
			// Rename/copy/unmerged/type-change all treated as modified —
			// the destination path in the merged tree is the one we care
			// about, and any content change is at least as likely as a
			// pure rename.
			modified = append(modified, path)
		default:
			// Unknown status — conservative fallback.
			modified = append(modified, path)
		}
	}
	return dedupeSorted(added), dedupeSorted(modified), dedupeSorted(deleted)
}

// validateRefs is a small guard used by tests to confirm the executor
// rejects empty refs without invoking git.
func validateRefs(sourceRef, targetRef string) error {
	if sourceRef == "" || targetRef == "" {
		return fmt.Errorf("gitmerge: sourceRef and targetRef are required")
	}
	return nil
}
