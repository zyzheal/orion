package service

import "testing"

func Test_StableBucket_Deterministic(t *testing.T) {
	if stableBucket("user-1") != stableBucket("user-1") {
		t.Fatal("bucket must be deterministic for same caller")
	}
	if stableBucket("user-1") == stableBucket("user-2") {
		// unlikely but not guaranteed; just warn
		t.Log("note: user-1 and user-2 share a bucket")
	}
	for i := 0; i < 100; i++ {
		b := stableBucket("caller")
		if b < 0 || b >= 100 {
			t.Errorf("bucket %d out of range", b)
		}
	}
}

func Test_InCanaryBucket(t *testing.T) {
	if !inCanaryBucket("any", 100) {
		t.Fatal("100% traffic should always hit canary")
	}
	if inCanaryBucket("any", 0) {
		t.Fatal("0% traffic should never hit canary")
	}
	if inCanaryBucket("", 50) {
		t.Fatal("empty caller should not hit canary")
	}
	// 50% traffic should route roughly half of callers
	hits := 0
	for i := 0; i < 1000; i++ {
		if inCanaryBucket("u"+string(rune(i)), 50) {
			hits++
		}
	}
	// broad tolerance: 50% ± 15%
	if hits < 350 || hits > 650 {
		t.Fatalf("50pct traffic routed %d/1000, want ~500", hits)
	}
}

func Test_Fnv32a_Consistency(t *testing.T) {
	a := fnv32a("hello")
	b := fnv32a("hello")
	if a != b {
		t.Fatal("fnv32a should be deterministic")
	}
	if fnv32a("hello") == fnv32a("world") {
		t.Log("note: hash collision (rare, not an error)")
	}
}

func Test_InCanaryBucket_TrafficThreshold(t *testing.T) {
	// 30% should hit strictly less than 100% would
	for _, id := range []string{"alpha", "beta", "gamma"} {
		if inCanaryBucket(id, 30) {
			if !inCanaryBucket(id, 100) {
				t.Error("should be monotonic: 30pct hit => 100pct hit for " + id)
			}
		}
	}
}