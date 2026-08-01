package engine

// ---------------------------------------------------------------------------
// orion-notification-svc-go - Unified Notification Engine
//
// 借鉴 NeatLogic 的 NotifyPolicyHandlerFactory + 工厂模式（42 API + 多渠道 SPI）。
//
// 架构组件：
//
//  1. NotifyHandlerFactory - 渠道发送器工厂（sync.Map + init 注册）
//     对应 NeatLogic 的 NotifyHandlerFactory
//     文件：factory.go
//
//  2. NotifyChannel - 单渠道 SPI 接口
//     对应 NeatLogic 的 INotifyHandler
//     实现：channels/channels.go (Email, Slack, Webhook, DingTalk, WeChat, InApp, SMS)
//
//  3. NotifyPolicyHandler - 策略处理器接口
//     对应 NeatLogic 的 NotifyPolicyHandlerBase
//     文件：policy_factory.go
//
//  4. NotifyPolicyHandlerFactory - 策略处理器工厂（sync.Map + init 注册）
//     对应 NeatLogic 的 NotifyPolicyHandlerFactory（@Component 自动扫描）
//     文件：policy_factory.go
//
//  5. NotifyPolicyExecutor - 策略执行器
//     对应 NeatLogic 的 NotifyPolicyUtil.executeAsync() / AfterTransactionJob
//     文件：policy_factory.go
//
//  6. EngineAdapter - 现有 Service → Engine 的桥接适配器
//     文件：integration.go
//
// 执行链路（与 NeatLogic 完全对应）：
//
//   eventReceived(event)
//     → matchHandler(event.EventType)              [NotifyPolicyHandlerFactory]
//     → handler.Handle(event, policyConfig)         [NotifyPolicyHandler]
//     → NotifyHandlerFactory.Get(channelType)       [NotifyHandlerFactory]
//     → handler.Execute(message)                    [NotifyChannel SPI]
//
// ---------------------------------------------------------------------------
