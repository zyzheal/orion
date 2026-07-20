package service

// compare implements the alert operators: gt, lt, gte, lte, eq, neq.
func compare(value float64, operator string, threshold float64) bool {
	switch operator {
	case "gt":
		return value > threshold
	case "gte", ">=":
		return value >= threshold
	case "lt":
		return value < threshold
	case "lte", "<=":
		return value <= threshold
	case "eq":
		return value == threshold
	case "neq", "ne":
		return value != threshold
	default:
		return false
	}
}

// escalateSeverity returns the next severity level, capping at "critical".
func escalateSeverity(current string) string {
	switch current {
	case "info":
		return "warning"
	case "warning":
		return "critical"
	default:
		return "critical"
	}
}
