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
	exitCode := run(os.Args[1:])
	os.Exit(exitCode)
}

// run is the main entry point, refactored to return an exit code
// instead of calling os.Exit scattered throughout the control flow.
// This enables graceful shutdown and proper testability.
func run(args []string) int {
	if len(args) < 1 {
		printUsage()
		return types.ExitErr
	}

	cmd := args[0]
	cmdArgs := args[1:]

	switch cmd {
	case "schema-check":
		flags, showHelp := commands.SchemaCheckParseArgs(cmdArgs)
		if showHelp {
			return types.ExitPass
		}
		return commands.SchemaCheckCommand(flags)

	case "data-compare":
		flags, showHelp := commands.DataCompareParseArgs(cmdArgs)
		if showHelp {
			return types.ExitPass
		}
		return commands.DataCompareCommand(flags)

	case "source-audit":
		flags, showHelp := commands.SourceAuditParseArgs(cmdArgs)
		if showHelp {
			return types.ExitPass
		}
		return commands.SourceAuditCommand(flags)

	case "report":
		flags, showHelp := commands.ReportParseArgs(cmdArgs)
		if showHelp {
			return types.ExitPass
		}
		return commands.ReportCommand(flags)

	case "--version", "-v":
		fmt.Println("audit-cli v0.1.0")
		return types.ExitPass

	case "--help", "-h":
		printUsage()
		return types.ExitPass

	default:
		fmt.Fprintf(os.Stderr, "unknown subcommand: %s\n\n", cmd)
		printUsage()
		return types.ExitErr
	}
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
