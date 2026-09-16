package handler

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"

	"orion/platform-svc-go/internal/alert-pipeline/service"
)

func updateConfigContext(body string) (*gin.Context, *httptest.ResponseRecorder) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPut, "/alerts/pipeline/config",
		bytes.NewBufferString(body))
	c.Request.Header.Set("Content-Type", "application/json")
	return c, w
}

// UpdateConfig used to bind the request, fill a nil stage list and echo the
// body back as "config accepted" without calling the service at all. Echoing
// the request back satisfies any assertion about the response body, so these
// tests assert on the service's own state: the config the pipeline will
// actually run.
func TestHandlerUpdateConfigAppliesToTheService(t *testing.T) {
	svc := service.NewPipelineService(zap.NewNop(), nil)
	h := NewHandler(svc, nil, zap.NewNop())

	c, w := updateConfigContext(`{"maxRetries":7,"stages":["receive","validate"]}`)
	h.UpdateConfig(c)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, body %s", w.Code, w.Body.String())
	}

	cfg := svc.Config()
	if got := svc.Config().Stages; len(got) != 2 || got[0] != "receive" || got[1] != "validate" {
		t.Fatalf("service stages = %v, want [receive validate]; the update was accepted but not applied", got)
	}
	if cfg.MaxRetries != 7 {
		t.Errorf("service MaxRetries = %d, want 7", cfg.MaxRetries)
	}
}

// An update that only mentions maxRetries must not wipe the stage list, and it
// must not fabricate a name.
func TestHandlerUpdateConfigKeepsUnsetFields(t *testing.T) {
	svc := service.NewPipelineService(zap.NewNop(), nil)
	h := NewHandler(svc, nil, zap.NewNop())
	name := svc.Config().Name

	c, w := updateConfigContext(`{"maxRetries":9}`)
	h.UpdateConfig(c)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, body %s", w.Code, w.Body.String())
	}
	cfg := svc.Config()
	if len(cfg.Stages) == 0 {
		t.Error("stage list was wiped by an update that did not mention it")
	}
	if cfg.Name != name {
		t.Errorf("name = %q, want %q", cfg.Name, name)
	}
	if cfg.MaxRetries != 9 {
		t.Errorf("MaxRetries = %d, want 9", cfg.MaxRetries)
	}
}

// A typo'd stage name must be rejected rather than accepted and silently run as
// a no-op stage. The service also refuses to apply partially.
func TestHandlerUpdateConfigRejectsUnknownStage(t *testing.T) {
	svc := service.NewPipelineService(zap.NewNop(), nil)
	h := NewHandler(svc, nil, zap.NewNop())

	c, w := updateConfigContext(`{"stages":["receive","recieve"]}`)
	h.UpdateConfig(c)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400, body %s", w.Code, w.Body.String())
	}
	if !strings.Contains(w.Body.String(), "recieve") {
		t.Errorf("body %s should name the offending stage", w.Body.String())
	}
	if got := svc.Config().Stages; len(got) == 0 {
		t.Error("a rejected update left the stage list empty")
	}
}

// Malformed JSON and negative values are rejected at the boundary and must not
// mutate the service.
func TestHandlerUpdateConfigRejectsInvalidInput(t *testing.T) {
	svc := service.NewPipelineService(zap.NewNop(), nil)
	h := NewHandler(svc, nil, zap.NewNop())

	c, w := updateConfigContext(`{not json`)
	h.UpdateConfig(c)
	if w.Code != http.StatusBadRequest {
		t.Errorf("malformed JSON: status = %d, want 400", w.Code)
	}

	c, w = updateConfigContext(`{"maxRetries":-1}`)
	h.UpdateConfig(c)
	if w.Code != http.StatusBadRequest {
		t.Errorf("negative maxRetries: status = %d, want 400", w.Code)
	}

	if got := svc.Config().MaxRetries; got != 3 {
		t.Errorf("MaxRetries = %d after rejected updates, want 3", got)
	}
}

// The success envelope must carry the config that was applied, so a client can
// read back what the pipeline will run.
func TestHandlerUpdateConfigRespondsWithAppliedConfig(t *testing.T) {
	svc := service.NewPipelineService(zap.NewNop(), nil)
	h := NewHandler(svc, nil, zap.NewNop())

	c, w := updateConfigContext(`{"stages":["route"]}`)
	h.UpdateConfig(c)

	var env struct {
		Success bool `json:"success"`
		Data    struct {
			Message string `json:"message"`
			Config  struct {
				Stages     []string `json:"stages"`
				MaxRetries int      `json:"maxRetries"`
			} `json:"config"`
		} `json:"data"`
	}
	if err := json.NewDecoder(io.NopCloser(bytes.NewReader(w.Body.Bytes()))).Decode(&env); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if !env.Success || env.Data.Message != "config updated" {
		t.Fatalf("envelope = %+v", env)
	}
	if len(env.Data.Config.Stages) != 1 || env.Data.Config.Stages[0] != "route" {
		t.Fatalf("response stages = %v, want [route]", env.Data.Config.Stages)
	}
	if env.Data.Config.MaxRetries != 3 {
		t.Errorf("response MaxRetries = %d, want the inherited 3", env.Data.Config.MaxRetries)
	}
}
