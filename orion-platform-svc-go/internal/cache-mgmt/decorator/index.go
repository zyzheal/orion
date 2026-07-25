// Package decorator provides a method-level caching system for Orion Go
// microservices. It supports in-memory and Redis backends, multiple eviction
// policies (LRU, LFU, FIFO, TTL), pluggable key generation, and structured
// logging.
//
// Quick start:
//
//   cfg := decorator.CacheConfig{
//       Name:     "getUser",
//       TTL:      5 * time.Minute,
//       MaxSize:  100,
//       Eviction: decorator.EvictionLRU,
//   }
//   backend := decorator.NewCache(decorator.CacheConfig{MaxSize: 100})
//   mc := decorator.NewMethodCache("getUser", getUser, cfg, backend)
//
//   // Call the cached method.
//   result, err := mc.Invoke("user-123")
//
//   // Evict a specific key.
//   mc.Evict("user-123")
//
//   // Invalidate the entire cache.
//   mc.Invalidate()
//
//   // Redis backend:
//   ctx := context.Background()
//   client := redis.NewClient(&redis.Options{Addr: "localhost:6379"})
//   rb := decorator.NewRedisBackend(ctx, client)
//   mcRedis := decorator.NewMethodCache("getUser", getUser, cfg, rb)
//
// Multiple caches can be managed by a CacheManager:
//
//   mgr := decorator.NewCacheManager(logger)
//   mgr.Register("getUser", getUser, cfg, backend)
//   mgr.Register("getProduct", getProduct, productCfg, backend)
//   stats := mgr.Stats()
package decorator
