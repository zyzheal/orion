package aireview

import (
	"context"
	"strings"
	"time"

	"go.uber.org/zap"

	engine "orion/platform-svc-go/internal/inception/engine"
)

// ReviewerConfig controls the Reviewer's logging and fallback behavior.
type ReviewerConfig struct {
	// LogLocal controls whether local audit findings are logged to zap.
	// Default false — findings are returned to the caller instead.
	LogLocal bool
	// LogAI controls whether AI suggestions are logged to zap.
	// Default false.
	LogAI bool
	// RequireLocalAudit, when true, causes Review to fail fast when the
	// local audit engine returns an error. When false (default), local
	// audit failures degrade to an empty report and the AI path still runs.
	RequireLocalAudit bool
	// SkipEmptySQL, when true (default), short-circuits on empty SQL input
	// without touching the AI client. This avoids wasting AI tokens on
	// empty requests.
	SkipEmptySQL bool
}

// Reviewer orchestrates the local + AI review pipeline.
type Reviewer struct {
	localEngine LocalChecker
	aiClient    AIReviewer
	log         *zap.Logger
	cfg         ReviewerConfig
}

// LocalChecker is the narrow interface the reviewer needs from the local
// audit engine. *engine.LocalAuditEngine satisfies this contract.
type LocalChecker interface {
	Check(ctx context.Context, sqlStr string, dbType string) (*engine.AuditReport, error)
}

// AIReviewer is the narrow interface the reviewer needs from the AI client.
type AIReviewer interface {
	IsEnabled() bool
	Model() string
	ReviewForTenant(ctx context.Context, prompt, tenantID string) ([]AISuggestion, string, error)
}

// NewReviewer wires a Reviewer from a local audit engine and AI client.
// A nil aiClient disables the AI path; the reviewer degrades to local-only.
// A nil localEngine disables the local path; the reviewer degrades to AI-only.
// A nil log disables structured logging.
func NewReviewer(localEngine LocalChecker, aiClient AIReviewer, log *zap.Logger) *Reviewer {
	if log == nil {
		log = zap.NewNop()
	}
	return &Reviewer{
		localEngine: localEngine,
		aiClient:    aiClient,
		log:         log,
		cfg:         ReviewerConfig{SkipEmptySQL: true},
	}
}

// NewReviewerWithConfig is like NewReviewer but accepts ReviewerConfig.
func NewReviewerWithConfig(localEngine LocalChecker, aiClient AIReviewer, log *zap.Logger, cfg ReviewerConfig) *Reviewer {
	if log == nil {
		log = zap.NewNop()
	}
	return &Reviewer{
		localEngine: localEngine,
		aiClient:    aiClient,
		log:         log,
		cfg:         cfg,
	}
}

// SetConfig replaces the Reviewer's config in place. Callers can use this
// to tune SkipEmptySQL / LogLocal / LogAI after construction.
func (r *Reviewer) SetConfig(cfg ReviewerConfig) {
	r.cfg = cfg
}

// Review runs both the local audit and the AI semantic review, merging
// their results into a single SQLReviewResult.
//
// Behavior on failure:
//   - Empty SQL input returns a result with Verdict=dangerous, no AI call.
//   - Local audit error returns an empty local report; AI still runs.
//   - AI not configured: AICalled=false, AISuggestions empty.
//   - AI rate-limited or timed out: AICalled=true, AISuggestions empty,
//     AIErrors records the failure, review still succeeds.
//   - Local audit is nil when the engine itself is not wired.
func (r *Reviewer) Review(ctx context.Context, req SQLReviewRequest) (*SQLReviewResult, error) {
	return r.ReviewForTenant(ctx, req, "")
}

// ReviewForTenant is like Review but passes tenantID to the AI client for
// rate-limiting purposes.
func (r *Reviewer) ReviewForTenant(ctx context.Context, req SQLReviewRequest, tenantID string) (*SQLReviewResult, error) {
	start := time.Now()

	result := &SQLReviewResult{
		AISuggestions: []AISuggestion{},
		TenantID:      tenantID,
		ReviewedAt:    time.Now().UTC(),
		Verdict:       VerdictNeedsReview,
		Score:         100,
	}

	sqlStr := strings.TrimSpace(req.SQL)
	if sqlStr == "" {
		if r.cfg.SkipEmptySQL {
			result.Verdict = VerdictDangerous
			result.Score = 0
			result.Duration = time.Since(start)
			return result, nil
		}
	}

	// 1. Local audit (never blocks on error).
	if r.localEngine != nil {
		report, err := r.localEngine.Check(ctx, sqlStr, req.DBType)
		if err != nil {
			r.log.Warn("aireview: local audit failed",
				zap.String("tenant_id", tenantID),
				zap.Error(err),
			)
			result.AIErrors = append(result.AIErrors, "local_audit: "+err.Error())
		} else {
			result.LocalAudit = report
			if r.cfg.LogLocal {
				for _, rule := range report.Rules {
					r.log.Info("aireview: local finding",
						zap.String("tenant_id", tenantID),
						zap.String("rule_id", rule.RuleID),
						zap.String("level", rule.Level),
						zap.Int("line", rule.LineNumber),
						// Never log raw SQL here — findings only.
					)
				}
			}
		}
	}

	// 2. AI semantic review (best-effort).
	if r.aiClient != nil && r.aiClient.IsEnabled() {
		prompt := BuildPrompt(req)
		suggestions, model, err := r.aiClient.ReviewForTenant(ctx, prompt, tenantID)
		result.AICalled = true
		result.ModelUsed = model
		if err != nil {
			r.log.Warn("aireview: ai review failed",
				zap.String("tenant_id", tenantID),
				zap.Error(err),
			)
			result.AIErrors = append(result.AIErrors, "ai: "+err.Error())
		} else {
			result.AISuggestions = suggestions
			if r.cfg.LogAI {
				for _, s := range suggestions {
					r.log.Info("aireview: ai suggestion",
						zap.String("tenant_id", tenantID),
						zap.String("category", s.Category),
						zap.String("severity", s.Severity),
						zap.String("title", s.Title),
					)
				}
			}
		}
	}

	// 3. Merge verdicts.
	result.Verdict, result.Score = computeVerdict(result.LocalAudit, result.AISuggestions)
	result.Duration = time.Since(start)
	return result, nil
}

// computeVerdict folds local + AI findings into a single verdict + score.
//
// Scoring:
//   - Start at 100.
//   - Local error: -40 (or -100 if the local audit also flagged the SQL as
//     unparseable).
//   - Local warn:  -15.
//   - AI critical: -30.
//   - AI warning:  -15.
//   - AI info:     -3.
//   - Clamp to [0, 100].
//
// Verdict thresholds:
//   - score == 100 and no findings:  safe
//   - score >= 70:                    caution
//   - score >= 40:                    needs_review
//   - score < 40 (or any local error or AI critical): dangerous
func computeVerdict(local *engine.AuditReport, ai []AISuggestion) (string, int) {
	score := 100
	hasLocalError := false
	hasCritical := false
	hasWarn := false
	hasInfo := false

	if local != nil {
		if !local.ParsedOK {
			score -= 100
			hasLocalError = true
		}
		for _, rule := range local.Rules {
			switch rule.Level {
			case engine.LevelError:
				score -= 40
				hasLocalError = true
			case engine.LevelWarn:
				score -= 15
				hasWarn = true
			case engine.LevelInfo:
				score -= 3
				hasInfo = true
			}
		}
	}

	for _, s := range ai {
		switch strings.ToLower(s.Severity) {
		case SeverityCritical:
			score -= 30
			hasCritical = true
		case SeverityWarning:
			score -= 15
			hasWarn = true
		case SeverityInfo, "":
			score -= 3
			hasInfo = true
		}
	}

	if score > 100 {
		score = 100
	}
	if score < 0 {
		score = 0
	}

	var verdict string
	switch {
	case hasLocalError || hasCritical || score < 40:
		verdict = VerdictDangerous
	case score >= 70 && !hasWarn && !hasInfo:
		// Everything clean.
		verdict = VerdictSafe
	case score >= 70:
		verdict = VerdictCaution
	default:
		verdict = VerdictNeedsReview
	}
	return verdict, score
}

// RedactSQL returns a redacted version of sqlStr suitable for logging.
// Strips single- and double-quoted string literals so PII / data leaks
// are unlikely to reach logs. Only the statement skeleton is preserved.
func RedactSQL(sqlStr string) string {
	s := strings.TrimSpace(sqlStr)
	if len(s) > 120 {
		s = s[:120] + "…"
	}
	return redactQuotedLiterals(s)
}

// redactQuotedLiterals scans s and replaces the contents of every
// single- or double-quoted literal with '?'. Escaped quotes (`` '' `` or
// `` "" ``) inside the literal do not terminate it.
func redactQuotedLiterals(s string) string {
	out := make([]byte, 0, len(s))
	i := 0
	for i < len(s) {
		var q byte
		switch s[i] {
		case '\'':
			q = '\''
		case '"':
			q = '"'
		default:
			out = append(out, s[i])
			i++
			continue
		}
		j := i + 1
		for j < len(s) {
			if s[j] == q {
				// Peek: doubled quote is an escape inside the literal.
				if j+1 < len(s) && s[j+1] == q {
					j += 2
					continue
				}
				break
			}
			j++
		}
		out = append(out, '?')
		i = j + 1
	}
	return string(out)
}
