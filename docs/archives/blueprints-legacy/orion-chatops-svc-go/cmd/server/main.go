package main

import (
	"log"
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/orion/chatops-svc/internal/chatops/handler"
	"github.com/orion/chatops-svc/internal/chatops/repository"
	"github.com/orion/chatops-svc/internal/chatops/service"
	commandRouterHandler "github.com/orion/chatops-svc/internal/command-router/handler"
	commandRouter "github.com/orion/chatops-svc/internal/command-router/service"
	eventSubHandler "github.com/orion/chatops-svc/internal/event-subscriber/handler"
	eventSubscriber "github.com/orion/chatops-svc/internal/event-subscriber/service"
	notifPrefHandler "github.com/orion/chatops-svc/internal/notification-pref/handler"
	notifPref "github.com/orion/chatops-svc/internal/notification-pref/service"
	executionHandler "github.com/orion/chatops-svc/internal/execution/handler"
	executionSvc "github.com/orion/chatops-svc/internal/execution/service"
	"github.com/orion/chatops-svc/internal/config"
	"github.com/orion/chatops-svc/pkg/nats"
)

func main() {
	cfg := config.Load()

	db := initDB(cfg.DatabaseURL)
	nc := initNATS(cfg.NATSUrl)

	chatopsRepo := repository.NewChatOpsRepository(db)
	chatopsSvc := service.NewChatOpsService(chatopsRepo)
	chatopsHandler := chatopsHandler.NewChatOpsHandler(chatopsSvc)

	cmdRouterSvc := commandRouter.NewCommandRouterService(chatopsRepo)
	cmdRouterHandler := commandRouterHandler.NewCommandRouterHandler(cmdRouterSvc)

	eventSubSvc := eventSubscriber.NewEventSubscriberService(nc)
	eventSubHandler := eventSubHandler.NewEventSubscriberHandler(eventSubSvc)

	notifPrefSvc := notifPref.NewNotificationPreferenceService(chatopsRepo)
	notifPrefHandler := notifPrefHandler.NewNotificationPreferenceHandler(notifPrefSvc)

	executionSvc := executionSvc.NewExecutionService(chatopsRepo)
	executionHandler := executionHandler.NewExecutionHandler(executionSvc)

	r := gin.Default()
	api := r.Group("/api/v1/chatops")
	{
		chatopsHandler.RegisterRoutes(api)
		cmdRouterHandler.RegisterRoutes(api)
		eventSubHandler.RegisterRoutes(api)
		notifPrefHandler.RegisterRoutes(api)
		executionHandler.RegisterRoutes(api)
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	log.Printf("Starting chatops service on port %s", port)
	if err := http.ListenAndServe(":"+port, r); err != nil {
		log.Fatalf("failed to start server: %v", err)
	}
}

func initDB(dsn string) *sql.DB {
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		log.Fatalf("failed to connect to database: %v", err)
	}
	return db
}

func initNATS(url string) *nats.Conn {
	nc, err := nats.Connect(url)
	if err != nil {
		log.Fatalf("failed to connect to NATS: %v", err)
	}
	return nc
}
