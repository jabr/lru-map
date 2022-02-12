// Stores references for [0,2*maxSize) most recently stored keys.
export default class LRUMap<K,V> {
  private current = new Map<K,V>
  private previous = new Map<K,V>

  constructor(private maxSize: number = 100) {}

  get(k: K) {
    // @todo: move k to current?
    return (this.current.get(k) || this.previous.get(k))
  }

  set(k: K, v: V) {
    this.current.set(k, v)

    // is the current map full?
    if (this.current.size >= this.maxSize) {
        // rotate the current/previous maps...
        const p = this.previous
        this.previous = this.current
        this.current = p
        // ...then clear the "new" current
        p.clear()
    }

    return this
  }
}
