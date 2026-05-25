/**
 * tfidf.test.ts — Unit tests for TF-IDF keyword extraction service
 */

import { describe, it, expect } from 'vitest';
import { tokenize, computeTFIDF, generateSnowball } from './tfidf';

// ─── tokenize() ───────────────────────────────────────────────────────────────

describe('tokenize()', () => {
  it('removes stopwords (the, a, for, with, etc.)', () => {
    const result = tokenize('the quick brown fox for a test with items');
    expect(result).not.toContain('the');
    expect(result).not.toContain('a');
    expect(result).not.toContain('for');
    expect(result).not.toContain('with');
  });

  it('filters tokens shorter than 3 characters', () => {
    const result = tokenize('ab cd ef long word');
    expect(result).not.toContain('ab');
    expect(result).not.toContain('cd');
    expect(result).not.toContain('ef');
    expect(result).toContain('long');
    expect(result).toContain('word');
  });

  it('lowercases everything', () => {
    const result = tokenize('APPLE iPhone Samsung GALAXY');
    expect(result).toContain('apple');
    expect(result).toContain('iphone');
    expect(result).toContain('samsung');
    expect(result).toContain('galaxy');
    expect(result).not.toContain('APPLE');
    expect(result).not.toContain('iPhone');
  });

  it('returns empty array for empty string', () => {
    const result = tokenize('');
    expect(result).toEqual([]);
  });

  it('returns empty array for string with only stopwords', () => {
    const result = tokenize('the a an for with by');
    expect(result).toEqual([]);
  });
});

// ─── computeTFIDF() ───────────────────────────────────────────────────────────

describe('computeTFIDF()', () => {
  it('returns empty array for empty titles array', () => {
    const result = computeTFIDF([]);
    expect(result).toEqual([]);
  });

  it('returns KeywordScore array sorted by tfidf descending', () => {
    const titles = [
      'Apple iPhone 14 Pro Max 256GB Unlocked Smartphone',
      'Samsung Galaxy S23 Ultra 512GB Android Phone',
      'Google Pixel 7 Pro 128GB Unlocked Android Smartphone',
    ];
    const result = computeTFIDF(titles);
    expect(result.length).toBeGreaterThan(0);
    // Verify sorted descending by tfidf
    for (let i = 0; i < result.length - 1; i++) {
      expect(result[i].tfidf).toBeGreaterThanOrEqual(result[i + 1].tfidf);
    }
  });

  it('each result has required KeywordScore fields', () => {
    const titles = ['Wireless Bluetooth Headphones Noise Cancelling Over Ear'];
    const result = computeTFIDF(titles);
    expect(result.length).toBeGreaterThan(0);
    const first = result[0];
    expect(first).toHaveProperty('term');
    expect(first).toHaveProperty('tf');
    expect(first).toHaveProperty('idf');
    expect(first).toHaveProperty('tfidf');
    expect(first).toHaveProperty('count');
    expect(typeof first.term).toBe('string');
    expect(typeof first.tfidf).toBe('number');
  });

  it('terms appearing in more titles get lower IDF', () => {
    // 'phone' appears in all 3 titles → lower IDF than 'apple' which appears in 1
    const titles = [
      'Apple iPhone phone case',
      'Samsung Galaxy phone cover',
      'Google Pixel phone screen',
    ];
    const result = computeTFIDF(titles);
    const phoneScore = result.find(r => r.term === 'phone');
    const appleScore = result.find(r => r.term === 'apple');
    // phone appears in all docs → lower IDF
    if (phoneScore && appleScore) {
      expect(phoneScore.idf).toBeLessThan(appleScore.idf);
    }
  });
});

// ─── generateSnowball() ───────────────────────────────────────────────────────

describe('generateSnowball()', () => {
  it('returns SnowballResult with correct seed', () => {
    const seed = 'wireless headphones';
    const titles = ['Wireless Bluetooth Headphones Over Ear Noise Cancelling'];
    const result = generateSnowball(seed, titles);
    expect(result.seed).toBe(seed);
  });

  it('returns max 20 keywords', () => {
    // Provide many unique titles to generate many keywords
    const titles = Array.from({ length: 30 }, (_, i) =>
      `Product${i} Widget${i} Gadget${i} Device${i} Item${i} Model${i} Version${i}`
    );
    const result = generateSnowball('test', titles);
    expect(result.keywords.length).toBeLessThanOrEqual(20);
  });

  it('generatedAt is a valid ISO string', () => {
    const result = generateSnowball('test', ['Sample product title here']);
    expect(result.generatedAt).toBeTruthy();
    const parsed = new Date(result.generatedAt);
    expect(parsed.toISOString()).toBe(result.generatedAt);
  });

  it('includes source titles in result', () => {
    const titles = ['Apple iPhone 14 Pro Max Unlocked'];
    const result = generateSnowball('iphone', titles);
    expect(result.titles).toEqual(titles);
  });
});
