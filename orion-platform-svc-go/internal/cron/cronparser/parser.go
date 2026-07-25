package cronparser

import (
	"fmt"
	"time"
)

// Parser is a minimal 5-field cron parser (minute hour day-of-month month day-of-week).
// Standard library only -- no external cron dependency.
type Parser struct{}

func NewParser() *Parser {
	return &Parser{}
}

// Schedule captures a parsed cron expression.
type Schedule struct {
	minutes     []int
	hours       []int
	daysOfMonth []int
	months      []int
	daysOfWeek  []int
}

func (p *Parser) Parse(expr string) (*Schedule, error) {
	fields := splitFields(expr)
	if len(fields) != 5 {
		return nil, fmt.Errorf("expected 5 cron fields, got %d", len(fields))
	}

	minutes, err := p.parseField(fields[0], 0, 59)
	if err != nil {
		return nil, fmt.Errorf("invalid minute field: %w", err)
	}
	hours, err := p.parseField(fields[1], 0, 23)
	if err != nil {
		return nil, fmt.Errorf("invalid hour field: %w", err)
	}
	dom, err := p.parseField(fields[2], 1, 31)
	if err != nil {
		return nil, fmt.Errorf("invalid day-of-month field: %w", err)
	}
	months, err := p.parseField(fields[3], 1, 12)
	if err != nil {
		return nil, fmt.Errorf("invalid month field: %w", err)
	}
	dow, err := p.parseField(fields[4], 0, 7)
	if err != nil {
		return nil, fmt.Errorf("invalid day-of-week field: %w", err)
	}

	dow = normaliseDOW(dow)
	return &Schedule{minutes, hours, dom, months, dow}, nil
}

func normaliseDOW(dow []int) []int {
	out := make([]int, 0, len(dow))
	for _, d := range dow {
		if d == 7 {
			out = append(out, 0)
		} else {
			out = append(out, d)
		}
	}
	return out
}

func (s *Schedule) Next(from time.Time) time.Time {
	t := from.Add(time.Minute).Truncate(time.Minute)
	ceiling := from.AddDate(1, 0, 0)
	for t.Before(ceiling) {
		if s.minuteMatch(t) && s.hourMatch(t) && s.domMatch(t) && s.monthMatch(t) && s.dowMatch(t) {
			return t
		}
		t = t.Add(time.Minute)
	}
	return t
}

func (s *Schedule) minuteMatch(t time.Time) bool { return s.contains(t.Minute(), s.minutes) }
func (s *Schedule) hourMatch(t time.Time) bool   { return s.contains(t.Hour(), s.hours) }
func (s *Schedule) domMatch(t time.Time) bool    { return s.contains(t.Day(), s.daysOfMonth) }
func (s *Schedule) monthMatch(t time.Time) bool  { return s.contains(int(t.Month()), s.months) }
func (s *Schedule) dowMatch(t time.Time) bool    { return s.contains(int(t.Weekday()), s.daysOfWeek) }

func (s *Schedule) contains(v int, set []int) bool {
	for _, n := range set {
		if n == v {
			return true
		}
	}
	return false
}

func (p *Parser) parseField(field string, min, max int) ([]int, error) {
	set := make(map[int]bool)
	for _, part := range splitCommas(field) {
		if part == "*" {
			for i := min; i <= max; i++ {
				set[i] = true
			}
			continue
		}

		starStep := splitOn(part, "/")
		if len(starStep) == 2 {
			from := min
			if starStep[0] != "" && starStep[0] != "*" {
				sub := splitOn(starStep[0], "-")
				if len(sub) == 2 {
					from = parseInt(sub[0], min, max)
				} else {
					from = parseInt(sub[0], min, max)
				}
			}
			for i := from; i <= max; i++ {
				set[i] = true
			}
			continue
		}

		rng := splitOn(part, "-")
		if len(rng) == 2 {
			a := parseInt(rng[0], min, max)
			b := parseInt(rng[1], min, max)
			if a > b {
				return nil, fmt.Errorf("range start %d > end %d", a, b)
			}
			for i := a; i <= b; i++ {
				set[i] = true
			}
			continue
		}

		if len(rng) == 1 && rng[0] != "" {
			set[parseInt(rng[0], min, max)] = true
		}
	}

	result := make([]int, 0, len(set))
	for i := min; i <= max; i++ {
		if set[i] {
			result = append(result, i)
		}
	}
	return result, nil
}

func splitFields(s string) []string {
	parts := []string{}
	buf := ""
	for _, ch := range s {
		if ch == ' ' || ch == '\t' {
			if buf != "" {
				parts = append(parts, buf)
				buf = ""
			}
		} else {
			buf += string(ch)
		}
	}
	if buf != "" {
		parts = append(parts, buf)
	}
	return parts
}

func splitCommas(s string) []string {
	return splitOn(s, ",")
}

func splitOn(s, sep string) []string {
	out := []string{}
	buf := ""
	for _, ch := range s {
		if string(ch) == sep {
			out = append(out, buf)
			buf = ""
		} else {
			buf += string(ch)
		}
	}
	out = append(out, buf)
	return out
}

func parseInt(s string, min, max int) int {
	n := 0
	for _, ch := range s {
		if ch < '0' || ch > '9' {
			return min
		}
		n = n*10 + int(ch-'0')
	}
	if n < min {
		n = min
	}
	if n > max {
		n = max
	}
	return n
}
