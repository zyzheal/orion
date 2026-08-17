package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/report-designer/service"

	"github.com/gin-gonic/gin"
	"context"
<<<<<<< Updated upstream
	"orion/platform-svc-go/internal/report-designer/models"
=======
>>>>>>> Stashed changes
)

func newHandler() *Handler {
	return NewHandler(&fakeReport_designerService{})
}

func makeCtx(method string, path string) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	c.Params = gin.Params{}
	c.Request = httptest.NewRequest(method, path, nil)
	return c, w
}

<<<<<<< Updated upstream
type fakeReport_designerService struct{}

func (f *fakeReport_designerService) CreateDatasource(ctx context.Context, req *models.CreateDatasourceRequest) (*models.ReportDatasource, error) {
	return &models.ReportDatasource{}, nil
}

func (f *fakeReport_designerService) CreateReport(ctx context.Context, req *models.CreateReportRequest) (*models.ReportDefinition, error) {
	return &models.ReportDefinition{}, nil
}

func (f *fakeReport_designerService) CreateSchedule(ctx context.Context, req *models.CreateScheduleRequest) (*models.ReportSchedule, error) {
	return &models.ReportSchedule{}, nil
}

func (f *fakeReport_designerService) DeleteDatasource(ctx context.Context, id string, tenantID string) (bool, error) {
	return false, nil
}

func (f *fakeReport_designerService) DeleteReport(ctx context.Context, id string, tenantID string) (bool, error) {
	return false, nil
}

func (f *fakeReport_designerService) DeleteSchedule(ctx context.Context, id string, tenantID string) (bool, error) {
	return false, nil
}

func (f *fakeReport_designerService) ExecuteReport(ctx context.Context, reportID string, tenantID string, req *models.ExecuteReportRequest) (*models.ReportExecution, error) {
	return &models.ReportExecution{}, nil
}

func (f *fakeReport_designerService) GetDatasource(ctx context.Context, id string, tenantID string) (*models.ReportDatasource, error) {
	return &models.ReportDatasource{}, nil
}

func (f *fakeReport_designerService) GetExecutionHistory(ctx context.Context, reportID string, tenantID string, limit int) ([]models.ReportExecution, error) {
	return []models.ReportExecution{}, nil
}

func (f *fakeReport_designerService) GetReport(ctx context.Context, id string, tenantID string) (*models.ReportDefinition, error) {
	return &models.ReportDefinition{}, nil
}

func (f *fakeReport_designerService) GetSchedule(ctx context.Context, id string, tenantID string) (*models.ReportSchedule, error) {
	return &models.ReportSchedule{}, nil
}

func (f *fakeReport_designerService) ListDatasources(ctx context.Context, tenantID string) ([]models.ReportDatasource, error) {
	return []models.ReportDatasource{}, nil
}

func (f *fakeReport_designerService) ListReports(ctx context.Context, tenantID string, req *models.ListReportsRequest) ([]models.ReportDefinition, int, error) {
	return []models.ReportDefinition{}, 0, nil
}

func (f *fakeReport_designerService) ListSchedules(ctx context.Context, reportID string, tenantID string) ([]models.ReportSchedule, error) {
	return []models.ReportSchedule{}, nil
}

func (f *fakeReport_designerService) PreviewReport(ctx context.Context, reportID string, tenantID string, req *models.PreviewReportRequest) (*models.PreviewReportResult, error) {
	return &models.PreviewReportResult{}, nil
}

func (f *fakeReport_designerService) UpdateDatasource(ctx context.Context, id string, tenantID string, req *models.UpdateDatasourceRequest) (*models.ReportDatasource, error) {
	return &models.ReportDatasource{}, nil
}

func (f *fakeReport_designerService) UpdateReport(ctx context.Context, id string, tenantID string, req *models.UpdateReportRequest) (*models.ReportDefinition, error) {
	return &models.ReportDefinition{}, nil
}

func (f *fakeReport_designerService) UpdateSchedule(ctx context.Context, id string, tenantID string, req *models.UpdateScheduleRequest) (*models.ReportSchedule, error) {
	return &models.ReportSchedule{}, nil
}

var _ service.ServiceInterface = (*fakeReport_designerService)(nil)
=======
type fakereport_designerService struct{}

func (f *fakereport_designerService) CreateDatasource(ctx context.Context, req *models.CreateDatasourceRequest) ((*models.ReportDatasource, error)) {
	return &models.ReportDatasource{}, nil
}

func (f *fakereport_designerService) CreateReport(ctx context.Context, req *models.CreateReportRequest) ((*models.ReportDefinition, error)) {
	return &models.ReportDefinition{}, nil
}

func (f *fakereport_designerService) CreateSchedule(ctx context.Context, req *models.CreateScheduleRequest) ((*models.ReportSchedule, error)) {
	return &models.ReportSchedule{}, nil
}

func (f *fakereport_designerService) DeleteDatasource(ctx context.Context, id string, tenantID string) ((bool, error)) {
	return false, nil
}

func (f *fakereport_designerService) DeleteReport(ctx context.Context, id string, tenantID string) ((bool, error)) {
	return false, nil
}

func (f *fakereport_designerService) DeleteSchedule(ctx context.Context, id string, tenantID string) ((bool, error)) {
	return false, nil
}

func (f *fakereport_designerService) ExecuteReport(ctx context.Context, reportID string, tenantID string, req *models.ExecuteReportRequest) ((*models.ReportExecution, error)) {
	return &models.ReportExecution{}, nil
}

func (f *fakereport_designerService) GetDatasource(ctx context.Context, id string, tenantID string) ((*models.ReportDatasource, error)) {
	return &models.ReportDatasource{}, nil
}

func (f *fakereport_designerService) GetExecutionHistory(ctx context.Context, reportID string, tenantID string, limit int) (([]models.ReportExecution, error)) {
	return []models.ReportExecution{}, nil
}

func (f *fakereport_designerService) GetReport(ctx context.Context, id string, tenantID string) ((*models.ReportDefinition, error)) {
	return &models.ReportDefinition{}, nil
}

func (f *fakereport_designerService) GetSchedule(ctx context.Context, id string, tenantID string) ((*models.ReportSchedule, error)) {
	return &models.ReportSchedule{}, nil
}

func (f *fakereport_designerService) ListDatasources(ctx context.Context, tenantID string) (([]models.ReportDatasource, error)) {
	return []models.ReportDatasource{}, nil
}

func (f *fakereport_designerService) ListReports(ctx context.Context, tenantID string, req *models.ListReportsRequest) (([]models.ReportDefinition, int, error)) {
	return []models.ReportDefinition{}, 0, nil
}

func (f *fakereport_designerService) ListSchedules(ctx context.Context, reportID string, tenantID string) (([]models.ReportSchedule, error)) {
	return []models.ReportSchedule{}, nil
}

func (f *fakereport_designerService) PreviewReport(ctx context.Context, reportID string, tenantID string, req *models.PreviewReportRequest) ((*models.PreviewReportResult, error)) {
	return &models.PreviewReportResult{}, nil
}

func (f *fakereport_designerService) UpdateDatasource(ctx context.Context, id string, tenantID string, req *models.UpdateDatasourceRequest) ((*models.ReportDatasource, error)) {
	return &models.ReportDatasource{}, nil
}

func (f *fakereport_designerService) UpdateReport(ctx context.Context, id string, tenantID string, req *models.UpdateReportRequest) ((*models.ReportDefinition, error)) {
	return &models.ReportDefinition{}, nil
}

func (f *fakereport_designerService) UpdateSchedule(ctx context.Context, id string, tenantID string, req *models.UpdateScheduleRequest) ((*models.ReportSchedule, error)) {
	return &models.ReportSchedule{}, nil
}

var _ service.ServiceInterface = (*fakereport_designerService)(nil)
>>>>>>> Stashed changes


func TestHandler_REPORT_DESIGNE_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_REPORT_DESIG_CreateReport(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CreateReport(c)
	if w.Code >= 500 {
		t.Fatalf("CreateReport: got %d", w.Code)
	}
}
func TestHandler_REPORT_DESIG_GetReport(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetReport(c)
	if w.Code >= 500 {
		t.Fatalf("GetReport: got %d", w.Code)
	}
}
func TestHandler_REPORT_DESIG_UpdateReport(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().UpdateReport(c)
	if w.Code >= 500 {
		t.Fatalf("UpdateReport: got %d", w.Code)
	}
}
func TestHandler_REPORT_DESIG_DeleteReport(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().DeleteReport(c)
	if w.Code >= 500 {
		t.Fatalf("DeleteReport: got %d", w.Code)
	}
}
func TestHandler_REPORT_DESIG_ListReports(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListReports(c)
	if w.Code >= 500 {
		t.Fatalf("ListReports: got %d", w.Code)
	}
}
func TestHandler_REPORT_DESIG_CreateDatasource(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CreateDatasource(c)
	if w.Code >= 500 {
		t.Fatalf("CreateDatasource: got %d", w.Code)
	}
}
func TestHandler_REPORT_DESIG_UpdateDatasource(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().UpdateDatasource(c)
	if w.Code >= 500 {
		t.Fatalf("UpdateDatasource: got %d", w.Code)
	}
}
func TestHandler_REPORT_DESIG_DeleteDatasource(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().DeleteDatasource(c)
	if w.Code >= 500 {
		t.Fatalf("DeleteDatasource: got %d", w.Code)
	}
}
func TestHandler_REPORT_DESIG_ListDatasources(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListDatasources(c)
	if w.Code >= 500 {
		t.Fatalf("ListDatasources: got %d", w.Code)
	}
}
func TestHandler_REPORT_DESIG_CreateSchedule(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CreateSchedule(c)
	if w.Code >= 500 {
		t.Fatalf("CreateSchedule: got %d", w.Code)
	}
}
func TestHandler_REPORT_DESIG_UpdateSchedule(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().UpdateSchedule(c)
	if w.Code >= 500 {
		t.Fatalf("UpdateSchedule: got %d", w.Code)
	}
}
func TestHandler_REPORT_DESIG_DeleteSchedule(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().DeleteSchedule(c)
	if w.Code >= 500 {
		t.Fatalf("DeleteSchedule: got %d", w.Code)
	}
}
func TestHandler_REPORT_DESIG_ListSchedules(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListSchedules(c)
	if w.Code >= 500 {
		t.Fatalf("ListSchedules: got %d", w.Code)
	}
}
func TestHandler_REPORT_DESIG_PreviewReport(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().PreviewReport(c)
	if w.Code >= 500 {
		t.Fatalf("PreviewReport: got %d", w.Code)
	}
}
func TestHandler_REPORT_DESIG_ExecuteReport(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ExecuteReport(c)
	if w.Code >= 500 {
		t.Fatalf("ExecuteReport: got %d", w.Code)
	}
}
func TestHandler_REPORT_DESIG_GetExecutionHistory(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetExecutionHistory(c)
	if w.Code >= 500 {
		t.Fatalf("GetExecutionHistory: got %d", w.Code)
	}
}
