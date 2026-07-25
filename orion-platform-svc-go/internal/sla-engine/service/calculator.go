//go:generate mockgen -destination=mock_service.go -package=service . ServiceInterface
//go:generate mockgen -destination=mock_repository.go -package=service . RepositoryInterface

package service

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"orion/platform-svc-go/internal/sla-engine/models"
	"orion/go-common/pkg/sentinel"
)

// RepositoryInterface defines the repository methods used by the calculator.
type RepositoryInterface interface {
	CreateProfile(ctx context.Context, m *models.SLAProfile) error
	GetProfile(ctx context.Context, tenantID, id string) (*models.SLAProfile, error)
	ListProfiles(ctx context.Context, tenantID string, q models.ProfileListQuery) ([]models.SLAProfile, error)
	UpdateProfile(ctx context.Context, tenantID, id string, updates map[string]interface{}) error
	DeleteProfile(ctx context.Context, tenantID, id string) error

	CreateTracker(ctx context.Context, m *models.SLATracker) error
	GetTracker(ctx context.Context, tenantID, id string) (*models.SLATracker, error)
	ListTrackers(ctx context.Context, tenantID string, q models.TrackerListQuery) ([]models.SLATracker, error)
	UpdateTracker(ctx context.Context, tenantID, id string, updates map[string]interface{}) error
	DeleteTracker(ctx context.Context, tenantID, id string) error

	CreateHoliday(ctx context.Context, m *models.SLAHoliday) error
	ListHolidays(ctx context.Context, tenantID string, year int) ([]models.SLAHoliday, error)
	DeleteHoliday(ctx context.Context, tenantID, id string) error

	GetActiveTrackersByProfile(ctx context.Context, tenantID, profileID string) ([]models.SLATracker, error)
	GetTrackerStatistics(ctx context.Context, tenantID string) (models.TrackerStatistics, error)
	GetHolidaysForPeriod(ctx context.Context, tenantID string, start, end interface{}) ([]models.SLAHoliday, error)
	GetViolationsByTracker(ctx context.Context, trackerID string) ([]models.SLAViolation, error)
	GetViolationStatistics(ctx context.Context, tenantID string) (models.ViolationStatistics, error)
	MarkViolated(ctx context.Context, tenantID, trackerID string, violationType, details string) (*models.SLAViolation, error)
}

type SLACalculator struct {
	repo RepositoryInterface
}

func NewSLACalculator(repo RepositoryInterface) *SLACalculator {
	return &SLACalculator{repo: repo}
}

// CalculateDeadlines computes the response and resolution deadlines for a given SLA profile
// and opened time, applying business-hours, weekend, and holiday rules.
func (c *SLACalculator) CalculateDeadlines(ctx context.Context, profile *models.SLAProfile, openedAt time.Time) (responseDeadline, resolutionDeadline time.Time) {
	profileResponse, err := parseDuration(profile.ResponseSLA)
	if err != nil {
		profileResponse = time.Hour // default 1h on parse failure
	}
	profileResolution, err := parseDuration(profile.ResolutionSLA)
	if err != nil {
		profileResolution = 4 * time.Hour // default 4h on parse failure
	}

	responseDeadline = computeDeadline(openedAt, profileResponse, profile)
	// Resolution deadline is computed from the opened time (not from response deadline),
	// as is standard in ITSM: both SLA timers start when the ticket opens.
	resolutionDeadline = computeDeadline(openedAt, profileResolution, profile)

	return responseDeadline, resolutionDeadline
}

// CreateTracker creates a new SLA tracker for the target entity, computing deadlines from the profile.
func (c *SLACalculator) CreateTracker(ctx context.Context, tenantID, slaProfileID, targetID, targetType string, openedAt time.Time) (*models.SLATracker, error) {
	profile, err := c.repo.GetProfile(ctx, tenantID, slaProfileID)
	if err != nil {
		return nil, fmt.Errorf("sla profile %q not found: %w", slaProfileID, sentinel.NotFound)
	}
	if profile.Status != "active" {
		return nil, errors.New("sla profile is not active")
	}

	responseDeadline, resolutionDeadline := c.CalculateDeadlines(ctx, profile, openedAt)

	tracker := &models.SLATracker{
		TenantID:           tenantID,
		SLAProfileID:       slaProfileID,
		TargetID:           targetID,
		TargetType:         targetType,
		OpenedAt:           openedAt,
		ResponseDeadline:   responseDeadline,
		ResolutionDeadline: resolutionDeadline,
		Status:             "active",
	}

	if err := c.repo.CreateTracker(ctx, tracker); err != nil {
		return nil, err
	}
	return tracker, nil
}

// PauseTracker pauses an active SLA tracker, freezing the deadline timer.
func (c *SLACalculator) PauseTracker(ctx context.Context, tenantID, trackerID, reason string) error {
	t, err := c.repo.GetTracker(ctx, tenantID, trackerID)
	if err != nil {
		return fmt.Errorf("tracker %q not found: %w", trackerID, sentinel.NotFound)
	}
	if t.Status != "active" && t.Status != "responded" {
		return fmt.Errorf("tracker status must be active or responded, got %q", t.Status)
	}
	if reason == "" {
		reason = "manual pause"
	}
	now := time.Now().UTC()
	if err := c.repo.UpdateTracker(ctx, t.TenantID, trackerID, map[string]interface{}{
		"status":      "paused",
		"paused_at":   now,
		"paused_reason": reason,
	}); err != nil {
		return err
	}
	return nil
}

// ResumeTracker resumes a paused SLA tracker. The deadline is not extended; the timer
// resumes from where it was paused (it was frozen while paused).
func (c *SLACalculator) ResumeTracker(ctx context.Context, tenantID, trackerID string) error {
	t, err := c.repo.GetTracker(ctx, tenantID, trackerID)
	if err != nil {
		return fmt.Errorf("tracker %q not found: %w", trackerID, sentinel.NotFound)
	}
	if t.Status != "paused" {
		return fmt.Errorf("tracker status must be paused, got %q", t.Status)
	}
	now := time.Now().UTC()
	if err := c.repo.UpdateTracker(ctx, t.TenantID, trackerID, map[string]interface{}{
		"status":    "active",
		"resumed_at": now,
	}); err != nil {
		return err
	}
	return nil
}

// RecordResponse records the first response time and advances the tracker to "responded".
func (c *SLACalculator) RecordResponse(ctx context.Context, tenantID, trackerID string) error {
	t, err := c.repo.GetTracker(ctx, tenantID, trackerID)
	if err != nil {
		return fmt.Errorf("tracker %q not found: %w", trackerID, sentinel.NotFound)
	}
	if t.Status == "resolved" || t.Status == "breached" {
		return fmt.Errorf("tracker already %s, cannot record response", t.Status)
	}

	responseTime := time.Since(t.OpenedAt)
	var responseTimeMs int64
	if t.PausedAt != nil && t.ResumedAt != nil {
		// Subtract the actual paused interval
		responseTimeMs = int64(responseTime - (t.ResumedAt.Sub(*t.PausedAt)))
	} else {
		responseTimeMs = int64(responseTime)
	}

	if err := c.repo.UpdateTracker(ctx, t.TenantID, trackerID, map[string]interface{}{
		"status":        "responded",
		"response_time": responseTimeMs,
	}); err != nil {
		return err
	}
	return nil
}

// RecordResolution records the resolution time and advances the tracker to "resolved".
func (c *SLACalculator) RecordResolution(ctx context.Context, tenantID, trackerID string) error {
	t, err := c.repo.GetTracker(ctx, tenantID, trackerID)
	if err != nil {
		return fmt.Errorf("tracker %q not found: %w", trackerID, sentinel.NotFound)
	}
	if t.Status == "breached" {
		return fmt.Errorf("tracker already breached, cannot record resolution")
	}

	resolutionTime := time.Since(t.OpenedAt)
	var resolutionTimeMs int64
	if t.PausedAt != nil && t.ResumedAt != nil {
		// Subtract the actual paused interval
		resolutionTimeMs = int64(resolutionTime - (t.ResumedAt.Sub(*t.PausedAt)))
	} else {
		resolutionTimeMs = int64(resolutionTime)
	}

	if err := c.repo.UpdateTracker(ctx, t.TenantID, trackerID, map[string]interface{}{
		"status":         "resolved",
		"resolution_time": resolutionTimeMs,
	}); err != nil {
		return err
	}
	return nil
}

// CheckBreaches scans all active/responded trackers for the tenant and marks those whose
// response or resolution deadlines have passed.
func (c *SLACalculator) CheckBreaches(ctx context.Context, tenantID string) []models.SLATracker {
	// Iterate all open trackers and detect deadline breaches.
	trackers, err := c.repo.ListTrackers(ctx, tenantID, models.TrackerListQuery{})
	if err != nil {
		return nil
	}

	var breaches []models.SLATracker
	now := time.Now()
	for _, t := range trackers {
		// Skip non-breachable statuses
		if t.Status == "resolved" || t.Status == "breached" {
			continue
		}

		// Check response deadline breach
		if t.Status == "open" && t.ResponseDeadline.Before(now) {
			breaches = append(breaches, t)
		}
		// Check resolution deadline breach
		if t.Status == "responded" && t.ResolutionDeadline.Before(now) {
			breaches = append(breaches, t)
		}
	}

	return breaches
}

// GetTracker retrieves a tracker by ID (tenant-validated in the handler).
func (c *SLACalculator) GetTracker(ctx context.Context, tenantID, trackerID string) (*models.SLATracker, error) {
	t, err := c.repo.GetTracker(ctx, tenantID, trackerID)
	if err != nil {
		if IsNotFound(err) {
			return nil, fmt.Errorf("tracker %q not found: %w", trackerID, sentinel.NotFound)
		}
		return nil, err
	}
	return t, nil
}

// ListTrackers lists SLA trackers filtered by target type and status.
func (c *SLACalculator) ListTrackers(ctx context.Context, tenantID, targetType, status string, limit, offset int) ([]models.SLATracker, error) {
	q := models.TrackerListQuery{
		TargetType: targetType,
		Status:     status,
		Limit:      limit,
		Offset:     offset,
	}
	return c.repo.ListTrackers(ctx, tenantID, q)
}

// CreateProfile creates a new SLA profile.
func (c *SLACalculator) CreateProfile(ctx context.Context, tenantID string, req models.CreateProfileRequest) (*models.SLAProfile, error) {
	profile := &models.SLAProfile{
		TenantID:       tenantID,
		Name:           req.Name,
		Type:           req.Type,
		Priority:       req.Priority,
		ResponseSLA:    req.ResponseSLA,
		ResolutionSLA:  req.ResolutionSLA,
		Description:    req.Description,
		WorkingDays:    req.WorkingDays,
		WorkingHours:   req.WorkingHours,
	}
	if req.BusinessHours != nil {
		profile.BusinessHours = *req.BusinessHours
	}
	if req.WeekendsIncluded != nil {
		profile.WeekendsIncluded = *req.WeekendsIncluded
	}
	if req.HolidaysExcluded != nil {
		profile.HolidaysExcluded = *req.HolidaysExcluded
	}

	if err := c.repo.CreateProfile(ctx, profile); err != nil {
		return nil, err
	}
	return profile, nil
}

// GetProfile retrieves an SLA profile by ID.
func (c *SLACalculator) GetProfile(ctx context.Context, tenantID, id string) (*models.SLAProfile, error) {
	p, err := c.repo.GetProfile(ctx, tenantID, id)
	if err != nil {
		if IsNotFound(err) {
			return nil, fmt.Errorf("profile %q not found: %w", id, sentinel.NotFound)
		}
		return nil, err
	}
	return p, nil
}

// ListProfiles lists SLA profiles for the tenant with optional filtering.
func (c *SLACalculator) ListProfiles(ctx context.Context, tenantID string, q models.ProfileListQuery) ([]models.SLAProfile, error) {
	return c.repo.ListProfiles(ctx, tenantID, q)
}

// UpdateProfile updates an SLA profile.
func (c *SLACalculator) UpdateProfile(ctx context.Context, tenantID, id string, req models.UpdateProfileRequest) (*models.SLAProfile, error) {
	updates := make(map[string]interface{})
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.Type != nil {
		updates["type"] = *req.Type
	}
	if req.Priority != nil {
		updates["priority"] = *req.Priority
	}
	if req.ResponseSLA != nil {
		updates["response_sla"] = *req.ResponseSLA
	}
	if req.ResolutionSLA != nil {
		updates["resolution_sla"] = *req.ResolutionSLA
	}
	if req.Description != nil {
		updates["description"] = *req.Description
	}
	if req.BusinessHours != nil {
		updates["business_hours"] = *req.BusinessHours
	}
	if req.WeekendsIncluded != nil {
		updates["weekends_included"] = *req.WeekendsIncluded
	}
	if req.HolidaysExcluded != nil {
		updates["holidays_excluded"] = *req.HolidaysExcluded
	}
	if req.WorkingDays != nil {
		updates["working_days"] = *req.WorkingDays
	}
	if req.WorkingHours != nil {
		updates["working_hours"] = *req.WorkingHours
	}
	if req.Status != nil {
		updates["status"] = *req.Status
	}
	if len(updates) == 0 {
		return c.repo.GetProfile(ctx, tenantID, id)
	}
	if err := c.repo.UpdateProfile(ctx, tenantID, id, updates); err != nil {
		return nil, err
	}
	return c.repo.GetProfile(ctx, tenantID, id)
}

// DeleteProfile deletes an SLA profile.
func (c *SLACalculator) DeleteProfile(ctx context.Context, tenantID, id string) error {
	return c.repo.DeleteProfile(ctx, tenantID, id)
}

// CreateHoliday adds a holiday to exclude from SLA counting.
func (c *SLACalculator) CreateHoliday(ctx context.Context, tenantID, name string, date time.Time) (*models.SLAHoliday, error) {
	holiday := &models.SLAHoliday{
		TenantID: tenantID,
		Name:     name,
		Date:     date,
	}
	if err := c.repo.CreateHoliday(ctx, holiday); err != nil {
		return nil, err
	}
	return holiday, nil
}

// GetTrackerStatistics returns SLA tracker statistics for the tenant.
func (c *SLACalculator) GetTrackerStatistics(ctx context.Context, tenantID string) (models.TrackerStatistics, error) {
	return c.repo.GetTrackerStatistics(ctx, tenantID)
}

// --- Private helpers ---

func parseDuration(s string) (time.Duration, error) {
	if s == "" {
		return 0, errors.New("empty duration")
	}
	// Support "1h", "4h", "24h", "72h", "30m", "7d", "720m" formats.
	d, err := time.ParseDuration(s)
	if err == nil {
		return d, nil
	}
	// Try "Xd" format (days).
	if strings.HasSuffix(s, "d") {
		var h int64
		_, err := fmt.Sscanf(s, "%dd", &h)
		if err != nil {
			return 0, err
		}
		return time.Duration(h) * 24 * time.Hour, nil
	}
	// Try plain "N" meaning hours (common ITSM shorthand).
	var n int64
	_, err = fmt.Sscanf(s, "%d", &n)
	if err != nil {
		return 0, fmt.Errorf("invalid duration format %q", s)
	}
	return time.Duration(n) * time.Hour, nil
}

func computeDeadline(openedAt time.Time, duration time.Duration, profile *models.SLAProfile) time.Time {
	if !profile.BusinessHours {
		return openedAt.Add(duration)
	}
	return addBusinessHours(openedAt, duration, profile)
}

// addBusinessHours adds a duration counting only business hours and working days,
// skipping weekends and holidays.
func addBusinessHours(openedAt time.Time, duration time.Duration, profile *models.SLAProfile) time.Time {
	// Parse working hours "09:00-18:00"
	workStart := 9 * 60 // default 09:00
	workEnd := 18 * 60  // default 18:00
	if profile.WorkingHours != "" {
		parts := strings.Split(profile.WorkingHours, "-")
		if len(parts) == 2 {
			var sh, sm, eh, em int
			if _, err := fmt.Sscanf(parts[0], "%d:%d", &sh, &sm); err == nil {
				workStart = sh*60 + sm
			}
			if _, err := fmt.Sscanf(parts[1], "%d:%d", &eh, &em); err == nil {
				workEnd = eh*60 + em
			}
		}
	}

	workingMinutes := workEnd - workStart
	if workingMinutes <= 0 {
		return openedAt.Add(duration) // fallback: no working window, add raw duration
	}

	totalMinutes := int(duration.Minutes())
	if totalMinutes <= 0 {
		return openedAt
	}

	remainingMinutes := totalMinutes
	candidate := openedAt

	// Simulate day-by-day until duration is consumed
	for remainingMinutes > 0 {
		// Check if today is a working day
		if !isWorkingDay(candidate, profile) {
			// Skip to next day at work start
			candidate = candidate.AddDate(0, 0, 1)
			candidate = candidate.Truncate(24*time.Hour).Add(time.Duration(workStart) * time.Minute)
			continue
		}

		// Calculate minutes available today
		todayMinutes := minutesUntilEndOfDay(candidate, workEnd)
		if todayMinutes <= 0 {
			// Past working hours today, move to next day
			candidate = candidate.AddDate(0, 0, 1)
			candidate = candidate.Truncate(24*time.Hour).Add(time.Duration(workStart) * time.Minute)
			continue
		}

		if remainingMinutes <= todayMinutes {
			candidate = candidate.Add(time.Duration(remainingMinutes) * time.Minute)
			remainingMinutes = 0
		} else {
			remainingMinutes -= todayMinutes
			// Move to next working day
			candidate = candidate.AddDate(0, 0, 1)
			candidate = candidate.Truncate(24*time.Hour).Add(time.Duration(workStart) * time.Minute)
		}

		// Safety valve: prevent infinite loops (max 365 days)
		if candidate.Sub(openedAt) > 365*24*time.Hour {
			break
		}
	}

	return candidate
}

// minutesUntilEndOfDay calculates minutes remaining in the working window today.
func minutesUntilEndOfDay(t time.Time, workEnd int) int {
	nowMinutes := t.Hour()*60 + t.Minute()
	if nowMinutes >= workEnd {
		return 0
	}
	return workEnd - nowMinutes
}

// isWorkingDay checks if the date falls on a working day (default Mon-Fri).
func isWorkingDay(t time.Time, profile *models.SLAProfile) bool {
	if profile.WeekendsIncluded {
		return true
	}
	weekday := t.Weekday()
	if weekday == time.Saturday || weekday == time.Sunday {
		return false
	}
	// Custom working days check (e.g., "Mon-Fri", "Sun-Thu")
	if profile.WorkingDays != "" {
		return dayInRange(weekday, profile.WorkingDays)
	}
	return true // default Mon-Fri already handled above
}

func dayInRange(weekday time.Weekday, workingDays string) bool {
	dayNames := map[string]time.Weekday{
		"Mon": time.Monday, "Tue": time.Tuesday, "Wed": time.Wednesday,
		"Thu": time.Thursday, "Fri": time.Friday, "Sat": time.Saturday, "Sun": time.Sunday,
	}
	// Support "Mon-Fri" or "Sun-Thu" ranges
	parts := strings.Split(workingDays, "-")
	if len(parts) == 2 {
		start, ok1 := dayNames[parts[0]]
		end, ok2 := dayNames[parts[1]]
		if !ok1 || !ok2 {
			return weekday != time.Saturday && weekday != time.Sunday
		}
		// Handle wrap-around (e.g., Sun-Thu)
		startInt := int(start)
		endInt := int(end)
		if startInt <= endInt {
			return int(weekday) >= startInt && int(weekday) <= endInt
		}
		return int(weekday) >= startInt || int(weekday) <= endInt
	}
	// Single day list (e.g., "Mon,Wed,Fri")
	for _, day := range strings.Split(workingDays, ",") {
		d := strings.TrimSpace(day)
		if wd, ok := dayNames[d]; ok && wd == weekday {
			return true
		}
	}
	return false
}

func IsNotFound(err error) bool {
	return strings.Contains(err.Error(), "not found") || errors.Is(err, sentinel.NotFound)
}
