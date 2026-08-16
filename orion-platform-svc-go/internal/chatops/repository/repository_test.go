package repository

import (
	"testing"
)

func Test_NewRepository_Nil(t *testing.T) {
	r := NewRepository(nil)
	if r == nil {
		t.Fatal("NewRepository(nil) returned nil")
	}
}

func Test_Contains_EmptyTarget(t *testing.T) {
	if contains("hello", "") != true {
		t.Fatal("contains(s, \"\") should be true for any s")
	}
}

func Test_Contains_SubstrFound(t *testing.T) {
	if !contains("hello world", "world") {
		t.Fatal("should find 'world' in 'hello world'")
	}
}

func Test_Contains_SubstrNotFound(t *testing.T) {
	if contains("hello world", "xyz") {
		t.Fatal("should not find 'xyz' in 'hello world'")
	}
}

func Test_Contains_SameString(t *testing.T) {
	if !contains("hello", "hello") {
		t.Fatal("should find string in itself")
	}
}

func Test_Contains_SubstrAtStart(t *testing.T) {
	if !contains("world hello", "world") {
		t.Fatal("should find 'world' at start")
	}
}

func Test_Contains_SubstrAtEnd(t *testing.T) {
	if !contains("hello world", "world") {
		t.Fatal("should find 'world' at end")
	}
}

func Test_IsUnknownTable_NilError(t *testing.T) {
	if isUnknownTable(nil) {
		t.Fatal("isUnknownTable(nil) should be false")
	}
}

type errStr struct{ s string }

func (e *errStr) Error() string { return e.s }

func Test_IsUnknownTable_DoesNotExist(t *testing.T) {
	e := &errStr{"relation 'foo' does not exist"}
	if !isUnknownTable(e) {
		t.Fatal("should detect 'does not exist'")
	}
}

func Test_IsUnknownTable_UnknownTable(t *testing.T) {
	e := &errStr{"unknown table 'bar'"}
	if !isUnknownTable(e) {
		t.Fatal("should detect 'unknown table'")
	}
}

func Test_IsUnknownTable_OtherError(t *testing.T) {
	e := &errStr{"connection refused"}
	if isUnknownTable(e) {
		t.Fatal("should not match 'connection refused'")
	}
}

func Test_FindSubstr_Empty(t *testing.T) {
	if !findSubstr("hello", "") {
		t.Fatal("findSubstr should match empty substr")
	}
}

func Test_FindSubstr_Found(t *testing.T) {
	if !findSubstr("hello world", "lo w") {
		t.Fatal("should find 'lo w' in 'hello world'")
	}
}

func Test_FindSubstr_NotFound(t *testing.T) {
	if findSubstr("hello", "xyz") {
		t.Fatal("should not find 'xyz'")
	}
}
