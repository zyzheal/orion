package database_devops

import (
    "encoding/json"
    "net/http"
    "time"

    "github.com/gin-gonic/gin"
)

type DatabaseHandler struct {
    dbRepo  *DatabaseRepository
    opRepo  *OperationRepository
}

func NewDatabaseHandler(dbRepo *DatabaseRepository, opRepo *OperationRepository) *DatabaseHandler {
    return &DatabaseHandler{dbRepo: dbRepo, opRepo: opRepo}
}

type CreateInstanceRequest struct {
    Name      string            `json:"name" binding:"required,max=128"`
    Engine    string            `json:"engine" binding:"required,oneof=postgres mysql clickhouse"`
    Host      string            `json:"host" binding:"required,max=512"`
    Port      int               `json:"port" binding:"required,min=1,max=65535"`
    Username  string            `json:"username" binding:"required,max=128"`
    Password  string            `json:"password" binding:"required,max=256"`
    DBName    string            `json:"dbName" binding:"required,max=128"`
    TenantID  string            `json:"tenantId" binding:"required,max=64"`
    Tags      map[string]string `json:"tags" xml:"-" form:"-" query:"-"`
    Labels    map[string]string `json:"labels" xml:"-" form:"-" query:"-"`
}

type UpdateInstanceRequest struct {
    Name     *string           `json:"name" binding:"omitempty,max=128"`
    Tags     map[string]string `json:"tags" xml:"-" form:"-" query:"-"`
    Labels   map[string]string `json:"labels" xml:"-" form:"-" query:"-"`
}

func (h *DatabaseHandler) List(c *gin.Context) {
    tenantID := c.GetString("tenantId")
    instances, err := h.dbRepo.ListByTenant(c.Request.Context(), tenantID)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error()})
        return
    }
    c.JSON(http.StatusOK, gin.H{"code": 0, "message": "ok", "data": instances})
}

func (h *DatabaseHandler) Get(c *gin.Context) {
    id := c.Param("id")
    instance, err := h.dbRepo.GetByID(c.Request.Context(), id)
    if err != nil {
        c.JSON(http.StatusNotFound, gin.H{"code": 404, "message": "not found"})
        return
    }
    c.JSON(http.StatusOK, gin.H{"code": 0, "message": "ok", "data": instance})
}

func (h *DatabaseHandler) Create(c *gin.Context) {
    var req CreateInstanceRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": err.Error()})
        return
    }

    tagsJSON, _ := json.Marshal(req.Tags)
    labelsJSON, _ := json.Marshal(req.Labels)

    instance := &DatabaseInstance{
        Name: req.Name, Engine: req.Engine, Host: req.Host,
        Port: req.Port, Username: req.Username, Password: req.Password,
        DBName: req.DBName, Status: "inactive", Role: "standalone",
        TenantID: req.TenantID, Metrics: "{}", Tags: string(tagsJSON),
        Labels: string(labelsJSON),
    }
    if err := h.dbRepo.Create(c.Request.Context(), instance); err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error()})
        return
    }
    c.JSON(http.StatusCreated, gin.H{"code": 0, "message": "created", "data": instance})
}

func (h *DatabaseHandler) Update(c *gin.Context) {
    id := c.Param("id")
    var req UpdateInstanceRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": err.Error()})
        return
    }
    instance, err := h.dbRepo.GetByID(c.Request.Context(), id)
    if err != nil {
        c.JSON(http.StatusNotFound, gin.H{"code": 404, "message": "not found"})
        return
    }
    if req.Name != nil { instance.Name = *req.Name }
    if req.Tags != nil {
        data, _ := json.Marshal(req.Tags)
        instance.Tags = string(data)
    }
    instance.UpdatedAt = time.Now()
    if err := h.dbRepo.Update(c.Request.Context(), instance); err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error()})
        return
    }
    c.JSON(http.StatusOK, gin.H{"code": 0, "message": "updated", "data": instance})
}

func (h *DatabaseHandler) Delete(c *gin.Context) {
    id := c.Param("id")
    tenantID := c.GetString("tenantId")
    if err := h.dbRepo.SoftDelete(c.Request.Context(), id, tenantID); err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error()})
        return
    }
    c.JSON(http.StatusOK, gin.H{"code": 0, "message": "deleted"})
}

func (h *DatabaseHandler) StartOperation(c *gin.Context) {
    id := c.Param("id")
    var req struct {
        Type string `json:"type" binding:"required,oneof=restart upgrade resize clone"`
    }
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": err.Error()})
        return
    }
    op := &DBOperation{
        DatabaseID: id, Type: req.Type, Status: "pending",
        Executor: c.GetString("userId"),
        StartedAt: ptrTime(time.Now()),
    }
    if err := h.opRepo.Create(c.Request.Context(), op); err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error()})
        return
    }
    c.JSON(http.StatusCreated, gin.H{"code": 0, "message": "operation created", "data": op})
}

type DatabaseRouter struct{}

func (r *DatabaseRouter) Register(rg *gin.RouterGroup, handler *DatabaseHandler) {
    group := rg.Group("/database")
    {
        group.GET("/list", handler.List)
        group.GET("/:id", handler.Get)
        group.POST("", handler.Create)
        group.PUT("/:id", handler.Update)
        group.DELETE("/:id", handler.Delete)
        group.POST("/:id/operation", handler.StartOperation)
    }
}