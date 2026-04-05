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

    it('should throw when cache() generator returns undefined', async () => {
      await expect(cache.fetch('a', async () => undefined as any)).rejects.toThrow(TypeError)
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

  describe('cache() function', () => {
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
      await expect(cache.fetch('a', () => undefined as any)).rejects.toThrow(TypeError)
    })
  })

  describe('rotation behavior', () => {
    it('should trigger rotation when current + promoteSet exceeds max', async () => {
      // Fill to max - no rotation yet
      await cache.fetch('a', () => 'A')
      await cache.fetch('b', () => 'B')
      await cache.fetch('c', () => 'C')
      expect(cache.size).toBe(3)  // All in current

      // Add d - triggers rotation (current.size = 3, promoteSet.size = 0)
      await cache.fetch('d', () => 'D')
      // Rotation: previous becomes {a,b,c,d}, current cleared
      expect(cache.size).toBe(4)
    })

    it('should promote items accessed from previous generation', async () => {
      // Fill current
      await cache.fetch('a', () => 'A')
      await cache.fetch('b', () => 'B')
      await cache.fetch('c', () => 'C')

      // Trigger rotation - a,b,c move to previous
      await cache.fetch('d', () => 'D')
      // After rotation: previous = {a,b,c}, current = {d}
      
      // Access items from previous - they get promoted on next rotation
      cache.get('a')  // a in promoteSet
      cache.get('b')  // b in promoteSet

      // Add e - promoteSet size is 2, current size is 1 (d)
      // 1 + 2 = 3 >= 3, triggers rotation
      // a and b promoted to current, then swapped to previous
      await cache.fetch('e', () => 'E')
      // After rotation: previous = {d,a,b}, current = {e}
      expect(cache.size).toBe(4)
      expect(cache.get('a')).toBe('A')  // a survived in previous
      expect(cache.get('b')).toBe('B')  // b survived in previous
    })
  })

  describe('edge cases', () => {
    it('should handle sequential access pattern A,B,C,A,B,C', async () => {
      const cache2 = new LRUMap<string, string>(3)

      for (let i = 0; i < 5; i++) {
        await cache2.fetch('a', () => 'A')
        await cache2.fetch('b', () => 'B')
        await cache2.fetch('c', () => 'C')
      }

      expect(cache2.size).toBe(3)
      expect(cache2.get('a')).toBe('A')
      expect(cache2.get('b')).toBe('B')
      expect(cache2.get('c')).toBe('C')
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

    it('should cycle through N unique keys without losing working set', async () => {
      const cache2 = new LRUMap<string, string>(4)

      // 10 complete cycles through 4 keys
      for (let i = 0; i < 10; i++) {
        await cache2.fetch('a', () => 'A')
        await cache2.fetch('b', () => 'B')
        await cache2.fetch('c', () => 'C')
        await cache2.fetch('d', () => 'D')
      }

      expect(cache2.size).toBe(4)
      expect(cache2.get('a')).toBe('A')
      expect(cache2.get('b')).toBe('B')
      expect(cache2.get('c')).toBe('C')
      expect(cache2.get('d')).toBe('D')
    })
  })

  describe('storage bounds', () => {
    it('should have storage between [N, 2N]', async () => {
      // Fill to max
      cache.set('a', 'A')
      cache.set('b', 'B')
      cache.set('c', 'C')
      expect(cache.size).toBe(3)

      // Access some to populate promoteSet
      cache.get('a')
      cache.get('b')

      // Add more - promoteSet = {a,b}, current empty
      // size = 3 + 2 = 5 before rotation
      cache.set('d', 'D')
      expect(cache.size).toBe(4)
    })
  })
})