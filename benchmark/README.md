# Benchmark Results

Run with: `bun run benchmark/index.ts --caches all -o 1000000`

All benchmarks: Cache size 1000; Working set 2000-4000; Operations 1,000,000; Run on Bun 1.3.11

## Summary

| Distribution | Fastest | Throughput | vs Second Place |
|--------------|---------|------------|-----------------|
| **Flat** (uniform) | LRUMap | 3.30M ops/sec | 22% faster |
| **Zipf** (skewed) | LRUMap | 7.08M ops/sec | 26% faster |
| **Hot-set** (cached) | LRUMap | 19.45M ops/sec | 19% faster |
| **Sequential** (streaming) | LRUMap | 1.68M ops/sec | 9% faster |
| **Working-set-shift** | LRUMap | 6.29M ops/sec | 1% faster |

**LRUMap is the fastest JavaScript LRU implementation across all access patterns.**

## Detailed Results

### Flat Distribution (uniform random)

```
Cache         Ops/sec    Hit Rate
──────────────────────────────────
LRUMap        3.30M      63.9%
quick-lru     2.70M      63.9%
hashlru       2.56M      64.0%
lru.min       2.51M      49.9%
lru-cache     2.24M      50.0%
mnemonist     0.47M      50.0%
```

### Zipf Distribution (realistic)

```
Cache         Ops/sec    Hit Rate
──────────────────────────────────
LRUMap        7.08M      91.2%
quick-lru     5.62M      91.2%
hashlru       5.18M      91.2%
lru.min       4.65M      87.9%
lru-cache     4.55M      87.9%
mnemonist     1.45M      87.9%
```

### Hot-Set Distribution (fits in cache)

```
Cache         Ops/sec     Hit Rate
───────────────────────────────────
LRUMap        19.45M      100.0%
lru.min       16.31M      100.0%
quick-lru     16.09M      100.0%
hashlru       14.21M      100.0%
lru-cache     13.86M      100.0%
mnemonist     13.28M      100.0%
```

### Sequential Distribution (no reuse)
_Working set increased to 4000 since LRUMap upper-bound is 2N, not 2N-1._

```
Cache         Ops/sec    Hit Rate
──────────────────────────────────
LRUMap        1.68M      0.0%
quick-lru     1.54M      0.0%
hashlru       1.46M      0.0%
lru.min       1.37M      0.0%
lru-cache     1.24M      0.0%
mnemonist     0.26M      0.0%
```

### Working-Set-Shift (changing locality)

```
Cache         Ops/sec    Hit Rate
──────────────────────────────────
LRUMap        6.29M      92.0%
quick-lru     6.23M      92.0%
hashlru       5.59M      92.0%
lru.min       5.48M      90.0%
lru-cache     4.75M      90.0%
mnemonist     1.81M      90.0%
```

---

# Distribution Types

These patterns simulate different real-world cache access scenarios.

## 1. Flat (Uniform Random)

```
Keys accessed: [0, workingSetSize-1]
Probability:    Equal for all keys
```

Each key has an equal probability of being accessed.

**Pattern visualization** (workingSetSize=10):
```
Access sequence: 7, 3, 9, 1, 4, 8, 2, 6, 0, 5, ...
```

Use case: Baseline comparison, stress testing with unpredictable access.

## 2. Zipf (Heavy-tailed)

```
Keys accessed: [0, workingSetSize-1]
Probability:    P(rank i) ∝ 1 / i^alpha
```

A small subset of "hot" keys receives the majority of accesses. The `alpha` parameter controls skewness:
- `alpha = 0`: Flat (uniform)
- `alpha = 1`: Standard Zipf (~20% of keys get ~80% of accesses)
- `alpha > 1`: More extreme skew

**Pattern visualization** (workingSetSize=10, alpha=1):
```
Access sequence: 0, 0, 1, 0, 2, 0, 1, 3, 0, 0, ...
                  ^^     ^^  ^^   ^^     ^^
               Key 0 dominates
```

Use case: Realistic web/caching workloads (popular items vs long tail).

## 3. Sequential

```
Keys accessed: 0, 1, 2, ..., workingSetSize-1, 0, 1, 2, ...
```

Linear scan through all keys, wrapping when reaching the end. Each key is accessed once per cycle.

**Pattern visualization** (workingSetSize=10):
```
Cycle 1: 0, 1, 2, 3, 4, 5, 6, 7, 8, 9
Cycle 2: 0, 1, 2, 3, 4, 5, 6, 7, 8, 9
...
```

Use case: Batch processing, streaming data. Tests cache behavior with predictable, non-repeating access within each cycle.

**Expected behavior**: Near 100% miss rate if workingSetSize > cacheSize (no key repeats before eviction).

## 4. Hot-Set (Repeating Subset)

```
Keys accessed: 0, 1, ..., hotSetSize-1, 0, 1, ..., hotSetSize-1, ...
```

Repeatedly scans through a small subset of keys (default hotSetSize=100). Unlike sequential, this immediately repeats after `hotSetSize` keys.

**Pattern visualization** (hotSetSize=5):
```
Cycle 1: 0, 1, 2, 3, 4
Cycle 2: 0, 1, 2, 3, 4
Cycle 3: 0, 1, 2, 3, 4
...
```

Use case: Hot working set that fits in cache. Tests how well cache retains frequently-accessed subset.

**Expected behavior**: Near 100% hit rate if hotSetSize <= cacheSize (all hot items fit in cache).

## 5. Working-Set-Shift (Locality Changes)

```
Keys accessed: 80% within current window, 20% random
Window shifts: Every shiftInterval operations by 10% of workingSetSize
```

Simulates realistic workloads where the "hot" data changes over time. At any moment, 80% of accesses target roughly 20% of the keys, but that "hot window" periodically shifts.

**Pattern visualization** (workingSetSize=1000, shiftInterval=100):
```
Ops 0-99:     80% from keys [0, 200]   + 20% random
Ops 100-199:  80% from keys [100, 300] + 20% random  (window shifted)
Ops 200-299:  80% from keys [200, 400] + 20% random
...
```

Use case: Web caches during traffic pattern changes, database queries during peak hours. Tests cache adaptation to changing access patterns.

**Expected behavior**: Hit rates vary based on how quickly cache adapts to new hot window.

### Sequential vs Hot-Set Distinction

- **Sequential**: Cycles through ALL `workingSetSize` keys. With workingSet=2000, cache=1000, you get ~0% hit rate (keys evicted before next cycle).
- **Hot-Set**: Repeats through ONLY `hotSetSize` keys (default 100). With hotSetSize=100, cache=1000, you get ~100% hit rate (all hot items fit).

Sequential tests "how does cache handle total working set turnover?"  
Hot-Set tests "how does cache retain a hot working set?"

---

# Analysis: The (N, 2N) Trade-off

Two implementation families dominate performance:

| Implementation Type | Examples | Storage Range |
|---------------------|----------|---------------|
| **(N, 2N) Rotation** | LRUMap, hashlru, quick-lru | N to 2N |
| **True LRU** | lru-cache, lru.min, mnemonist | Exactly N |

## Hit Rate Comparison

With working set 2000, cache size 1000:

| Distribution | True LRU | (N, 2N) | Improvement |
|--------------|----------|---------|-------------|
| **Flat** | 50% | 64% | +28% |
| **Zipf** | 88% | 91% | +3% |
| **Hot-set** | 100% | 100% | — |
| **Sequential** | ~0% | ~0% | — |
| **Working-set-shift** | 90% | 92% | +2% |

**Why the difference on flat distribution?**

- **Strict LRU**: Holds exactly 1000 items → covers 50% of working set
- **(N, 2N) caches**: Hold ~1500 items → covers 50-75% of working set

**Why less difference on Zipf?**

Hot items dominate regardless of exact eviction order. Both approaches cache the frequently-accessed keys.

The (N, 2N) approach improves hit rates most on flat/uniform access where coverage matters. On skewed workloads (Zipf), true LRU performs nearly as well since hot items dominate.

---

# Running Benchmarks

## Quick Start

```bash
# Run all implementations with default settings
bun run benchmark/index.ts --caches all

# Run with 1M operations (more stable results)
bun run benchmark/index.ts --caches all -o 1000000

# Test specific distribution
bun run benchmark/index.ts --distribution zipf --zipf-alpha 1.5

# Compare specific implementations
bun run benchmark/index.ts --caches lrumap,hashlru,lru-cache
```

## Available Options

| Flag | Description | Default |
|------|-------------|---------|
| `--cache-size, -c <n>` | Max cache size | 1000 |
| `--operations, -o <n>` | Number of operations | 100000 |
| `--warmup <n>` | Warmup operations | 1000 |
| `--working-set, -w <n>` | Working set size | 2000 |
| `--distribution, -d <name>` | Access pattern | flat |
| `--zipf-alpha <n>` | Zipf skew parameter | 1.0 |
| `--hot-set-size <n>` | Hot-set size | 100 |
| `--caches <list>` | Comma-separated list or "all" | lrumap |
| `--format <format>` | Output: console, json, both | console |

## Examples

```bash
# Zipf with high skew
bun run benchmark/index.ts --distribution zipf --zipf-alpha 1.5

# Small hot set
bun run benchmark/index.ts --distribution hot-set --hot-set-size 50

# Fast shifting locality
bun run benchmark/index.ts --distribution working-set-shift --shift-interval 500

# Large scale test
bun run benchmark/index.ts --caches all -o 5000000 --cache-size 10000
```

---

# Implementation Details

## KeyGenerator

All distributions use the `KeyGenerator` class:

```typescript
const gen = new KeyGenerator(
  workingSetSize,     // Total unique keys
  distribution,        // 'flat' | 'zipf' | 'sequential' | 'hot-set' | 'working-set-shift'
  zipfAlpha?,         // Skew parameter for zipf (default: 1.0)
  hotSetSize?,        // Hot set size for hot-set (default: 100)
  shiftInterval?      // Ops between window shifts (default: 1000)
)

const key = gen.next()  // Get next key index
gen.reset()            // Reset state for reproducibility
```

## Zipf Implementation

Uses pre-computed cumulative distribution for O(log n) lookup:

```typescript
// Pre-compute cumulative probabilities
zipfRanks[i] = Σ(1/k^alpha) / H(n,alpha)  for k=1..i

// Sample via binary search
const rank = binarySearch(zipfRanks, random())
```

This is faster than rejection sampling and provides exact Zipf distribution.
