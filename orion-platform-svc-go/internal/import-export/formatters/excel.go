package formatters

// ===================================================================
// Excel Formatter (stub)

// NOTE: Full Excel support requires the `github.com/xuri/excelize/v2` library,
// which is not currently in go.mod.  Implement ToExcelRows / FromExcelReader
// once the dependency is added.

// ExcelContentDispositionHint returns the suggested file extension for Excel
// downloads so handlers can set the correct HTTP header.
func ExcelContentDispositionHint() string {
	return "xlsx"
}
