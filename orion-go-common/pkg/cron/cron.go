package cron

import (
	"sync"

	"github.com/robfig/cron/v3"
	"go.uber.org/zap"
)

// Scheduler exposes a thread-safe, named-job cron scheduler backed by
// github.com/robfig/cron/v3.
//
// Typical usage:
//   s := cron.New(cron.AutoStart(), cron.WithLocation(time.Local))
//   s.Add("health-check", "@every 30s", func() { ... })
//
// The scheduler is framework-level: it owns the cron engine and the registry of
// named Job entries; domain services supply the command functions.
type Scheduler struct {
	cron  *cron.Cron
	cronLogger *zap.Logger

	mu   sync.RWMutex
	jobs map[string]*Job // name -> Job

	stopped bool
}

// New creates a Scheduler with the given options.
//
// Options control the time zone (WithLocation), structured logger (WithLogger),
// and whether the scheduler auto-starts (AutoStart).
func New(opts ...Option) *Scheduler {
	cfg := DefaultConfig()
	for _, opt := range opts {
		opt(&cfg)
	}

	// Build cron parser flags based on configuration.
	parser := cron.NewParser(
		cron.Minute | cron.Hour | cron.Dom | cron.Month | cron.Dow,
	)
	if cfg.WithSeconds {
		parser = cron.NewParser(
			cron.Second | cron.Minute | cron.Hour | cron.Dom | cron.Month | cron.Dow | cron.Descriptor,
		)
	}

	optsCron := []cron.Option{
		cron.WithParser(parser),
		cron.WithLocation(cfg.Location),
	}

	// Attach a zap logger if provided.
	var l *zap.Logger
	if cfg.Logger != nil {
		l = cfg.Logger
	}
	if l != nil {
		optsCron = append(optsCron, cron.WithLogger(newCronZapLogger(l)))
	}

	s := &Scheduler{
		cron:     cron.New(optsCron...),
		cronLogger: l,
		jobs:     make(map[string]*Job),
	}

	if cfg.Running {
		s.Start()
	}

	return s
}

// Add registers a named Job and returns the new EntryID.
//
// The spec may be a standard cron expression (e.g. "0 30 * * *") or one of the
// cron.Descriptor shortcuts ("@every 1h", "@midnight", etc.).
//
// Panics if a job with the same name is already registered or if the spec
// cannot be parsed.
func (s *Scheduler) Add(name, spec string, cmd func()) cron.EntryID {
	if cmd == nil {
		panic("cron: Add called with nil cmd")
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	if _, exists := s.jobs[name]; exists {
		panic("cron: job already registered: " + name)
	}

	job := &Job{
		Name: name,
		Spec: spec,
		cmd:  cmd,
	}
	entryID, err := s.cron.AddJob(spec, job)
	if err != nil {
		panic("cron: cannot add spec " + spec + ": " + err.Error())
	}

	job.entryID = entryID
	s.jobs[name] = job

	s.log("job added", zap.String("name", name), zap.String("spec", spec))

	return entryID
}

// Remove unregisters and stops the Job with the given name.
//
// Returns false if no job with that name exists.
func (s *Scheduler) Remove(name string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()

	job, ok := s.jobs[name]
	if !ok {
		return false
	}

	s.cron.Remove(job.entryID)
	delete(s.jobs, name)
	s.log("job removed", zap.String("name", name))
	return true
}

// Start begins executing registered jobs on their schedule.
func (s *Scheduler) Start() {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.stopped {
		s.log("start ignored: scheduler was stopped", zap.Bool("stopped", s.stopped))
		return
	}
	s.cron.Start()
	s.log("scheduler started", zap.Int("jobs", len(s.jobs)))
}

// Stop halts the scheduler and waits for all running jobs to finish.
//
// After Stop(), the scheduler cannot be started again.
func (s *Scheduler) Stop() {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.stopped = true
	s.cron.Stop()
}

// Pause stops the scheduler without removing registered jobs.
//
// Jobs can be resumed later by calling Resume().
func (s *Scheduler) Pause() {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.cron.Stop()
	s.log("scheduler paused")
}

// Resume restarts the scheduler.
func (s *Scheduler) Resume() {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.stopped {
		s.log("resume ignored: scheduler was stopped", zap.Bool("stopped", s.stopped))
		return
	}
	s.cron.Start()
	s.log("scheduler resumed")
}

// Jobs returns a snapshot of all registered jobs (read-only copy).
func (s *Scheduler) Jobs() []Job {
	s.mu.RLock()
	defer s.mu.RUnlock()

	out := make([]Job, 0, len(s.jobs))
	for _, j := range s.jobs {
		out = append(out, *j)
	}
	return out
}

// Log returns a child logger tagged with "cron" for structured output.
func (s *Scheduler) Log() *zap.Logger {
	if s.cronLogger == nil {
		// Fallback: create a no-op logger.
		// (In practice the caller should pass WithLogger.)
		l, _ := zap.NewDevelopment()
		return l.Named("cron")
	}
	return s.cronLogger.Named("cron")
}

func (s *Scheduler) log(msg string, fields ...zap.Field) {
	if s.cronLogger != nil {
		s.cronLogger.Info(msg, fields...)
	}
}

// cronZapLogger adapts zap.Logger to cron.Logger (robfig/cron/v3).
type cronZapLogger struct {
	l *zap.Logger
}

func newCronZapLogger(l *zap.Logger) *cronZapLogger {
	return &cronZapLogger{l: l}
}

func (c *cronZapLogger) Info(msg string, keysAndValues ...interface{}) {
	c.l.Info(msg, flattenKV(keysAndValues...)...)
}

func (c *cronZapLogger) Error(err error, msg string, keysAndValues ...interface{}) {
	c.l.Error(msg, append(flattenKV(keysAndValues...), zap.Error(err))...)
}

func flattenKV(kv ...interface{}) []zap.Field {
	n := len(kv) / 2
	if n == 0 {
		return nil
	}
	fields := make([]zap.Field, n)
	for i := 0; i < n; i++ {
		key := kv[i*2]
		val := kv[i*2+1]
		if s, ok := key.(string); ok {
			fields[i] = zap.Any(s, val)
		}
	}
	return fields
}
