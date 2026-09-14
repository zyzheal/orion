package scan

import (
	"os"
	"path/filepath"
	"testing"
)

// writeTempTree writes the given relative paths into a fresh temp dir and
// returns the directory. Each value is the whole file content, so a line number
// can be asserted from the number of newlines before the payload.
func writeTempTree(t *testing.T, files map[string]string) string {
	t.Helper()
	root := t.TempDir()
	for rel, body := range files {
		p := filepath.Join(root, rel)
		if err := os.MkdirAll(filepath.Dir(p), 0o755); err != nil {
			t.Fatalf("mkdir %s: %v", rel, err)
		}
		if err := os.WriteFile(p, []byte(body), 0o644); err != nil {
			t.Fatalf("write %s: %v", rel, err)
		}
	}
	return root
}

// payload prepends one comment line so the finding lands on line 2.
func payload(body string) string { return "// line one\n" + body + "\n" }

func TestScan_DetectsEachRuleAtTheRightLine(t *testing.T) {
	cases := []struct {
		file     string
		body     string
		rule     string
		severity string
		category string
	}{
		{"rsa.go", payload(`key = "-----BEGIN RSA PRIVATE KEY-----"`),
			"private-key-block", "critical", "sensitive_data"},
		{"aws.go", payload(`awsKey := "AKIAIOSFODNN7EXAMPLE"`),
			"aws-access-key-id", "critical", "sensitive_data"},
		{"gh.go", payload(`tok := "ghp_abcdefghij1234567890ABCD"`),
			"github-token", "critical", "sensitive_data"},
		{"gcp.go", payload(`gkey := "AIzaSyABCDEFGHIJKLMNOPQRSTUVWXYZ12345"`),
			"google-api-key", "high", "sensitive_data"},
		// The sample deliberately omits Stripe's "51" account-number prefix so
		// the literal is not a real Stripe secret format (the rule regex still
		// matches it: sk_live_ + 16+ alphanumerics).
		{"stripe.go", payload(`sk := "sk_live_H8k7Qx0rE2wZ9AbCdEfG12"`),
			"stripe-live-secret-key", "critical", "sensitive_data"},
		{"slack.go", payload(`bot := "xoxb-1234567890-abcdefghij"`),
			"slack-token", "high", "sensitive_data"},
		{"cred.go", payload(`password: "S3cretValue123"`),
			"hardcoded-credential", "high", "sensitive_data"},
		{"sql.go", payload(`q := fmt.Sprintf("SELECT * FROM users WHERE name = '%s'", name)`),
			"go-sql-sprintf", "critical", "injection"},
		{"shell.go", payload(`exec.Command("sh", "-c")`),
			"shell-command-injection", "high", "injection"},
		{"eval.js", payload(`eval(input)`),
			"dynamic-eval", "high", "injection"},
		{"xss.js", payload(`el.innerHTML = html`),
			"dom-xss", "high", "xss"},
		{"tls.go", payload(`InsecureSkipVerify: true`),
			"tls-skip-verify", "high", "security_misconfig"},
		{"cors.go", payload(`Access-Control-Allow-Origin: '*'`),
			"wildcard-cors-origin", "medium", "security_misconfig"},
		{"gin.go", payload(`gin.SetMode(gin.DebugMode)`),
			"gin-debug-mode", "medium", "security_misconfig"},
		{"hash.go", payload(`h := md5.Sum(data)`),
			"weak-hash", "medium", "integrity"},
		{"log.go", payload(`log.Printf("token=%s", token)`),
			"secret-in-log", "medium", "logging"},
	}

	files := map[string]string{}
	for _, c := range cases {
		files[c.file] = c.body
	}
	root := writeTempTree(t, files)

	rep, err := Scan(root, NewDefaultRules(), DefaultOption())
	if err != nil {
		t.Fatalf("Scan: %v", err)
	}

	byRule := map[string]Finding{}
	for _, f := range rep.Findings {
		byRule[f.RuleID] = f
	}
	for _, c := range cases {
		f, ok := byRule[c.rule]
		if !ok {
			t.Errorf("rule %s did not fire; findings=%v", c.rule, rep.Findings)
			continue
		}
		if f.Severity != c.severity {
			t.Errorf("rule %s severity = %s, want %s", c.rule, f.Severity, c.severity)
		}
		if f.Category != c.category {
			t.Errorf("rule %s category = %s, want %s", c.rule, f.Category, c.category)
		}
		if f.File != c.file {
			t.Errorf("rule %s file = %s, want %s", c.rule, f.File, c.file)
		}
		if f.Line != 2 {
			t.Errorf("rule %s line = %d, want 2", c.rule, f.Line)
		}
		if f.Description == "" || f.Fix == "" {
			t.Errorf("rule %s has an empty description or fix", c.rule)
		}
	}
	if rep.Counts.Total != len(rep.Findings) {
		t.Errorf("Counts.Total = %d, want %d findings", rep.Counts.Total, len(rep.Findings))
	}
	if rep.Counts.Critical != 5 || rep.Counts.High != 7 || rep.Counts.Medium != 4 {
		t.Errorf("Counts = %+v, want critical=5 high=7 medium=4", rep.Counts)
	}
	if rep.FilesScanned != len(cases) {
		t.Errorf("FilesScanned = %d, want %d", rep.FilesScanned, len(cases))
	}
	if rep.Duration <= 0 {
		t.Error("Duration must be positive so the page can show a real run time")
	}
}

func TestScan_CleanTreeReportsZeroFindings(t *testing.T) {
	root := writeTempTree(t, map[string]string{
		"main.go":   payload(`func main() {}`),
		"readme.md": payload("# Orion"),
	})
	rep, err := Scan(root, NewDefaultRules(), DefaultOption())
	if err != nil {
		t.Fatalf("Scan: %v", err)
	}
	if rep.Counts.Total != 0 || len(rep.Findings) != 0 {
		t.Fatalf("clean tree must report no findings, got %+v", rep.Findings)
	}
	if rep.FilesScanned != 2 {
		t.Errorf("FilesScanned = %d, want 2", rep.FilesScanned)
	}
}

func TestScan_BadRootsAreErrors(t *testing.T) {
	if _, err := Scan(filepath.Join(t.TempDir(), "no-such-dir"), NewDefaultRules(), DefaultOption()); err == nil {
		t.Error("a missing root must be an error")
	}
	root := t.TempDir()
	file := filepath.Join(root, "f.txt")
	if err := os.WriteFile(file, []byte("x"), 0o644); err != nil {
		t.Fatal(err)
	}
	if _, err := Scan(file, NewDefaultRules(), DefaultOption()); err == nil {
		t.Error("a regular file must be rejected: it is not a scan target")
	}
}

// TestScan_SkipsVendorDirectories pins the SkipDirs list. A vendor tree is the
// single biggest source of noise in a repository scan, and every one of its
// findings is somebody else's bug.
func TestScan_SkipsVendorDirectories(t *testing.T) {
	root := writeTempTree(t, map[string]string{
		"app.go":            payload(`func main() {}`),
		"vendor/dep.go":     payload(`key = "-----BEGIN RSA PRIVATE KEY-----"`),
		"node_modules/a.js": payload(`el.innerHTML = html`),
		"build/out.go":      payload(`InsecureSkipVerify: true`),
	})
	rep, err := Scan(root, NewDefaultRules(), DefaultOption())
	if err != nil {
		t.Fatalf("Scan: %v", err)
	}
	if len(rep.Findings) != 0 {
		t.Fatalf("findings from skipped directories leaked into the report: %+v", rep.Findings)
	}
}

func TestScan_SkipsSymlinksBinariesAndOversizedFiles(t *testing.T) {
	root := t.TempDir()
	plant := payload(`key = "-----BEGIN RSA PRIVATE KEY-----"` + "\n")
	if err := os.WriteFile(filepath.Join(root, "real.go"), []byte(plant), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink("real.go", filepath.Join(root, "alias.go")); err != nil {
		t.Fatalf("symlink: %v", err)
	}
	if err := os.WriteFile(filepath.Join(root, "blob.dat"),
		[]byte("\x00\x01\x02"+`-----BEGIN RSA PRIVATE KEY-----`+"\x00"), 0o644); err != nil {
		t.Fatal(err)
	}
	big := make([]byte, 4096)
	copy(big, []byte(plant))
	if err := os.WriteFile(filepath.Join(root, "big.go"), big, 0o644); err != nil {
		t.Fatal(err)
	}

	rep, err := Scan(root, NewDefaultRules(), Option{MaxFileSize: 256})
	if err != nil {
		t.Fatalf("Scan: %v", err)
	}
	if len(rep.Findings) != 1 {
		t.Fatalf("want the one real.go finding, got %+v", rep.Findings)
	}
	if rep.Findings[0].File != "real.go" {
		t.Errorf("finding came from %s, want real.go", rep.Findings[0].File)
	}
	if rep.FilesSkipped != 3 {
		t.Errorf("FilesSkipped = %d, want 3 (symlink, binary, oversized)", rep.FilesSkipped)
	}
	if rep.FilesScanned != 1 {
		t.Errorf("FilesScanned = %d, want 1", rep.FilesScanned)
	}
}

func TestScan_MaxDepthSkipsDeepFiles(t *testing.T) {
	root := writeTempTree(t, map[string]string{
		"top.go":               payload(`key = "-----BEGIN RSA PRIVATE KEY-----"`),
		"deep/a/b/c/nested.go": payload(`key = "-----BEGIN RSA PRIVATE KEY-----"`),
	})
	rep, err := Scan(root, NewDefaultRules(), Option{MaxDepth: 2})
	if err != nil {
		t.Fatalf("Scan: %v", err)
	}
	if len(rep.Findings) != 1 || rep.Findings[0].File != "top.go" {
		t.Fatalf("MaxDepth=2 must leave only the depth-1 file: %+v", rep.Findings)
	}
	if rep.FilesSkipped != 1 {
		t.Errorf("FilesSkipped = %d, want 1", rep.FilesSkipped)
	}
}

func TestScan_MaxFilesTruncatesTheWalk(t *testing.T) {
	root := writeTempTree(t, map[string]string{
		"a.go": payload(`key = "-----BEGIN RSA PRIVATE KEY-----"`),
		"b.go": payload(`key = "-----BEGIN RSA PRIVATE KEY-----"`),
		"c.go": payload(`key = "-----BEGIN RSA PRIVATE KEY-----"`),
	})
	rep, err := Scan(root, NewDefaultRules(), Option{MaxFiles: 2})
	if err != nil {
		t.Fatalf("Scan: %v", err)
	}
	if !rep.TruncatedFiles {
		t.Error("TruncatedFiles must be set so the page knows the report is partial")
	}
	if len(rep.Findings) != 2 || rep.FilesScanned != 2 {
		t.Errorf("MaxFiles=2 scanned %d files for %d findings", rep.FilesScanned, len(rep.Findings))
	}
}

func TestScan_MaxFindingsCapsTheReport(t *testing.T) {
	const key = "-----BEGIN RSA PRIVATE KEY-----"
	body := "// three hits\n" +
		"key = \"" + key + "\"\n" +
		"key = \"" + key + "\"\n" +
		"key = \"" + key + "\"\n"
	root := writeTempTree(t, map[string]string{"many.go": body})
	rep, err := Scan(root, NewDefaultRules(), Option{MaxFindings: 2})
	if err != nil {
		t.Fatalf("Scan: %v", err)
	}
	if len(rep.Findings) != 2 {
		t.Errorf("MaxFindings=2 produced %d findings", len(rep.Findings))
	}
	if rep.Counts.Total != len(rep.Findings) {
		t.Errorf("Counts.Total = %d, want the number of findings kept", rep.Counts.Total)
	}
}

// TestScan_PlaceholderCredentialsAreSuppressed is the precision test. The
// credential rule matches the key name as well as the value, so without the
// placeholder filter every configuration template in the repository is a
// finding and the page is useless.
func TestScan_PlaceholderCredentialsAreSuppressed(t *testing.T) {
	root := writeTempTree(t, map[string]string{
		"real.go": payload(`password: "S3cretValue123"`),
		"template.go": payload(
			`password: "changeme"` + "\n" +
				`api_key: "${API_KEY}"` + "\n" +
				`secret: "<your-secret>"` + "\n" +
				`db_password: "example-password"` + "\n" +
				`client_secret: "replace-me-with-the-real-value"` + "\n" +
				`secret: "%s"` + "\n" +
				`password: "test"` + "\n",
		),
	})
	rep, err := Scan(root, NewDefaultRules(), DefaultOption())
	if err != nil {
		t.Fatalf("Scan: %v", err)
	}
	if len(rep.Findings) != 1 {
		t.Fatalf("want exactly the real credential, got %+v", rep.Findings)
	}
	if rep.Findings[0].File != "real.go" || rep.Findings[0].RuleID != "hardcoded-credential" {
		t.Errorf("wrong finding: %+v", rep.Findings[0])
	}
}

// TestScan_ZeroOptionStillScans guards normalise. A zero Option has MaxDepth=0,
// so every file is deeper than the cap and the whole tree is skipped: the scan
// reports an empty repository as clean. That is the failure mode of the whole
// module, so it is tested directly rather than left to the default path.
func TestScan_ZeroOptionStillScans(t *testing.T) {
	root := writeTempTree(t, map[string]string{
		"secrets.go": payload(`key = "-----BEGIN RSA PRIVATE KEY-----"`),
	})
	rep, err := Scan(root, NewDefaultRules(), Option{})
	if err != nil {
		t.Fatalf("Scan: %v", err)
	}
	if len(rep.Findings) == 0 {
		t.Fatal("a zero Option must not silently scan nothing")
	}
}

func TestScan_OutputIsDeterministic(t *testing.T) {
	root := writeTempTree(t, map[string]string{
		"z_low.go":  payload(`Access-Control-Allow-Origin: '*'`),
		"a_crit.go": payload(`key = "-----BEGIN RSA PRIVATE KEY-----"`),
		"m_hash.go": payload(`h := md5.Sum(data)`),
	})
	rules := NewDefaultRules()
	first, err := Scan(root, rules, DefaultOption())
	if err != nil {
		t.Fatalf("Scan: %v", err)
	}
	second, err := Scan(root, rules, DefaultOption())
	if err != nil {
		t.Fatalf("Scan: %v", err)
	}
	if first.Counts != second.Counts {
		t.Errorf("counts are not stable: %+v vs %+v", first.Counts, second.Counts)
	}
	if len(first.Findings) != len(second.Findings) {
		t.Fatalf("finding counts differ: %d vs %d", len(first.Findings), len(second.Findings))
	}
	for i := range first.Findings {
		if first.Findings[i].RuleID != second.Findings[i].RuleID ||
			first.Findings[i].File != second.Findings[i].File ||
			first.Findings[i].Line != second.Findings[i].Line {
			t.Errorf("finding %d is not stable: %+v vs %+v", i, first.Findings[i], second.Findings[i])
		}
	}
	// Most severe first, so the page shows what actually matters.
	if first.Findings[0].Severity != "critical" {
		t.Errorf("findings[0].Severity = %s, want critical", first.Findings[0].Severity)
	}
}

// TestScan_UnknownSeverityCannotHideAFinding: a rule that invents a new
// severity level must still be counted in the total. Otherwise adding a
// "blocker" rule would make findings disappear from the counters.
func TestScan_UnknownSeverityCannotHideAFinding(t *testing.T) {
	root := writeTempTree(t, map[string]string{
		"one.go": payload(`key = "-----BEGIN RSA PRIVATE KEY-----"`),
	})
	rules := []Rule{
		NewRule("custom", "injection", "blocker", "desc", "fix", `-----BEGIN RSA PRIVATE KEY-----`, false),
	}
	rep, err := Scan(root, rules, DefaultOption())
	if err != nil {
		t.Fatalf("Scan: %v", err)
	}
	if rep.Counts.Total != 1 {
		t.Fatalf("Counts.Total = %d, want 1", rep.Counts.Total)
	}
	if rep.Counts.Critical+rep.Counts.High+rep.Counts.Medium+rep.Counts.Low != 0 {
		t.Errorf("an unknown severity must not be folded into a known one: %+v", rep.Counts)
	}
}

func TestScan_UnreadableFileIsSkippedNotFatal(t *testing.T) {
	if os.Geteuid() == 0 {
		t.Skip("root can read anything, so the unreadable-file path cannot be exercised")
	}
	root := t.TempDir()
	good := filepath.Join(root, "good.go")
	if err := os.WriteFile(good, []byte(payload(`key = "-----BEGIN RSA PRIVATE KEY-----"`)), 0o644); err != nil {
		t.Fatal(err)
	}
	bad := filepath.Join(root, "bad.go")
	if err := os.WriteFile(bad, []byte(payload(`key = "-----BEGIN RSA PRIVATE KEY-----"`)), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.Chmod(bad, 0); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = os.Chmod(bad, 0o644) })

	rep, err := Scan(root, NewDefaultRules(), DefaultOption())
	if err != nil {
		t.Fatalf("one unreadable file must not abort the scan: %v", err)
	}
	if len(rep.Findings) != 1 {
		t.Fatalf("want the finding from the readable file, got %+v", rep.Findings)
	}
	if rep.FilesSkipped != 1 {
		t.Errorf("FilesSkipped = %d, want 1", rep.FilesSkipped)
	}
}

// TestNewRule_BadPatternIsABuildFailure: the rule set is a constant, so a typo
// in a pattern must panic at construction rather than silently match nothing at
// runtime. A rule that never fires is indistinguishable from a clean repo.
func TestNewRule_BadPatternIsABuildFailure(t *testing.T) {
	defer func() {
		if recover() == nil {
			t.Error("a malformed pattern must panic")
		}
	}()
	_ = NewRule("broken", "injection", "high", "d", "f", "(", false)
}
