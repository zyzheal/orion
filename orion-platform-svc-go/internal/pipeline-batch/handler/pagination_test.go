package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func pbCtx(query string) *gin.Context {
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	// Joined with "?" so an empty query still yields a valid request URL.
	c.Set("tenant_id", "tenant-1")
	c.Request = httptest.NewRequest(http.MethodGet, "/x?"+query, nil)
	return c
}

// The `absentUsesDefaults` row is the one that matters most here: with no
// limit parameter `strconv.Atoi("")` returned 0 and the 0 went straight into
// LIMIT, so every ordinary request answered an empty list. The fallback below
// is what makes that endpoint return anything at all.
func pbListArgsCases() []struct {
	name       string
	query      string
	wantOffset int
	wantLimit  int
} {
	return []struct {
		name       string
		query      string
		wantOffset int
		wantLimit  int
	}{
		{"absentUsesDefaults", "", 0, 20},
		{"bothPresent", "limit=10&offset=25", 25, 10},
		{"negativeOffsetIsFloored", "offset=-5", 0, 20},
		{"negativeOffsetIsFlooredIntMin", "offset=-2147483648", 0, 20},
		{"zeroOffsetIsZero", "offset=0", 0, 20},
		{"unparsableOffsetIsZero", "offset=abc", 0, 20},
		{"negativeLimitFallsBack", "limit=-5", 0, 20},
		{"zeroLimitFallsBack", "limit=0", 0, 20},
		{"unparsableLimitFallsBack", "limit=abc", 0, 20},
		{"cappedAtOneHundred", "limit=100000", 0, 100},
	}
}

func TestListArgs_PipelineBatchFloorsBothValues(t *testing.T) {
	gin.SetMode(gin.TestMode)
	for _, tc := range pbListArgsCases() {
		t.Run(tc.name, func(t *testing.T) {
			gotOffset, gotLimit := listArgs(pbCtx(tc.query))
			if gotOffset != tc.wantOffset {
				t.Errorf("offset = %d, want %d (%q)", gotOffset, tc.wantOffset, tc.query)
			}
			if gotLimit != tc.wantLimit {
				t.Errorf("limit = %d, want %d (%q)", gotLimit, tc.wantLimit, tc.query)
			}
			if gotOffset < 0 {
				t.Errorf("offset %d is negative; Postgres rejects it and the GET becomes a 500 (%q)", gotOffset, tc.query)
			}
			if gotLimit < 1 {
				t.Errorf("limit %d is below 1; LIMIT 0 answers an empty page silently (%q)", gotLimit, tc.query)
			}
		})
	}
}

// The listArgs tests above pin the helper. This one pins that ListPhaseGroups
// still calls it, and that the repository's reversed (limit, offset) order was
// threaded through correctly - the existing ListPhaseGroups test only asserts a
// status code below 500, so a swapped or silently empty window sails through it.
func TestListPhaseGroupsForwardsAValidWindow(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h, fake := newHandlerWithRecorder()

	h.ListPhaseGroups(pbCtx("limit=7&offset=13"))
	if fake.lastLimit == nil || fake.lastOffset == nil {
		t.Fatalf("service was not called with a limit and offset")
	}
	if *fake.lastLimit != 7 || *fake.lastOffset != 13 {
		t.Errorf("got limit=%d offset=%d, want limit=7 offset=13", *fake.lastLimit, *fake.lastOffset)
	}

	// The two failure modes the endpoint used to have: a negative OFFSET (500)
	// and a LIMIT of 0 (an empty page for an ordinary request).
	h.ListPhaseGroups(pbCtx("offset=-5"))
	if fake.lastOffset == nil || *fake.lastOffset < 0 {
		t.Fatalf("offset was not floored: %v", fake.lastOffset)
	}
	if fake.lastLimit == nil || *fake.lastLimit < 1 {
		t.Fatalf("limit was not floored: %v", fake.lastLimit)
	}

	h.ListPhaseGroups(pbCtx(""))
	if fake.lastLimit == nil || *fake.lastLimit != 20 {
		t.Fatalf("absent limit: got %v, want 20", fake.lastLimit)
	}
}
