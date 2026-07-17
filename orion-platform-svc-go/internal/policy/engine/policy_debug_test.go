package engine

import "testing"

func TestDebugParseComp(t *testing.T) {
	rego := `
package policies.test
allow = true if input.level > 5
`
	p, _ := compile(rego)
	c := p.rules[0].body.(cmpExpr)
	t.Logf("op=%q left type=%T right type=%T", c.op, c.left, c.right)
	ctx := &ctx{input: map[string]interface{}{"level": 6}}
	lv := c.left.val(ctx)
	rv := c.right.val(ctx)
	t.Logf("lv=%v(%T) rv=%v(%T)", lv, lv, rv, rv)
	ln, lk := normalise(lv)
	rr, rk := normalise(rv)
	t.Logf("normalise lv=(%v,%v) rv=(%v,%v)", ln, lk, rr, rk)
	t.Logf("kind of int 6 = %v", kindValue(6))
	t.Logf("kind of int 5 = %v", kindValue(5))
	t.Logf("eval=%v", c.eval(ctx))
}
