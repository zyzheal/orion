package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

// pageCtx builds a context that reads the given query string. The query is
// joined with "?" rather than concatenated so an empty query still yields a
// valid request URL.
func pageCtx(query string) *gin.Context {
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodGet, "/x?"+query, nil)
	return c
}

// listPageCases covers both endpoints. The two rows that start from an empty
// `query` pin the default; the rows in the alias block only exist to prove
// `pageSize` is honoured by ListDocs and ignored by ListSpaces, because
// widening ListSpaces here would silently change what that endpoint accepts.
//
// Eight rows discriminate against a bare strconv.Atoi on the size parameter:
// 4, 5, 6, 7, 15, 18, 19 and 20. Four of those also discriminate against
// dropping the cap: 7, 11, 18 and 19.
func listPageCases() []struct {
	name       string
	query      string
	readAlias  bool
	wantPage   int
	wantOffset int
	wantSize   int
} {
	return []struct {
		name       string
		query      string
		readAlias  bool
		wantPage   int
		wantOffset int
		wantSize   int
	}{
		{"defaults", "", false, 1, 0, 50},
		{"pageThree", "page=3", false, 3, 100, 50},
		{"pageThreeSizeTwenty", "page=3&perPage=20", false, 3, 40, 20},
		{"unparsableSizeFallsBackToDefault", "page=3&perPage=abc", false, 3, 100, 50},
		{"negativeSizeFallsBackToDefault", "page=3&perPage=-5", false, 3, 100, 50},
		{"zeroSizeFallsBackToDefault", "page=3&perPage=0", false, 3, 100, 50},
		{"hugeSizeIsCappedBeforeDeriving", "page=3&perPage=100000", false, 3, 100, 50},
		{"negativePageIsClamped", "page=-5&perPage=20", false, 1, 0, 20},
		{"zeroPageIsClamped", "page=0&perPage=20", false, 1, 0, 20},
		{"unparsablePageUsesDefault", "page=abc&perPage=20", false, 1, 0, 20},
		{"sizeAboveTheCapIsCapped", "page=2&perPage=100", false, 2, 50, 50},
		{"spacesIgnoreThePageSizeAlias", "pageSize=10", false, 1, 0, 50},
		{"spacesStillHonourPerPage", "pageSize=10&perPage=20", false, 1, 0, 20},

		{"docsHonourPageSize", "pageSize=20", true, 1, 0, 20},
		{"docsUnparsablePageSizeFallsBack", "pageSize=abc", true, 1, 0, 50},
		{"perPageWinsOverPageSize", "pageSize=20&perPage=10", true, 1, 0, 10},
		{"docsPageTwoByTwentyFive", "page=2&pageSize=25", true, 2, 25, 25},
		{"docsSizeCapAppliesBeforeDeriving", "page=3&pageSize=250", true, 3, 100, 50},
		{"docsCapOverridesTheWinningAlias", "page=3&pageSize=10&perPage=250", true, 3, 100, 50},
		{"docsUnparsablePerPageBeatsAValidPageSize", "page=3&pageSize=25&perPage=abc", true, 3, 100, 50},
	}
}

func TestListPage_FloorsAndCapsTheSizeParameter(t *testing.T) {
	gin.SetMode(gin.TestMode)
	for _, tc := range listPageCases() {
		t.Run(tc.name, func(t *testing.T) {
			gotPage, gotOffset, gotSize := listPage(pageCtx(tc.query), tc.readAlias)
			if gotPage != tc.wantPage {
				t.Errorf("page = %d, want %d (%q)", gotPage, tc.wantPage, tc.query)
			}
			if gotOffset != tc.wantOffset {
				t.Errorf("offset = %d, want %d (%q)", gotOffset, tc.wantOffset, tc.query)
			}
			if gotSize != tc.wantSize {
				t.Errorf("size = %d, want %d (%q)", gotSize, tc.wantSize, tc.query)
			}
			if gotOffset < 0 {
				t.Errorf("offset %d is negative; Postgres rejects it and the GET becomes a 500 (%q)", gotOffset, tc.query)
			}
			if gotSize < 1 {
				t.Errorf("size %d is below 1; LIMIT 0 answers an empty page silently (%q)", gotSize, tc.query)
			}
		})
	}
}

// The service floors both values it receives, which is what let these
// mis-parsings ship for years: the call succeeded and page 3 returned page 1's
// rows. Pinning the pair here is what makes that class of answer impossible
// from the handler going forward.
func TestListPage_NeverEmitsANegativeOffset(t *testing.T) {
	for _, q := range []string{"page=9&perPage=-9", "page=9&perPage=0", "page=9&perPage=abc"} {
		_, offset, size := listPage(pageCtx(q), true)
		if offset < 0 || size < 1 {
			t.Errorf("%q: offset=%d size=%d", q, offset, size)
		}
	}
}
