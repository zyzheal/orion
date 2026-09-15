package handler

import (
	"context"
	"net/http"
	"os"
	"regexp"
	"strings"
	"testing"

	"orion/platform-svc-go/internal/policy/models"
)

// ListExemptionsRequest is the only struct in the module bound with
// c.ShouldBindQuery, and the handler threads every field of it to the
// repository. gin reads the form tag and, when a field has none, falls back to
// the Go field name, so a query-bound struct carrying only json tags accepts
// ?Status= ?PolicyID= ?RequestedBy= ?Category= ?Limit= ?Offset= -- PascalCase,
// while every other policy endpoint and PaginatedQuery read limit, offset and
// source_url. The four filters this round threaded to the repository were
// bound and then dropped, and without form tags on the struct a new filter
// would be dropped again invisibly. These tests run gin's real binding code
// against the real struct, so they fail on either half of the defect: a filter
// that never reaches the service, or a tag that stops matching the wire name.

// recordingExemptionService captures the request the handler built, so the
// test asserts what the service actually received rather than what the handler
// claimed to do.
type recordingExemptionService struct {
	fakePolicyService
	called   bool
	tenant   string
	received models.ListExemptionsRequest
}

func (s *recordingExemptionService) ListExemptions(ctx context.Context, tenantID string, req models.ListExemptionsRequest) (*models.ListExemptionsResponse, error) {
	s.called = true
	s.tenant = tenantID
	s.received = req
	return &models.ListExemptionsResponse{}, nil
}

const exemptionFilterQuery = "/policies/exemptions?status=approved&policy_id=pol-9&requested_by=u-7&category=technical&limit=5&offset=10"

func TestHandler_ListExemptions_BindsEveryWireFilter(t *testing.T) {
	svc := &recordingExemptionService{}
	c, w := makeCtx(http.MethodGet, exemptionFilterQuery)
	NewHandler(svc).ListExemptions(c)
	if w.Code >= 500 {
		t.Fatalf("ListExemptions: HTTP %d, body %s", w.Code, w.Body.String())
	}
	if !svc.called {
		t.Fatal("the handler never reached the service")
	}
	if svc.tenant != "tenant-1" {
		t.Fatalf("tenant id lost in transit: %q", svc.tenant)
	}

	got := svc.received
	if got.Status != "approved" {
		t.Errorf("status: got %q", got.Status)
	}
	if got.PolicyID != "pol-9" {
		t.Errorf("policy_id: got %q", got.PolicyID)
	}
	if got.RequestedBy != "u-7" {
		t.Errorf("requested_by: got %q", got.RequestedBy)
	}
	if got.Category != "technical" {
		t.Errorf("category: got %q", got.Category)
	}
	if got.Limit != 5 || got.Offset != 10 {
		t.Errorf("limit/offset: got %d/%d", got.Limit, got.Offset)
	}
}

// legacyListExemptionsRequest is the struct as it stood before this round: json
// tags only. It exists to keep the test above from being vacuous -- it proves
// that with the form tags removed gin's own binding leaves every field at its
// zero value, so a caller who sent status=approved got an unfiltered list. If
// gin ever started lowercasing field names, this control would fail and the
// regression test would have to be re-examined rather than silently passing.
type legacyListExemptionsRequest struct {
	Status      string `json:"status"`
	PolicyID    string `json:"policy_id"`
	RequestedBy string `json:"requested_by"`
	Category    string `json:"category"`
	Limit       int    `json:"limit"`
	Offset      int    `json:"offset"`
}

func TestHandler_ListExemptions_WithoutFormTagsGinBindsNothing(t *testing.T) {
	c, _ := makeCtx(http.MethodGet, exemptionFilterQuery)
	var legacy legacyListExemptionsRequest
	if err := c.ShouldBindQuery(&legacy); err != nil {
		t.Fatalf("binding the legacy shape: %v", err)
	}
	if legacy.Status != "" || legacy.PolicyID != "" || legacy.RequestedBy != "" ||
		legacy.Category != "" || legacy.Limit != 0 || legacy.Offset != 0 {
		t.Fatalf("json tags alone bound the query: %+v; gin's fallback is the Go field name, so the test above would not be a real guard", legacy)
	}
}

// The recorded tradeoff: the fix removes PascalCase acceptance. No caller uses
// it -- the policy API client sends camelCase and has no exemptions caller at
// all -- so this pins the direction the module moved instead of preserving both.
func TestHandler_ListExemptions_PascalCaseKeysNoLongerBind(t *testing.T) {
	svc := &recordingExemptionService{}
	c, _ := makeCtx(http.MethodGet,
		"/policies/exemptions?Status=approved&PolicyID=pol-9&Category=technical")
	NewHandler(svc).ListExemptions(c)
	if svc.received.Status != "" || svc.received.PolicyID != "" || svc.received.Category != "" {
		t.Fatalf("PascalCase still binds: %+v", svc.received)
	}
}

// TestSource_ListExemptionsRequestDeclaresAFormTagPerField fails if a single
// field loses its form tag. The behavioral test above would also catch it, but
// the message would name the wire value, not the field, and a field whose
// caller never filters on it would not be exercised at all.
func TestSource_ListExemptionsRequestDeclaresAFormTagPerField(t *testing.T) {
	b, err := os.ReadFile("../models/models.go")
	if err != nil {
		t.Fatal(err)
	}
	src := string(b)
	body := functionBody(src, "type ListExemptionsRequest struct {")
	if body == "" {
		t.Fatal("ListExemptionsRequest not found in models.go")
	}

	reField := regexp.MustCompile(`^\t([A-Za-z_][A-Za-z0-9_]*)\s+\S`)
	reForm := regexp.MustCompile(`form:"([a-z_0-9]+)"`)
	fields := 0
	for _, line := range strings.Split(body, "\n") {
		fm := reField.FindStringSubmatch(line)
		if fm == nil {
			continue
		}
		fields++
		tm := reForm.FindStringSubmatch(line)
		if tm == nil {
			t.Errorf("ListExemptionsRequest.%s has no form tag, so gin binds it by Go field name", fm[1])
			continue
		}
		if tm[1] != strings.ToLower(fm[1]) &&
			tm[1] != "policy_id" && tm[1] != "requested_by" {
			t.Errorf("ListExemptionsRequest.%s form tag %q does not match the wire name", fm[1], tm[1])
		}
	}
	if fields != 6 {
		t.Fatalf("ListExemptionsRequest has %d fields, the recorded set holds 6", fields)
	}

	// positive control: the parser must see a missing tag as missing.
	fixture := "\tLimit int `json:\"limit\"`\n\tOffset int `json:\"offset\" form:\"offset\"`\n}"
	if reForm.FindStringSubmatch(strings.SplitN(fixture, "\n", 2)[0]) != nil {
		t.Fatal("detector reports a form tag where the fixture has none")
	}
	if reForm.FindStringSubmatch(strings.SplitN(fixture, "\n", 2)[1]) == nil {
		t.Fatal("detector missed the form tag the fixture declares")
	}
}

// functionBody returns everything from start to the next top-level declaration,
// so a tag guard cannot read past the struct it is meant to inspect.
func functionBody(src, start string) string {
	at := strings.Index(src, start)
	if at < 0 {
		return ""
	}
	rest := src[at+len(start):]
	if nl := strings.Index(rest, "\n}"); nl >= 0 {
		return rest[:nl]
	}
	return rest
}
