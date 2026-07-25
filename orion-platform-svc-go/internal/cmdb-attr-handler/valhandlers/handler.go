// Package handlers implements per-type value handlers for CMDB attribute values.
// Each handler provides Validate, Parse, Serialize, and Compare for its type.
package handlers

// ---------------------------------------------------------------------------
// Public interface (exported for consumers in processor / validator packages).
// ---------------------------------------------------------------------------

// AttributeValueHandler defines the contract every type handler must implement.
type AttributeValueHandler interface {
	Type() string
	Validate(value string) error
	Parse(value string) (interface{}, error)
	Serialize(v interface{}) string
	Compare(a, b string) int
}

// ---------------------------------------------------------------------------
// Constructor helpers (non-destructive; existing unexported structs untouched).
// ---------------------------------------------------------------------------

func NewStringValueHandler() AttributeValueHandler    { return stringValueHandler{} }
func NewNumberValueHandler() AttributeValueHandler    { return numberValueHandler{} }
func NewBooleanValueHandler() AttributeValueHandler   { return booleanValueHandler{} }
func NewDatetimeValueHandler() AttributeValueHandler  { return datetimeValueHandler{} }
func NewEnumValueHandler() AttributeValueHandler      { return enumValueHandler{} }
func NewMultiselectValueHandler() AttributeValueHandler { return multiselectValueHandler{} }
func NewReferenceValueHandler() AttributeValueHandler { return referenceValueHandler{} }
func NewJsonValueHandler() AttributeValueHandler      { return jsonValueHandler{} }
func NewArrayValueHandler() AttributeValueHandler     { return arrayValueHandler{} }
func NewBinaryValueHandler() AttributeValueHandler    { return binaryValueHandler{} }
func NewPasswordValueHandler() AttributeValueHandler  { return passwordValueHandler{} }
func NewIpValueHandler() AttributeValueHandler        { return ipValueHandler{} }
func NewEmailValueHandler() AttributeValueHandler     { return emailValueHandler{} }
func NewUrlValueHandler() AttributeValueHandler       { return urlValueHandler{} }
func NewPercentageValueHandler() AttributeValueHandler { return percentageValueHandler{} }
func NewMemoryValueHandler() AttributeValueHandler    { return memoryValueHandler{} }
func NewDiskValueHandler() AttributeValueHandler      { return diskValueHandler{} }
func NewCpuValueHandler() AttributeValueHandler       { return cpuValueHandler{} }
func NewVersionValueHandler() AttributeValueHandler   { return versionValueHandler{} }
func NewMacValueHandler() AttributeValueHandler       { return macValueHandler{} }
func NewUuidValueHandler() AttributeValueHandler      { return uuidValueHandler{} }
func NewTagsValueHandler() AttributeValueHandler      { return tagsValueHandler{} }
func NewDateValueHandler() AttributeValueHandler      { return dateValueHandler{} }

// ---------------------------------------------------------------------------
// Built-in handlers map (type -> handler). Useful for consumers that want
// the complete registry without importing every constructor.
// ---------------------------------------------------------------------------

// AllHandlers returns a map of every built-in attribute type handler.
func AllHandlers() map[string]AttributeValueHandler {
	return map[string]AttributeValueHandler{
		"string":       NewStringValueHandler(),
		"number":       NewNumberValueHandler(),
		"boolean":      NewBooleanValueHandler(),
		"datetime":     NewDatetimeValueHandler(),
		"date":         NewDateValueHandler(),
		"enum":         NewEnumValueHandler(),
		"multiselect":  NewMultiselectValueHandler(),
		"reference":    NewReferenceValueHandler(),
		"json":         NewJsonValueHandler(),
		"array":        NewArrayValueHandler(),
		"binary":       NewBinaryValueHandler(),
		"password":     NewPasswordValueHandler(),
		"ip":           NewIpValueHandler(),
		"email":        NewEmailValueHandler(),
		"url":          NewUrlValueHandler(),
		"percentage":   NewPercentageValueHandler(),
		"memory":       NewMemoryValueHandler(),
		"disk":         NewDiskValueHandler(),
		"cpu":          NewCpuValueHandler(),
		"version":      NewVersionValueHandler(),
		"mac":          NewMacValueHandler(),
		"uuid":         NewUuidValueHandler(),
		"tags":         NewTagsValueHandler(),
	}
}
