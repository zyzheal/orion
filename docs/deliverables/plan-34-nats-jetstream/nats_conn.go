// ============================================================
// Plan 34 — NATS JetStream 消息队列接入
// ============================================================
// 优先级: P1
// 来源: 全量代码扫描发现 — NATS 依赖已安装但未使用
// 本地证据:
//   - go.mod: github.com/nats-io/nats.go v1.52.0 (已安装)
//   - internal/eventbus/service/eventbus_service.go (284行): 使用内存 busConn
//   - internal/eventbus/service/conn.go (248行): newBusConn() — 纯内存 pub/sub
//   - grep -r "nats.Connect" internal/ → 空 (NATS 未被调用)
// 技术约束: Go, nats.go v1.52.0, JetStream
// 合并 Plan-24: SchemaRegistry 部分合并到 plan-43-schema-registry
// ============================================================

package service

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/nats-io/nats.go"
	"github.com/nats-io/nats.go/jetstream"
)

// --- Config ---

type NATSConfig struct {
	// NATS 服务器地址 (nats://localhost:4222)
	URL string
	// JetStream Stream 名称前缀
	StreamPrefix string
	// MaxWait 等待 JetStream 操作超时
	MaxWait time.Duration
	// MaxReconnect 重连次数
	MaxReconnect int
	// ReconnectWait 重连等待时间
	ReconnectWait time.Duration
}

func DefaultNATSConfig() NATSConfig {
	return NATSConfig{
		URL:          "nats://127.0.0.1:4222",
		StreamPrefix: "orion",
		MaxWait:      10 * time.Second,
		MaxReconnect: 60,
		ReconnectWait: 2 * time.Second,
	}
}

// --- NATS Bus Connection ---

// natsBusConn 实现 busConn 接口，替换内存版
type natsBusConn struct {
	nc  *nats.Conn
	js  jetstream.JetStream
	cfg NATSConfig

	// 订阅管理
	mu          sync.RWMutex
	subscriptions map[string][]*nats.Subscription

	// 回调注册
	callbacks map[string][]func([]byte)

	closed bool
}

// NewNATSBusConn 创建 NATS 总线连接
func NewNATSBusConn(cfg NATSConfig) (*natsBusConn, error) {
	nc, err := nats.Connect(
		cfg.URL,
		nats.MaxReconnects(cfg.MaxReconnect),
		nats.ReconnectWait(cfg.ReconnectWait),
		nats.DisconnectErrHandler(func(_ *nats.Conn, err error) {
			fmt.Printf("[eventbus] NATS disconnected: %v\n", err)
		}),
		nats.ReconnectHandler(func(c *nats.Conn) {
			fmt.Printf("[eventbus] NATS reconnected to %s\n", c.ConnectedUrl())
		}),
		nats.ClosedHandler(func(c *nats.Conn) {
			fmt.Printf("[eventbus] NATS connection closed: %v\n", c.LastError())
		}),
	)
	if err != nil {
		return nil, fmt.Errorf("nats connect: %w", err)
	}

	// 创建 JetStream 上下文
	js, err := jetstream.New(nc)
	if err != nil {
		nc.Close()
		return nil, fmt.Errorf("jetstream new: %w", err)
	}

	bus := &natsBusConn{
		nc:            nc,
		js:            js,
		cfg:           cfg,
		subscriptions: make(map[string][]*nats.Subscription),
		callbacks:     make(map[string][]func([]byte)),
	}

	return bus, nil
}

// --- busConn 接口实现 ---

// Publish 发布事件到 NATS
func (b *natsBusConn) Publish(ctx context.Context, subject string, data []byte) error {
	if b.closed {
		return fmt.Errorf("bus connection closed")
	}

	// 确保 Stream 存在
	streamName := b.streamName(subject)
	if err := b.ensureStream(ctx, streamName, subject); err != nil {
		return fmt.Errorf("ensure stream: %w", err)
	}

	// 发布到 JetStream (持久化)
	_, err := b.js.Publish(ctx, subject, data)
	if err != nil {
		return fmt.Errorf("jetstream publish: %w", err)
	}

	// 同时发布到 Core NATS (用于实时订阅者)
	if err := b.nc.Publish(subject, data); err != nil {
		// Core 发布失败不影响 JetStream (仅日志)
		fmt.Printf("[eventbus] core publish warning: %v\n", err)
	}

	return nil
}

// Subscribe 订阅事件
func (b *natsBusConn) Subscribe(subject string, handler func([]byte)) error {
	if b.closed {
		return fmt.Errorf("bus connection closed")
	}

	b.mu.Lock()
	defer b.mu.Unlock()

	// Core NATS 订阅 (实时)
	sub, err := b.nc.Subscribe(subject, func(msg *nats.Msg) {
		handler(msg.Data)
	})
	if err != nil {
		return fmt.Errorf("nats subscribe: %w", err)
	}

	b.subscriptions[subject] = append(b.subscriptions[subject], sub)
	b.callbacks[subject] = append(b.callbacks[subject], handler)

	return nil
}

// SubscribeQueue 加入队列组 (竞争消费)
func (b *natsBusConn) SubscribeQueue(subject, queue string, handler func([]byte)) error {
	if b.closed {
		return fmt.Errorf("bus connection closed")
	}

	sub, err := b.nc.QueueSubscribe(subject, queue, func(msg *nats.Msg) {
		handler(msg.Data)
	})
	if err != nil {
		return fmt.Errorf("nats queue subscribe: %w", err)
	}

	b.mu.Lock()
	defer b.mu.Unlock()
	b.subscriptions[subject] = append(b.subscriptions[subject], sub)
	return nil
}

// SubscribeDurable 创建 JetStream 持久化消费者
func (b *natsBusConn) SubscribeDurable(ctx context.Context, consumerName, subject string, handler func([]byte)) error {
	streamName := b.streamName(subject)
	if err := b.ensureStream(ctx, streamName, subject); err != nil {
		return err
	}

	// 创建或获取持久化消费者
	cons, err := b.js.CreateOrUpdateConsumer(ctx, streamName, jetstream.ConsumerConfig{
		DurableName:   consumerName,
		FilterSubject: subject,
		AckPolicy:     jetstream.AckExplicitPolicy,
		MaxDeliver:    3,
	})
	if err != nil {
		return fmt.Errorf("create consumer: %w", err)
	}

	// 开始消费
	go func() {
		ctx, cancel := context.WithCancel(ctx)
		defer cancel()

		for !b.closed {
			msgs, err := cons.FetchNoWait(10)
			if err != nil {
				if err == jetstream.ErrNoMessages {
					time.Sleep(100 * time.Millisecond)
					continue
				}
				fmt.Printf("[eventbus] fetch error: %v\n", err)
				time.Sleep(time.Second)
				continue
			}

			for msg := range msgs.Messages() {
				handler(msg.Data())
				_ = msg.Ack()
			}
		}
	}()

	return nil
}

// Close 关闭连接
func (b *natsBusConn) Close() error {
	b.mu.Lock()
	defer b.mu.Unlock()

	b.closed = true

	// 取消所有订阅
	for subject, subs := range b.subscriptions {
		for _, sub := range subs {
			_ = sub.Unsubscribe()
		}
		delete(b.subscriptions, subject)
	}

	// 关闭 NATS 连接
	b.nc.Close()
	return nil
}

// --- Helper Methods ---

// streamName 从 subject 生成 Stream 名称
// 例: "orion.alert.created" → "ORION_ALERT"
func (b *natsBusConn) streamName(subject string) string {
	prefix := b.cfg.StreamPrefix
	// 提取 subject 的第一段作为 stream 名称
	// orion.alert.created → ORION_ALERT
	// orion.pipeline.* → ORION_PIPELINE
	var domain string
	for i, c := range subject {
		if c == '.' {
			domain = subject[:i]
			break
		}
	}
	if domain == "" {
		domain = subject
	}

	return fmt.Sprintf("%s_%s", prefix, domain)
}

// ensureStream 确保 JetStream Stream 存在
func (b *natsBusConn) ensureStream(ctx context.Context, name, subject string) error {
	// 尝试获取 Stream
	_, err := b.js.Stream(ctx, name)
	if err == nil {
		return nil // Stream 已存在
	}

	// 创建 Stream
	_, err = b.js.CreateStream(ctx, jetstream.StreamConfig{
		Name:      name,
		Subjects:  []string{subject, subject + ".>"},
		Retention: jetstream.LimitsPolicy,
		MaxMsgs:   100000,
		MaxAge:    72 * time.Hour,
		Storage:   jetstream.FileStorage,
	})
	if err != nil {
		return fmt.Errorf("create stream %s: %w", name, err)
	}

	return nil
}

// PublishJSON 发布 JSON 事件
func (b *natsBusConn) PublishJSON(ctx context.Context, subject string, event any) error {
	data, err := json.Marshal(event)
	if err != nil {
		return fmt.Errorf("marshal event: %w", err)
	}
	return b.Publish(ctx, subject, data)
}

// --- Health Check ---

// Health 检查 NATS 连接健康状态
func (b *natsBusConn) Health() error {
	if b.closed {
		return fmt.Errorf("bus connection closed")
	}
	if !b.nc.IsConnected() {
		return fmt.Errorf("nats not connected")
	}
	return nil
}

// Stats 获取连接统计
func (b *natsBusConn) Stats() map[string]any {
	b.mu.RLock()
	defer b.mu.RUnlock()

	subCount := 0
	for _, subs := range b.subscriptions {
		subCount += len(subs)
	}

	return map[string]any{
		"connected":        b.nc.IsConnected(),
		"url":              b.nc.ConnectedUrl(),
		"subscriptions":    subCount,
		"subjects":         len(b.subscriptions),
		"jetstream":        b.js != nil,
		"stream_prefix":    b.cfg.StreamPrefix,
	}
}
