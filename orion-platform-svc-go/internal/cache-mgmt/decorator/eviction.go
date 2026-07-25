package decorator

import (
	"container/list"
	"sync"
)

// ---------------------------------------------------------------------------
// Internal entry types
// ---------------------------------------------------------------------------

type entry struct {
	key       string
	value     interface{}
	expiry    int64 // unix nanoseconds; 0 means never expires
	freq      int   // LFU counter
}

// evictor manages insertion, lookup, and eviction for a cache.
type evictor interface {
	put(key string, val interface{})
	get(key string) (interface{}, bool)
	delete(key string)
	len() int
	clear()
}

// ---------------------------------------------------------------------------
// LRU — least recently used
// ---------------------------------------------------------------------------

type lruEvictor struct {
	mu      sync.RWMutex
	store   *list.List            // ordered from front (MRU) to back (LRU)
	idx     map[string]*list.Element
	maxSize int
}

func newLRUEvictor(maxSize int) evictor {
	return &lruEvictor{
		store:   list.New(),
		idx:     make(map[string]*list.Element, maxSize),
		maxSize: maxSize,
	}
}

func (e *lruEvictor) put(key string, val interface{}) {
	e.mu.Lock()
	defer e.mu.Unlock()
	if el, ok := e.idx[key]; ok {
		e.store.MoveToFront(el)
		el.Value.(*entry).value = val
		return
	}
	if e.store.Len() >= e.maxSize {
		e.removeBack()
	}
	el := e.store.PushFront(&entry{key: key, value: val})
	e.idx[key] = el
}

func (e *lruEvictor) get(key string) (interface{}, bool) {
	e.mu.Lock()
	defer e.mu.Unlock()
	if el, ok := e.idx[key]; ok {
		e.store.MoveToFront(el)
		return el.Value.(*entry).value, true
	}
	return nil, false
}

func (e *lruEvictor) delete(key string) {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.remove(key)
}

func (e *lruEvictor) len() int {
	e.mu.RLock()
	defer e.mu.RUnlock()
	return e.store.Len()
}

func (e *lruEvictor) clear() {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.store.Init()
	e.idx = make(map[string]*list.Element, e.maxSize)
}

// remove deletes the element identified by key from the list and index.
// Caller must hold e.mu.
func (e *lruEvictor) remove(key string) {
	if el, ok := e.idx[key]; ok {
		delete(e.idx, key)
		e.store.Remove(el)
	}
}

// removeBack evicts the least recently used entry.
// Caller must hold e.mu.
func (e *lruEvictor) removeBack() {
	if el := e.store.Back(); el != nil {
		en := el.Value.(*entry)
		delete(e.idx, en.key)
		e.store.Remove(el)
	}
}

// ---------------------------------------------------------------------------
// LFU — least frequently used
// ---------------------------------------------------------------------------

type lfuEvictor struct {
	mu      sync.RWMutex
	idx     map[string]*entry
	maxSize int
}

func newLFUEvictor(maxSize int) evictor {
	return &lfuEvictor{
		idx:     make(map[string]*entry, maxSize),
		maxSize: maxSize,
	}
}

func (e *lfuEvictor) put(key string, val interface{}) {
	e.mu.Lock()
	defer e.mu.Unlock()
	if en, ok := e.idx[key]; ok {
		en.value = val
		en.freq++
		return
	}
	if len(e.idx) >= e.maxSize {
		e.evictOnce()
	}
	e.idx[key] = &entry{key: key, value: val, freq: 1}
}

// evictOnce removes the entry with the lowest frequency.
// Ties are broken arbitrarily. Caller must hold e.mu.
func (e *lfuEvictor) evictOnce() {
	if len(e.idx) == 0 {
		return
	}
	evictKey, minFreq := "", 1<<63-1
	for k, en := range e.idx {
		if en.freq < minFreq {
			minFreq = en.freq
			evictKey = k
		}
	}
	delete(e.idx, evictKey)
}

func (e *lfuEvictor) get(key string) (interface{}, bool) {
	e.mu.Lock()
	defer e.mu.Unlock()
	if en, ok := e.idx[key]; ok {
		en.freq++
		return en.value, true
	}
	return nil, false
}

func (e *lfuEvictor) delete(key string) {
	e.mu.Lock()
	defer e.mu.Unlock()
	delete(e.idx, key)
}

func (e *lfuEvictor) len() int {
	e.mu.RLock()
	defer e.mu.RUnlock()
	return len(e.idx)
}

func (e *lfuEvictor) clear() {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.idx = make(map[string]*entry, e.maxSize)
}


// ---------------------------------------------------------------------------
// FIFO — first in, first out
// ---------------------------------------------------------------------------

type fifoEvictor struct {
	mu      sync.RWMutex
	store   *list.List
	idx     map[string]*list.Element
	maxSize int
}

func newFIFOEvictor(maxSize int) evictor {
	return &fifoEvictor{
		store:   list.New(),
		idx:     make(map[string]*list.Element, maxSize),
		maxSize: maxSize,
	}
}

func (e *fifoEvictor) put(key string, val interface{}) {
	e.mu.Lock()
	defer e.mu.Unlock()
	if el, ok := e.idx[key]; ok {
		el.Value.(*entry).value = val
		return // do not move to front on update
	}
	if e.store.Len() >= e.maxSize {
		e.removeFront()
	}
	el := e.store.PushBack(&entry{key: key, value: val})
	e.idx[key] = el
}

func (e *fifoEvictor) get(key string) (interface{}, bool) {
	e.mu.RLock()
	defer e.mu.RUnlock()
	if el, ok := e.idx[key]; ok {
		return el.Value.(*entry).value, true
	}
	return nil, false
}

func (e *fifoEvictor) delete(key string) {
	e.mu.Lock()
	defer e.mu.Unlock()
	if el, ok := e.idx[key]; ok {
		delete(e.idx, key)
		e.store.Remove(el)
	}
}

func (e *fifoEvictor) len() int {
	e.mu.RLock()
	defer e.mu.RUnlock()
	return e.store.Len()
}

func (e *fifoEvictor) clear() {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.store.Init()
	e.idx = make(map[string]*list.Element, e.maxSize)
}

// removeFront evicts the oldest entry.
// Caller must hold e.mu.
func (e *fifoEvictor) removeFront() {
	if el := e.store.Front(); el != nil {
		en := el.Value.(*entry)
		delete(e.idx, en.key)
		e.store.Remove(el)
	}
}

// ---------------------------------------------------------------------------
// NewEvictor factory
// ---------------------------------------------------------------------------

func newEvictor(policy EvictionPolicy, maxSize int) evictor {
	switch policy {
	case EvictionLRU, "":
		return newLRUEvictor(maxSize)
	case EvictionLFU:
		return newLFUEvictor(maxSize)
	case EvictionFIFO:
		return newFIFOEvictor(maxSize)
	case EvictionTTL:
		// TTL eviction is handled by the cache wrapper itself (lazy expiry
		// on get/set/delete); the backing evictor is LRU for ordering.
		return newLRUEvictor(maxSize)
	case EvictionNone:
		return newLRUEvictor(maxSize)
	default:
		return newLRUEvictor(maxSize)
	}
}
