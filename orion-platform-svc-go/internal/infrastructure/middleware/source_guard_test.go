package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func init() {
	gin.SetMode(gin.TestMode)
}

// --- SourceGuard construction ---

func TestNewSourceGuard(t *testing.T) {
	g := NewSourceGuardWithMode(ModeReadWrite)
	if g.mode != ModeReadWrite {
		t.Errorf("expected %s, got %s", ModeReadWrite, g.mode)
	}
}

func TestNewSourceGuardWithModeInvalid(t *testing.T) {
	g := NewSourceGuardWithMode("bogus")
	if g.mode != ModeReadWrite {
		t.Errorf("expected default %s, got %s", ModeReadWrite, g.mode)
	}
}

func TestIsReadOnly(t *testing.T) {
	readOnly := NewSourceGuardWithMode(ModeReadOnly)
	if !readOnly.IsReadOnly() {
		t.Error("expected IsReadOnly to be true")
	}

	readWrite := NewSourceGuardWithMode(ModeReadWrite)
	if readWrite.IsReadOnly() {
		t.Error("expected IsReadOnly to be false")
	}
}

// --- SetSource middleware ---

func TestSetSourceTagsContext(t *testing.T) {
	g := NewSourceGuardWithMode(ModeReadWrite)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("POST", "/api/test", nil)

	g.SetSource()(c)

	src := GetSource(c)
	if src != SourceGO {
		t.Errorf("expected source %s, got %s", SourceGO, src)
	}
}

// --- BlockConflicts: read-only mode ---

func TestBlockConflictsReadOnlyBlocksPOST(t *testing.T) {
	g := NewSourceGuardWithMode(ModeReadOnly)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("POST", "/api/write", nil)

	handler := g.BlockConflicts()
	handler(c)

	if !c.IsAborted() {
		t.Error("expected request to be aborted")
	}
	if w.Code != http.StatusMethodNotAllowed {
		t.Errorf("expected 405, got %d", w.Code)
	}
}

func TestBlockConflictsReadOnlyBlocksPUT(t *testing.T) {
	g := NewSourceGuardWithMode(ModeReadOnly)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("PUT", "/api/update", nil)

	g.BlockConflicts()(c)

	if !c.IsAborted() {
		t.Error("expected request to be aborted")
	}
}

func TestBlockConflictsReadOnlyBlocksDELETE(t *testing.T) {
	g := NewSourceGuardWithMode(ModeReadOnly)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("DELETE", "/api/delete", nil)

	g.BlockConflicts()(c)

	if !c.IsAborted() {
		t.Error("expected request to be aborted")
	}
}

func TestBlockConflictsReadOnlyAllowsGET(t *testing.T) {
	g := NewSourceGuardWithMode(ModeReadOnly)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("GET", "/api/read", nil)

	g.BlockConflicts()(c)

	if c.IsAborted() {
		t.Error("expected GET to pass through")
	}
}

func TestBlockConflictsReadOnlyAllowsHealthz(t *testing.T) {
	g := NewSourceGuardWithMode(ModeReadOnly)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("POST", "/healthz", nil)

	g.BlockConflicts()(c)

	if c.IsAborted() {
		t.Error("expected POST to /healthz to pass through")
	}
}

// --- BlockConflicts: read-write mode ---

func TestBlockConflictsReadWriteAllowsWrite(t *testing.T) {
	g := NewSourceGuardWithMode(ModeReadWrite)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("POST", "/api/write", nil)

	g.BlockConflicts()(c)

	if c.IsAborted() {
		t.Error("expected request to pass through in read-write mode")
	}
}

func TestBlockConflictsReadWriteRejectsConflict(t *testing.T) {
	g := NewSourceGuardWithMode(ModeReadWrite)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("PUT", "/api/update", nil)
	c.Set("_source_conflict", true)

	g.BlockConflicts()(c)

	if !c.IsAborted() {
		t.Error("expected request to be aborted on conflict")
	}
	if w.Code != http.StatusConflict {
		t.Errorf("expected 409, got %d", w.Code)
	}
}

func TestBlockConflictsReadWriteAllowsWhenConflictCleared(t *testing.T) {
	g := NewSourceGuardWithMode(ModeReadWrite)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("PUT", "/api/update", nil)
	c.Set("_source_conflict", false) // conflict explicitly allowed

	g.BlockConflicts()(c)

	if c.IsAborted() {
		t.Error("expected request to pass through when conflict cleared")
	}
}

// --- SetConflict / AllowConflict ---

func TestSetConflict(t *testing.T) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("GET", "/", nil)

	SetConflict(c)
	v, ok := c.Get("_source_conflict")
	if !ok || v != true {
		t.Error("expected conflict to be set to true")
	}
}

func TestAllowConflict(t *testing.T) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("GET", "/", nil)

	SetConflict(c)
	AllowConflict(c)
	v, ok := c.Get("_source_conflict")
	if !ok || v != false {
		t.Error("expected conflict to be cleared")
	}
}

// --- GetSource ---

func TestGetSourceDefault(t *testing.T) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("GET", "/", nil)

	// No source set — should default to SourceTS
	src := GetSource(c)
	if src != SourceTS {
		t.Errorf("expected default source %s, got %s", SourceTS, src)
	}
}

// --- config Mode ---

func TestModeDefault(t *testing.T) {
	// When env is empty, default is readwrite
	t.Setenv(sourceGuardEnv, "")
	m := Mode()
	if m != ModeReadWrite {
		t.Errorf("expected %s, got %s", ModeReadWrite, m)
	}
}

func TestModeReadOnly(t *testing.T) {
	t.Setenv(sourceGuardEnv, ModeReadOnly)
	m := Mode()
	if m != ModeReadOnly {
		t.Errorf("expected %s, got %s", ModeReadOnly, m)
	}
}

func TestModeInvalid(t *testing.T) {
	t.Setenv(sourceGuardEnv, "bogus")
	m := Mode()
	if m != ModeReadWrite {
		t.Errorf("expected default %s for invalid env, got %s", ModeReadWrite, m)
	}
}
