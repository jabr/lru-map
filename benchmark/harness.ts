import type { BenchmarkResult, ReportOptions } from './report'
import { printReport } from './report'
import { KeyGenerator, type DistributionConfig } from './distributions'

export interface BenchmarkConfig {
  cacheSize: number
  keyLength: number
  valueLength: number
  operations: number
  warmup: number
  workingSetSize: number
  distribution: DistributionConfig['distribution']
  zipfAlpha?: number
  hotSetSize?: number
  shiftInterval?: number
}

export interface CacheAdapter {
  name: string
  get(key: string): any | undefined
  set(key: string, value: string): void
  clear(): void
}

export interface RunOptions {
  config: BenchmarkConfig
  caches: CacheAdapter[]
  reportOptions: ReportOptions
}

function generateRandomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)]
  }
  return result
}

export async function runBenchmark(options: RunOptions): Promise<BenchmarkResult[]> {
  const { config, caches, reportOptions } = options
  const results: BenchmarkResult[] = []

  for (const cache of caches) {
    const keyGen = new KeyGenerator(
      config.workingSetSize,
      config.distribution,
      config.zipfAlpha ?? 1.0,
      config.hotSetSize ?? 100,
      config.shiftInterval ?? 1000
    )

    // Pre-generate keys for consistent workload
    const keys: string[] = []
    for (let i = 0; i < config.operations + config.warmup; i++) {
      const idx = keyGen.next()
      keys.push(`key-${idx.toString().padStart(6, '0')}`)
    }

    // Warmup phase
    for (let i = 0; i < config.warmup; i++) {
      const key = keys[i]
      const value = cache.get(key)
      if (value === undefined) {
        cache.set(key, generateRandomString(config.valueLength))
      }
    }

    // Reset counters after warmup
    let hits = 0
    let misses = 0
    keyGen.reset()

    // Benchmark phase
    const startTime = performance.now()

    for (let i = config.warmup; i < config.operations + config.warmup; i++) {
      const key = keys[i]

      const value = cache.get(key)
      if (value !== undefined) {
        hits++
      } else {
        misses++
        const generated = generateRandomString(config.valueLength)
        cache.set(key, generated)
      }
    }

    const endTime = performance.now()
    const durationMs = endTime - startTime

    results.push({
      name: cache.name,
      operations: config.operations,
      durationMs,
      opsPerSec: config.operations / (durationMs / 1000),
      hitRate: hits / (hits + misses),
      hits,
      misses,
    })

    cache.clear()
  }

  printReport(results, reportOptions)

  return results
}

// LRUMap: 66 LOC - two Map rotation with immediate promotion
export async function createLRUMapAdapter(maxSize: number): Promise<CacheAdapter> {
  const { default: LRUMap } = await import('../index.ts') as {
    default: new (maxSize: number) => {
      get(key: string): any | undefined
      set(key: string, value: string): void
      clear(): void
    }
  }

  const cache = new LRUMap(maxSize)

  return {
    name: 'LRUMap',
    get(key: string) {
      return cache.get(key)
    },
    set(key: string, value: string) {
      cache.set(key, value)
    },
    clear() {
      cache.clear()
    },
  }
}

// lru-cache: 1,590 LOC - linked list with full features
export async function createLruCacheAdapter(maxSize: number): Promise<CacheAdapter> {
  const { LRUCache } = await import('lru-cache')

  const cache = new LRUCache({ max: maxSize })

  return {
    name: 'lru-cache',
    get(key: string) {
      return cache.get(key)
    },
    set(key: string, value: string) {
      cache.set(key, value)
    },
    clear() {
      cache.clear()
    },
  }
}

// quick-lru: 329 LOC - two Map rotation with TTL support
export async function createQuickLruAdapter(maxSize: number): Promise<CacheAdapter> {
  const QuickLRU = (await import('quick-lru')).default

  const cache = new QuickLRU({ maxSize })

  return {
    name: 'quick-lru',
    get(key: string) {
      return cache.get(key)
    },
    set(key: string, value: string) {
      cache.set(key, value)
    },
    clear() {
      cache.clear()
    },
  }
}

// mnemonist: 15,386 LOC - comprehensive data structures library
export async function createMnemonistAdapter(maxSize: number): Promise<CacheAdapter> {
  const { LRUCache } = await import('mnemonist')

  const cache = new LRUCache(maxSize)

  return {
    name: 'mnemonist',
    get(key: string) {
      return cache.get(key)
    },
    set(key: string, value: string) {
      cache.set(key, value)
    },
    clear() {
      cache.clear()
    },
  }
}

// lru.min: 302 LOC - typed arrays with indices (claims fastest)
export async function createLruMinAdapter(maxSize: number): Promise<CacheAdapter> {
  const { createLRU } = await import('lru.min')

  const cache = createLRU<string, string>({ max: maxSize })

  return {
    name: 'lru.min',
    get(key: string) {
      return cache.get(key)
    },
    set(key: string, value: string) {
      cache.set(key, value)
    },
    clear() {
      cache.clear()
    },
  }
}

// hashlru: 51 LOC - two object rotation (original inspiration)
export async function createHashlruAdapter(maxSize: number): Promise<CacheAdapter> {
  const hashlruModule = await import('hashlru')
  const hashlru = hashlruModule.default

  const cache = hashlru(maxSize)

  return {
    name: 'hashlru',
    get(key: string) {
      return cache.get(key)
    },
    set(key: string, value: string) {
      cache.set(key, value)
    },
    clear() {
      cache.clear()
    },
  }
}
