package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func pageCtx(query string) *gin.Context {
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	// Joined with "?" so an empty query still yields a valid request URL.
	c.Request = httptest.NewRequest(http.MethodGet, "/x?"+query, nil)
	return c
}

// listArgsCases. Nine rows discriminate against a bare strconv.Atoi on offset:
// the four `offset=-N` rows plus `offset=0`, `offset=abc` and the combined
// row. Three rows discriminate against dropping the limit fallback.
//
// `limit=100000` used to go straight into LIMIT because neither this endpoint
// nor any of the three it feeds ever capped the size. The cap is now in
// pagination.Limit itself (100), so the row below asserts the capped value.
func listArgsCases() []struct {
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
		{"bothPresent", "offset=25&limit=10", 25, 10},
		{"negativeOffsetIsFloored", "offset=-1", 0, 20},
		{"negativeOffsetIsFlooredFive", "offset=-5", 0, 20},
		{"negativeOffsetIsFlooredHundred", "offset=-100", 0, 20},
		{"negativeOffsetIsFlooredHuge", "offset=-999999", 0, 20},
		{"negativeOffsetIsFlooredIntMin", "offset=-2147483648", 0, 20},
		{"zeroOffsetIsZero", "offset=0", 0, 20},
		{"unparsableOffsetIsZero", "offset=abc", 0, 20},
		{"negativeOffsetKeepsTheLimit", "offset=-5&limit=10", 0, 10},
		{"negativeLimitFallsBack", "limit=-5", 0, 20},
		{"zeroLimitFallsBack", "limit=0", 0, 20},
		{"unparsableLimitFallsBack", "limit=abc", 0, 20},
		{"cappedAtOneHundred", "limit=100000", 0, 100},
	}
}

func TestListArgs_FloorsTheOffset(t *testing.T) {
	gin.SetMode(gin.TestMode)
	for _, tc := range listArgsCases() {
		t.Run(tc.name, func(t *testing.T) {
			gotOffset, gotLimit := listArgs(pageCtx(tc.query))
			if gotOffset != tc.wantOffset {
				t.Errorf("offset = %d, want %d (%q)", gotOffset, tc.wantOffset, tc.query)
			}
			if gotLimit != tc.wantLimit {
				t.Errorf("limit = %d, want %d (%q)", gotLimit, tc.wantLimit, tc.query)
			}
			// Postgres rejects a negative OFFSET, so this is the assertion that
			// keeps a GET from becoming a 500.
			if gotOffset < 0 {
				t.Errorf("offset %d is negative (%q)", gotOffset, tc.query)
			}
			if gotLimit < 1 {
				t.Errorf("limit %d is below 1; LIMIT 0 answers an empty page silently (%q)", gotLimit, tc.query)
			}
		})
	}
}
