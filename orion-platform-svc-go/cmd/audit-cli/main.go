// Command audit-cli provides data audit and migration verification utilities.
//
// Subcommands:
//   schema-check    Compare DB schemas between TS and Go databases
//   data-compare    Compare row counts and checksums between two databases
//   source-audit    Audit _source column distribution in Go tables
//   report          Generate a comprehensive JSON audit report
//
// Usage:
//   audit-cli <subcommand> [flags]
//   audit-cli --help          Show this help text
//   audit-cli <subcommand> --help  Show subcommand-specific help
//
// Exit codes:
//   0 = success (all checks pass)
//   1 = discrepancies found
//   2 = execution error
package main

import (
	"fmt"
	"os"

	"orion/platform-svc-go/cmd/audit-cli/commands"
	"orion/platform-svc-go/cmd/audit-cli/output"
	"orion/platform-svc-go/cmd/audit-cli/types"
)

func main() {
	if len(os.Args) < 2 {
		printUsage()
		os.Exit(types.ExitErr)
	}

	cmd := os.Args[1]
	args := os.Args[2:]

	var exitCode int
	switch cmd {
	case "schema-check":
		flags, showHelp := commands.SchemaCheckParseArgs(args)
		if showHelp {
			os.Exit(types.ExitPass)
		}
		exitCode = commands.SchemaCheckCommand(flags)

	case "data-compare":
		flags, showHelp := commands.DataCompareParseArgs(args)
		if showHelp {
			os.Exit(types.ExitPass)
		}
		exitCode = commands.DataCompareCommand(flags)

	case "source-audit":
		flags, showHelp := commands.SourceAuditParseArgs(args)
		if showHelp {
			os.Exit(types.ExitPass)
		}
		exitCode = commands.SourceAuditCommand(flags)

	case "report":
		flags, showHelp := commands.ReportParseArgs(args)
		if showHelp {
			os.Exit(types.ExitPass)
		}
		exitCode = commands.ReportCommand(flags)

	case "--version", "-v":
		fmt.Println("audit-cli v0.1.0")
		os.Exit(types.ExitPass)

	case "--help", "-h":
		printUsage()
		os.Exit(types.ExitPass)

	default:
		fmt.Fprintf(os.Stderr, "unknown subcommand: %s\n\n", cmd)
		printUsage()
		os.Exit(types.ExitErr)
	}

	os.Exit(exitCode)
}

func printUsage() {
	fmt.Println(`audit-cli - Data audit and migration verification tool

Subcommands:
  schema-check    Compare DB schemas (tables, columns, indexes)
  data-compare    Compare row counts and checksums between databases
  source-audit    Audit _source column distribution per table
  report          Generate comprehensive JSON audit report

Global flags:
  --version, -v   Show version
  --help, -h      Show this help text

Examples:
  audit-cli schema-check --ts-dsn "postgres://..." --go-dsn "postgres://..."
  audit-cli data-compare --ts-dsn "postgres://..." --go-dsn "postgres://..."
  audit-cli source-audit --go-dsn "postgres://..." --format json
  audit-cli report --go-dsn "postgres://..." --migrations-dir ./migrations

Exit codes:
  0 = success (all checks pass)
  1 = discrepancies found
  2 = execution error`)
}

// Ensure package imports are used
var _ = output.Format
var _ = types.ExitPass
