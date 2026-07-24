// ============================================================
// Collector Runner — 采集任务调度器
// ============================================================
//
// 职责:
//   1. 定时调度采集任务 (CRON)
//   2. 并发控制 (semaphore)
//   3. 结果收集与入库
//   4. 错误重试与告警
//
// 设计参考:
//   - NeatLogic 采集调度 (定时任务 + 中间件)
//   - go-cron (cron 表达式)
package collector

import (
	"context"
	"log/slog"
	"sync"
	"sync/atomic"
)

// ============================================================
// Runner 配置
// ============================================================

// RunnerConfig 采集器运行配置
type RunnerConfig struct {
	MaxParallel  int  `yaml:"max_parallel"`  // 最大并发数
	Timeout      int  `yaml:"timeout"`        // 采集超时 (秒)
	Retries      int  `yaml:"retries"`        // 重试次数
	RetryDelay   int  `yaml:"retry_delay"`    // 重试间隔 (秒)
	BatchSize    int  `yaml:"batch_size"`     // 批量入库大小
	DedupKey     string `yaml:"dedup_key"`    // 去重字段
	LogLevel     string `yaml:"log_level"`    // 日志级别
}

// DefaultRunnerConfig 默认配置
func DefaultRunnerConfig() *RunnerConfig {
	return &RunnerConfig{
		MaxParallel:  10,
		Timeout:      30,
		Retries:      3,
		RetryDelay:   2,
		BatchSize:    100,
		DedupKey:     "attributes.vendor",
		LogLevel:     "info",
	}
}

// ============================================================
// Runner 运行器
// ============================================================

// Runner 采集任务运行器
type Runner struct {
	cfg       *RunnerConfig
	sem       chan struct{}       // 并发控制
	results   atomic.Value        // 存储 [CollectionResult]
	mu        sync.RWMutex
	taskQueue chan TaskItem       // 任务队列
	done      chan struct{}       // 停止信号
}

// TaskItem 任务队列项
type TaskItem struct {
	ID     string
	Collector string
	Config map[string]any
	TenantID string
}

// NewRunner 创建采集运行器
func NewRunner(cfg *RunnerConfig) *Runner {
	if cfg == nil {
		cfg = DefaultRunnerConfig()
	}

	runner := &Runner{
		cfg:       cfg,
		sem:       make(chan struct{}, cfg.MaxParallel),
		taskQueue: make(chan TaskItem, 1000),
		done:      make(chan struct{}),
	}

	// 初始化结果存储
	runner.results.Store(make([]map[string]any, 0))

	return runner
}

// Start 启动采集器
func (r *Runner) Start(ctx context.Context) {
	slog.Info("collector runner started", "max_parallel", r.cfg.MaxParallel)

	// 启动 worker
	for i := 0; i < r.cfg.MaxParallel; i++ {
		go r.worker(ctx, i)
	}

	// 启动调度器 (简化版，实际应使用 cron)
	// TODO: 集成 go-cron
	go r.scheduler(ctx)
}

// Stop 停止采集器
func (r *Runner) Stop() {
	close(r.done)
	slog.Info("collector runner stopped")
}

// Submit 提交采集任务
func (r *Runner) Submit(item TaskItem) {
	select {
	case r.taskQueue <- item:
		slog.Debug("task submitted", "id", item.ID, "collector", item.Collector)
	default:
		slog.Warn("task queue full, dropping task", "id", item.ID)
	}
}

// SubmitBatch 批量提交任务
func (r *Runner) SubmitBatch(items []TaskItem) {
	for _, item := range items {
		r.Submit(item)
	}
}

// worker 工作协程
func (r *Runner) worker(ctx context.Context, workerID int) {
	slog.Debug("worker started", "worker_id", workerID)

	for {
		select {
		case <-r.done:
			slog.Debug("worker stopped", "worker_id", workerID)
			return
		case item, ok := <-r.taskQueue:
			if !ok {
				return
			}
			r.execute(ctx, item, workerID)
		}
	}
}

// execute 执行单个采集任务
func (r *Runner) execute(ctx context.Context, item TaskItem, workerID int) {
	// 获取采集器
	collector, ok := GlobalFactory.Get(item.Collector)
	if !ok {
		slog.Error("collector not found", "name", item.Collector)
		return
	}

	// 获取信号量
	r.sem <- struct{}{}
	defer func() { <-r.sem }()

	slog.Info("execute task", "id", item.ID, "collector", item.Collector, "worker", workerID)

	// 重试逻辑
	var lastErr error
	for attempt := 0; attempt <= r.cfg.Retries; attempt++ {
		if attempt > 0 {
			slog.Info("retry", "task_id", item.ID, "attempt", attempt)
			// TODO: 实现重试等待
		}

		// 执行采集
		cis, err := collector.Collect(ctx, item.Config)
		if err == nil {
			// 存储结果
			result := map[string]any{
				"task_id":   item.ID,
				"collector": item.Collector,
				"ci_count":  len(cis),
				"status":    "success",
				"raw_ci":    cis,
			}
			r.storeResult(result)
			slog.Info("task complete", "id", item.ID, "ci_count", len(cis))
			return
		}

		lastErr = err
	}

	// 所有重试失败
	result := map[string]any{
		"task_id":   item.ID,
		"collector": item.Collector,
		"status":    "failed",
		"error":     lastErr.Error(),
	}
	r.storeResult(result)
	slog.Error("task failed", "id", item.ID, "error", lastErr)
}

// storeResult 存储结果
func (r *Runner) storeResult(result map[string]any) {
	r.mu.Lock()
	defer r.mu.Unlock()

	current := r.results.Load().([]map[string]any)
	r.results.Store(append(current, result))
}

// GetResults 获取所有结果
func (r *Runner) GetResults() []map[string]any {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.results.Load().([]map[string]any)
}

// scheduler 调度器 (简化版)
//
// TODO: 集成 go-cron 实现 CRON 表达式调度
func (r *Runner) scheduler(ctx context.Context) {
	// 当前为占位实现
	// 生产环境应使用: github.com/robfig/cron/v3
	<-r.done
}

// Stats 返回运行统计
func (r *Runner) Stats() map[string]any {
	results := r.GetResults()
	successCount := 0
	failedCount := 0
	totalCI := 0

	for _, result := range results {
		status := result["status"].(string)
		if status == "success" {
			successCount++
			totalCI += result["ci_count"].(int)
		} else {
			failedCount++
		}
	}

	return map[string]any{
		"total_tasks":  len(results),
		"success":      successCount,
		"failed":       failedCount,
		"total_ci":     totalCI,
		"active_workers": len(r.sem),
	}
}
