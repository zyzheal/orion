# JWT 并发刷新保护设计方案

## 1. 概述

本方案设计用于解决 Orion 平台 JWT Refresh Token 存在的并发刷新竞态条件安全问题。通过设备指纹绑定、并发检测、异常告警等多层防护机制，确保 Token 刷新过程的安全性。

---

## 2. 核心安全机制

### 2.1 Refresh Token 设备指纹绑定

**绑定策略**：
- 在用户登录生成 Refresh Token 时，采集客户端设备特征
- 指纹组成：`Fingerprint = SHA256(User-Agent + Client-IP + Salt)`
- 指纹存储于 Redis，与 Refresh Token 关联
- 每次刷新请求需校验指纹一致性

**校验流程**：
1. 提取请求头 `User-Agent` 和真实客户端 IP（经代理时取 `X-Forwarded-For` 首个 IP）
2. 计算请求指纹
3. 与 Redis 中存储的指纹比对
4. 不一致 → 拒绝刷新并触发安全告警

---

### 2.2 并发刷新检测（Lua 原子操作）

**检测原理**：
- 利用 Redis Lua 脚本的原子性，确保同一 Refresh Token 的并发刷新请求可被精确捕获
- 为每个 Refresh Token 维护一个「刷新锁」和「刷新计数器」

**数据结构**：
```
Key 命名规范：
- 刷新锁：rt:lock:{refresh_token_hash}     TTL: 3 秒
- 刷新计数：rt:counter:{refresh_token_hash}  TTL: 3 秒
```

**检测逻辑**：
1. 收到刷新请求时，尝试获取刷新锁（Lua 原子操作）
2. 若锁已存在且为同一请求 → 正常续期
3. 若锁已存在但为不同请求 → 检测到并发刷新攻击
4. 锁释放后，检查刷新计数：
   - 计数 > 1 → 竞态条件触发 → 吊销该 Refresh Token 及所有关联会话

---

### 2.3 竞态条件处理

**触发条件**：
- 同一 Refresh Token 在 3 秒窗口内收到 ≥2 次独立刷新请求

**处置动作**：
1. 立即吊销该 Refresh Token
2. 吊销该用户所有活跃会话（Access Token + Refresh Token）
3. 记录安全事件日志
4. 向用户发送「账户异常」通知
5. 可选：临时冻结账户（需二次验证解锁）

---

### 2.4 Access Token 有效期调整

| Token 类型 | 原有效期 | 新有效期 | 说明 |
|------------|----------|----------|------|
| Access Token | 15 分钟 | **5 分钟** | 缩短攻击窗口 |
| Refresh Token | 7 天 | 7 天（不变） | 配合指纹绑定 |

**配套措施**：
- Access Token 加入 `iat`（签发时间）和 `exp`（过期时间）声明
- 前端需在 Token 过期前自动刷新（建议剩余 30 秒时触发）

---

### 2.5 异常登录告警

**检测场景**：
1. **异地同时登录**：同一账户在 5 分钟内从不同地理位置（基于 IP GeoIP）成功登录
2. **设备指纹突变**：Refresh Token 刷新时指纹不匹配
3. **高频刷新**：单设备 1 分钟内刷新 ≥10 次

**告警动作**：
- 记录安全审计日志
- 推送实时告警至安全监控平台
- 发送邮件/短信通知用户
- 可选：自动冻结可疑会话

---

### 2.6 会话管理

**设备数量限制**：
- 单用户最多同时活跃 **5 个设备**
- 新设备登录时，若已达上限 → 提示用户选择踢出旧设备

**主动踢出功能**：
- 用户可在「安全设置」中查看所有活跃设备列表
- 支持按设备逐个踢出或「踢出所有其他设备」
- 踢出操作 → 删除对应 Refresh Token → 使关联 Access Token 失效

**会话数据结构**：
```
Key: session:{user_id}:{device_id}
Value: { refresh_token_hash, fingerprint, ip, location, last_active }
TTL: 7 天（随刷新续期）
```

---

## 3. 时序图

### 3.1 Token 刷新正常流程

```mermaid
sequenceDiagram
    participant C as 客户端
    participant A as API 网关
    participant R as Redis( Lua)
    participant J as JWT 服务
    participant D as 数据库

    C->>A: POST /auth/refresh (RefreshToken, User-Agent)
    A->>A: 提取 Client-IP
    A->>R: 计算指纹 F = SHA256(UA + IP + Salt)
    A->>R: Lua 原子操作：获取刷新锁
    
    alt 锁已存在 (并发中)
        R-->>A: 锁存在，返回请求 ID
        A->>A: 比对请求 ID
        
        alt 同一请求
            A->>A: 续期锁 TTL
            A->>J: 刷新 Token
        else 不同请求 (竞态攻击)
            A->>A: 触发竞态保护
            A->>R: 删除 Refresh Token
            A->>C: 403 Forbidden (并发刷新检测)
            Note over A,D: 吊销所有会话并告警
        end
    else 无锁 (正常刷新)
        R->>R: 设置锁 (TTL=3s)
        R->>R: 刷新计数 +1
        A->>J: 校验指纹一致性
        
        alt 指纹匹配
            J->>J: 生成新 Access Token
            J->>J: 生成新 Refresh Token
            J->>R: 更新指纹绑定
            J-->>C: 返回新 Token 对
        else 指纹不匹配
            J-->>C: 401 Unauthorized (设备指纹异常)
            Note over J,D: 记录安全告警
        end
    end
```

---

### 3.2 竞态条件检测流程

```mermaid
flowchart TD
    Start([收到刷新请求]) --> CalcFingerprint[计算设备指纹]
    CalcFingerprint --> CheckLock{检查刷新锁}
    
    CheckLock -->|锁不存在 | SetLock[设置刷新锁 TTL=3s]
    SetLock --> IncCounter[刷新计数 +1]
    IncCounter --> VerifyFingerprint{指纹校验}
    
    CheckLock -->|锁存在 | CheckLockOwner{是否为同一请求？}
    CheckLockOwner -->|是 | ExtendLock[续期锁 TTL]
    ExtendLock --> VerifyFingerprint
    
    CheckLockOwner -->|否 | RaceDetected[竞态条件触发]
    RaceDetected --> RevokeAll[吊销所有会话]
    RevokeAll --> Alert[发送安全告警]
    Alert --> Reject1[返回 403]
    Reject1 --> End([结束])
    
    VerifyFingerprint -->|匹配 | GenerateToken[生成新 Token 对]
    GenerateToken --> UpdateFingerprint[更新指纹绑定]
    UpdateFingerprint --> Success[返回新 Token]
    Success --> End
    
    VerifyFingerprint -->|不匹配 | FingerprintAlert[指纹异常告警]
    FingerprintAlert --> Reject2[返回 401]
    Reject2 --> End
```

---

## 4. 并发刷新攻击示意图

```mermaid
sequenceDiagram
    participant A as 攻击者
    participant V as 受害者
    participant S as 服务端

    Note over A,V: 攻击者窃取 Refresh Token
    A->>S: 刷新请求 (窃取 Token)
    par 并发窗口 (3 秒内)
        V->>S: 刷新请求 (合法 Token)
        A->>S: 刷新请求 (窃取 Token)
    end
    
    S->>S: Lua 检测到同一 Token 多次刷新
    S->>S: 判定为竞态攻击
    S->>S: 吊销所有会话
    S-->>V: 403 (会话已吊销)
    S-->>A: 403 (攻击失败)
    Note over S: 安全事件日志记录
```

---

## 5. 异常登录检测流程

```mermaid
flowchart LR
    Login[用户登录] --> GeoIP[GeoIP 定位]
    GeoIP --> CheckHistory{检查历史登录地}
    
    CheckHistory -->|首次登录 | StoreLocation[存储位置信息]
    StoreLocation --> Success[登录成功]
    
    CheckHistory -->|有记录 | CompareLocation{位置是否异常？}
    CompareLocation -->|同一城市 | UpdateLocation[更新最后登录时间]
    UpdateLocation --> Success
    
    CompareLocation -->|异地 | CheckTime{5 分钟内？}
    CheckTime -->|否 | UpdateLocation
    CheckTime -->|是 | Anomaly[异常登录告警]
    Anomaly --> NotifyUser[通知用户]
    Anomaly --> LogEvent[记录审计日志]
    Anomaly --> OptionalFreeze{是否冻结？}
    OptionalFreeze -->|配置开启 | Freeze[临时冻结账户]
    OptionalFreeze -->|配置关闭 | Success
    Freeze --> Success
```

---

## 6. 会话管理流程图

```mermaid
flowchart TD
    Start([用户登录新设备]) --> CountSessions{当前设备数}
    
    CountSessions -->|< 5 个 | CreateSession[创建新会话]
    CreateSession --> BindToken[绑定 Refresh Token]
    BindToken --> Success([登录成功])
    
    CountSessions -->|= 5 个 | PromptUser[提示：选择踢出设备]
    PromptUser --> SelectDevice{用户选择}
    
    SelectDevice -->|踢出旧设备 | RevokeOld[吊销旧 Refresh Token]
    RevokeOld --> CreateSession
    
    SelectDevice -->|取消登录 | Abort([登录终止])
    
    SelectDevice -->|踢出所有其他 | RevokeAllOthers[批量吊销]
    RevokeAllOthers --> CreateSession
```

---

## 7. 安全事件等级定义

| 等级 | 事件类型 | 响应动作 |
|------|----------|----------|
| **P0** | 竞态条件触发（并发刷新） | 立即吊销所有会话，告警，通知用户 |
| **P1** | 设备指纹不匹配 | 拒绝刷新，记录告警日志 |
| **P1** | 异地同时登录 | 告警，通知用户，可选冻结 |
| **P2** | 高频刷新（≥10 次/分钟） | 限流，记录日志 |
| **P2** | 会话数达上限 | 提示用户管理设备 |

---

## 8. 配置参数建议

| 参数 | 建议值 | 说明 |
|------|--------|------|
| `ACCESS_TOKEN_TTL` | 5 分钟 | Access Token 有效期 |
| `REFRESH_TOKEN_TTL` | 7 天 | Refresh Token 有效期 |
| `REFRESH_LOCK_TTL` | 3 秒 | 并发检测锁窗口 |
| `MAX_SESSIONS_PER_USER` | 5 | 单用户最大设备数 |
| `GEO_ANOMALY_WINDOW` | 5 分钟 | 异地登录检测时间窗 |
| `HIGH_FREQ_REFRESH_THRESHOLD` | 10 次/分钟 | 高频刷新阈值 |

---

## 9. 附录：关键 Lua 脚本伪代码

```lua
-- 并发刷新检测 Lua 脚本
-- KEYS[1]: rt:lock:{refresh_token_hash}
-- KEYS[2]: rt:counter:{refresh_token_hash}
-- ARGV[1]: request_id (唯一标识本次请求)
-- ARGV[2]: lock_ttl (3 秒)

local lock = redis.call('GET', KEYS[1])
if lock == false then
    -- 无锁，设置新锁
    redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[2])
    redis.call('INCR', KEYS[2])
    redis.call('EXPIRE', KEYS[2], ARGV[2])
    return 'LOCK_ACQUIRED'
elseif lock == ARGV[1] then
    -- 同一请求，续期
    redis.call('EXPIRE', KEYS[1], ARGV[2])
    return 'SAME_REQUEST'
else
    -- 不同请求，竞态条件触发
    redis.call('DEL', KEYS[1])
    redis.call('DEL', KEYS[2])
    return 'RACE_CONDITION'
end
```

---

## 10. 修订记录

| 版本 | 日期 | 修订内容 | 作者 |
|------|------|----------|------|
| 1.0 | 2026-04-10 | 初始版本 | Orion Security Team |
