package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/gin-gonic/gin"
	"github.com/jmoiron/sqlx"

	"orion/platform-svc-go/internal/security/secret/repository"
	"orion/platform-svc-go/internal/security/secret/service"
)

// The envelope is a masked []gin.H with no pagination field, so the bound
// LIMIT argument is the only thing that can be pinned. The repository SQL is
// OFFSET $2 LIMIT $3 (note the order: offset before limit).
func TestList_CapsPageSizeAtOneHundred(t *testing.T) {
	for _, tc := range []struct {
		name   string
		query  string
		limit  int
		offset int
	}{
		{"capped", "page_size=1000", 100, 0},
		{"insideTheCap", "page=3&page_size=25", 25, 50},
		{"defaults", "", 20, 0},
	} {
		t.Run(tc.name, func(t *testing.T) {
			raw, mock, err := sqlmock.New()
			if err != nil {
				t.Fatalf("sqlmock: %v", err)
			}
			defer raw.Close()
			svc := service.NewService(repository.NewRepository(sqlx.NewDb(raw, "postgres")), "")
			h := NewHandler(svc)
			mock.ExpectQuery("FROM secrets").
				WithArgs("tenant-1", tc.offset, tc.limit).
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
