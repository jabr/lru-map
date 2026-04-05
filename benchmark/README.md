# Benchmark Distributions

This directory contains the benchmark harness for comparing LRU cache implementations. The key component is the `KeyGenerator` class which produces different access patterns.

## Distribution Types

### 1. Flat (Uniform Random)

```
Keys accessed: [0, workingSetSize-1]
Probability:    Equal for all keys
```

Each key has an equal probability of being accessed. With working set size 2000 and cache size 1000:
- True LRU (exactly N entries): 50% hit rate
- (N, 2N) caches (~1.5N entries): ~64% hit rate

**Pattern visualization** (workingSetSize=10):
```
Access sequence: 7, 3, 9, 1, 4, 8, 2, 6, 0, 5, ...
```

Use case: Baseline comparison, stress testing with unpredictable access.

### 2. Zipf (Heavy-tailed)

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

### 3. Sequential

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

### 4. Hot-Set (Repeating Subset)

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

### 5. Working-Set-Shift (Locality Changes)

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

## Configuration

Each distribution can be configured via CLI flags:

```bash
bun run benchmark --distribution zipf --zipf-alpha 1.5
bun run benchmark --distribution hot-set --hot-set-size 50
bun run benchmark --distribution working-set-shift --shift-interval 500
```

## Choosing Distributions

| Distribution | Best For |
|-------------|----------|
| Flat | Baseline performance, worst-case analysis |
| Zipf | Real-world web/database workloads, skewed popularity |
| Sequential | Streaming, batch processing scenarios |
| Hot-Set | Hot working set, cache warming tests |
| Working-set-shift | Temporal locality, cache adaptation, eviction patterns |

**Key distinction - Sequential vs Hot-Set:**

- **Sequential**: Cycles through ALL `workingSetSize` keys. With workingSet=2000, cache=1000, you get ~0% hit rate (keys evicted before next cycle).
  
- **Hot-Set**: Repeats through ONLY `hotSetSize` keys (default 100). With hotSetSize=100, cache=1000, you get ~100% hit rate (all hot items fit).

Sequential tests "how does cache handle total working set turnover?"  
Hot-Set tests "how does cache retain a hot working set?"

## Implementation Details

All distributions use the `KeyGenerator` class:

```typescript
const gen = new KeyGenerator(
  workingSetSize,     // Total unique keys
  distribution,        // 'flat' | 'zipf' | 'sequential' | 'hot-set' | 'working-set-shift'
  zipfAlpha?,         // Skew parameter for zipf (default: 1.0)
  hotSetSize?,        // Hot set size for hot-set distribution (default: 100)
  shiftInterval?      // Ops between window shifts (default: 1000)
)

const key = gen.next()  // Get next key index
gen.reset()            // Reset state for reproducibility
```

### Zipf Implementation

Uses pre-computed cumulative distribution for O(log n) lookup:

```typescript
// Pre-compute cumulative probabilities
zipfRanks[i] = Σ(1/k^alpha) / H(n,alpha)  for k=1..i

// Sample via binary search
const rank = binarySearch(zipfRanks, random())
```

This is faster than rejection sampling and provides exact Zipf distribution.