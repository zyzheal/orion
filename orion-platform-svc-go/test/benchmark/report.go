package benchmark

import (
	"fmt"
	"strings"
	"time"
)

// Report aggregates multiple benchmark results for summary output.
type Report struct {
	Results []*Result
}

// NewReport creates an empty Report.
func NewReport() *Report {
	return &Report{}
}

// Add appends a result to the report.
func (r *Report) Add(result *Result) {
	r.Results = append(r.Results, result)
}

// Report prints a formatted table of all benchmark results to stdout.
func (r *Report) Report() {
	if len(r.Results) == 0 {
		fmt.Println("No benchmark results to report.")
		return
	}

	fmt.Println()
	fmt.Println("========== Benchmark Report ==========")
	fmt.Println()

	// Header row.
	fmt.Printf("%-30s %10s %10s %15s %12s %12s %12s\n",
		"Name", "Requests", "Errors", "Elapsed", "P50", "P95", "P99")
	fmt.Println(strings.Repeat("─", 105))

	// Result rows.
	for _, res := range r.Results {
		fmt.Printf("%-30s %10d %10d %15s %12s %12s %12s\n",
			res.Name,
			res.Requests,
			res.Errors,
			res.Elapsed.Round(time.Millisecond),
			formatDuration(res.P50),
			formatDuration(res.P95),
			formatDuration(res.P99),
		)
	}

	fmt.Println(strings.Repeat("─", 105))
	fmt.Println()
}

// Report prints a formatted single-result report to stdout.
func (r *Result) Report() {
	report := NewReport()
	report.Add(r)
	report.Report()
}

// formatDuration formats a duration for display, using ms or s as appropriate.
func formatDuration(d time.Duration) string {
	if d < time.Second {
		return fmt.Sprintf("%dms", d.Milliseconds())
	}
	return fmt.Sprintf("%.2fs", d.Seconds())
}