package database

import (
	"testing"
)

func TestAppendSourceToInsert(t *testing.T) {
	tag := NewSourceTag()

	query := "INSERT INTO tickets (id, title) VALUES (:id, :title)"
	result := tag.AppendSourceToInsert(query, SourceGO)
	expected := "INSERT INTO tickets (id, title, _source) VALUES (:id, :title, 'go')"
	if result != expected {
		t.Errorf("got:\n%s\nexpected:\n%s", result, expected)
	}
}

func TestAppendSourceToInsertAlreadyHasSource(t *testing.T) {
	tag := NewSourceTag()
	query := "INSERT INTO tickets (id, _source) VALUES (:id, 'ts')"
	result := tag.AppendSourceToInsert(query, SourceGO)
	// Should return unchanged because _source already present
	if result != query {
		t.Errorf("expected unchanged, got:\n%s", result)
	}
}

func TestAppendSourceToInsertEmptySource(t *testing.T) {
	tag := NewSourceTag()
	query := "INSERT INTO alerts (id) VALUES (:id)"
	result := tag.AppendSourceToInsert(query, "")
	if result != "INSERT INTO alerts (id, _source) VALUES (:id, 'go')" {
		t.Errorf("expected default go source, got:\n%s", result)
	}
}

func TestAppendSourceToUpdate(t *testing.T) {
	tag := NewSourceTag()
	query := "UPDATE tickets SET title=:title WHERE id=:id"
	result := tag.AppendSourceToUpdate(query, SourceGO)
	// The simple textual insertion works: append before WHERE
	if result == query {
		t.Error("expected query to be modified")
	}
	if !containsColumn(result, SourceColumn) {
		t.Error("expected _source in result")
	}
}

func TestAppendSourceToUpdateNoWhere(t *testing.T) {
	tag := NewSourceTag()
	query := "UPDATE tickets SET title=:title"
	result := tag.AppendSourceToUpdate(query, SourceGO)
	// Should append SET _source = 'go' at the end
	if !containsColumn(result, SourceColumn) {
		t.Error("expected _source in result")
	}
}

func TestAppendSourceToUpdateAlreadyHasSource(t *testing.T) {
	tag := NewSourceTag()
	query := "UPDATE tickets SET title=:title, _source = 'ts' WHERE id=:id"
	result := tag.AppendSourceToUpdate(query, SourceGO)
	if result != query {
		t.Errorf("expected unchanged, got:\n%s", result)
	}
}

func TestUpsertSource(t *testing.T) {
	tag := NewSourceTag()
	result := tag.UpsertSource("")
	expected := "DO UPDATE SET _source = 'go'"
	if result != expected {
		t.Errorf("expected %s, got %s", expected, result)
	}
}
