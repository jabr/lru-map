import {
  runBenchmark,
  createLRUMapAdapter,
  createLruCacheAdapter,
  createQuickLruAdapter,
  createMnemonistAdapter,
  createHashlruAdapter,
  createLruMinAdapter,
  type BenchmarkConfig,
  type CacheAdapter,
} from './harness'
import type { Distribution } from './distributions'

const DEFAULT_CONFIG: BenchmarkConfig = {
  cacheSize: 1000,
  keyLength: 32,
  valueLength: 100,
  operations: 1000000,
  warmup: 1000,
  workingSetSize: 2000,
  distribution: 'flat',
  zipfAlpha: 1.0,
  hotSetSize: 100,
  shiftInterval: 1000,
}

function parseArgs(): {
  config: BenchmarkConfig
  caches: string[]
  format: 'console' | 'json' | 'both'
  jsonFile?: string
} {
  const args = process.argv.slice(2)
  const config = { ...DEFAULT_CONFIG }
  const caches: string[] = ['lrumap']
  let format: 'console' | 'json' | 'both' = 'console'
  let jsonFile: string | undefined

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    switch (arg) {
      case '--cache-size':
      case '-c':
        config.cacheSize = parseInt(args[++i], 10)
        break
      case '--operations':
      case '-o':
        config.operations = parseInt(args[++i], 10)
        break
      case '--warmup':
        config.warmup = parseInt(args[++i], 10)
        break
      case '--working-set':
      case '-w':
        config.workingSetSize = parseInt(args[++i], 10)
        break
      case '--distribution':
      case '-d':
        config.distribution = args[++i] as Distribution
        break
      case '--zipf-alpha':
        config.zipfAlpha = parseFloat(args[++i])
        break
      case '--hot-set-size':
        config.hotSetSize = parseInt(args[++i], 10)
        break
      case '--format':
        format = args[++i] as typeof format
        break
      case '--json-output':
        jsonFile = args[++i]
        format = 'json'
        break
      case '--caches':
        caches.length = 0
        caches.push(...args[++i].split(','))
        break
      case '--help':
      case '-h':
        printHelp()
        process.exit(0)
    }
  }

  return { config, caches, format, jsonFile }
}

function printHelp(): void {
  console.log(`
Benchmark Harness for LRU Cache Implementations

Usage: bun run benchmark/index.ts [options]

Options:
  --cache-size, -c <n>        Max cache size (default: ${DEFAULT_CONFIG.cacheSize})
  --operations, -o <n>        Number of operations (default: ${DEFAULT_CONFIG.operations})
  --warmup <n>               Warmup operations (default: ${DEFAULT_CONFIG.warmup})
  --working-set, -w <n>      Working set size (default: ${DEFAULT_CONFIG.workingSetSize})
  --distribution, -d <name>  Access pattern: flat, zipf, sequential, hot-set, working-set-shift
                             (default: ${DEFAULT_CONFIG.distribution})
  --zipf-alpha <n>           Zipf distribution alpha (default: ${DEFAULT_CONFIG.zipfAlpha})
  --hot-set-size <n>         Hot set size for hot-set distribution (default: 100)
  --caches <list>            Comma-separated list: lrumap,lru-cache,quick-lru,mnemonist,hashlru,lru.min
                             Use "all" to run all implementations
                             (default: lrumap)
  --format <format>          Output format: console, json, both (default: console)
  --json-output <file>       Write JSON to file
  --help, -h                 Show this help

Examples:
  bun run benchmark/index.ts
  bun run benchmark/index.ts --distribution zipf --zipf-alpha 1.2
  bun run benchmark/index.ts --caches all --operations 500000
  bun run benchmark/index.ts --caches lrumap,lru-cache,hashlru
`)
}

async function main(): Promise<void> {
  const { config, caches, format, jsonFile } = parseArgs()

  // Validate distribution
  const validDistributions: Distribution[] = ['flat', 'zipf', 'sequential', 'hot-set', 'working-set-shift']
  if (!validDistributions.includes(config.distribution)) {
    console.error(`Invalid distribution: ${config.distribution}`)
    console.error(`Valid: ${validDistributions.join(', ')}`)
    process.exit(1)
  }

  // Build cache adapters
  const cacheAdapters: CacheAdapter[] = []

  // Expand "all" to all implementations
  const expandedCaches = caches.includes('all')
    ? ['lrumap', 'lru-cache', 'quick-lru', 'mnemonist', 'hashlru', 'lru.min']
    : caches

  for (const name of expandedCaches) {
    switch (name.toLowerCase()) {
      case 'lrumap':
      case 'lru':
        cacheAdapters.push(await createLRUMapAdapter(config.cacheSize))
        break
      case 'lru-cache':
        cacheAdapters.push(await createLruCacheAdapter(config.cacheSize))
        break
      case 'quick-lru':
      case 'quicklru':
        cacheAdapters.push(await createQuickLruAdapter(config.cacheSize))
        break
      case 'mnemonist':
        cacheAdapters.push(await createMnemonistAdapter(config.cacheSize))
        break
      case 'hashlru':
        cacheAdapters.push(await createHashlruAdapter(config.cacheSize))
        break
      case 'lru.min':
      case 'lrumin':
        cacheAdapters.push(await createLruMinAdapter(config.cacheSize))
        break
      default:
        console.error(`Unknown cache: ${name}`)
        console.error(`Valid: lrumap, lru-cache, quick-lru, mnemonist, hashlru, lru.min, all`)
        process.exit(1)
    }
  }

  console.log('Benchmark Configuration:')
  console.log(`  Cache size:      ${config.cacheSize}`)
  console.log(`  Working set:     ${config.workingSetSize}`)
  console.log(`  Operations:      ${config.operations}`)
  console.log(`  Warmup:          ${config.warmup}`)
  console.log(`  Distribution:    ${config.distribution}`)
  console.log(`  Key length:      ${config.keyLength}`)
  console.log(`  Value length:    ${config.valueLength}`)
  console.log(`  Caches:          ${caches.join(', ')}`)
  console.log('')

  await runBenchmark({
    config,
    caches: cacheAdapters,
    reportOptions: { format, jsonFile },
  })
}

main().catch((err) => {
  console.error('Benchmark failed:', err)
  process.exit(1)
})
