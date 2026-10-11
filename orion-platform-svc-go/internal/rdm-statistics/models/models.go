// Package models defines response types for the RDM statistics module.
//
// These match the shapes the orion-frontend/src/api/rdm.ts client declares
// (getBurndownData / getVelocityData / getDefectStatsAPI / getSprintStats).
// The frontend API client declares these endpoints but has no data source
// yet; this module provides real HTTP routes so those calls return 200
// instead of 404, matching the frontend contract.
//
// Aggregation is currently a no-op (returns empty arrays). When the RDM
// entity tables (rdm_requirements / rdm_defects / rdm_tasks) land, the
// Service implementation can be wired to real aggregation logic without
// changing the response shapes here.
package models

// BurndownPoint is a single data point on a sprint burndown chart.
// See frontend rdm.ts `BurndownPoint`.
type BurndownPoint struct {
	Date            string `json:"date"`
	RemainingPoints int    `json:"remainingPoints"`
	IdealPoints     int    `json:"idealPoints"`
}

// VelocityPoint is a single data point on a velocity trend.
// See frontend rdm.ts `VelocityPoint`.
type VelocityPoint struct {
	Sprint          string `json:"sprint"`
	CompletedPoints int    `json:"completedPoints"`
}

// DefectStats is the response for GET /rdm/statistics/defects.
// See frontend rdm.ts getDefectStatsAPI.
type DefectStats struct {
	BySeverity []DefectBySeverity `json:"bySeverity"`
	ByStatus   []DefectByStatus   `json:"byStatus"`
}

// DefectBySeverity counts defects per severity value
// (critical / major / minor / cosmetic).
type DefectBySeverity struct {
	Severity string `json:"severity"`
	Count    int    `json:"count"`
}

// DefectByStatus counts defects per status value
// (open / in_progress / fixed / verified / closed / rejected).
type DefectByStatus struct {
	Status string `json:"status"`
	Count  int    `json:"count"`
}

// SprintSummary is a single entry of the sprint aggregate stats.
// See frontend rdm.ts getSprintStats.
type SprintSummary struct {
	SprintID        string `json:"sprintId"`
	SprintName      string `json:"sprintName"`
	TotalTasks      int    `json:"totalTasks"`
	CompletedTasks  int    `json:"completedTasks"`
	TotalPoints     int    `json:"totalPoints"`
	CompletedPoints int    `json:"completedPoints"`
}

// SprintSummaryList is the response for GET /rdm/statistics/sprints.
type SprintSummaryList []SprintSummary
