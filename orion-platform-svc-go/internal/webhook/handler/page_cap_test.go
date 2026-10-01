package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestList_CapsPageSizeAtOneHundred(t *testing.T) {
	for _, tc := range []struct {
		name  string
		query string
		want  int
	}{
		{"capped", "pageSize=1000", 100},
		{"insideTheCap", "page=3&pageSize=25", 25},
		{"defaults", "", 20},
	} {
		t.Run(tc.name, func(t *testing.T) {
			h := newHandler()
			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)
			c.Set("tenant_id", "tenant-1")
			c.Request = httptest.NewRequest(http.MethodGet, "/x?"+tc.query, nil)
			h.List(c)
			if w.Code != http.StatusOK {
				t.Fatalf("status %d, want 200: %s", w.Code, w.Body.String())
			}
			// RespondSuccess wraps: {"success":true,"data":{...,"pageSize":S}}
			var env struct {
				Success bool `json:"success"`
				Data    struct {
					PageSize int `json:"pageSize"`
				} `json:"data"`
			}
			if err := json.Unmarshal(w.Body.Bytes(), &env); err != nil {
				t.Fatalf("decode: %v\n%s", err, w.Body.String())
			}
			if env.Data.PageSize != tc.want {
				t.Errorf("pageSize=%q got %d, want %d", tc.query, env.Data.PageSize, tc.want)
			}
		})
	}
}
