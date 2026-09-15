package main

import (
	"context"
	"fmt"
	"log"
	"os"

	ff_config "orion/platform-svc-go/internal/feature-flag/config"

	app_commands "orion/platform-svc-go/internal/application/commands"
	cqrs_http "orion/platform-svc-go/internal/application/http"
	eventstore "orion/platform-svc-go/internal/domain/eventstore"
	eventbus "orion/platform-svc-go/internal/infrastructure/eventbus"

	go_redis "github.com/redis/go-redis/v9"
	"orion/go-common/pkg/database"
	"orion/go-common/pkg/otel"
	redis_pkg "orion/go-common/pkg/redis"

	"go.uber.org/zap"
)

// infrastructure holds all shared infrastructure components initialized in config.go.
type infrastructure struct {
	ffCfg             *ff_config.Config
	db                *database.DB
	rdb               *go_redis.Client
	eventStore        *eventstore.PostgreSQLEventStore
	natsPublisher     *eventbus.NATSEventPublisher
	composedPublisher *eventbus.ComposedEventPublisher
	commandBus        *app_commands.CommandBus
	cqrsHandler       *cqrs_http.Handler
	logger            *zap.Logger
}

func initInfrastructure(logger *zap.Logger) *infrastructure {
	ffCfg := ff_config.Load()

	// OpenTelemetry tracing (0.1)
	if otelShutdown, err := otel.Init(otel.Config{
		ServiceName: "orion-platform-svc",
		Endpoint:    ffCfg.OTELExporterEndpoint,
		Insecure:    ffCfg.OTELInsecure,
	}); err != nil {
		logger.Warn("OpenTelemetry init failed (tracing disabled)", zap.Error(err))
	} else if otelShutdown != nil {
		defer otelShutdown(context.Background())
	}

	dsn := fmt.Sprintf("host=%s port=%d user=%s password=%s dbname=%s sslmode=%s",
		ffCfg.DBHost, ffCfg.DBPort, ffCfg.DBUser, ffCfg.DBPassword, ffCfg.DBName, ffCfg.DBSSLMode)
	dbCfg := database.DefaultConfig(dsn)

	db, err := database.Connect(context.Background(), dbCfg)
	if err != nil {
		logger.Fatal("failed to connect to database", zap.Error(err))
	}
	// db.Close is deferred in main instead

	// ---- Event Infrastructure (EventStore + NATS Publisher + AggregateLoader) ----
	eventStore := eventstore.NewPostgreSQLEventStore(db.DB)
	natsPublisher, natsErr := eventbus.NewNATSEventPublisher(nil) // nil store — ComposedPublisher owns persistence
	if natsErr != nil {
		logger.Warn("NATS publisher init failed (async dispatch disabled)", zap.Error(natsErr))
		natsPublisher = nil
	}
	composedPublisher := eventbus.NewComposedEventPublisher(eventStore, natsPublisher)

	// ---- CQRS Command Bus — register all command handlers ----
	commandBus := app_commands.NewCommandBus()
	commandBus.Register("ActivatePipelineCommand", app_commands.NewActivatePipelineHandler(eventStore, composedPublisher))
	commandBus.Register("DeactivatePipelineCommand", app_commands.NewDeactivatePipelineHandler(eventStore, composedPublisher))
	commandBus.Register("UpdatePipelineYAMLCommand", app_commands.NewUpdatePipelineYAMLHandler(eventStore, composedPublisher))
	commandBus.Register("CreateApprovalCommand", app_commands.NewCreateApprovalHandler(eventStore, composedPublisher))
	commandBus.Register("ApproveLevelCommand", app_commands.NewApproveLevelHandler(eventStore, composedPublisher))
	commandBus.Register("RejectLevelCommand", app_commands.NewRejectLevelHandler(eventStore, composedPublisher))
	commandBus.Register("CancelApprovalCommand", app_commands.NewCancelApprovalHandler(eventStore, composedPublisher))
	commandBus.Register("ToggleFeatureFlagCommand", app_commands.NewToggleFeatureFlagHandler(eventStore, composedPublisher))
	commandBus.Register("UpdateRolloutCommand", app_commands.NewUpdateRolloutHandler(eventStore, composedPublisher))
	cqrsHandler := cqrs_http.NewHandler(commandBus)

	migrationsDir := "migrations"
	if _, err := os.Stat(migrationsDir); err != nil {
		migrationsDir = "" // no migrations directory — skip both rollback and forward
	}

	// Rollback migrations when explicitly requested via MIGRATE_DOWN_TO env var.
	// Rollback runs BEFORE forward migrations so a restart without the env var
	// simply picks up the already-applied state.
	targetVersionStr := os.Getenv("MIGRATE_DOWN_TO")
	if migrationsDir != "" && targetVersionStr != "" {
		var targetVersion int
		if _, err := fmt.Sscanf(targetVersionStr, "%d", &targetVersion); err == nil {
			if targetVersion < 0 {
				log.Fatalf("MIGRATE_DOWN_TO must be >= 0, got: %s", targetVersionStr)
			}
			if err := database.RunMigrationsDownTo(db, migrationsDir, targetVersion); err != nil {
				log.Fatalf("failed to roll back migrations to version %d: %v", targetVersion, err)
			}
			log.Printf("rollback to version %d completed, exiting", targetVersion)
			os.Exit(0)
		}
		log.Fatalf("invalid MIGRATE_DOWN_TO value (must be an integer): %s", targetVersionStr)
	}

	// Forward migrations (run on every start, skip already-applied)
	if migrationsDir != "" {
		if err := database.RunMigrations(db, migrationsDir); err != nil {
			log.Fatalf("failed to run migrations: %v", err)
		}
	}

	rdb := redis_pkg.NewClient(redis_pkg.Config{Addr: ffCfg.RedisAddr})

	return &infrastructure{
		ffCfg:             ffCfg,
		db:                db,
		rdb:               rdb,
		eventStore:        eventStore,
		natsPublisher:     natsPublisher,
		composedPublisher: composedPublisher,
		commandBus:        commandBus,
		cqrsHandler:       cqrsHandler,
		logger:            logger,
	}
}
