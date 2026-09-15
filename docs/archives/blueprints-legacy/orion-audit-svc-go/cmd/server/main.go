package main

import (
	"log"
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/orion/audit-svc/internal/audit/handler"
	"github.com/orion/audit-svc/internal/audit/repository"
	"github.com/orion/audit-svc/internal/audit/service"
	"github.com/orion/audit-svc/internal/config"
)

func main() {
	cfg := config.Load()
	db := initDB(cfg.DatabaseURL)

	auditRepo := repository.NewAuditRepository(db)
	auditSvc := service.NewAuditService(auditRepo)
	auditHandler := auditHandler.NewAuditHandler(auditSvc)

	r := gin.Default()
	api := r.Group("/api/v1/audit")
	{
		auditHandler.RegisterRoutes(api)
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	log.Printf("Starting audit service on port %s", port)
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
