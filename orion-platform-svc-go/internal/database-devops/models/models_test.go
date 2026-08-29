package models

import (
	"encoding/json"
	"reflect"
	"strings"
	"testing"
)

// ARCH-0.11: DatabaseSource.Password used to be json:"password,omitempty", so the
// handler's create route — c.JSON(http.StatusCreated, ds) — returned the caller's
// plaintext password to them. The list route was already safe because
// repository.ListDataSources never SELECTs the column, so create was the only leak.
//
// The tag is now json:"-", which makes every response path credential-free. These
// tests pin the tag itself as well as the rendered output, so a partial revert is
// caught too.
func TestDatabaseSourcePasswordNeverSerialized(t *testing.T) {
	ds := DatabaseSource{
		ID: "ds-1", TenantID: "t1", Name: "analytics", Type: "postgres",
		Host: "db.internal", Port: 5432, Database: "orion", Username: "app",
		Password: "hunter2-secret", SSLMode: "require", Status: "active",
	}

	if got := tagOf(ds, "Password", "json"); got != "-" {
		t.Errorf(`DatabaseSource.Password json tag = %q, want "-"`, got)
	}
	// db:"password" must stay: repository.CreateDataSource binds it as a named
	// placeholder in the INSERT, so dropping it would break persistence.
	if got := tagOf(ds, "Password", "db"); got != "password" {
		t.Errorf(`DatabaseSource.Password db tag = %q, want "password"`, got)
	}

	out, err := json.Marshal(ds)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	payload := string(out)
	if strings.Contains(payload, "hunter2-secret") {
		t.Errorf("the serialized data source echoes the credential: %s", payload)
	}
	if strings.Contains(strings.ToLower(payload), "password") {
		t.Errorf("the serialized data source still names a password field: %s", payload)
	}
	// The redaction is surgical: every non-secret field keeps serializing.
	for _, want := range []string{"ds-1", "analytics", "postgres", "db.internal", "5432", "orion", "app", "active"} {
		if !strings.Contains(payload, want) {
			t.Errorf("redaction removed %q from the response: %s", want, payload)
		}
	}
}

// The request model carries the opposite guarantee: password is accepted on the way
// in, and it is required — a data source record with no credential is useless to
// every consumer of it. binding is asserted through the struct tag rather than by
// driving gin's validator, which keeps this test free of a web framework dep.
func TestCreateDataSourceRequestAcceptsRequiredPassword(t *testing.T) {
	const src = `{"name":"n","type":"postgres","host":"h","port":5432,"database":"d","username":"u","password":"hunter2-secret"}`
	var req CreateDataSourceRequest
	if err := json.Unmarshal([]byte(src), &req); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if req.Password != "hunter2-secret" {
		t.Errorf("Password = %q, want the caller's plaintext", req.Password)
	}
	// reflect.StructTag.Get strips the surrounding quotes, so the expected value is
	// bare. The point is that a json name exists at all — a "-" here would mean the
	// caller can no longer send a credential.
	if got := tagOf(req, "Password", "json"); got != "password" {
		t.Errorf(`CreateDataSourceRequest.Password json tag = %q, want "password"`, got)
	}
	if got := tagOf(req, "Password", "binding"); got != "required" {
		t.Errorf(`CreateDataSourceRequest.Password binding tag = %q, want "required"`, got)
	}

	// No update request in this module may carry a password: a partial update must
	// not be able to reset or drop a credential that Create set.
	if _, ok := reflect.TypeOf(UpdateDatabaseDevopsRequest{}).FieldByName("Password"); ok {
		t.Error("an update request must not carry a Password field")
	}
}

// tagOf reflects one struct tag off a model value by field name, so each assertion
// above reads as a plain tag check instead of a block of reflect plumbing.
func tagOf(v any, field, key string) string {
	typ := reflect.TypeOf(v)
	if typ.Kind() == reflect.Ptr {
		typ = typ.Elem()
	}
	f, ok := typ.FieldByName(field)
	if !ok {
		return "<missing>"
	}
	return f.Tag.Get(key)
}
