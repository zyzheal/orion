package service

import (
	"errors"
	"fmt"
	"strconv"
	"strings"

	"orion/platform-svc-go/internal/condition/models"

	"go.uber.org/zap"
)

// ConditionKind identifies whether a Condition is a leaf expression or a logical group.
type ConditionKind string

const (
	ConditionKindExpression ConditionKind = "expression"
	ConditionKindGroup      ConditionKind = "group"
)

// Condition is the unified AST node for a condition: either a single
// comparison/membership/pattern expression, or a logical group (AND/OR/NOT).
type Condition struct {
	Kind ConditionKind

	// For KindExpression
	Expr *models.ConditionExpression

	// For KindGroup (logical operator; one of AND, OR, NOT)
	Group *LogicalGroup
}

// LogicalGroup holds the children of a NOT/AND/OR node.
type LogicalGroup struct {
	Op    string // "AND", "OR", "NOT"
	Left  *Condition
	Right *Condition // nil for NOT
}

// ---------- Token types ----------

type TokenType int

const (
	TokenEOF TokenType = iota
	TokenIdent     // field name, e.g. "user.name"
	TokenOperator  // comparison operator, e.g. ">=", "contains", "in"
	TokenNumber    // numeric literal, e.g. "123", "3.14"
	TokenString    // quoted string, e.g. "hello" or 'hello'
	TokenArray     // JSON array literal, e.g. ["a","b"]
	TokenBool      // true, false
	TokenNull      // null literal
	TokenAnd
	TokenOr
	TokenNot
	TokenLParen    // "("
	TokenRParen    // ")"
	TokenError
)

// Token represents a single lexical token.
type Token struct {
	Type  TokenType
	Value string
	Pos   int // character position in the original input
}

// ---------- Lexer ----------

// Lexer turns an expression string into a stream of tokens.
type Lexer struct {
	input string
	pos   int
	width int // rune width at current position
}

// NewLexer creates a Lexer for the given input.
func NewLexer(input string) *Lexer {
	return &Lexer{input: input}
}

// Scan returns the next token.
func (l *Lexer) Scan() *Token {
	l.skipWhitespace()
	if l.pos >= len(l.input) {
		return &Token{Type: TokenEOF}
	}

	// Parentheses
	if l.input[l.pos] == '(' {
		return l.emitToken(TokenLParen, l.input[l.pos:l.pos+1])
	}
	if l.input[l.pos] == ')' {
		return l.emitToken(TokenRParen, l.input[l.pos:l.pos+1])
	}

	// String literals
	if l.input[l.pos] == '"' || l.input[l.pos] == '\'' {
		return l.scanString()
	}

	// JSON array literal
	if l.input[l.pos] == '[' {
		return l.scanArray()
	}

	// Operators that start with non-alphanumeric
	if op := l.scanSymbolOperator(); op != "" {
		return l.emitToken(TokenOperator, op)
	}

	// Alphanumeric token: could be identifier, operator, boolean, null, or logical keyword
	start := l.pos
	for l.pos < len(l.input) {
		c := l.input[l.pos]
		if c == '.' {
			l.pos++
			continue
		}
		if c >= 'a' && c <= 'z' || c >= 'A' && c <= 'Z' || c >= '0' && c <= '9' || c == '_' {
			l.pos++
		} else {
			break
		}
	}
	word := l.input[start:l.pos]
	return l.classifyWord(word, start)
}

func (l *Lexer) emitToken(t TokenType, value string) *Token {
	tok := &Token{Type: t, Value: value, Pos: l.pos - len(value)}
	l.pos += len(value)
	return tok
}

func (l *Lexer) skipWhitespace() {
	for l.pos < len(l.input) {
		c := l.input[l.pos]
		if c == ' ' || c == '\t' || c == '\n' || c == '\r' {
			l.pos++
		} else {
			break
		}
	}
}

func (l *Lexer) scanString() *Token {
	q := l.input[l.pos]
	pos := l.pos
	l.pos++
	for l.pos < len(l.input) {
		if l.input[l.pos] == '\\' {
			l.pos += 2
			continue
		}
		if l.input[l.pos] == q {
			l.pos++
			return &Token{Type: TokenString, Value: l.input[pos+1 : l.pos-1], Pos: pos}
		}
		l.pos++
	}
	return &Token{Type: TokenError, Value: "unterminated string", Pos: pos}
}

func (l *Lexer) scanArray() *Token {
	pos := l.pos
	depth := 0
	for l.pos < len(l.input) {
		c := l.input[l.pos]
		if c == '[' {
			depth++
		} else if c == ']' {
			depth--
			if depth == 0 {
				l.pos++
				return &Token{Type: TokenArray, Value: l.input[pos:l.pos], Pos: pos}
			}
		} else if c == '"' || c == '\'' {
			// skip string literal inside array
			q := c
			l.pos++
			for l.pos < len(l.input) {
				if l.input[l.pos] == '\\' {
					l.pos += 2
					continue
				}
				if l.input[l.pos] == q {
					l.pos++
					break
				}
				l.pos++
			}
		}
		l.pos++
	}
	return &Token{Type: TokenError, Value: "unterminated array", Pos: pos}
}

// scanSymbolOperator looks for multi-char operators that start with a symbol.
func (l *Lexer) scanSymbolOperator() string {
	if l.pos+1 < len(l.input) {
		two := l.input[l.pos : l.pos+2]
		if two == ">=" || two == "<=" || two == "==" || two == "!=" {
			return two
		}
	}
	single := string(l.input[l.pos])
	if single == ">" || single == "<" || single == "=" || single == "!" {
		return single
	}
	return ""
}

func (l *Lexer) classifyWord(word string, pos int) *Token {
	lower := strings.ToLower(word)

	// Boolean literals
	if lower == "true" || lower == "false" {
		return &Token{Type: TokenBool, Value: word, Pos: pos}
	}

	// Null literal
	if lower == "null" {
		return &Token{Type: TokenNull, Value: word, Pos: pos}
	}

	// Logical keywords
	if lower == "and" {
		return &Token{Type: TokenAnd, Value: word, Pos: pos}
	}
	if lower == "or" {
		return &Token{Type: TokenOr, Value: word, Pos: pos}
	}
	if lower == "not" {
		return &Token{Type: TokenNot, Value: word, Pos: pos}
	}

	// Comparison / membership / pattern operators
	if knownOperator[lower] {
		return &Token{Type: TokenOperator, Value: lower, Pos: pos}
	}

	// Numeric literal (pure digits with optional decimal point)
	if isNumber(word) {
		return &Token{Type: TokenNumber, Value: word, Pos: pos}
	}

	// Otherwise treat as an identifier / field name
	return &Token{Type: TokenIdent, Value: word, Pos: pos}
}

func isNumber(word string) bool {
	_, err := strconv.ParseFloat(word, 64)
	return err == nil
}

// ---------- Parser ----------

// ExpressionParser builds a Condition AST from a string expression.
type ExpressionParser struct {
	lexer  *Lexer
	current *Token
	logger *zap.Logger
}

// NewExpressionParser creates a new parser with optional structured logging.
func NewExpressionParser(logger *zap.Logger) *ExpressionParser {
	return &ExpressionParser{logger: logger}
}

// Parse parses a condition string into a Condition AST.
// Supported syntax:
//
//	comparison operators: age > 18, name == "admin", status contains "ok"
//	membership:          role IN ["admin","root"]
//	pattern:             email matches "*.example.com"
//	logical:             age > 18 AND role == "admin"
// negation:             NOT active == false
//	grouping:            (age > 18 AND role == "admin")
func (p *ExpressionParser) Parse(input string) (*Condition, error) {
	input = strings.TrimSpace(input)
	if input == "" {
		return nil, ErrEmptyExpression
	}

	p.lexer = NewLexer(input)
	p.next()
	cond, err := p.parseOr()
	if err != nil {
		return nil, err
	}
	if p.current.Type != TokenEOF {
		return nil, fmt.Errorf("%w: unexpected token at position %d: %q",
			ErrParseError, p.current.Pos, p.current.Value)
	}
	return cond, err
}

// next advances to the following token.
func (p *ExpressionParser) next() {
	p.current = p.lexer.Scan()
}

// expect consumes the expected token type, returning an error on mismatch.
func (p *ExpressionParser) expect(typ TokenType) error {
	if p.current.Type != typ {
		return fmt.Errorf("%w: expected %s got %q at position %d",
			ErrParseError, tokenName(typ), p.current.Value, p.current.Pos)
	}
	p.next()
	return nil
}

// ---------- Grammar ----------
//
//	orExpr      = andExpr (OR  andExpr)*
//	andExpr     = notExpr (AND notExpr)*
//	notExpr     = NOT notExpr | atom
//	atom        = ( orExpr ) | comparison
//	comparison  = IDENT OPERATOR? value?
//	value       = STRING | NUMBER | ARRAY | BOOL | NULL | IDENT

func (p *ExpressionParser) parseOr() (*Condition, error) {
	left, err := p.parseAnd()
	if err != nil {
		return nil, err
	}
	for p.current.Type == TokenOr {
		p.next()
		right, err := p.parseAnd()
		if err != nil {
			return nil, err
		}
		left = &Condition{
			Kind:  ConditionKindGroup,
			Group: &LogicalGroup{Op: "OR", Left: left, Right: right},
		}
	}
	return left, nil
}

func (p *ExpressionParser) parseAnd() (*Condition, error) {
	left, err := p.parseNot()
	if err != nil {
		return nil, err
	}
	for p.current.Type == TokenAnd {
		p.next()
		right, err := p.parseNot()
		if err != nil {
			return nil, err
		}
		left = &Condition{
			Kind:  ConditionKindGroup,
			Group: &LogicalGroup{Op: "AND", Left: left, Right: right},
		}
	}
	return left, nil
}

func (p *ExpressionParser) parseNot() (*Condition, error) {
	if p.current.Type == TokenNot {
		p.next()
		inner, err := p.parseNot()
		if err != nil {
			return nil, err
		}
		return &Condition{
			Kind:  ConditionKindGroup,
			Group: &LogicalGroup{Op: "NOT", Left: inner},
		}, nil
	}
	return p.parseAtom()
}

func (p *ExpressionParser) parseAtom() (*Condition, error) {
	if p.current.Type == TokenLParen {
		p.next()
		cond, err := p.parseOr()
		if err != nil {
			return nil, err
		}
		if err := p.expect(TokenRParen); err != nil {
			return nil, err
		}
		return cond, nil
	}

	return p.parseComparison()
}

func (p *ExpressionParser) parseComparison() (*Condition, error) {
	if p.current.Type != TokenIdent {
		return nil, fmt.Errorf("%w: expected field name, got %q at position %d",
			ErrParseError, p.current.Value, p.current.Pos)
	}
	field := p.current.Value
	p.next()

	// Unary operators need no value.
	if p.current.Type == TokenOperator && unaryOperators[p.current.Value] {
		op := p.current.Value
		return &Condition{
			Kind: ConditionKindExpression,
			Expr: &models.ConditionExpression{
				Field:    field,
				Operator: op,
				Enabled:  true,
			},
		}, nil
	}

	// Expect a binary operator.
	if p.current.Type != TokenOperator {
		return nil, fmt.Errorf("%w: expected operator after field %q, got %q at position %d",
			ErrParseError, field, p.current.Value, p.current.Pos)
	}
	op := p.current.Value
	p.next()

	// Some binary operators that do not need a value (e.g. empty, notempty —
	// handled above). Everything else needs a value.
	var value string
	var valueType string

	switch p.current.Type {
	case TokenString:
		value = p.current.Value
		valueType = "string"
	case TokenNumber:
		value = p.current.Value
		valueType = "number"
	case TokenBool:
		value = p.current.Value
		valueType = "boolean"
	case TokenNull:
		value = p.current.Value
		valueType = "null"
	case TokenArray:
		value = p.current.Value
		valueType = "array"
	case TokenIdent:
		// bare identifier as value (e.g. field == otherField)
		value = p.current.Value
		valueType = "string"
	default:
		return nil, fmt.Errorf("%w: expected value after operator %q, got %q at position %d",
			ErrParseError, op, p.current.Value, p.current.Pos)
	}
	p.next()

	return &Condition{
		Kind: ConditionKindExpression,
		Expr: &models.ConditionExpression{
			Field:     field,
			Operator:  op,
			Value:     value,
			ValueType: valueType,
			Enabled:   true,
		},
	}, nil
}

// ---------- String representation ----------

// String returns a readable representation of the Condition AST.
func (c *Condition) String() string {
	return formatCondition(c)
}

func formatCondition(c *Condition) string {
	if c == nil {
		return "<nil>"
	}
	switch c.Kind {
	case ConditionKindExpression:
		return exprToString(c.Expr)
	case ConditionKindGroup:
		return groupToString(c.Group)
	}
	return "<unknown>"
}

func exprToString(e *models.ConditionExpression) string {
	if e == nil {
		return "<nil>"
	}
	if unaryOperators[e.Operator] {
		return e.Field + " " + e.Operator
	}
	return e.Field + " " + e.Operator + " " + e.Value
}

func groupToString(g *LogicalGroup) string {
	if g == nil {
		return "<nil>"
	}
	if g.Op == "NOT" {
		return "NOT(" + formatCondition(g.Left) + ")"
	}
	if g.Right == nil {
		return g.Op + "(" + formatCondition(g.Left) + ")"
	}
	return "(" + formatCondition(g.Left) + ") " + g.Op + " (" + formatCondition(g.Right) + ")"
}

// ---------- Operator sets ----------

var knownOperator = map[string]bool{
	"=": true, "==": true, "!=": true, "!": true,
	">": true, ">=": true, "<": true, "<=": true,
	"contains": true, "notcontains": true, "regex": true,
	"in": true, "notin": true, "between": true,
	"isnull": true, "isnotnull": true, "null": true, "notnull": true,
	"matches": true, "startswith": true, "endswith": true,
	"length": true, "empty": true, "notempty": true,
	"arraycontains": true, "jsonpath": true,
}

var unaryOperators = map[string]bool{
	"isnull": true, "isnotnull": true, "null": true, "notnull": true,
	"empty": true, "notempty": true,
}

// ---------- Errors ----------

var (
	ErrEmptyExpression = errors.New("empty expression")
	ErrParseError      = errors.New("condition parse error")
)

// tokenName returns a human-readable name for a TokenType.
func tokenName(t TokenType) string {
	switch t {
	case TokenEOF:
		return "EOF"
	case TokenIdent:
		return "identifier"
		case TokenOperator:
		return "operator"
	case TokenNumber:
		return "number"
	case TokenString:
		return "string"
	case TokenArray:
		return "array"
	case TokenBool:
		return "boolean"
	case TokenNull:
		return "null"
	case TokenAnd:
		return "AND"
	case TokenOr:
		return "OR"
	case TokenNot:
		return "NOT"
	case TokenLParen:
		return "open paren"
	case TokenRParen:
		return "close paren"
	case TokenError:
		return "error"
	}
	return "unknown"
}
