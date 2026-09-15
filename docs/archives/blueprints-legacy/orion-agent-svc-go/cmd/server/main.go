package main

import (
	"log"
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/orion/agent-svc/internal/agent/handler"
	"github.com/orion/agent-svc/internal/agent/repository"
	"github.com/orion/agent-svc/internal/agent/service"
	"github.com/orion/agent-svc/internal/task/handler"
	"github.com/orion/agent-svc/internal/task/service"
	"github.com/orion/agent-svc/internal/sandbox/handler"
	"github.com/orion/agent-svc/internal/sandbox/service"
	"github.com/orion/agent-svc/internal/config"
)

func main() {
	cfg := config.Load()
	db := initDB(cfg.DatabaseURL)

	agentRepo := repository.NewAgentRepository(db)
	agentSvc := service.NewAgentService(agentRepo)
	agentHandler := agentHandler.NewAgentHandler(agentSvc)

	taskSvc := taskSvc.NewTaskService(agentRepo)
	taskHandler := taskHandler.NewTaskHandler(taskSvc)

	sandboxSvc := sandboxSvc.NewSandboxService()
	sandboxHandler := sandboxHandler.NewSandboxHandler(sandboxSvc)

	r := gin.Default()
	api := r.Group("/api/v1/agent")
	{
		agentHandler.RegisterRoutes(api)
		taskHandler.RegisterRoutes(api)
		sandboxHandler.RegisterRoutes(api)
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	log.Printf("Starting agent service on port %s", port)
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
