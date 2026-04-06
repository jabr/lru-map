# LRUMap

A fast, simple LRU cache using two Maps with relaxed N to 2N storage bounds. Consistently the fastest JavaScript LRU implementation across all access patterns, including other relaxed N implementations.

## Performance

LRUMap outperforms all popular LRU implementations across realistic workloads:

| Distribution | LRUMap | vs Second Place |
|-------------|--------|-----------------|
| Flat (uniform) | 3.30M ops/sec | 22% faster |
| Zipf (realistic) | 7.08M ops/sec | 26% faster |
| Hot-set (cached) | 19.45M ops/sec | 19% faster |
| Sequential (streaming) | 1.68M ops/sec | 9% faster |
| Working-set-shift | 6.29M ops/sec | 1% faster |

All benchmarks run with 1M operations, cache size 1000, working set 2000. See [Benchmarks](benchmark/README.md) for full results.

## Overview

LRUMap implements an LRU cache using a two-Map rotation strategy inspired by [hashlru](https://github.com/dominictarr/hashlru). Instead of maintaining exact LRU order with linked lists, it uses a generational approach:

- **Current map**: Recently accessed items
- **Previous map**: Older items from the last generation

When the current map reaches `maxSize`, the maps rotate: current becomes previous, previous is dropped. Items accessed from previous are promoted to current on read.

This approach trades precise LRU ordering for **dramatically simpler code** (64 lines) and **better performance** while maintaining useful LRU semantics.

## Installation

```bash
bun add https://github.com/jabr/lru-map
# or
npm install https://github.com/jabr/lru-map
```

## Usage

```typescript
import LRUMap from 'lru-map'

// Create a cache with max 1000 items
const cache = new LRUMap<string, User>(1000)

// Basic operations
cache.set('user:1', { name: 'Alice', id: 1 })
cache.get('user:1')  // { name: 'Alice', id: 1 }
cache.has('user:1')  // true
cache.size           // 1
cache.clear()

// Async fetch-or-compute pattern
const user = await cache.fetch('user:123', async (key) => {
  const response = await fetch(`/api/users/123`)
  return response.json()
})
```

## API

### Constructor

```typescript
new LRUMap<K, V>(maxSize: number = 100)
```

Creates a new cache. `maxSize` must be a positive integer.

### Methods

| Method | Description |
|--------|-------------|
| `get(k: K): V \| undefined` | Get value if exists. Promotes from previous to current map. |
| `has(k: K): boolean` | Check if key exists in either map. |
| `set(k: K, v: V): this` | Set a value. Throws `TypeError` for undefined values. |
| `fetch(k: K, generator: (k: K) => V \| Promise<V>): Promise<V>` | Get existing or compute and set. Async. Throws `TypeError` if generator returns undefined. |
| `clear(): void` | Remove all entries. |
| `size: number` | Total entries across both maps (read-only). |

## How It Works

### The (N, 2N) Trade-off

Unlike strict LRU implementations that maintain exact ordering with doubly-linked lists (O(1) operations, but complex code), LRUMap uses a simpler approach:

```
┌─────────────────────────────────────────────────────┐
│                    AFTER ROTATION                   │
│                                                     │
│   current (empty)     previous (holds last N sets)  │
│   ┌──────────┐        ┌──────────────────────┐      │
│   │          │        │ a, b, c, ..., N items│      │
│   │  size=0  │        │                      │      │
│   └──────────┘        └──────────────────────┘      │
│                                                     │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│                    AFTER N SETS                     │
│                                                     │
│   current (N new)     previous (unchanged)          │
│   ┌──────────┐        ┌──────────────────────┐      │
│   │ x, y, z  │        │ a, b, c, ..., N items│      │
│   │ ..., N   │        │                      │      │
│   └──────────┘        └──────────────────────┘      │
│                                                     │
│   Total storage: N to 2N items                      │
└─────────────────────────────────────────────────────┘
```

### Rotation Semantics

When `current.size >= maxSize`:

1. `previous = current` (old items)
2. `current = new Map()` (fresh empty map)
3. Items in previous still accessible but "old"
4. Accessing previous items promotes them to current

## When to Use

**Use LRUMap when:**
- You want simple, maintainable code (64 lines)
- Performance matters (competitive with fastest implementations)
- You're okay with relaxed LRU semantics
- Memory is not extremely constrained

**Consider strict LRU when:**
- You need exact eviction order
- Memory is tightly constrained (must hold exactly N items)
- You need TTL support or other advanced features

## Implementation Complexity

| Library | Lines of Code | Complexity |
|---------|---------------|------------|
| **LRUMap** | **64** | Two-map rotation |
| hashlru | 51 | Two-object rotation |
| quick-lru | 329 | Two-map + TTL |
| lru.min | 302 | Typed arrays + indices |
| lru-cache | 1,590 | Linked list + full features |

## Credit

This implementation is inspired by [hashlru](https://github.com/dominictarr/hashlru/blob/master/README.md) by Dominic Tarr.

## License

[MIT](LICENSE.txt)
