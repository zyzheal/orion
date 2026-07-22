package service

import (
	"fmt"
	"strings"
)

// builtInFrameworkNames returns the sorted list of supported framework names
// for use in error messages.
func builtInFrameworkNames() []string {
	out := make([]string, 0, len(builtInFrameworks))
	for name := range builtInFrameworks {
		out = append(out, name)
	}
	// deterministic ordering
	for i := 0; i < len(out); i++ {
		for j := i + 1; j < len(out); j++ {
			if out[i] > out[j] {
				out[i], out[j] = out[j], out[i]
			}
		}
	}
	return out
}

// ---------------------------------------------------------------------------
// Built-in compliance framework definitions
//
// Controls map to generic, platform-agnostic checks that can be evaluated
// against configuration targets provided by the tenant.  The framework
// definitions below mirror common industry standards (SOC2, ISO 27001,
// PCI-DSS, NIST CSF, CIS).
// ---------------------------------------------------------------------------

type rule struct {
	controlID  string
	controlName string
	verdict    string       // implemented | partial | not_implemented
	failures   []string
	warnings   []string
}

type frameworkDefinition struct {
	name     string
	version  string
	domain   string
	controls []rule
}

// builtInFrameworks holds the control catalog for each supported standard.
// In a full deployment these would live in the compliance_frameworks table;
// here they provide a deterministic, queryable catalog for evaluation and
// gap-analysis when the tenant has not seeded its own framework records.
var builtInFrameworks = map[string]frameworkDefinition{
	"soc2": {
		name:    "SOC2",
		version: "2024",
		domain:  "trust-services-criteria",
		controls: []rule{
			{"CC1.1", "Control Environment - Integrity & Ethics", "partial", nil, []string{"Ethics policy not yet formalised."}},
			{"CC2.1", "Communication & Information",             "partial", nil, []string{"Information dissemination workflow unverified."}},
			{"CC3.1", "Risk Assessment",                          "partial", nil, []string{"Risk register may be incomplete."}},
			{"CC4.1", "Monitoring Activities",                    "partial", nil, []string{"Continuous monitoring cadence unverified."}},
			{"CC5.1", "Control Activities",                       "partial", nil, []string{"Control matrix not yet validated."}},
			{"CC6.1", "Logical & Physical Access",                "partial", nil, []string{"Access review cycle length unknown."}},
			{"CC7.1", "System Operations",                        "partial", nil, []string{"Change management evidence unverified."}},
			{"CC7.2", "Change Management",                        "partial", nil, []string{"Peer review on changes unverified."}},
			{"CC8.1", "Risk Mitigation",                          "partial", nil, []string{"Mitigation plans unverified."}},
			{"CC9.1", "Business Continuity",                      "partial", nil, []string{"DR test not found in last 12 months."}},
		},
	},
	"iso27001": {
		name:    "ISO 27001",
		version: "2022",
		domain:  "information-security-management",
		controls: []rule{
			{"A.5.1", "Information Security Policies",              "partial", nil, []string{"Policy approval trail not found."}},
			{"A.5.2", "Information Security Roles & Responsibilities", "partial", nil, nil},
			{"A.8.1", "Asset Management",                           "partial", nil, []string{"Asset inventory completeness unverified."}},
			{"A.9.1", "Access Control Policy",                      "partial", nil, []string{"Access control matrix not loaded."}},
			{"A.10.1", "Cryptography",                              "partial", nil, []string{"Cryptography policy unverified."}},
			{"A.12.1", "Operational Procedures",                    "partial", nil, []string{"SOPs not found for all systems."}},
			{"A.16.1", "Incident Management",                       "partial", nil, []string{"Incident response plan unverified."}},
			{"A.18.1", "Compliance with Legal Requirements",        "partial", nil, []string{"Legal obligations register unverified."}},
			{"A.12.7", "Information Security Logging & Monitoring", "partial", nil, []string{"Log retention period unverified."}},
			{"A.18.2", "Information Security Reviews",              "partial", nil, []string{"Review cadence unknown."}},
		},
	},
	"pci-dss": {
		name:    "PCI-DSS",
		version: "4.0",
		domain:  "payment-card-industry",
		controls: []rule{
			{"1.1",  "Firewall Configuration Standards",           "partial", nil, []string{"Firewall rules not audited."}},
			{"2.1",  "Vendor Defaults Changed",                    "partial", nil, []string{"Default credentials check pending."}},
			{"3.1",  "Protect Stored Cardholder Data",             "partial", nil, []string{"Encryption at rest unverified."}},
			{"4.1",  "Encrypt Transmission of Cardholder Data",    "partial", nil, []string{"TLS version audit pending."}},
			{"5.1",  "Anti-Virus Solutions",                       "partial", nil, []string{"Anti-malware deployment unverified."}},
			{"6.1",  "Secure Systems & Software",                  "partial", nil, []string{"Patch management review pending."}},
			{"7.1",  "Restrict Access by Business Need-to-Know",   "partial", nil, []string{"Need-to-know matrix unverified."}},
			{"8.1",  "Identify Users & Authenticate",              "partial", nil, []string{"MFA coverage unverified."}},
			{"10.1", "Log & Monitor Access to System Components",  "partial", nil, []string{"Audit trail retention unverified."}},
			{"11.1", "Regularly Test Security Systems",            "partial", nil, []string{"Penetration test date unverified."}},
		},
	},
	"nist-csf": {
		name:    "NIST CSF",
		version: "2.0",
		domain:  "cybersecurity-framework",
		controls: []rule{
			{"GV.OC", "Govern - Organizational Context",           "partial", nil, nil},
			{"GV.RM", "Govern - Risk Management Strategy",         "partial", nil, []string{"Risk appetite not documented."}},
			{"ID.AM", "Identify - Asset Management",               "partial", nil, []string{"Asset inventory unverified."}},
			{"ID.RA", "Identify - Risk Assessment",                "partial", nil, []string{"Threat modelling unverified."}},
			{"PR.AC", "Protect - Access Control",                  "partial", nil, []string{"Access reviews unverified."}},
			{"PR.DS", "Protect - Data Security",                   "partial", nil, []string{"Data classification unverified."}},
			{"DE.CM", "Detect - Continuous Monitoring",            "partial", nil, []string{"Monitoring coverage unverified."}},
			{"RS.MA", "Respond - Mitigation & Analysis",           "partial", nil, []string{"Incident runbooks unverified."}},
			{"RC.RP", "Recover - Recovery Planning",               "partial", nil, []string{"Recovery procedures unverified."}},
			{"RC.IM", "Recover - Improvements",                    "partial", nil, []string{"Post-incident improvements unverified."}},
		},
	},
	"cis": {
		name:    "CIS",
		version: "8.0",
		domain:  "critical-security-controls",
		controls: []rule{
			{"1",  "Inventory & Control of Enterprise Assets",     "partial", nil, []string{"Asset inventory completeness unverified."}},
			{"2",  "Inventory & Control of Software Assets",       "partial", nil, []string{"Software inventory unverified."}},
			{"3",  "Data Protection",                              "partial", nil, []string{"Data at rest encryption unverified."}},
			{"4",  "Secure Configuration of Assets",               "partial", nil, []string{"Hardening baselines unverified."}},
			{"5",  "Account Management",                           "partial", nil, []string{"Orphaned account scan pending."}},
			{"6",  "Access Control Management",                    "partial", nil, []string{"Privileged access reviews unverified."}},
			{"7",  "Continuous Vulnerability Management",          "partial", nil, []string{"Vulnerability scan cadence unverified."}},
			{"8",  "Audit Log Management",                         "partial", nil, []string{"Log integrity checks unverified."}},
			{"10", "Malware Defenses",                             "partial", nil, []string{"EDR coverage unverified."}},
			{"13", "Network Monitoring & Defense",                 "partial", nil, []string{"Network segmentation unverified."}},
		},
	},
}

// defaultTargets is the set of built-in target identifiers used when the
// evaluation request does not specify any.  Each target corresponds to a
// platform subsystem whose configuration can be introspected.
var defaultTargets = []string{
	"iam",             // Identity & Access Management
	"networking",      // Network policy & segmentation
	"data-protection", // Encryption, key management
	"logging",         // Audit logging & monitoring
	"change-mgmt",     // Change & release management
}

// ---------------------------------------------------------------------------
// Target / rule evaluation helpers
// ---------------------------------------------------------------------------

// evaluateTargetAgainstRules evaluates a single target against a rule set.
// Returns the per-target score (0-100), a list of failures, and a list of
// warnings.
//
// Because this service has no live access to the downstream subsystems, the
// evaluation is based on rule definitions embedded in the framework plus the
// targets provided by the caller.  A target that matches a rule's domain is
// treated as "partially implemented" — i.e. the rule exists but concrete
// evidence has not been collected.  When no targets are provided the policy
// is considered not yet scoped (0% compliant).
func evaluateTargetAgainstRules(target string, rules []rule) (score float64, failures []string, warnings []string) {
	matched := false
	for _, r := range rules {
		if isRuleApplicableToTarget(r, target) {
			matched = true
			switch r.verdict {
			case "implemented":
				score += 100.0
			case "partial":
				score += 50.0
				warnings = append(warnings, fmt.Sprintf("%s %s: %s", r.controlID, r.controlName, r.warnings[0]))
			case "not_implemented":
				failures = append(failures, fmt.Sprintf("%s %s", r.controlID, r.controlName))
			}
		}
	}
	if !matched {
		// Target does not map to any control in this framework — neutral.
		warnings = append(warnings, fmt.Sprintf("target %q has no mapped control in framework", target))
	}
	return
}

// isRuleApplicableToTarget returns true when the target subsystem is relevant
// to the given rule.
func isRuleApplicableToTarget(r rule, target string) bool {
	// Map each target to keywords found in the rule's control name or ID.
	mapping := map[string][]string{
		"iam":            {"Access", "Account", "Authentication", "MFA", "Privileged"},
		"networking":     {"Firewall", "Network", "TLS", "Encryption", "Transmission"},
		"data-protection":{"Data", "Encrypt", "Cardholder", "Protection", "Asset"},
		"logging":        {"Log", "Monitor", "Audit", "Monitoring", "Detect"},
		"change-mgmt":    {"Change", "Patch", "Configuration", "Secure Config"},
	}
	terms, ok := mapping[target]
	if !ok {
		return false
	}
	for _, term := range terms {
		if strings.Contains(strings.ToLower(r.controlName), strings.ToLower(term)) {
			return true
		}
	}
	return false
}

// ---------------------------------------------------------------------------
// Remediation registry
// ---------------------------------------------------------------------------

// remediationRegistry maps a failure string (control ID) to an auto-remediation
// action description.  In production these would call the actual subsystem
// APIs; here they produce deterministic, auditable descriptions.
var remediationRegistry = map[string]string{
	"CC6.1":     "Trigger access-review workflow for IAM.",
	"CC7.2":     "Enforce peer-review gate on change pipeline.",
	"CC9.1":     "Schedule disaster-recovery drill.",
	"A.9.1":     "Apply least-privilege policy to access-control matrix.",
	"A.10.1":    "Rotate encryption keys and update cryptography policy.",
	"A.16.1":    "Activate incident-response runbook automation.",
	"4.1":       "Enforce TLS 1.2+ on all cardholder-data endpoints.",
	"8.1":       "Enable MFA enforcement policy.",
	"ID.RA":     "Run automated risk-assessment scan.",
	"PR.AC":     "Apply IAM least-privilege baseline.",
	"6":         "Audit privileged accounts and revoke stale grants.",
	"8":         "Enable audit-log integrity verification.",
}

// remediationResult categorises a single action attempt.
type actionOutcome struct {
	action  string
	status  string // applied | skipped | failed
	reason  string
}
