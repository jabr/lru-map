export interface BenchmarkResult {
  name: string
  operations: number
  durationMs: number
  opsPerSec: number
  hitRate: number
  hits: number
  misses: number
}

export interface ReportOptions {
  format: 'console' | 'json' | 'both'
  jsonFile?: string
}

export function formatConsoleReport(results: BenchmarkResult[]): string {
  const lines: string[] = []

  // Header
  lines.push('')
  lines.push('═'.repeat(90))
  lines.push('BENCHMARK RESULTS')
  lines.push('═'.repeat(90))
  lines.push('')

  // Table header
  lines.push(
    'Cache'.padEnd(20) +
    'Ops/sec'.padStart(12) +
    'Hit Rate'.padStart(10)
  )
  lines.push('─'.repeat(80))

  // Sort by ops/sec descending
  const sorted = [...results].sort((a, b) => b.opsPerSec - a.opsPerSec)

  for (const r of sorted) {
    lines.push(
      r.name.padEnd(20) +
      r.opsPerSec.toFixed(0).padStart(12) +
      (r.hitRate * 100).toFixed(1).padStart(9) + '%'
    )
  }

  lines.push('')

  // Summary for fastest
  if (sorted.length > 1) {
    const fastest = sorted[0]
    const slowest = sorted[sorted.length - 1]
    const speedup = fastest.opsPerSec / slowest.opsPerSec
    lines.push(`Fastest: ${fastest.name} (${speedup.toFixed(2)}x faster than ${slowest.name})`)
    lines.push('')
  }

  // Detailed results
  lines.push('─'.repeat(90))
  lines.push('DETAILED RESULTS')
  lines.push('─'.repeat(90))
  lines.push('')

  for (const r of sorted) {
    lines.push(`${r.name}:`)
    lines.push(`  Operations:    ${r.operations.toLocaleString()}`)
    lines.push(`  Duration:      ${r.durationMs.toFixed(2)} ms`)
    lines.push(`  Ops/sec:       ${r.opsPerSec.toFixed(0)}`)
    lines.push(`  Hit rate:      ${(r.hitRate * 100).toFixed(1)}% (${r.hits} hits, ${r.misses} misses)`)
    lines.push('')
  }

  lines.push('═'.repeat(90))
  lines.push('')

  return lines.join('\n')
}

export function formatJsonReport(results: BenchmarkResult[]): string {
  return JSON.stringify(
    {
      timestamp: new Date().toISOString(),
      results: results.sort((a, b) => b.opsPerSec - a.opsPerSec),
    },
    null,
    2
  )
}

export function printReport(results: BenchmarkResult[], options: ReportOptions): void {
  if (options.format === 'console' || options.format === 'both') {
    console.log(formatConsoleReport(results))
  }

  if (options.format === 'json' || options.format === 'both') {
    const json = formatJsonReport(results)
    if (options.jsonFile) {
      Bun.write(options.jsonFile, json)
      console.log(`JSON report written to: ${options.jsonFile}`)
    } else {
      console.log(json)
    }
  }
}
