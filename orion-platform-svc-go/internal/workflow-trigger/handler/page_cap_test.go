package handler

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

// PageSize used to treat an oversized value as a reason to reset to its own
// default: `?pageSize=1000` answered with 20 rows here and with 100 rows in
// the other 148 handlers on the platform, so one client paginating two of
// these endpoints could not reuse the offset it was told it had. The cap now
// lands at the platform's 100, and the response reports it - which is what
// makes this test possible.
func TestList_CapsPageSizeAtOneHundred(t *testing.T) {
	newCtx := func(query string) (*gin.Context, *httptest.ResponseRecorder) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Set("tenant_id", "tenant-1")
		// Joined with "?" so an empty query still yields a valid request URL.
		c.Request = httptest.NewRequest(http.MethodGet, "/x?"+query, nil)
		return c, w
	}

	c, w := newCtx("pageSize=1000")
	newHandler().List(c)
	if w.Code != http.StatusOK {
		t.Fatalf("status %d, want 200: %s", w.Code, w.Body.String())
	}
	if got := w.Body.String(); !strings.Contains(got, `"page_size":100`) {
		t.Errorf("response did not report the capped size:\n%s", got)
	}

	// The cap is a ceiling, not a reset: a size inside the cap still reaches
	// the client unchanged, so the two endpoints a client paginates agree.
	c, w = newCtx("page=3&pageSize=25")
	newHandler().List(c)
	if got := w.Body.String(); !strings.Contains(got, `"page_size":25`) {
		t.Errorf("a size inside the cap must pass through unchanged:\n%s", got)
	}
}
