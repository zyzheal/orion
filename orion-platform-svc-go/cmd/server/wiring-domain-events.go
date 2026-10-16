package main

import (
	"go.uber.org/zap"
	"orion/go-common/pkg/database"
	audit_repo "orion/platform-svc-go/internal/audit/repository"
	audit_service "orion/platform-svc-go/internal/audit/service"
	"orion/platform-svc-go/internal/auditlogger"
	"orion/platform-svc-go/internal/eventpublisher"
	domainevents "orion/platform-svc-go/internal/domain/events"
	"orion/platform-svc-go/internal/eventsub"
	"orion/platform-svc-go/internal/infrastructure/eventbus"
)

// Package-level references for graceful shutdown of background jobs.
var (
	domainPublisher   eventpublisher.EventPublisher
	domainAuditLogger auditlogger.AuditLogger
)

// wireDomainEvents connects the infrastructure-level EventBus and Audit
// service to the 6 Wave-2 domain modules. It creates adapters and injects
// them via SetPublisher / SetAuditLogger so that domain services can publish
// events and write audit logs without a direct dependency on the
// infrastructure packages.
//
// Graceful degradation: if the composed event publisher is nil (NATS
// unavailable), a NoopPublisher is used. Domain functionality continues
// uninterrupted — only event delivery is affected.
func wireDomainEvents(db *database.DB, composedPublisher *eventbus.ComposedEventPublisher, logger *zap.Logger) {
	// --- Event Publisher ---
	var eventBusPublisher domainevents.EventPublisher
	if composedPublisher != nil {
		eventBusPublisher = composedPublisher
	}
	if eventBusPublisher != nil {
		domainPublisher = eventpublisher.NewEventBusAdapter(eventBusPublisher)
		logger.Info("domain event publisher wired", zap.String("type", "EventBusAdapter"))
	} else {
		domainPublisher = eventpublisher.NoopPublisher{}
		logger.Info("domain event publisher wired", zap.String("type", "NoopPublisher"))
	}

	// --- Audit Logger ---
	auditRepo := audit_repo.NewRepository(db.DB)
	auditSvc := audit_service.NewService(auditRepo)
	domainAuditLogger = auditlogger.NewAuditServiceAdapter(auditSvc)
	logger.Info("domain audit logger wired", zap.String("type", "AuditServiceAdapter"))

	// --- Inject into all 6 domain services ---
	if alertSlaSvc != nil {
		alertSlaSvc.SetPublisher(domainPublisher)
		alertSlaSvc.SetAuditLogger(domainAuditLogger)
		logger.Info("domain wiring injected", zap.String("module", "alert-sla"))
	}
	if alertShiftSvc != nil {
		alertShiftSvc.SetPublisher(domainPublisher)
		alertShiftSvc.SetAuditLogger(domainAuditLogger)
		logger.Info("domain wiring injected", zap.String("module", "alert-shift"))
	}
	if inspectionTemplateSvc != nil {
		inspectionTemplateSvc.SetPublisher(domainPublisher)
		inspectionTemplateSvc.SetAuditLogger(domainAuditLogger)
		logger.Info("domain wiring injected", zap.String("module", "inspection-template"))
	}
	if inspectionScheduleSvc != nil {
		inspectionScheduleSvc.SetPublisher(domainPublisher)
		inspectionScheduleSvc.SetAuditLogger(domainAuditLogger)
		logger.Info("domain wiring injected", zap.String("module", "inspection-schedule"))
	}
	if rdmRequirementSvc != nil {
		rdmRequirementSvc.SetPublisher(domainPublisher)
		rdmRequirementSvc.SetAuditLogger(domainAuditLogger)
		logger.Info("domain wiring injected", zap.String("module", "rdm-requirement"))
	}
	if sprintAnalyticsSvc != nil {
		sprintAnalyticsSvc.SetPublisher(domainPublisher)
		sprintAnalyticsSvc.SetAuditLogger(domainAuditLogger)
		logger.Info("domain wiring injected", zap.String("module", "sprint-analytics"))
	}

	// --- Cross-Module Event Subscribers (P2-1) ---
	// Register domain event subscribers on the composed publisher so that
	// events published by one module trigger actions in another. For
	// example, inspection.schedule.created triggers next-run computation,
	// and alert.sla.created triggers active alert evaluation.
	if eventBusPublisher != nil {
		eventsub.RegisterAll(eventBusPublisher, logger)
	} else {
		logger.Info("cross-module event subscribers skipped (no composed publisher)")
	}

	// --- SLA Monitor (deferred) ---
	// The scheduler requires a TriggerFunc that executes inspection templates.
	// Until the inspection-template service provides a trigger, the scheduler
	// is not started. The ComputeNextRun API endpoint (GET /:id/next-run)
	// and manual trigger (POST /:id/trigger) remain available.
}

// shutdownDomainBackgroundJobs stops any running background goroutines.
// Safe to call even if none were started.
func shutdownDomainBackgroundJobs() {
	stopSLAMonitor()
	stopInspectionScheduler()
}
