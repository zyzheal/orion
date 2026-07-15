package models

// ConnectRequest is the request body for connecting to a NATS cluster.
type ConnectRequest struct {
	Servers []string                 `json:"servers"`
	Options map[string]interface{}   `json:"options"`
}

// ConnectResult is the response for a successful NATS connection.
type ConnectResult struct {
	Connected bool   `json:"connected"`
	Server    string `json:"server"`
}

// BusStatus represents the health status of the event bus connection.
type BusStatus struct {
	Status      string `json:"status"`
	Server      string `json:"server"`
	ConnectedAt int64  `json:"connectedAt"`
}

// Subscription represents an active event subscription.
type Subscription struct {
	Name     string `json:"name"`
	Topic    string `json:"topic"`
	Consumer string `json:"consumer"`
	Active   int    `json:"active"`
}

// DLQQuery specifies the query parameters for retrieving DLQ messages.
type DLQQuery struct {
	Limit int `json:"limit"`
}

// DLQResponse is the response for a DLQ query.
type DLQResponse struct {
	Total    int           `json:"total"`
	Messages []DLQMessage  `json:"messages"`
}

// DLQMessage represents a single message in the dead letter queue.
type DLQMessage struct {
	EventID       string                 `json:"eventId"`
	Topic         string                 `json:"topic"`
	Payload       map[string]interface{} `json:"payload"`
	FailedAt      int64                  `json:"failedAt"`
	FailureReason string                 `json:"failureReason"`
}

// BusStats represents aggregated event bus statistics.
type BusStats struct {
	TotalEvents     int64 `json:"totalEvents"`
	Published       int64 `json:"published"`
	Subscribers     int   `json:"subscribers"`
	ActiveConsumers int   `json:"activeConsumers"`
	DLQCount        int   `json:"dlqCount"`
}
