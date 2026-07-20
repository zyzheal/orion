package service

import (
	"math"
	"time"

	"orion/platform-svc-go/internal/efficiency/models"
)

// ==================== Generic helpers ====================

func filterSlice[T any](slice []T, fn func(T) bool) []T {
	out := make([]T, 0, len(slice))
	for _, v := range slice {
		if fn(v) {
			out = append(out, v)
		}
	}
	return out
}

func countBy[T any](slice []T, fn func(T) bool) int {
	n := 0
	for _, v := range slice {
		if fn(v) {
			n++
		}
	}
	return n
}

func filterPipelinesByWindow(pipelines []models.PipelineCompletionRecord, wc models.TimeWindowConfig) []models.PipelineCompletionRecord {
	return filterSlice(pipelines, func(p models.PipelineCompletionRecord) bool {
		return !p.CompletedAt.Before(wc.Start) && !p.CompletedAt.After(wc.End)
	})
}

func filterDeploymentsByWindow(deployments []models.DeploymentRecord, wc models.TimeWindowConfig) []models.DeploymentRecord {
	return filterSlice(deployments, func(d models.DeploymentRecord) bool {
		return !d.DeployedAt.Before(wc.Start) && !d.DeployedAt.After(wc.End)
	})
}

func daysInWindow(wc models.TimeWindowConfig) int {
	msInDay := 24 * 60 * 60 * 1000
	days := int(wc.End.Sub(wc.Start).Milliseconds() / int64(msInDay))
	if days < 1 {
		return 1
	}
	return days
}

func getWindowDurationMs(window models.TimeWindow, size int) time.Duration {
	dayMs := int64(24 * 60 * 60 * 1000)
	switch window {
	case models.TimeWindowDay:
		return time.Duration(dayMs*int64(size)) * time.Millisecond
	case models.TimeWindowWeek:
		return time.Duration(dayMs*7*int64(size)) * time.Millisecond
	case models.TimeWindowMonth:
		return time.Duration(dayMs*30*int64(size)) * time.Millisecond
	case models.TimeWindowQuarter:
		return time.Duration(dayMs*90*int64(size)) * time.Millisecond
	default:
		return time.Duration(dayMs*7*int64(size)) * time.Millisecond
	}
}

func round2(v float64) float64 {
	return math.Round(v*100) / 100
}

func sumInt64(vals []int64) int64 {
	var s int64
	for _, v := range vals {
		s += v
	}
	return s
}

func percentile(sorted []int64, p int) int64 {
	if len(sorted) == 0 {
		return 0
	}
	idx := int(math.Ceil(float64(p)/100*float64(len(sorted)))) - 1
	if idx < 0 {
		idx = 0
	}
	if idx >= len(sorted) {
		idx = len(sorted) - 1
	}
	return sorted[idx]
}

func copyTeamInfos(src []models.TeamInfo) []models.TeamInfo {
	out := make([]models.TeamInfo, len(src))
	copy(out, src)
	return out
}
