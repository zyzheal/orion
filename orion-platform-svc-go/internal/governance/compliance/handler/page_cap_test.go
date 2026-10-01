package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/gin-gonic/gin"
	"github.com/jmoiron/sqlx"

	"orion/platform-svc-go/internal/governance/compliance/repository"
	"orion/platform-svc-go/internal/governance/compliance/service"
)

func newComplianceHandlerWithMock() (*Handler, sqlmock.Sqlmock, func()) {
	raw, mock, err := sqlmock.New()
	if err != nil {
		panic(err)
	}
	db := sqlx.NewDb(raw, "postgres")
	svc := service.NewComplianceService(
		repository.NewComplianceReportRepository(db),
		repository.NewComplianceScheduleRepository(db),
		repository.NewCompliancePolicyRepository(db),
	)
	return NewHandler(svc), mock, func() { raw.Close() }
}

func TestListReports_CapsPageSizeAtOneHundred(t *testing.T) {
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
			h, mock, cleanup := newComplianceHandlerWithMock()
			defer cleanup()
			mock.ExpectQuery("SELECT \\* FROM compliance_reports").
				WithArgs("tenant-1", tc.limit, tc.offset).
				WillReturnRows(sqlmock.NewRows(nil))
			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			c.Set("tenant_id", "tenant-1")
			c.Request = httptest.NewRequest(http.MethodGet, "/x?"+tc.query, nil)
			h.ListReports(c)
			if err := mock.ExpectationsWereMet(); err != nil {
				t.Errorf("limit/offset did not match: %v", err)
			}
		})
	}
}

func TestListSchedules_CapsPageSizeAtOneHundred(t *testing.T) {
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
			h, mock, cleanup := newComplianceHandlerWithMock()
			defer cleanup()
			mock.ExpectQuery("SELECT \\* FROM compliance_schedules").
				WithArgs("tenant-1", tc.limit, tc.offset).
				WillReturnRows(sqlmock.NewRows(nil))
			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			c.Set("tenant_id", "tenant-1")
			c.Request = httptest.NewRequest(http.MethodGet, "/x?"+tc.query, nil)
			h.ListSchedules(c)
			if err := mock.ExpectationsWereMet(); err != nil {
				t.Errorf("limit/offset did not match: %v", err)
			}
		})
	}
}

func TestListPolicies_CapsPageSizeAtOneHundred(t *testing.T) {
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
			h, mock, cleanup := newComplianceHandlerWithMock()
			defer cleanup()
			mock.ExpectQuery("SELECT \\* FROM compliance_policies").
				WithArgs("tenant-1", tc.limit, tc.offset).
				WillReturnRows(sqlmock.NewRows(nil))
			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			c.Set("tenant_id", "tenant-1")
			c.Request = httptest.NewRequest(http.MethodGet, "/x?"+tc.query, nil)
			h.ListPolicies(c)
			if err := mock.ExpectationsWereMet(); err != nil {
				t.Errorf("limit/offset did not match: %v", err)
			}
		})
	}
}
