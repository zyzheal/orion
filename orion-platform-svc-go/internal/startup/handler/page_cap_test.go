package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

// parsePagination used to treat an oversized page size as a reason to reset to
// its own default, so ?page_size=1000 returned 20 rows here and 100 rows in
// the other 148 handlers on the platform. It is a pure helper, so the pair it
// returns can be pinned directly without a handler or a service fake.
func TestParsePagination_CapsPageSizeAtOneHundred(t *testing.T) {
	newCtx := func(query string) *gin.Context {
		c, _ := gin.CreateTestContext(httptest.NewRecorder())
		c.Request = httptest.NewRequest(http.MethodGet, "/x?"+query, nil)
		return c
	}
	if page, pageSize := parsePagination(newCtx("page_size=1000")); page != 1 || pageSize != 100 {
		t.Errorf("page=%d pageSize=%d, want page=1 pageSize=100", page, pageSize)
	}
	if page, pageSize := parsePagination(newCtx("page=4&page_size=25")); page != 4 || pageSize != 25 {
		t.Errorf("page=%d pageSize=%d, want page=4 pageSize=25", page, pageSize)
	}
	if page, pageSize := parsePagination(newCtx("page=-9&page_size=-7")); page != 1 || pageSize != 20 {
		t.Errorf("page=%d pageSize=%d, want page=1 pageSize=20", page, pageSize)
	}
	if page, pageSize := parsePagination(newCtx("")); page != 1 || pageSize != 20 {
		t.Errorf("page=%d pageSize=%d, want page=1 pageSize=20", page, pageSize)
	}
}
