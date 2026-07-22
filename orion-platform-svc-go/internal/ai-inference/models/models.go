package models

// InferenceRequest represents a request to the Python AI inference service.
type InferenceRequest struct {
	Service    string                 `json:"service"`    // "classify", "embedding", "anomaly"
	InputType  string                 `json:"inputType"`  // "image", "text", "data"
	ImageData  []byte                 `json:"imageData,omitempty"` // base64 or raw bytes
	Text       string                 `json:"text,omitempty"`
	DataPoints []map[string]interface{} `json:"dataPoints,omitempty"`
	Model      string                 `json:"model"`
	Options    map[string]interface{} `json:"options,omitempty"`
}

// InferenceResponse represents a response from the Python AI inference service.
type InferenceResponse struct {
	Success  bool                   `json:"success"`
	Data     map[string]interface{} `json:"data,omitempty"`
	Error    string                 `json:"error,omitempty"`
	Duration float64                `json:"duration"` // seconds
}

// DecisionRequest represents a request to the Python AI decision service.
type DecisionRequest struct {
	Type    string                 `json:"type"` // "deployment", "incident", "general"
	Context map[string]interface{} `json:"context"`
	Options []map[string]interface{} `json:"options,omitempty"`
}

// DecisionResponse represents a response from the Python AI decision service.
type DecisionResponse struct {
	Success    bool                   `json:"success"`
	Decision   map[string]interface{} `json:"decision,omitempty"`
	Confidence float64                `json:"confidence"`
	Error      string                 `json:"error,omitempty"`
}
