package main

import (
	"context"

	"orion/go-common/pkg/database"
	migration "orion/platform-svc-go/internal/migration"
	infraBackup_handler "orion/platform-svc-go/internal/infrastructure/backup/handler"
	infraBackup_repo "orion/platform-svc-go/internal/infrastructure/backup/repository"
	infraBackup_service "orion/platform-svc-go/internal/infrastructure/backup/service"
	infraChaos_handler "orion/platform-svc-go/internal/infrastructure/chaos/handler"
	infraChaos_repo "orion/platform-svc-go/internal/infrastructure/chaos/repository"
	infraChaos_service "orion/platform-svc-go/internal/infrastructure/chaos/service"
	infraDba_handler "orion/platform-svc-go/internal/infrastructure/dba/handler"
	infraDba_repo "orion/platform-svc-go/internal/infrastructure/dba/repository"
	infraDba_service "orion/platform-svc-go/internal/infrastructure/dba/service"
	infraDegradation_handler "orion/platform-svc-go/internal/infrastructure/degradation/handler"
	infraDegradation_repo "orion/platform-svc-go/internal/infrastructure/degradation/repository"
	infraDegradation_service "orion/platform-svc-go/internal/infrastructure/degradation/service"
	infraDTwin_handler "orion/platform-svc-go/internal/infrastructure/digital-twin/handler"
	infraDTwin_repo "orion/platform-svc-go/internal/infrastructure/digital-twin/repository"
	infraDTwin_service "orion/platform-svc-go/internal/infrastructure/digital-twin/service"
	infraDr_handler "orion/platform-svc-go/internal/infrastructure/dr/handler"
	infraDr_repo "orion/platform-svc-go/internal/infrastructure/dr/repository"
	infraDr_service "orion/platform-svc-go/internal/infrastructure/dr/service"
	infraEE_handler "orion/platform-svc-go/internal/infrastructure/ephemeral-env/handler"
	infraEE_repo "orion/platform-svc-go/internal/infrastructure/ephemeral-env/repository"
	infraEE_service "orion/platform-svc-go/internal/infrastructure/ephemeral-env/service"
	infraIac_handler "orion/platform-svc-go/internal/infrastructure/iac/handler"
	infraIac_repo "orion/platform-svc-go/internal/infrastructure/iac/repository"
	infraIac_service "orion/platform-svc-go/internal/infrastructure/iac/service"
	infraMWn_handler "orion/platform-svc-go/internal/infrastructure/maintenance-window/handler"
	infraMWn_repo "orion/platform-svc-go/internal/infrastructure/maintenance-window/repository"
	infraMWn_service "orion/platform-svc-go/internal/infrastructure/maintenance-window/service"
	infraMulti_handler "orion/platform-svc-go/internal/infrastructure/multicloud/handler"
	infraMulti_repo "orion/platform-svc-go/internal/infrastructure/multicloud/repository"
	infraMulti_service "orion/platform-svc-go/internal/infrastructure/multicloud/service"
	infraOCI_handler "orion/platform-svc-go/internal/infrastructure/oci-registry/handler"
	infraOCI_repo "orion/platform-svc-go/internal/infrastructure/oci-registry/repository"
	infraOCI_service "orion/platform-svc-go/internal/infrastructure/oci-registry/service"
	infraServerless_handler "orion/platform-svc-go/internal/infrastructure/serverless/handler"
	infraServerless_repo "orion/platform-svc-go/internal/infrastructure/serverless/repository"
	infraServerless_service "orion/platform-svc-go/internal/infrastructure/serverless/service"
	schemaReg_handler "orion/platform-svc-go/internal/schema-registry/handler"
	schemaReg_repo "orion/platform-svc-go/internal/schema-registry/repository"
	schemaReg_service "orion/platform-svc-go/internal/schema-registry/service"

	"go.uber.org/zap"
)

var (
	infraDrH               *infraDr_handler.Handler
	infraEEH               *infraEE_handler.Handler
	infraBackupH           *infraBackup_handler.Handler
	infraArchiveH          *infraBackup_handler.ArchiveHandler
	infraArchiveSchedulerH *infraBackup_handler.ArchiveSchedulerHandler
	infraArchiveScheduler  *infraBackup_service.ArchiveScheduler
	infraRetentionH        *infraBackup_handler.RetentionHandler
	infraSchemaRegH        *schemaReg_handler.Handler
	migrationH             *migration.Handler
	infraChaosH            *infraChaos_handler.Handler
	infraDbaH              *infraDba_handler.Handler
	infraDegH              *infraDegradation_handler.Handler
	infraDTwinH            *infraDTwin_handler.Handler
	infraIacH              *infraIac_handler.Handler
	infraMWnH              *infraMWn_handler.Handler
	infraMultiH            *infraMulti_handler.Handler
	infraOCIH              *infraOCI_handler.Handler
	infraServerlessH       *infraServerless_handler.Handler
)

// wireBlueprintInfraOps wires the Blueprint InfraOps merge infrastructure subdomain
// handlers: dr, ephemeral-env, backup (with archive scheduler + retention),
// schema-registry, chaos, migration, dba, degradation, digital-twin, iac,
// maintenance-window, multicloud, oci-registry, serverless.
func wireBlueprintInfraOps(db *database.DB, logger *zap.Logger) {
	// dr: repo -> service -> handler
	infraDrRepo := infraDr_repo.NewRepository(db.DB)
	infraDrSvc := infraDr_service.NewService(infraDrRepo)
	infraDrH = infraDr_handler.NewHandler(infraDrSvc)
	// ephemeral-env: repo -> service -> handler
	infraEERepo := infraEE_repo.NewRepository(db.DB)
	infraEESvc := infraEE_service.NewService(infraEERepo)
	infraEEH = infraEE_handler.NewHandler(infraEESvc)
	// backup: repo -> 2 services (BackupService + RecoveryService) -> handler
	infraBackupRepo := infraBackup_repo.NewBackupRepository(db)
	infraBackupSvc := infraBackup_service.NewBackupService(infraBackupRepo, logger)
	infraRecoverySvc := infraBackup_service.NewRecoveryService(infraBackupRepo, logger)
	// Archiver reuses BackupService's storageBackendFor as its resolver so that WAL/binlog
	// archive records land in the same backend as backup artifacts.
	infraBackupArchiver := infraBackup_service.NewArchiver(
		infraBackupRepo,
		infraBackupSvc.StorageBackendForPublic,
		logger,
	)
	infraBackupH = infraBackup_handler.New(infraBackupSvc, infraRecoverySvc, logger)
	infraArchiveH = infraBackup_handler.NewArchiveHandler(infraBackupArchiver, infraBackupH, logger)
	// Lifecycle: start the backup scheduler and the archive scheduler.
	infraBackupSvc.Start()
	infraBackupSvc.StartRetentionCron("0 30 2 * * *")
	infraArchiveScheduler = infraBackup_service.NewArchiveScheduler(infraBackupArchiver, logger)
	infraArchiveScheduler.Start()
	infraArchiveSchedulerH = infraBackup_handler.NewArchiveSchedulerHandler(infraArchiveScheduler, logger)
	infraRetentionH = infraBackup_handler.NewRetentionHandler(infraBackupSvc, logger)
	infraRecoverySvc.SetArchiver(infraBackupArchiver)
	infraRecoverySvc.SetArchiveScheduler(infraArchiveScheduler)
	// Auto-load archive configs from existing backup plans.
	if infraBackupRepo != nil {
		totalLoaded := 0
		if tenants, err := infraBackupRepo.ListTenantsWithPlans(context.Background()); err == nil {
			for _, t := range tenants {
				plans, err := infraBackupRepo.ListPlans(context.Background(), t, 0, 10000)
				if err != nil {
					logger.Warn("archive autoload: list plans failed",
						zap.String("tenant", t), zap.Error(err))
					continue
				}
				if n, err := infraArchiveScheduler.LoadArchivesFromPlans(context.Background(), t, plans); err == nil && n > 0 {
					totalLoaded += n
				}
			}
			if totalLoaded > 0 {
				logger.Info("archive autoload: registered plans from storage_config",
					zap.Int("loaded", totalLoaded))
			}
		}
	}
	// schema-registry: Postgres-backed repository, falls back to InMemory when DB missing.
	var schemaRegRepo schemaReg_repo.Interface
	if db != nil {
		schemaRegRepo = schemaReg_repo.NewPostgres(db.DB)
	} else {
		schemaRegRepo = schemaReg_repo.NewInMemory()
	}
	schemaRegSvc := schemaReg_service.New(schemaRegRepo, logger)
	infraSchemaRegH = schemaReg_handler.New(schemaRegSvc, schemaRegRepo)
	// chaos: repo -> service -> handler
	infraChaosRepo := infraChaos_repo.NewChaosRepository(db.DB)
	infraChaosSvc := infraChaos_service.NewChaosService(infraChaosRepo)
	infraChaosH = infraChaos_handler.NewHandler(infraChaosSvc)
	// migration: repo -> service -> handler
	migRepo := migration.NewRepository()
	migSvc := migration.NewService(migRepo, logger)
	migrationH = migration.NewHandler(migSvc, logger)
	// dba: repo -> service -> handler
	infraDbaRepo := infraDba_repo.NewRepository(db.DB)
	infraDbaSvc := infraDba_service.NewService(infraDbaRepo)
	infraDbaH = infraDba_handler.NewHandler(infraDbaSvc)
	// degradation: repo -> service -> handler
	infraDegRepo := infraDegradation_repo.NewRepository(db.DB)
	infraDegSvc := infraDegradation_service.NewService(infraDegRepo)
	infraDegH = infraDegradation_handler.NewHandler(infraDegSvc)
	// digital-twin: repo -> service -> handler
	infraDTwinRepo := infraDTwin_repo.NewRepository(db.DB)
	infraDTwinSvc := infraDTwin_service.NewService(infraDTwinRepo)
	infraDTwinH = infraDTwin_handler.NewHandler(infraDTwinSvc)
	// iac: repo -> service -> handler
	infraIacRepo := infraIac_repo.NewRepository(db.DB)
	infraIacSvc := infraIac_service.NewService(infraIacRepo)
	infraIacH = infraIac_handler.NewHandler(infraIacSvc)
	// maintenance-window: repo -> service -> handler
	infraMWnRepo := infraMWn_repo.NewRepository(db.DB)
	infraMWnSvc := infraMWn_service.NewService(infraMWnRepo)
	infraMWnH = infraMWn_handler.NewHandler(infraMWnSvc)
	// multicloud: repo -> service -> handler
	infraMultiRepo := infraMulti_repo.NewRepository(db.DB)
	infraMultiSvc := infraMulti_service.NewService(infraMultiRepo)
	infraMultiH = infraMulti_handler.NewHandler(infraMultiSvc)
	// oci-registry: repo -> service -> handler
	infraOCIRepo := infraOCI_repo.NewRepository(db.DB)
	infraOCISvc := infraOCI_service.NewService(infraOCIRepo)
	infraOCIH = infraOCI_handler.NewHandler(infraOCISvc)
	// serverless: repo -> service -> handler
	infraServerlessRepo := infraServerless_repo.NewRepository(db.DB)
	infraServerlessSvc := infraServerless_service.NewService(infraServerlessRepo)
	infraServerlessH = infraServerless_handler.NewHandler(infraServerlessSvc)
}
