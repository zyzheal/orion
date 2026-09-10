// Package server wires the domain CQRS handler to the Gin router.
package main

import (
	"go.uber.org/zap"
	"orion/go-common/pkg/database"

	domain_commands "orion/platform-svc-go/internal/domain/commands"
	domain_events "orion/platform-svc-go/internal/domain/events"
	domain_eventstore "orion/platform-svc-go/internal/domain/eventstore"
	domain_handler "orion/platform-svc-go/internal/domain/handler"
	domain_readmodel "orion/platform-svc-go/internal/domain/readmodel"
	domain_service "orion/platform-svc-go/internal/domain/service"
)

var domainCqrsH *domain_handler.Handler

func wireDomainCQRS(db *database.DB, logger *zap.Logger) {
	bus := domain_commands.NewInMemoryCommandBus()
	publisher := domain_events.NewInMemoryEventPublisher()

	// PostgreSQL event store. Before this wiring the service received
	// (nil, nil) for the read side, so GetEventHistory / GetLatestVersion /
	// RebuildReadModel all silently returned empty — the CQRS projection
	// never ran. NewPostgresReadModelProjector takes the store as its
	// EventStoreReader, so it must be built after the store.
	eventStore := domain_eventstore.NewPostgreSQLEventStore(db.DB)
	proj := domain_readmodel.NewPostgresReadModelProjector(db.DB, eventStore)

	svc := domain_service.NewService(bus, publisher, eventStore, proj, logger)
	domainCqrsH = domain_handler.NewHandler(bus, publisher, svc, logger)
}
