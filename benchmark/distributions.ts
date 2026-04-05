export type Distribution =
  | 'flat'
  | 'zipf'
  | 'sequential'
  | 'hot-set'
  | 'working-set-shift'

export interface DistributionConfig {
  distribution: Distribution
  workingSetSize: number
  zipfAlpha?: number
  hotSetSize?: number
  shiftInterval?: number
}

export class KeyGenerator {
  private zipfRanks: number[] | null = null
  private sequentialIndex = 0
  private hotSetIndex = 0
  private shiftWindowStart = 0
  private currentShift = 0

  constructor(
    private workingSetSize: number,
    private distribution: Distribution,
    private zipfAlpha: number = 1.0,
    private hotSetSize: number = 100,
    private shiftInterval: number = 1000
  ) {
    if (distribution === 'zipf') {
      this.initZipf()
    }
  }

  private initZipf(): void {
    // Pre-compute Zipf ranks for performance
    // Using zeta function approximation for harmonic numbers
    const n = this.workingSetSize
    const alpha = this.zipfAlpha

    // Harmonic number H(n, alpha)
    let zeta = 0
    for (let i = 1; i <= n; i++) {
      zeta += 1 / Math.pow(i, alpha)
    }

    // Pre-compute probability thresholds
    this.zipfRanks = []
    let cumulative = 0
    for (let i = 1; i <= n; i++) {
      cumulative += (1 / Math.pow(i, alpha)) / zeta
      this.zipfRanks.push(cumulative)
    }
  }

  next(): number {
    switch (this.distribution) {
      case 'flat':
        return Math.floor(Math.random() * this.workingSetSize)

      case 'zipf':
        return this.nextZipf()

      case 'sequential':
        return this.nextSequential()

      case 'hot-set':
        return this.nextHotSet()

      case 'working-set-shift':
        return this.nextWorkingSetShift()

      default:
        return Math.floor(Math.random() * this.workingSetSize)
    }
  }

  private nextZipf(): number {
    const r = Math.random()
    // Binary search for rank
    let low = 0
    let high = this.zipfRanks!.length - 1
    while (low < high) {
      const mid = (low + high) >> 1
      if (this.zipfRanks![mid] < r) {
        low = mid + 1
      } else {
        high = mid
      }
    }
    return low
  }

  private nextSequential(): number {
    return this.sequentialIndex++ % this.workingSetSize
  }

  private nextHotSet(): number {
    const idx = this.hotSetIndex++
    if (this.hotSetIndex >= this.hotSetSize) {
      this.hotSetIndex = 0
    }
    return idx % this.workingSetSize
  }

  private nextWorkingSetShift(): number {
    // Shift window periodically
    if (this.sequentialIndex > 0 && this.sequentialIndex % this.shiftInterval === 0) {
      this.shiftWindowStart = (this.shiftWindowStart + Math.floor(this.workingSetSize * 0.1)) % this.workingSetSize
      this.currentShift = this.shiftWindowStart
    }

    // 80% accesses within current window, 20% outside
    if (Math.random() < 0.8) {
      return this.currentShift + Math.floor(Math.random() * (this.workingSetSize * 0.2))
    } else {
      return Math.floor(Math.random() * this.workingSetSize)
    }
  }

  reset(): void {
    this.sequentialIndex = 0
    this.hotSetIndex = 0
    this.shiftWindowStart = 0
    this.currentShift = 0
  }
}

export function createKeyGenerator(config: DistributionConfig): KeyGenerator {
  return new KeyGenerator(
    config.workingSetSize,
    config.distribution,
    config.zipfAlpha ?? 1.0,
    config.hotSetSize ?? 100,
    config.shiftInterval ?? 1000
  )
}