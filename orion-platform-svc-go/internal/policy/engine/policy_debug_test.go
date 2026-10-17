package engine

import "testing"

func TestDebugParseComp(t *testing.T) {
	rego := `
package policies.test
allow = true if input.level > 5
`
	p, err := compile(rego)
	if err != nil {
		t.Fatalf("compile failed: %v", err)
	}
	if len(p.rules) == 0 {
		t.Fatal("expected at least 1 rule, got 0")
	}
	c, ok := p.rules[0].body.(cmpExpr)
	if !ok {
		t.Fatalf("expected cmpExpr, got %T", p.rules[0].body)
	}
	if c.op != ">" {
		t.Errorf("expected op '>', got %q", c.op)
	}
	evalCtx := &ctx{input: map[string]interface{}{"level": 6}}
	lv := c.left.val(evalCtx)
	rv := c.right.val(evalCtx)
	// left is input.level (int 6), right is literal 5 (float64)
	// normalise converts all numbers to float64
	ln, _ := normalise(lv)
	rn, _ := normalise(rv)
	if ln.(float64) != 6 {
		t.Errorf("expected normalised left val 6, got %v", ln)
	}
	if rn.(float64) != 5 {
		t.Errorf("expected normalised right val 5, got %v", rn)
	}
	result := c.eval(evalCtx)
	if !result {
		t.Errorf("expected eval()=true for 6 > 5, got false")
	}
	// Test with input that should fail
	evalCtx2 := &ctx{input: map[string]interface{}{"level": 3}}
	if c.eval(evalCtx2) {
		t.Errorf("expected eval()=false for 3 > 5, got true")
	}
}
