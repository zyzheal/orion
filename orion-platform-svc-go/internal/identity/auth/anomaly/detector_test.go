package anomaly

import (
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

// fixedTime returns a time.Time fixed at 2024-01-15 10:00:00 UTC.
var fixedTime = time.Date(2024, 1, 15, 10, 0, 0, 0, time.UTC)

func TestRecordLogin_Basic(t *testing.T) {
	d := NewDetector(func() time.Time { return fixedTime })
	d.RecordLogin("t1", "user1", "Mozilla/5.0", "10.0.0.1", true, fixedTime)
	reports := d.DetectAnomalies("t1", "user1", time.Hour)
	// Fresh login within window, no anomalies expected
	for _, r := range reports {
		assert.NotEqual(t, TypeRapidFail, r.Type)
		assert.NotEqual(t, TypeOffHours, r.Type)
	}
}

func TestDetectAnomalies_NewDevice(t *testing.T) {
	d := NewDetector(func() time.Time { return fixedTime })
	// Record a login 31 days ago (outside 30-day window)
	olds := fixedTime.Add(-31 * 24 * time.Hour)
	d.RecordLogin("t1", "user1", "OldDevice", "10.0.0.1", true, olds)
	// Record a recent login with a NEW device
	d.RecordLogin("t1", "user1", "NewDevice", "10.0.0.1", true, fixedTime)

	reports := d.DetectAnomalies("t1", "user1", 31*24*time.Hour)
	var found string
	for _, r := range reports {
		if r.Type == TypeNewDevice {
			found = r.Detail
		}
	}
	assert.Contains(t, found, "OldDevice")
}

func TestDetectAnomalies_NoNewDeviceIfRecent(t *testing.T) {
	d := NewDetector(func() time.Time { return fixedTime })
	d.RecordLogin("t1", "user1", "KnownDevice", "10.0.0.1", true, fixedTime.Add(-1*time.Hour))

	reports := d.DetectAnomalies("t1", "user1", 2*time.Hour)
	for _, r := range reports {
		assert.NotEqual(t, TypeNewDevice, r.Type)
	}
}

func TestDetectAnomalies_RapidFailure(t *testing.T) {
	d := NewDetector(func() time.Time { return fixedTime })
	base := fixedTime.Add(-4 * time.Minute)
	for i := 0; i < 4; i++ {
		d.RecordLogin("t1", "user1", "Browser", "10.0.0.1", false, base.Add(time.Duration(i)*time.Minute))
	}

	reports := d.DetectAnomalies("t1", "user1", 10*time.Minute)
	var found bool
	for _, r := range reports {
		if r.Type == TypeRapidFail {
			found = true
		}
	}
	assert.True(t, found, "expected rapid_failure anomaly")
}

func TestDetectAnomalies_NoRapidFailureIfFarApart(t *testing.T) {
	d := NewDetector(func() time.Time { return fixedTime })
	// 2 failures, 6 minutes apart (outside 5-min window)
	d.RecordLogin("t1", "user1", "Browser", "10.0.0.1", false, fixedTime.Add(-6*time.Minute))
	d.RecordLogin("t1", "user1", "Browser", "10.0.0.1", false, fixedTime.Add(-1*time.Minute))

	reports := d.DetectAnomalies("t1", "user1", 10*time.Minute)
	for _, r := range reports {
		assert.NotEqual(t, TypeRapidFail, r.Type)
	}
}

func TestDetectAnomalies_OffHours(t *testing.T) {
	d := NewDetector(func() time.Time { return fixedTime })
	// Login at 03:00 UTC (inside off-hours window 02:00-05:00)
	offTime := time.Date(2024, 1, 15, 3, 0, 0, 0, time.UTC)
	d.RecordLogin("t1", "user1", "Browser", "10.0.0.1", true, offTime)
	// Move now forward so cutoff includes offTime
	d = NewDetector(func() time.Time { return time.Date(2024, 1, 15, 10, 0, 0, 0, time.UTC) })
	d.RecordLogin("t1", "user1", "Browser", "10.0.0.1", true, offTime)

	reports := d.DetectAnomalies("t1", "user1", 24*time.Hour)
	var found bool
	for _, r := range reports {
		if r.Type == TypeOffHours {
			found = true
		}
	}
	assert.True(t, found, "expected off_hours anomaly")
}

func TestDetectAnomalies_NoOffHoursIfBusinessHours(t *testing.T) {
	d := NewDetector(func() time.Time { return fixedTime })
	d.RecordLogin("t1", "user1", "Browser", "10.0.0.1", true, fixedTime)

	reports := d.DetectAnomalies("t1", "user1", 2*time.Hour)
	for _, r := range reports {
		assert.NotEqual(t, TypeOffHours, r.Type)
	}
}

func TestDetectAnomalies_NormalLogin(t *testing.T) {
	d := NewDetector(func() time.Time { return fixedTime })
	d.RecordLogin("t1", "user1", "KnownBrowser", "10.0.0.1", true, fixedTime.Add(-30*time.Minute))

	reports := d.DetectAnomalies("t1", "user1", 1*time.Hour)
	assert.Empty(t, reports)
}

func TestDetectAnomalies_EmptyTenant(t *testing.T) {
	d := NewDetector(func() time.Time { return fixedTime })
	reports := d.DetectAnomalies("t1", "nobody", 1*time.Hour)
	assert.Empty(t, reports)
}

func TestDetectAnomalies_WrongTenant(t *testing.T) {
	d := NewDetector(func() time.Time { return fixedTime })
	d.RecordLogin("tenant-1", "user1", "Browser", "10.0.0.1", true, fixedTime.Add(-30*time.Minute))

	reports := d.DetectAnomalies("tenant-2", "user1", 1*time.Hour)
	assert.Empty(t, reports)
}

func TestDetectAnomalies_MultipleTypes(t *testing.T) {
	d := NewDetector(func() time.Time { return time.Date(2024, 1, 15, 10, 10, 0, 0, time.UTC) })
	// old device (31d ago) + 3 failures (rapid) + off-hours login
	d.RecordLogin("t1", "u1", "OldUA", "10.0.0.1", true, time.Date(2023, 12, 15, 10, 0, 0, 0, time.UTC))
	d.RecordLogin("t1", "u1", "NewUA", "10.0.0.1", true, time.Date(2024, 1, 15, 10, 5, 0, 0, time.UTC))
	d.RecordLogin("t1", "u1", "NewUA", "10.0.0.1", true, time.Date(2024, 1, 15, 3, 0, 0, 0, time.UTC)) // off-hours
	for i := 0; i < 3; i++ {
		d.RecordLogin("t1", "u1", "NewUA", "10.0.0.1", false, time.Date(2024, 1, 15, 10, 6+i, 0, 0, time.UTC))
	}

	types := make(map[string]bool)
	reports := d.DetectAnomalies("t1", "u1", 32*24*time.Hour)
	for _, r := range reports {
		types[r.Type] = true
	}
	assert.True(t, types[TypeNewDevice], "expected new_device")
	assert.True(t, types[TypeRapidFail], "expected rapid_failure")
}

func TestDetectAnomalies_ConcurrentAccess(t *testing.T) {
	d := NewDetector(func() time.Time { return fixedTime })
	var wg sync.WaitGroup
	for i := 0; i < 50; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			d.RecordLogin("t1", "user1", "Browser", "10.0.0.1", true, fixedTime)
		}(i)
	}
	wg.Wait()
	// Single-threaded read after writes complete
	reports := d.DetectAnomalies("t1", "user1", 1*time.Hour)
	assert.Empty(t, reports)
}

func TestDetectAnomalies_NoAnomalies(t *testing.T) {
	d := NewDetector(func() time.Time { return fixedTime })
	d.RecordLogin("t1", "u1", "Known", "10.0.0.1", true, fixedTime.Add(-1*time.Hour))
	reports := d.DetectAnomalies("t1", "u1", 2*time.Hour)
	assert.Empty(t, reports)
}
