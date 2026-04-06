// Stores references for [N,2N) most recently stored keys.
// Inspired by hashlru but using Map instead of object.
export default class LRUMap<K,V> {
  private current = new Map<K,V>()
  private previous = new Map<K,V>()

  constructor(private maxSize: number = 100) {
    if (!Number.isInteger(maxSize) || maxSize < 1) {
      throw new RangeError('maxSize must be a positive integer')
    }
  }

  get(k: K): V | undefined {
    const v = this.current.get(k)
    if (v !== undefined) return v

    const pv = this.previous.get(k)
    if (pv !== undefined) {
      this.checkRotation()
      this.current.set(k, pv)
      return pv
    }
    return undefined
  }

  has(k: K): boolean {
    return this.current.has(k) || this.previous.has(k)
  }

  set(k: K, v: V): this {
    if (v === undefined) {
      throw new TypeError('undefined values are not allowed')
    }
    this.checkRotation()
    this.current.set(k, v)
    return this
  }

  async fetch(k: K, generator: (k: K) => V | Promise<V>): Promise<V> {
    const v = this.get(k)
    if (v !== undefined) return v
    const result = await generator(k)
    if (result === undefined) {
      throw new TypeError('generator must not return undefined')
    }
    this.set(k, result)
    return result
  }

  private checkRotation(): void {
    if (this.current.size < this.maxSize) return
    this.previous = this.current
    this.current = new Map()
  }

  get size(): number {
    return this.current.size + this.previous.size
  }

  clear(): void {
    this.current.clear()
    this.previous.clear()
  }
}
