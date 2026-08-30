package service

import (
	"context"
	"sync"
	"time"

	"orion/platform-svc-go/internal/infrastructure/backup/models"

	"github.com/robfig/cron/v3"
	"go.uber.org/zap"
)

// ArchiveScheduler runs the Archiver on a cron cadence per (tenant, plan)
// pair. It is a sibling to Scheduler but owns a separate cron instance so
// archiving failures never affect backup execution timing.
type ArchiveScheduler struct {
	cron     *cron.Cron
	entries  map[string]cron.EntryID // key: <tenant>/<plan>
	plans    map[string]*ArchivePlanSpec
	mu       sync.RWMutex
	archiver *Archiver
	logger   *zap.Logger
}

// ArchivePlanSpec is the per-plan archive configuration. It deliberately
// duplicates the fields the cron callback needs so callers can construct
// specs without holding a full BackupPlan reference.
type ArchivePlanSpec struct {
	TenantID      string
	PlanID        string
	SourceDir     string
	ArchiveType   models.ArchiveType
	Schedule      string // cron expression (seconds precision)
	EncryptionKey []byte
	Enabled       bool
}

// NewArchiveScheduler returns an ArchiveScheduler. Cron is created with
// seconds precision to match the backup Scheduler.
func NewArchiveScheduler(archiver *Archiver, logger *zap.Logger) *ArchiveScheduler {
	if logger == nil {
		logger, _ = zap.NewProduction()
	}
	return &ArchiveScheduler{
		cron:     cron.New(cron.WithSeconds()),
		entries:  map[string]cron.EntryID{},
		plans:    map[string]*ArchivePlanSpec{},
		archiver: archiver,
		logger:   logger,
	}
}

// Start begins firing scheduled archive jobs.
func (s *ArchiveScheduler) Start() {
	s.cron.Start()
	s.logger.Info("archive scheduler started")
}

// Stop halts the scheduler and releases cron resources.
func (s *ArchiveScheduler) Stop() {
	s.cron.Stop()
	s.logger.Info("archive scheduler stopped")
}

// AddPlan registers a plan for archive scheduling. Spec.Schedule is the
// cron expression; an empty schedule means manual-only.
func (s *ArchiveScheduler) AddPlan(spec *ArchivePlanSpec) {
	if spec == nil || !spec.Enabled || spec.Schedule == "" {
		return
	}
	key := archivePlanKey(spec.TenantID, spec.PlanID)
	s.mu.Lock()
	defer s.mu.Unlock()

	s.removeLocked(key)
	s.plans[key] = spec

	entryID, err := s.cron.AddFunc(spec.Schedule, func() {
		s.logger.Info("scheduled archive triggered",
			zap.String("tenant_id", spec.TenantID),
			zap.String("plan_id", spec.PlanID))
		go func(sp *ArchivePlanSpec) {
			ctx, cancel := context.WithTimeout(context.Background(), 30*time.Minute)
			defer cancel()
			res, err := s.archiver.ArchiveWindow(ctx, ArchiveOptions{
				SourceDir:   sp.SourceDir,
				PlanID:      sp.PlanID,
				TenantID:    sp.TenantID,
				ArchiveType: sp.ArchiveType,
				EncryptionKey: sp.EncryptionKey,
			})
			if err != nil {
				s.logger.Error("scheduled archive failed",
					zap.String("plan_id", sp.PlanID), zap.Error(err))
				return
			}
			s.logger.Info("scheduled archive completed",
				zap.String("plan_id", sp.PlanID),
				zap.Int("archived", res.Archived),
				zap.Int("skipped", res.Skipped),
				zap.Int("failed", res.Failed))
		}(spec)
	})
	if err != nil {
		s.logger.Error("failed to schedule archive plan",
			zap.String("plan_id", spec.PlanID), zap.Error(err))
		return
	}
	s.entries[key] = entryID
}

// UpdatePlan re-registers a plan's cron entry. The previous entry is
// removed before the new one is scheduled so there is no double-fire.
func (s *ArchiveScheduler) UpdatePlan(spec *ArchivePlanSpec) {
	if spec == nil {
		return
	}
	key := archivePlanKey(spec.TenantID, spec.PlanID)
	if !spec.Enabled || spec.Schedule == "" {
		s.mu.Lock()
		s.removeLocked(key)
		delete(s.plans, key)
		s.mu.Unlock()
		return
	}
	s.AddPlan(spec)
}

// RemovePlan unregisters a plan's cron entry.
func (s *ArchiveScheduler) RemovePlan(tenantID, planID string) {
	key := archivePlanKey(tenantID, planID)
	s.mu.Lock()
	defer s.mu.Unlock()
	s.removeLocked(key)
	delete(s.plans, key)
}

func (s *ArchiveScheduler) removeLocked(key string) {
	if id, ok := s.entries[key]; ok {
		s.cron.Remove(id)
		delete(s.entries, key)
	}
}

// List returns the currently registered plan keys. Useful for operators
// to inspect what the scheduler is firing.
func (s *ArchiveScheduler) List() []string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]string, 0, len(s.plans))
	for k := range s.plans {
		out = append(out, k)
	}
	return out
}

func archivePlanKey(tenantID, planID string) string {
	if tenantID == "" {
		return planID
	}
	return tenantID + "/" + planID
}
