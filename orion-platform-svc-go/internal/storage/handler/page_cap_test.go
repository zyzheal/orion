package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/gin-gonic/gin"
	"github.com/jmoiron/sqlx"

	"orion/platform-svc-go/internal/storage/repository"
	"orion/platform-svc-go/internal/storage/service"
)

// The envelope is gin.H{"data": items, "total": len(items)} — no limit field.
// The bound LIMIT is the only thing that can be pinned. The repository SQL is
// LIMIT $2 OFFSET $3 (limit before offset).
func TestList_CapsLimitAtOneHundred(t *testing.T) {
	for _, tc := range []struct {
		name   string
		query  string
		limit  int
		offset int
	}{
		{"capped", "limit=1000", 100, 0},
		{"insideTheCap", "limit=5", 5, 0},
		{"defaults", "", 20, 0},
	} {
		t.Run(tc.name, func(t *testing.T) {
			raw, mock, err := sqlmock.New()
			if err != nil {
				t.Fatalf("sqlmock: %v", err)
			}
			defer raw.Close()
			svc := service.NewService(repository.NewRepository(sqlx.NewDb(raw, "postgres")))
			h := NewHandler(svc)
			mock.ExpectQuery("FROM storage_entries").
				WithArgs("tenant-1", tc.limit, tc.offset).
				WillReturnRows(sqlmock.NewRows(nil))
			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			c.Set("tenant_id", "tenant-1")
			c.Request = httptest.NewRequest(http.MethodGet, "/x?"+tc.query, nil)
			h.List(c)
			if err := mock.ExpectationsWereMet(); err != nil {
				t.Errorf("limit/offset did not match: %v", err)
			}
		})
	}
}
