package handlers

import (
	"fmt"
	"net"
)

// ipValueHandler handles IPv4/IPv6 address attribute values.
type ipValueHandler struct{}

func (h ipValueHandler) Type() string { return "ip" }

func (h ipValueHandler) Validate(value string) error {
	if value == "" {
		return fmt.Errorf("ip address is required")
	}
	ip := net.ParseIP(value)
	if ip == nil {
		return fmt.Errorf("invalid IP address: %q", value)
	}
	return nil
}

func (h ipValueHandler) Parse(value string) (interface{}, error) {
	if value == "" {
		return nil, nil
	}
	ip := net.ParseIP(value)
	if ip == nil {
		return nil, fmt.Errorf("invalid IP address: %q", value)
	}
	return ip, nil
}

func (h ipValueHandler) Serialize(v interface{}) string {
	switch t := v.(type) {
	case net.IP:
		return t.String()
	case string:
		return t
	default:
		return fmt.Sprintf("%v", v)
	}
}

func (h ipValueHandler) Compare(a, b string) int {
	ipa, _ := h.Parse(a)
	ipb, _ := h.Parse(b)
	aIP, _ := ipa.(net.IP)
	bIP, _ := ipb.(net.IP)
	if aIP == nil && bIP == nil {
		return 0
	}
	if aIP == nil {
		return -1
	}
	if bIP == nil {
		return 1
	}
	if aIP.Equal(bIP) {
		return 0
	}
	// Compare by 16-byte representation
	if a16 := aIP.To16(); a16 != nil {
		if b16 := bIP.To16(); b16 != nil {
			for i := 0; i < 16; i++ {
				if a16[i] < b16[i] {
					return -1
				}
				if a16[i] > b16[i] {
					return 1
				}
			}
		}
	}
	return -1
}
