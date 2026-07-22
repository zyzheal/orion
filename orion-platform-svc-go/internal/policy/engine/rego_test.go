package engine

import "testing"

func TestAllowInputRoleAdmin(t *testing.T) {
	rego := `
package policies.test
default allow = false
allow = true if input.role == "admin"
`
	eng, err := Compile(rego)
	if err != nil {
		t.Fatal(err)
	}
	res, err := eng.Evaluate(map[string]interface{}{"role": "admin"})
	if err != nil {
		t.Fatal(err)
	}
	if res["allow"] != true {
		t.Fatalf("expected allow=true got %v", res["allow"])
	}
}

func TestDenyInputRoleUser(t *testing.T) {
	rego := `
package policies.test
default allow = false
allow = true if input.role == "admin"
`
	eng, err := Compile(rego)
	if err != nil {
		t.Fatal(err)
	}
	res, err := eng.Evaluate(map[string]interface{}{"role": "user"})
	if err != nil {
		t.Fatal(err)
	}
	if res["allow"] != false {
		t.Fatalf("expected allow=false got %v", res["allow"])
	}
}

func TestContainsOperator(t *testing.T) {
	rego := `
package policies.test
allow = true if input.name contains "admin"
`
	eng, err := Compile(rego)
	if err != nil {
		t.Fatal(err)
	}
	res, err := eng.Evaluate(map[string]interface{}{"name": "admin@corp.io"})
	if err != nil {
		t.Fatal(err)
	}
	if res["allow"] != true {
		t.Fatalf("expected allow=true got %v", res["allow"])
	}
}

func TestAndOr(t *testing.T) {
	rego := `
package policies.test
allow = true if input.role == "admin" and input.level > 10
deny = true if input.role == "user" or input.level < 5
`
	eng, err := Compile(rego)
	if err != nil {
		t.Fatal(err)
	}
	// both true
	res, err := eng.Evaluate(map[string]interface{}{"role": "admin", "level": 20})
	if err != nil {
		t.Fatal(err)
	}
	if res["allow"] != true {
		t.Fatalf("expected allow=true got %v", res["allow"])
	}
	// deny only
	res2, err := eng.Evaluate(map[string]interface{}{"role": "user", "level": 3})
	if err != nil {
		t.Fatal(err)
	}
	if res2["deny"] != true {
		t.Fatalf("expected deny=true got %v", res2["deny"])
	}
}

func TestMethodChainStartswith(t *testing.T) {
	rego := `
package policies.test
allow = true if input.name.startswith("prod-")
`
	eng, err := Compile(rego)
	if err != nil {
		t.Fatal(err)
	}
	res, err := eng.Evaluate(map[string]interface{}{"name": "prod-cluster-1"})
	if err != nil {
		t.Fatal(err)
	}
	if res["allow"] != true {
		t.Fatalf("expected allow=true got %v", res["allow"])
	}
}

func TestMethodChainEndswith(t *testing.T) {
	rego := `
package policies.test
allow = true if input.filename.endswith(".go")
`
	eng, err := Compile(rego)
	if err != nil {
		t.Fatal(err)
	}
	res, err := eng.Evaluate(map[string]interface{}{"filename": "main.go"})
	if err != nil {
		t.Fatal(err)
	}
	if res["allow"] != true {
		t.Fatalf("expected allow=true got %v", res["allow"])
	}
}

func TestInOperator(t *testing.T) {
	rego := `
package policies.test
allow = true if input.region in ["us-east-1", "eu-west-1"]
`
	eng, err := Compile(rego)
	if err != nil {
		t.Fatal(err)
	}
	res, err := eng.Evaluate(map[string]interface{}{"region": "eu-west-1"})
	if err != nil {
		t.Fatal(err)
	}
	if res["allow"] != true {
		t.Fatalf("expected allow=true got %v", res["allow"])
	}
}

func TestMultipleRules(t *testing.T) {
	rego := `
package policies.test
allow = true if input.level > 5
warn = true if input.level < 3
`
	eng, err := Compile(rego)
	if err != nil {
		t.Fatal(err)
	}
	// both false
	res, err := eng.Evaluate(map[string]interface{}{"level": 4})
	if err != nil {
		t.Fatal(err)
	}
	if res["allow"] != false || res["warn"] != false {
		t.Fatalf("expected allow=false warn=false got %v", res)
	}
	// both true
	res2, err := eng.Evaluate(map[string]interface{}{"level": 6})
	if err != nil {
		t.Fatal(err)
	}
	if res2["allow"] != true {
		t.Fatalf("expected allow=true got %v", res2["allow"])
	}
}

func TestNot(t *testing.T) {
	rego := `
package policies.test
allow = true if not input.denied
`
	eng, err := Compile(rego)
	if err != nil {
		t.Fatal(err)
	}
	// no denied key -> treat as falsy -> not falsy = true
	res, err := eng.Evaluate(map[string]interface{}{"foo": "bar"})
	if err != nil {
		t.Fatal(err)
	}
	if res["allow"] != true {
		t.Fatalf("expected allow=true got %v", res["allow"])
	}
}

func TestEmptyRegoReturnsAllowFalse(t *testing.T) {
	eng, err := Compile("")
	if err != nil {
		t.Fatal(err)
	}
	res, err := eng.Evaluate(map[string]interface{}{"a": 1})
	if err != nil {
		t.Fatal(err)
	}
	if res["allow"] != false {
		t.Fatalf("expected allow=false got %v", res["allow"])
	}
}
