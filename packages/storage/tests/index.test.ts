import { describe, expect, it } from 'vitest';

import {
  StorageConfigError,
  bucketConfig,
  isAbsoluteUrl,
  objectKey,
  publicUrl,
} from '../src/index';

const config = bucketConfig('https://bucket.example.com', 'leela');

describe('bucketConfig', () => {
  it('keeps a valid endpoint and bucket', () => {
    expect(config).toEqual({
      endpoint: 'https://bucket.example.com',
      bucket: 'leela',
    });
  });

  it('drops a trailing slash, so joining cannot produce //', () => {
    expect(bucketConfig('https://bucket.example.com/', 'leela').endpoint).toBe(
      'https://bucket.example.com',
    );
  });

  it('trims surrounding whitespace, which env files collect', () => {
    expect(bucketConfig('  https://b.example.com  ', ' leela ')).toEqual({
      endpoint: 'https://b.example.com',
      bucket: 'leela',
    });
  });

  it('accepts http, so a local MinIO can be pointed at', () => {
    expect(bucketConfig('http://localhost:9000', 'leela').endpoint).toBe(
      'http://localhost:9000',
    );
  });

  it.each([
    ['undefined endpoint', undefined, 'leela', 'endpoint is empty'],
    ['empty endpoint', '   ', 'leela', 'endpoint is empty'],
    ['schemeless endpoint', 'bucket.example.com', 'leela', 'must start with'],
    ['undefined bucket', 'https://b.example.com', undefined, 'bucket is empty'],
    ['empty bucket', 'https://b.example.com', ' ', 'bucket is empty'],
    ['bucket with a path', 'https://b.example.com', 'leela/images', 'not a path'],
  ])('rejects %s at startup rather than at the first image', (
    _label,
    endpoint,
    bucket,
    expected,
  ) => {
    expect(() => bucketConfig(endpoint, bucket)).toThrow(StorageConfigError);
    expect(() => bucketConfig(endpoint, bucket)).toThrow(
      new RegExp(expected as string),
    );
  });
});

describe('isAbsoluteUrl', () => {
  it.each([
    ['https', 'https://cdn.example.com/a.png', true],
    ['http', 'http://cdn.example.com/a.png', true],
    ['uppercase scheme', 'HTTPS://cdn.example.com/a.png', true],
    ['padded', '  https://cdn.example.com/a.png  ', true],
    ['a firebase key', 'images/avatar.png', false],
    ['a bare name', 'avatar.png', false],
    ['empty', '', false],
    ['null', null, false],
    ['undefined', undefined, false],
  ])('%s -> %s', (_label, reference, expected) => {
    expect(isAbsoluteUrl(reference as string | null | undefined)).toBe(expected);
  });
});

describe('objectKey', () => {
  it('keeps the images/ prefix, so a bulk copy is key -> key', () => {
    expect(objectKey('images/avatar.png')).toBe('images/avatar.png');
  });

  it('accepts a bare file name', () => {
    expect(objectKey('avatar.png')).toBe('avatar.png');
  });

  it('strips leading and trailing slashes', () => {
    expect(objectKey('/images/avatar.png/')).toBe('images/avatar.png');
  });

  it('trims whitespace', () => {
    expect(objectKey('  images/avatar.png  ')).toBe('images/avatar.png');
  });

  it('returns null for an absolute url, which needs no key', () => {
    expect(objectKey('https://cdn.example.com/a.png')).toBeNull();
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['empty', ''],
    ['whitespace', '   '],
    ['only slashes', '///'],
  ])('returns null for %s, so the caller picks its own placeholder', (
    _label,
    reference,
  ) => {
    expect(objectKey(reference as string | null | undefined)).toBeNull();
  });

  it('refuses a key that climbs out of its prefix', () => {
    expect(objectKey('images/../secrets/key.txt')).toBeNull();
  });

  it('allows a dot segment that is part of a name', () => {
    expect(objectKey('images/..hidden.png')).toBe('images/..hidden.png');
  });
});

describe('publicUrl', () => {
  it('addresses an object without asking anyone', () => {
    expect(publicUrl(config, 'images/avatar.png')).toBe(
      'https://bucket.example.com/leela/images/avatar.png',
    );
  });

  it('passes an already-migrated url straight through', () => {
    expect(publicUrl(config, 'https://cdn.example.com/a.png')).toBe(
      'https://cdn.example.com/a.png',
    );
  });

  it('returns null when there is nothing to address', () => {
    expect(publicUrl(config, null)).toBeNull();
    expect(publicUrl(config, '')).toBeNull();
  });

  it('encodes a space, which Firebase file names contain', () => {
    expect(publicUrl(config, 'images/my avatar.png')).toBe(
      'https://bucket.example.com/leela/images/my%20avatar.png',
    );
  });

  it('encodes non-ascii names', () => {
    expect(publicUrl(config, 'images/аватар.png')).toBe(
      'https://bucket.example.com/leela/images/%D0%B0%D0%B2%D0%B0%D1%82%D0%B0%D1%80.png',
    );
  });

  it('keeps path separators unencoded, so the prefix stays a prefix', () => {
    expect(publicUrl(config, 'images/nested/a.png')).toBe(
      'https://bucket.example.com/leela/images/nested/a.png',
    );
  });

  it('never produces a double slash', () => {
    const padded = bucketConfig('https://bucket.example.com/', 'leela');
    expect(publicUrl(padded, '/images/a.png')).toBe(
      'https://bucket.example.com/leela/images/a.png',
    );
  });
});
