package mlops

import "encoding/json"

type MLTrainingConfig struct {
    Name        string                 `json:"name"`
    ModelType   string                 `json:"model_type"`
    Parameters  map[string]interface{} `json:"parameters,omitempty"`
    DataPath    string                 `json:"data_path"`
    MaxEpochs   int                    `json:"max_epochs"`
    BatchSize   int                    `json:"batch_size"`
    EnableGPU   bool                   `json:"enable_gpu"`
}

func (c *MLTrainingConfig) MarshalJSON() ([]byte, error) {
    return json.Marshal(struct {
        Name        string                 `json:"name"`
        ModelType   string                 `json:"model_type"`
        Parameters  map[string]interface{} `json:"parameters,omitempty"`
        DataPath    string                 `json:"data_path"`
        MaxEpochs   int                    `json:"max_epochs"`
        BatchSize   int                    `json:"batch_size"`
        EnableGPU   bool                   `json:"enable_gpu"`
    }{
        Name:       c.Name,
        ModelType:  c.ModelType,
        Parameters: c.Parameters,
        DataPath:   c.DataPath,
        MaxEpochs:  c.MaxEpochs,
        BatchSize:  c.BatchSize,
        EnableGPU:  c.EnableGPU,
    })
}
