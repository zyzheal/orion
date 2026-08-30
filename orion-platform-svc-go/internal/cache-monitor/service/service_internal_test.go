package service

import (
	"testing"
)

func TestParseRedisInfo_BasicFields(t *testing.T) {
	info := `# Server
redis_version:7.2.4
redis_mode:standalone
os:Linux 4.14.0
# Clients
connected_clients:5
block_clients:0
total_connections_received:100
instantaneous_ops_per_sec:50
# Memory
used_memory:1048576
used_memory_rss:2097152
used_memory_peak:4194304
maxmemory:536870912
maxmemory_policy:allkeys-lru
# Stats
keyspace_hits:1000
keyspace_misses:100
evicted_keys:50
expired_keys:200
instantaneous_ops_per_sec:50
# Keyspace
db0:keys=50000,expires=100,expires_evicted=10
db1:keys=1000,expires=10,expires_evicted=2
`

	result := parseRedisInfo(info)

	tests := []struct {
		key    string
		expect int64
	}{
		{"connected_clients", 5},
		{"total_connections_received", 100},
		{"used_memory", 1048576},
		{"used_memory_rss", 2097152},
		{"maxmemory", 536870912},
		{"keyspace_hits", 1000},
		{"keyspace_misses", 100},
		{"evicted_keys", 50},
		{"expired_keys", 200},
		{"keys", 51000},         // db0(50000) + db1(1000) accumulated
		{"expires", 110},        // db0(100) + db1(10) accumulated
		{"expires_evicted", 12}, // db0(10) + db1(2) accumulated
	}

	for _, tc := range tests {
		got, ok := result[tc.key]
		if !ok {
			t.Errorf("expected key %q to exist in parsed info", tc.key)
			continue
		}
		if got != tc.expect {
			t.Errorf("parseRedisInfo(%q) = %d, want %d", tc.key, got, tc.expect)
		}
	}
}

func TestParseRedisInfo_EmptyInput(t *testing.T) {
	result := parseRedisInfo("")
	if len(result) != 0 {
		t.Errorf("expected empty map for empty input, got %d entries", len(result))
	}
}

func TestParseRedisInfo_SectionHeadersIgnored(t *testing.T) {
	info := `# Server
redis_version:7.2.4
# Clients
connected_clients:5
`
	result := parseRedisInfo(info)
	// Section headers should not appear as keys
	if _, ok := result["Server"]; ok {
		t.Error("section header 'Server' should not be in result")
	}
	if _, ok := result["Clients"]; ok {
		t.Error("section header 'Clients' should not be in result")
	}
	// But the actual numeric values should be present
	if result["connected_clients"] != 5 {
		t.Errorf("expected connected_clients=5, got %d", result["connected_clients"])
	}
	// Non-numeric values (like redis_version:7.2.4) should not be stored
	if _, ok := result["redis_version"]; ok {
		t.Error("non-numeric redis_version should not be in result")
	}
}

func TestParseRedisInfo_CommaSeparatedValues(t *testing.T) {
	info := `db0:keys=50000,expires=100,expires_evicted=10
db1:keys=1000,expires=10,expires_evicted=2
`
	result := parseRedisInfo(info)
	// Values accumulate across db entries
	if result["keys"] != 51000 {
		t.Errorf("expected keys=51000 (50000+1000), got %d", result["keys"])
	}
	if result["expires"] != 110 {
		t.Errorf("expected expires=110 (100+10), got %d", result["expires"])
	}
	if result["expires_evicted"] != 12 {
		t.Errorf("expected expires_evicted=12 (10+2), got %d", result["expires_evicted"])
	}
}

func TestParseRedisInfo_NonNumericValuesSkipped(t *testing.T) {
	info := `redis_mode:standalone
os:Linux 4.14.0
tcp_port:6379
`
	result := parseRedisInfo(info)
	// Non-numeric values should be skipped
	if _, ok := result["redis_mode"]; ok {
		t.Error("non-numeric 'standalone' should not be in result")
	}
	if _, ok := result["os"]; ok {
		t.Error("non-numeric 'Linux 4.14.0' should not be in result")
	}
	// Numeric values should still be present
	if result["tcp_port"] != 6379 {
		t.Errorf("expected tcp_port=6379, got %d", result["tcp_port"])
	}
}

func TestParseInt64(t *testing.T) {
	m := map[string]int64{"a": 42, "b": -1}
	if got := parseInt64(m, "a"); got != 42 {
		t.Errorf("parseInt64 a = %d, want 42", got)
	}
	if got := parseInt64(m, "b"); got != -1 {
		t.Errorf("parseInt64 b = %d, want -1", got)
	}
	if got := parseInt64(m, "missing"); got != 0 {
		t.Errorf("parseInt64 missing = %d, want 0", got)
	}
}
