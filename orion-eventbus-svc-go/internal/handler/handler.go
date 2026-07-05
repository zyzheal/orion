package handler

import (
	"net/http"
	"strconv"

	"orion/eventbus-svc-go/internal/model"
	natspkg "orion/eventbus-svc-go/internal"
	"orion/eventbus-svc-go/internal/repository"
	"orion/eventbus-svc-go/internal/service"
	"orion/go-common/pkg/auth"
	"orion/go-common/pkg/database"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

type Handler struct {
	svc  *service.EventBusService
	nats *natspkg.NATSClient
	log  *zap.Logger
}

func New(db *database.DB, log *zap.Logger, nats *natspkg.NATSClient) *Handler {
	repo := repository.NewEventBusRepository(db)
	svc := service.NewEventBusService(repo, nats, log)
	return &Handler{svc: svc, nats: nats, log: log}
}

func (h *Handler) PublishEvent(c *gin.Context) {
	var req model.Event
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	req.TenantID = auth.GetTenantID(c)
	if req.TenantID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	if err := h.svc.PublishEvent(c.Request.Context(), &req); err != nil {
		h.log.Error("publish event failed", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to publish event"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"id": req.ID, "status": "published"})
}

func (h *Handler) ListEvents(c *gin.Context) {
	tenantID := auth.GetTenantID(c)
	if tenantID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	eventType := c.Query("type")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	events, err := h.svc.ListEvents(c.Request.Context(), tenantID, eventType, page, pageSize)
	if err != nil {
		h.log.Error("list events failed", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list events"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"events": events})
}

func (h *Handler) CreateSubscription(c *gin.Context) {
	var req model.Subscription
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	req.TenantID = auth.GetTenantID(c)
	if req.TenantID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	if err := h.svc.CreateSubscription(c.Request.Context(), &req); err != nil {
		h.log.Error("create subscription failed", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create subscription"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"id": req.ID})
}

func (h *Handler) GetSubscription(c *gin.Context) {
	id := c.Param("id")
	sub, err := h.svc.GetSubscription(c.Request.Context(), id)
	if err != nil {
		h.log.Error("get subscription failed", zap.Error(err))
		c.JSON(http.StatusNotFound, gin.H{"error": "subscription not found"})
		return
	}
	c.JSON(http.StatusOK, sub)
}

func (h *Handler) ListSubscriptions(c *gin.Context) {
	tenantID := auth.GetTenantID(c)
	if tenantID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	subs, err := h.svc.ListSubscriptions(c.Request.Context(), tenantID)
	if err != nil {
		h.log.Error("list subscriptions failed", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list subscriptions"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"subscriptions": subs})
}
