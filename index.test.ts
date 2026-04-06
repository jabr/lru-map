import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import LRUMap from './index.ts'

describe('LRUMap', () => {
  let cache: LRUMap<string, string>

  beforeEach(() => {
    cache = new LRUMap<string, string>(3)
  })

  afterEach(() => {
    cache.clear()
  })

  describe('input validation', () => {
    it('should throw on maxSize = 0', () => {
      expect(() => new LRUMap(0)).toThrow(RangeError)
    })

    it('should throw on maxSize < 0', () => {
      expect(() => new LRUMap(-1)).toThrow(RangeError)
    })

    it('should throw on non-integer maxSize', () => {
      expect(() => new LRUMap(1.5)).toThrow(RangeError)
    })

    it('should accept maxSize = 1', async () => {
      const small = new LRUMap<string, string>(1)
      await small.fetch('a', () => 'A')
      expect(small.get('a')).toBe('A')
    })

    it('should throw when setting undefined value', () => {
      expect(() => cache.set('a', undefined as any)).toThrow(TypeError)
    })
  })

  describe('has() method', () => {
    it('should return true for existing key', () => {
      cache.set('a', 'A')
      expect(cache.has('a')).toBe(true)
    })

    it('should return false for missing key', () => {
      expect(cache.has('missing')).toBe(false)
    })
  })

  describe('basic operations', () => {
    it('should store and retrieve values', () => {
      cache.set('a', 'A')
      expect(cache.get('a')).toBe('A')
      expect(cache.size).toBe(1)
    })

    it('should return undefined for missing keys', () => {
      expect(cache.get('missing')).toBeUndefined()
    })

    it('should clear all entries', () => {
      cache.set('a', 'A')
      cache.set('b', 'B')
      cache.clear()
      expect(cache.size).toBe(0)
      expect(cache.get('a')).toBeUndefined()
    })
  })

  describe('fetch() function', () => {
    it('should return existing value on hit', async () => {
      cache.set('a', 'original')
      const result = await cache.fetch('a', () => 'generated')
      expect(result).toBe('original')
      expect(cache.size).toBe(1)
    })

    it('should generate and store on miss', async () => {
      const result = await cache.fetch('a', (k) => `generated-${k}`)
      expect(result).toBe('generated-a')
      expect(cache.get('a')).toBe('generated-a')
    })

    it('should throw when generator returns undefined', async () => {
      expect(cache.fetch('a', () => undefined as any)).rejects.toThrow(TypeError)
    })
  })

  describe('rotation behavior', () => {
    it('should maintain the [N,2N] bounds', async () => {
      // Fill to max - no rotation yet
      await cache.fetch('a', () => 'A')
      await cache.fetch('b', () => 'B')
      await cache.fetch('c', () => 'C')
      expect(cache.size).toBe(3) // current={a,b,c}

      await cache.fetch('d', () => 'D')
      await cache.fetch('e', () => 'E')
      await cache.fetch('f', () => 'F')
      expect(cache.size).toBe(6) // current={d,e,f} previous={a,b,c}

      await cache.fetch('g', () => 'G')
      expect(cache.size).toBe(4) // current={g} previous={d,e,f}
      expect(cache.get('a')).toBeUndefined()
      expect(cache.get('d')).toBe('D')
    })
  })

  describe('edge cases', () => {
    it('should handle empty cache operations', () => {
      expect(cache.get('missing')).toBeUndefined()
      expect(cache.has('missing')).toBe(false)
      expect(cache.size).toBe(0)
      cache.clear() // Should not throw
      expect(cache.size).toBe(0)
    })

    it('should handle maxSize=1 through multiple operations', () => {
      const small = new LRUMap<string, string>(1)

      small.set('a', 'A')
      expect(small.size).toBe(1)
      expect(small.get('a')).toBe('A')

      small.set('b', 'B')
      expect(small.size).toBe(2) // previous={a}, current={b}

      small.set('c', 'C')
      expect(small.size).toBe(2) // previous={b}, current={c}

      // 'a' was evicted (previous rotated away)
      expect(small.get('a')).toBeUndefined()

      // 'b' is still accessible (was promoted)
      expect(small.get('b')).toBe('B')
      // After promoting 'b': previous={c}, current={b}
    })

    it('should not cache when generator throws', async () => {
      expect(cache.fetch('a', async () => {
        throw new Error('Generator failed')
      })).rejects.toThrow('Generator failed')

      expect(cache.has('a')).toBe(false)
      expect(cache.size).toBe(0)
    })

    it('should clear both maps after rotation', () => {
      cache.set('a', 'A')
      cache.set('b', 'B')
      cache.set('c', 'C')
      cache.set('d', 'D') // Rotate

      cache.clear()

      expect(cache.size).toBe(0)
      expect(cache.get('a')).toBeUndefined()
      expect(cache.get('d')).toBeUndefined()
    })

    it('should handle sequential access pattern A,B,C,A,B,C', async () => {
      for (let i = 0; i < 5; i++) {
        await cache.fetch('a', () => 'A')
        await cache.fetch('b', () => 'B')
        await cache.fetch('c', () => 'C')
      }

      expect(cache.size).toBe(3)
      expect(cache.get('a')).toBe('A')
      expect(cache.get('b')).toBe('B')
      expect(cache.get('c')).toBe('C')
    })

    it('should handle updating items in previous generation', async () => {
      await cache.fetch('a', () => 'A')
      await cache.fetch('b', () => 'B')
      await cache.fetch('c', () => 'C')

      // Move to previous
      await cache.fetch('d', () => 'D')

      // Update in previous - should mark for promotion
      cache.set('a', 'A-updated')
      expect(cache.get('a')).toBe('A-updated')
    })

    describe('at current.size == max boundary', () => {
      it('handles update of current generation key', () => {
        cache.set('a', 'A')
        cache.set('b', 'B')
        cache.set('c', 'C')

        cache.set('a', 'A-updated')
        expect(cache.get('a')).toBe('A-updated')
        expect(cache.get('b')).toBe('B')
        expect(cache.get('c')).toBe('C')
      })

      it('handles update of previous generation key', () => {
        cache.set('a', 'A')
        cache.set('b', 'B')
        cache.set('c', 'C')
        cache.set('d', 'D')
        cache.set('e', 'E')
        cache.set('f', 'F')

        cache.set('a', 'A-updated')
        expect(cache.get('a')).toBe('A-updated')
        expect(cache.get('b')).toBeUndefined()
        expect(cache.get('c')).toBeUndefined()
        expect(cache.get('d')).toBe('D')
        expect(cache.get('e')).toBe('E')
        expect(cache.get('f')).toBe('F')
      })
    })
  })
})
