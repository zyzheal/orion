package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/gin-gonic/gin"
	"github.com/jmoiron/sqlx"

	"orion/platform-svc-go/internal/param-types/repository"
	"orion/platform-svc-go/internal/param-types/service"
)

// PageSize used to treat an oversized value as a reason to reset to its own
// default: ?page_size=1000 answered with 20 rows here and with 100 rows in
// the other 148 handlers on the platform. The response envelope reports
// page_size, so it cannot be pinned through it - the bound LIMIT can, which is
// what WithArgs checks here.
func TestListTemplates_CapsPageSizeAtOneHundred(t *testing.T) {
	raw, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer raw.Close()
	h := NewHandler(service.NewParamTypeRegistry(repository.NewRepository(sqlx.NewDb(raw, "postgres")), nil))

	expect := func(offset, limit int) {
		mock.ExpectQuery("SELECT \\* FROM script_param_templates").
			WithArgs("tenant-1", offset, limit).
			WillReturnRows(sqlmock.NewRows(nil))
	}
	for _, tc := range []struct {
		name   string
		query  string
		offset int
		limit  int
	}{
		// page=1&page_size=1000: the cap has to land before the offset is
		// derived, or this would bind offset 2000.
		{"capped", "page_size=1000", 0, 100},
		{"insideTheCap", "page=3&page_size=25", 50, 25},
		{"defaults", "", 0, 20},
	} {
		t.Run(tc.name, func(t *testing.T) {
			expect(tc.offset, tc.limit)
			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			c.Set("tenant_id", "tenant-1")
			// Joined with "?" so an empty query still yields a valid request URL.
			c.Request = httptest.NewRequest(http.MethodGet, "/x?"+tc.query, nil)
			h.ListTemplates(c)
			if r := mock.ExpectationsWereMet(); r != nil {
				t.Errorf("offset/limit did not match: %v", r)
			}
		})
	}
}
