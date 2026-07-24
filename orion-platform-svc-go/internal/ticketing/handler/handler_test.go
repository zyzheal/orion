package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/ticketing/service"

	"github.com/gin-gonic/gin"
)

func newHandler() *Handler {
	return NewHandler(&service.Service{})
}

func makeCtx(method string, path string) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	c.Params = gin.Params{}
	c.Request = httptest.NewRequest(method, path, nil)
	return c, w
}

func TestHandler_TICKETING_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_TICKETING_StartService(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().StartService(c)
	if w.Code >= 500 {
		t.Fatalf("StartService: got %d", w.Code)
	}
}
func TestHandler_TICKETING_StopService(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().StopService(c)
	if w.Code >= 500 {
		t.Fatalf("StopService: got %d", w.Code)
	}
}
func TestHandler_TICKETING_HealthCheck(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().HealthCheck(c)
	if w.Code >= 500 {
		t.Fatalf("HealthCheck: got %d", w.Code)
	}
}
func TestHandler_TICKETING_CreateTicket(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CreateTicket(c)
	if w.Code >= 500 {
		t.Fatalf("CreateTicket: got %d", w.Code)
	}
}
func TestHandler_TICKETING_CreateTicketFromAlert(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CreateTicketFromAlert(c)
	if w.Code >= 500 {
		t.Fatalf("CreateTicketFromAlert: got %d", w.Code)
	}
}
func TestHandler_TICKETING_CreateTicketFromIncident(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CreateTicketFromIncident(c)
	if w.Code >= 500 {
		t.Fatalf("CreateTicketFromIncident: got %d", w.Code)
	}
}
func TestHandler_TICKETING_GetTicket(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetTicket(c)
	if w.Code >= 500 {
		t.Fatalf("GetTicket: got %d", w.Code)
	}
}
func TestHandler_TICKETING_ListTickets(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListTickets(c)
	if w.Code >= 500 {
		t.Fatalf("ListTickets: got %d", w.Code)
	}
}
func TestHandler_TICKETING_TransitionStatus(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().TransitionStatus(c)
	if w.Code >= 500 {
		t.Fatalf("TransitionStatus: got %d", w.Code)
	}
}
func TestHandler_TICKETING_AssignTicket(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().AssignTicket(c)
	if w.Code >= 500 {
		t.Fatalf("AssignTicket: got %d", w.Code)
	}
}
func TestHandler_TICKETING_EscalateTicket(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().EscalateTicket(c)
	if w.Code >= 500 {
		t.Fatalf("EscalateTicket: got %d", w.Code)
	}
}
func TestHandler_TICKETING_ResolveTicket(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ResolveTicket(c)
	if w.Code >= 500 {
		t.Fatalf("ResolveTicket: got %d", w.Code)
	}
}
func TestHandler_TICKETING_CloseTicket(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CloseTicket(c)
	if w.Code >= 500 {
		t.Fatalf("CloseTicket: got %d", w.Code)
	}
}
func TestHandler_TICKETING_GetWorkflowHistory(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetWorkflowHistory(c)
	if w.Code >= 500 {
		t.Fatalf("GetWorkflowHistory: got %d", w.Code)
	}
}
func TestHandler_TICKETING_AddAssignmentRule(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().AddAssignmentRule(c)
	if w.Code >= 500 {
		t.Fatalf("AddAssignmentRule: got %d", w.Code)
	}
}
func TestHandler_TICKETING_GetAssignmentRules(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetAssignmentRules(c)
	if w.Code >= 500 {
		t.Fatalf("GetAssignmentRules: got %d", w.Code)
	}
}
func TestHandler_TICKETING_RemoveAssignmentRule(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().RemoveAssignmentRule(c)
	if w.Code >= 500 {
		t.Fatalf("RemoveAssignmentRule: got %d", w.Code)
	}
}
func TestHandler_TICKETING_AddRelation(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().AddRelation(c)
	if w.Code >= 500 {
		t.Fatalf("AddRelation: got %d", w.Code)
	}
}
func TestHandler_TICKETING_GetRelations(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetRelations(c)
	if w.Code >= 500 {
		t.Fatalf("GetRelations: got %d", w.Code)
	}
}
func TestHandler_TICKETING_FindRelatedTickets(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().FindRelatedTickets(c)
	if w.Code >= 500 {
		t.Fatalf("FindRelatedTickets: got %d", w.Code)
	}
}
func TestHandler_TICKETING_DetectDuplicates(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().DetectDuplicates(c)
	if w.Code >= 500 {
		t.Fatalf("DetectDuplicates: got %d", w.Code)
	}
}
func TestHandler_TICKETING_CorrelateRootCause(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CorrelateRootCause(c)
	if w.Code >= 500 {
		t.Fatalf("CorrelateRootCause: got %d", w.Code)
	}
}
func TestHandler_TICKETING_AddSLATarget(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().AddSLATarget(c)
	if w.Code >= 500 {
		t.Fatalf("AddSLATarget: got %d", w.Code)
	}
}
func TestHandler_TICKETING_GetTicketSLA(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetTicketSLA(c)
	if w.Code >= 500 {
		t.Fatalf("GetTicketSLA: got %d", w.Code)
	}
}
func TestHandler_TICKETING_GetSLACompliance(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetSLACompliance(c)
	if w.Code >= 500 {
		t.Fatalf("GetSLACompliance: got %d", w.Code)
	}
}
func TestHandler_TICKETING_GetResolutionStats(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetResolutionStats(c)
	if w.Code >= 500 {
		t.Fatalf("GetResolutionStats: got %d", w.Code)
	}
}
func TestHandler_TICKETING_GetBacklogAnalysis(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetBacklogAnalysis(c)
	if w.Code >= 500 {
		t.Fatalf("GetBacklogAnalysis: got %d", w.Code)
	}
}
func TestHandler_TICKETING_GetTrendReport(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetTrendReport(c)
	if w.Code >= 500 {
		t.Fatalf("GetTrendReport: got %d", w.Code)
	}
}
func TestHandler_TICKETING_GetStatistics(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetStatistics(c)
	if w.Code >= 500 {
		t.Fatalf("GetStatistics: got %d", w.Code)
	}
}
func TestHandler_TICKETING_RegisterEngineer(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().RegisterEngineer(c)
	if w.Code >= 500 {
		t.Fatalf("RegisterEngineer: got %d", w.Code)
	}
}
func TestHandler_TICKETING_ListEngineers(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListEngineers(c)
	if w.Code >= 500 {
		t.Fatalf("ListEngineers: got %d", w.Code)
	}
}
func TestHandler_TICKETING_GetEngineer(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetEngineer(c)
	if w.Code >= 500 {
		t.Fatalf("GetEngineer: got %d", w.Code)
	}
}
func TestHandler_TICKETING_AutoDispatch(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().AutoDispatch(c)
	if w.Code >= 500 {
		t.Fatalf("AutoDispatch: got %d", w.Code)
	}
}
func TestHandler_TICKETING_ManualDispatch(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ManualDispatch(c)
	if w.Code >= 500 {
		t.Fatalf("ManualDispatch: got %d", w.Code)
	}
}
func TestHandler_TICKETING_GetBestMatch(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetBestMatch(c)
	if w.Code >= 500 {
		t.Fatalf("GetBestMatch: got %d", w.Code)
	}
}
func TestHandler_TICKETING_CalculateDispatchScore(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CalculateDispatchScore(c)
	if w.Code >= 500 {
		t.Fatalf("CalculateDispatchScore: got %d", w.Code)
	}
}
func TestHandler_TICKETING_GetDispatchQueueStatus(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetDispatchQueueStatus(c)
	if w.Code >= 500 {
		t.Fatalf("GetDispatchQueueStatus: got %d", w.Code)
	}
}
func TestHandler_TICKETING_GetDispatchQueueEntries(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetDispatchQueueEntries(c)
	if w.Code >= 500 {
		t.Fatalf("GetDispatchQueueEntries: got %d", w.Code)
	}
}
func TestHandler_TICKETING_GetSLAAlerts(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetSLAAlerts(c)
	if w.Code >= 500 {
		t.Fatalf("GetSLAAlerts: got %d", w.Code)
	}
}
func TestHandler_TICKETING_AddDispatchRule(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().AddDispatchRule(c)
	if w.Code >= 500 {
		t.Fatalf("AddDispatchRule: got %d", w.Code)
	}
}
func TestHandler_TICKETING_GetDispatchRules(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetDispatchRules(c)
	if w.Code >= 500 {
		t.Fatalf("GetDispatchRules: got %d", w.Code)
	}
}
func TestHandler_TICKETING_GetLoadBalanceReport(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetLoadBalanceReport(c)
	if w.Code >= 500 {
		t.Fatalf("GetLoadBalanceReport: got %d", w.Code)
	}
}
func TestHandler_TICKETING_GetReassignmentSuggestions(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetReassignmentSuggestions(c)
	if w.Code >= 500 {
		t.Fatalf("GetReassignmentSuggestions: got %d", w.Code)
	}
}
func TestHandler_TICKETING_GetDispatchMetrics(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetDispatchMetrics(c)
	if w.Code >= 500 {
		t.Fatalf("GetDispatchMetrics: got %d", w.Code)
	}
}
func TestHandler_TICKETING_GetAssignmentSuccessMetrics(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetAssignmentSuccessMetrics(c)
	if w.Code >= 500 {
		t.Fatalf("GetAssignmentSuccessMetrics: got %d", w.Code)
	}
}
func TestHandler_TICKETING_GetTimeToAssignmentStats(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetTimeToAssignmentStats(c)
	if w.Code >= 500 {
		t.Fatalf("GetTimeToAssignmentStats: got %d", w.Code)
	}
}
func TestHandler_TICKETING_GetEngineerPerformance(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetEngineerPerformance(c)
	if w.Code >= 500 {
		t.Fatalf("GetEngineerPerformance: got %d", w.Code)
	}
}
func TestHandler_TICKETING_GetAllEngineerPerformances(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetAllEngineerPerformances(c)
	if w.Code >= 500 {
		t.Fatalf("GetAllEngineerPerformances: got %d", w.Code)
	}
}
func TestHandler_TICKETING_UpdateDispatchWeights(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().UpdateDispatchWeights(c)
	if w.Code >= 500 {
		t.Fatalf("UpdateDispatchWeights: got %d", w.Code)
	}
}
func TestHandler_TICKETING_GetDispatchWeights(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetDispatchWeights(c)
	if w.Code >= 500 {
		t.Fatalf("GetDispatchWeights: got %d", w.Code)
	}
}
func TestHandler_TICKETING_TransferTicket(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().TransferTicket(c)
	if w.Code >= 500 {
		t.Fatalf("TransferTicket: got %d", w.Code)
	}
}
func TestHandler_TICKETING_GetTransferHistory(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetTransferHistory(c)
	if w.Code >= 500 {
		t.Fatalf("GetTransferHistory: got %d", w.Code)
	}
}
func TestHandler_TICKETING_GetTransferStats(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetTransferStats(c)
	if w.Code >= 500 {
		t.Fatalf("GetTransferStats: got %d", w.Code)
	}
}
func TestHandler_TICKETING_CreateSuspend(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CreateSuspend(c)
	if w.Code >= 500 {
		t.Fatalf("CreateSuspend: got %d", w.Code)
	}
}
func TestHandler_TICKETING_ActivateSuspend(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ActivateSuspend(c)
	if w.Code >= 500 {
		t.Fatalf("ActivateSuspend: got %d", w.Code)
	}
}
func TestHandler_TICKETING_EndSuspend(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().EndSuspend(c)
	if w.Code >= 500 {
		t.Fatalf("EndSuspend: got %d", w.Code)
	}
}
func TestHandler_TICKETING_CancelSuspend(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CancelSuspend(c)
	if w.Code >= 500 {
		t.Fatalf("CancelSuspend: got %d", w.Code)
	}
}
func TestHandler_TICKETING_ListSuspensions(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListSuspensions(c)
	if w.Code >= 500 {
		t.Fatalf("ListSuspensions: got %d", w.Code)
	}
}
func TestHandler_TICKETING_GetSuspend(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetSuspend(c)
	if w.Code >= 500 {
		t.Fatalf("GetSuspend: got %d", w.Code)
	}
}
func TestHandler_TICKETING_GetEngineerSuspensions(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetEngineerSuspensions(c)
	if w.Code >= 500 {
		t.Fatalf("GetEngineerSuspensions: got %d", w.Code)
	}
}
func TestHandler_TICKETING_GetEngineerSuspendImpact(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetEngineerSuspendImpact(c)
	if w.Code >= 500 {
		t.Fatalf("GetEngineerSuspendImpact: got %d", w.Code)
	}
}
func TestHandler_TICKETING_GetExecutiveDashboard(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetExecutiveDashboard(c)
	if w.Code >= 500 {
		t.Fatalf("GetExecutiveDashboard: got %d", w.Code)
	}
}
func TestHandler_TICKETING_GetManagerDashboard(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetManagerDashboard(c)
	if w.Code >= 500 {
		t.Fatalf("GetManagerDashboard: got %d", w.Code)
	}
}
func TestHandler_TICKETING_GetEngineerDashboard(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetEngineerDashboard(c)
	if w.Code >= 500 {
		t.Fatalf("GetEngineerDashboard: got %d", w.Code)
	}
}
func TestHandler_TICKETING_GetEngineerEfficiency(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetEngineerEfficiency(c)
	if w.Code >= 500 {
		t.Fatalf("GetEngineerEfficiency: got %d", w.Code)
	}
}
func TestHandler_TICKETING_GetEfficiencyScore(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetEfficiencyScore(c)
	if w.Code >= 500 {
		t.Fatalf("GetEfficiencyScore: got %d", w.Code)
	}
}
func TestHandler_TICKETING_ComparePeriods(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ComparePeriods(c)
	if w.Code >= 500 {
		t.Fatalf("ComparePeriods: got %d", w.Code)
	}
}
func TestHandler_TICKETING_ExportBIData(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ExportBIData(c)
	if w.Code >= 500 {
		t.Fatalf("ExportBIData: got %d", w.Code)
	}
}
func TestHandler_TICKETING_GetTimeTrend(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetTimeTrend(c)
	if w.Code >= 500 {
		t.Fatalf("GetTimeTrend: got %d", w.Code)
	}
}
func TestHandler_TICKETING_CreateSLAPolicy(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CreateSLAPolicy(c)
	if w.Code >= 500 {
		t.Fatalf("CreateSLAPolicy: got %d", w.Code)
	}
}
func TestHandler_TICKETING_ListSLAPolicies(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListSLAPolicies(c)
	if w.Code >= 500 {
		t.Fatalf("ListSLAPolicies: got %d", w.Code)
	}
}
func TestHandler_TICKETING_GetSLAPolicy(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetSLAPolicy(c)
	if w.Code >= 500 {
		t.Fatalf("GetSLAPolicy: got %d", w.Code)
	}
}
func TestHandler_TICKETING_UpdateSLAPolicy(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().UpdateSLAPolicy(c)
	if w.Code >= 500 {
		t.Fatalf("UpdateSLAPolicy: got %d", w.Code)
	}
}
func TestHandler_TICKETING_DeleteSLAPolicy(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().DeleteSLAPolicy(c)
	if w.Code >= 500 {
		t.Fatalf("DeleteSLAPolicy: got %d", w.Code)
	}
}
func TestHandler_TICKETING_GetTicketSLAStatus(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetTicketSLAStatus(c)
	if w.Code >= 500 {
		t.Fatalf("GetTicketSLAStatus: got %d", w.Code)
	}
}
func TestHandler_TICKETING_GetBreaches(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetBreaches(c)
	if w.Code >= 500 {
		t.Fatalf("GetBreaches: got %d", w.Code)
	}
}
func TestHandler_TICKETING_GetCompliance(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetCompliance(c)
	if w.Code >= 500 {
		t.Fatalf("GetCompliance: got %d", w.Code)
	}
}
func TestHandler_TICKETING_CreateAutomationRule(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CreateAutomationRule(c)
	if w.Code >= 500 {
		t.Fatalf("CreateAutomationRule: got %d", w.Code)
	}
}
func TestHandler_TICKETING_ListAutomationRules(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListAutomationRules(c)
	if w.Code >= 500 {
		t.Fatalf("ListAutomationRules: got %d", w.Code)
	}
}
func TestHandler_TICKETING_UpdateAutomationRule(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().UpdateAutomationRule(c)
	if w.Code >= 500 {
		t.Fatalf("UpdateAutomationRule: got %d", w.Code)
	}
}
func TestHandler_TICKETING_DeleteAutomationRule(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().DeleteAutomationRule(c)
	if w.Code >= 500 {
		t.Fatalf("DeleteAutomationRule: got %d", w.Code)
	}
}
func TestHandler_TICKETING_ExecuteRule(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ExecuteRule(c)
	if w.Code >= 500 {
		t.Fatalf("ExecuteRule: got %d", w.Code)
	}
}
