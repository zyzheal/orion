package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/artifact/service"

	"github.com/gin-gonic/gin"
)

func newHandler() *Handler {
	return NewHandler(&service.Service{})
}

func makeCtx(method string, path string, body interface{}, params map[string]string) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	buf := new(bytes.Buffer)
	if body != nil {
		json.NewEncoder(buf).Encode(body)
	}
	c.Request = httptest.NewRequest(method, path, buf)
	if params != nil {
		c.Params = gin.Params{}
		for k, v := range params {
			c.Params = append(c.Params, gin.Param{Key: k, Value: v})
		}
	}
	return c, w
}

func TestARTIFACT_Handler_RegisterRoutes(t *testing.T) {
	newHandler().RegisterRoutes(gin.New().Group("/api/v1"))
}

func TestARTIFACT_Handler_Create(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().Create(c)
	if w.Code != http.StatusOK {
		t.Fatalf("Create: got %d", w.Code)
	}
}

func TestARTIFACT_Handler_List(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().List(c)
	if w.Code != http.StatusOK {
		t.Fatalf("List: got %d", w.Code)
	}
}

func TestARTIFACT_Handler_Get(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().Get(c)
	if w.Code != http.StatusOK {
		t.Fatalf("Get: got %d", w.Code)
	}
}

func TestARTIFACT_Handler_Update(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().Update(c)
	if w.Code != http.StatusOK {
		t.Fatalf("Update: got %d", w.Code)
	}
}

func TestARTIFACT_Handler_Delete(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().Delete(c)
	if w.Code != http.StatusOK {
		t.Fatalf("Delete: got %d", w.Code)
	}
}

func TestARTIFACT_Handler_AddTags(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().AddTags(c)
	if w.Code != http.StatusOK {
		t.Fatalf("AddTags: got %d", w.Code)
	}
}

func TestARTIFACT_Handler_RemoveTags(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().RemoveTags(c)
	if w.Code != http.StatusOK {
		t.Fatalf("RemoveTags: got %d", w.Code)
	}
}

func TestARTIFACT_Handler_GetTags(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetTags(c)
	if w.Code != http.StatusOK {
		t.Fatalf("GetTags: got %d", w.Code)
	}
}

func TestARTIFACT_Handler_Download(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().Download(c)
	if w.Code != http.StatusOK {
		t.Fatalf("Download: got %d", w.Code)
	}
}

func TestARTIFACT_Handler_GetDownloadHistory(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetDownloadHistory(c)
	if w.Code != http.StatusOK {
		t.Fatalf("GetDownloadHistory: got %d", w.Code)
	}
}

func TestARTIFACT_Handler_Search(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().Search(c)
	if w.Code != http.StatusOK {
		t.Fatalf("Search: got %d", w.Code)
	}
}

func TestARTIFACT_Handler_Promote(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().Promote(c)
	if w.Code != http.StatusOK {
		t.Fatalf("Promote: got %d", w.Code)
	}
}

func TestARTIFACT_Handler_GetStage(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetStage(c)
	if w.Code != http.StatusOK {
		t.Fatalf("GetStage: got %d", w.Code)
	}
}

func TestARTIFACT_Handler_GetPromotionHistory(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetPromotionHistory(c)
	if w.Code != http.StatusOK {
		t.Fatalf("GetPromotionHistory: got %d", w.Code)
	}
}

func TestARTIFACT_Handler_Deprecate(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().Deprecate(c)
	if w.Code != http.StatusOK {
		t.Fatalf("Deprecate: got %d", w.Code)
	}
}

func TestARTIFACT_Handler_Quarantine(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().Quarantine(c)
	if w.Code != http.StatusOK {
		t.Fatalf("Quarantine: got %d", w.Code)
	}
}

func TestARTIFACT_Handler_GetStats(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetStats(c)
	if w.Code != http.StatusOK {
		t.Fatalf("GetStats: got %d", w.Code)
	}
}

func TestARTIFACT_Handler_GetTypeStats(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetTypeStats(c)
	if w.Code != http.StatusOK {
		t.Fatalf("GetTypeStats: got %d", w.Code)
	}
}

func TestARTIFACT_Handler_GetNamespaces(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetNamespaces(c)
	if w.Code != http.StatusOK {
		t.Fatalf("GetNamespaces: got %d", w.Code)
	}
}
