package saga

import (
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestGenerateID(t *testing.T) {
	t.Run("returns id with correct prefix", func(t *testing.T) {
		id := generateID("test")
		assert.True(t, strings.HasPrefix(id, "test-"))
	})

	t.Run("returns unique ids on successive calls", func(t *testing.T) {
		a := generateID("foo")
		b := generateID("foo")
		assert.NotEqual(t, a, b)
	})

	t.Run("prefix is preserved exactly", func(t *testing.T) {
		id := generateID("my-prefix")
		assert.True(t, strings.HasPrefix(id, "my-prefix-"))
	})
}

func TestGetString(t *testing.T) {
	m := map[string]interface{}{
		"name": "Alice",
		"empty": "",
		"num":  42,
	}

	t.Run("returns value when key exists and is non-empty string", func(t *testing.T) {
		assert.Equal(t, "Alice", getString(m, "name", "default"))
	})

	t.Run("returns fallback when key is absent", func(t *testing.T) {
		assert.Equal(t, "fallback", getString(m, "missing", "fallback"))
	})

	t.Run("returns fallback when value is empty string", func(t *testing.T) {
		assert.Equal(t, "fallback", getString(m, "empty", "fallback"))
	})

	t.Run("returns fallback when value is not a string", func(t *testing.T) {
		assert.Equal(t, "fallback", getString(m, "num", "fallback"))
	})

	t.Run("uses fallback when map is nil", func(t *testing.T) {
		var nilMap map[string]interface{}
		assert.Equal(t, "default", getString(nilMap, "key", "default"))
	})
}

func TestGetInt(t *testing.T) {
	m := map[string]interface{}{
		"count":  10,
		"missing": nil,
	}

	t.Run("returns int when key exists", func(t *testing.T) {
		assert.Equal(t, 10, getInt(m, "count", 0))
	})

	t.Run("returns fallback when key is absent", func(t *testing.T) {
		assert.Equal(t, 42, getInt(m, "nope", 42))
	})

	t.Run("returns zero when value exists but is not an int", func(t *testing.T) {
		bad := map[string]interface{}{"x": "string"}
		// value exists (ok==true), so fallback is ignored; type assertion fails, zero returned
		assert.Equal(t, 0, getInt(bad, "x", -1))
	})

	t.Run("uses fallback when map is nil", func(t *testing.T) {
		var nilMap map[string]interface{}
		assert.Equal(t, 99, getInt(nilMap, "k", 99))
	})
}

func TestNowPtr(t *testing.T) {
	before := time.Now()
	ptr := nowPtr()
	after := time.Now()

	t.Run("returns non-nil pointer", func(t *testing.T) {
		assert.NotNil(t, ptr)
	})

	t.Run("value is within expected time window", func(t *testing.T) {
		assert.True(t, ptr.After(before) || ptr.Equal(before))
		assert.True(t, ptr.Before(after) || ptr.Equal(after))
	})

	t.Run("value is in UTC", func(t *testing.T) {
		assert.Equal(t, time.UTC, ptr.Location())
	})
}
