package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/gin-gonic/gin"
	"github.com/jmoiron/sqlx"
	"go.uber.org/zap"

	"orion/platform-svc-go/internal/prompt-security/repository"
	"orion/platform-svc-go/internal/prompt-security/service"
)

// The repository floors a non-positive limit on its own (`if limit <= 0 {
// limit = 20 }`), so a dropped floor cannot be pinned here. The cap can: without
// it, ?limit=1000 binds LIMIT 1000 straight into the query. The handler's own
// response envelope does report "limit", but the bound argument is the tighter
// assertion, so it is what WithArgs checks.
//
// page is deliberately left at the 0 default: ScanHistory derives
// `offset = page * limit`, so 0-based paging is load-bearing here and flooring
// page to 1 would skip the first page. Only the 4th row pins cap-before-derive.
func TestListScans_CapsLimitAtOneHundred(t *testing.T) {
	raw, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer raw.Close()

	logger := zap.NewNop()
	h := NewPromptSecurityHandler(service.NewPromptSecurityService(
		repository.NewRepository(sqlx.NewDb(raw, "postgres")), logger))

	expect := func(limit, offset int) {
		mock.ExpectQuery("SELECT \\* FROM prompt_security_scans").
			WithArgs("tenant-1", limit, offset).
			WillReturnRows(sqlmock.NewRows(nil))
		mock.ExpectQuery("SELECT COUNT\\(\\*\\) FROM prompt_security_scans").
			WithArgs("tenant-1").
			WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(7))
	}
	for _, tc := range []struct {
		name   string
		query  string
		limit  int
		offset int
	}{
		{"capped", "limit=1000", 100, 0},
		{"insideTheCap", "limit=25", 25, 0},
		{"defaults", "", 20, 0},
		{"capLandsBeforeOffsetIsDerived", "page=1&limit=1000", 100, 100},
	} {
		t.Run(tc.name, func(t *testing.T) {
			expect(tc.limit, tc.offset)
			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			c.Set("tenantId", "tenant-1")
			// Joined with "?" so an empty query still yields a valid request URL.
			c.Request = httptest.NewRequest(http.MethodGet, "/x?"+tc.query, nil)
			h.ListScans(c)
			if r := mock.ExpectationsWereMet(); r != nil {
				t.Errorf("limit/offset did not match: %v", r)
			}
		})
	}
}
