package cisco

// Package cisco provides the cisco collector adapter.
type Collector struct{}

func (c *Collector) Name() string { return "cisco" }
func (c *Collector) Type() string { return "network" }
func (c *Collector) Discover(ctx interface{}, target interface{}) ([]interface{}, error) { return nil, nil }
func (c *Collector) Collect(ctx interface{}, device interface{}) (interface{}, error) { return nil, nil }
func (c *Collector) HealthCheck(ctx interface{}, target interface{}) error { return nil }
func (c *Collector) ConfigSchema() map[string]interface{} { return nil }
