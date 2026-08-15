/**
 * Where a file lives, once it stops living in Firebase Storage.
 *
 * The published app (`com.leelagame` v6.5.1) asks Firebase for a download URL
 * per avatar, per plane image, per post. When the bucket's quota is exhausted
 * every one of those calls fails, and because the app never remembers a
 * failure it asks again on the next render - the running app logged 995 of
 * them on a single launch.
 *
 * The replacement is an S3-compatible bucket (MinIO on Railway, the same shape
 * `woody` uses). Object storage addresses a file by key, so a URL can be
 * *computed* rather than requested: no round trip, nothing to fail, nothing to
 * retry. That is the whole reason this module is pure functions over a config
 * object and imports no client - the part that used to break is now arithmetic
 * on strings, and it is tested without a network.
 *
 * Uploading still needs a real client; that belongs in a service with
 * credentials, not in the app.
 */

/** Where the bucket lives and under what name. */
export interface BucketConfig {
  /** Public base, e.g. `https://bucket.example.com`. No trailing slash needed. */
  readonly endpoint: string;
  /** Bucket name, e.g. `leela`. */
  readonly bucket: string;
}

export class StorageConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StorageConfigError';
  }
}

/**
 * Firebase keys arrive as `images/<file>`; some rows carry a bare file name and
 * some carry a full `https://` URL that was already migrated. All three have to
 * survive, because the same column holds all three during a migration.
 */
export type StoredReference = string | null | undefined;

const LEADING_SLASHES = /^\/+/;
const TRAILING_SLASHES = /\/+$/;

/** Strips the slashes that turn a join into `//` or `a//b`. */
const trimSlashes = (value: string): string =>
  value.replace(LEADING_SLASHES, '').replace(TRAILING_SLASHES, '');

/**
 * Validates once, at startup, so a typo in an environment variable fails where
 * someone can see it rather than at the first image a player scrolls past.
 */
export const bucketConfig = (
  endpoint: string | undefined,
  bucket: string | undefined,
): BucketConfig => {
  const cleanEndpoint = (endpoint ?? '').trim();
  const cleanBucket = (bucket ?? '').trim();

  if (cleanEndpoint === '') {
    throw new StorageConfigError('storage endpoint is empty');
  }
  if (!/^https?:\/\//i.test(cleanEndpoint)) {
    throw new StorageConfigError(
      `storage endpoint must start with http:// or https://, got "${cleanEndpoint}"`,
    );
  }
  if (cleanBucket === '') {
    throw new StorageConfigError('storage bucket is empty');
  }
  if (cleanBucket.includes('/')) {
    throw new StorageConfigError(
      `storage bucket must be a name, not a path, got "${cleanBucket}"`,
    );
  }

  return {
    endpoint: cleanEndpoint.replace(TRAILING_SLASHES, ''),
    bucket: cleanBucket,
  };
};

/** True when the stored value is already a URL and needs no bucket at all. */
export const isAbsoluteUrl = (reference: StoredReference): boolean =>
  typeof reference === 'string' && /^https?:\/\//i.test(reference.trim());

/**
 * The object key for a value written by the published app.
 *
 * Firebase stored `images/<name>`; the bucket keeps the same prefix so a bulk
 * copy is `key -> key` and no row needs rewriting. Returns null when there is
 * nothing addressable, which is the caller's cue to use its own placeholder -
 * this module deliberately does not know what a default avatar looks like.
 */
export const objectKey = (reference: StoredReference): string | null => {
  if (typeof reference !== 'string') return null;

  const trimmed = reference.trim();
  if (trimmed === '') return null;
  if (isAbsoluteUrl(trimmed)) return null;

  const key = trimSlashes(trimmed);
  if (key === '') return null;

  // `..` in a key would address a sibling bucket path on some gateways.
  if (key.split('/').some((segment) => segment === '..')) return null;

  return key;
};

/**
 * The URL a client should load, or null when the reference addresses nothing.
 *
 * Absolute URLs pass through untouched: rows migrated ahead of the rest keep
 * working, which is what lets the move happen a table at a time.
 */
export const publicUrl = (
  config: BucketConfig,
  reference: StoredReference,
): string | null => {
  if (isAbsoluteUrl(reference)) return (reference as string).trim();

  const key = objectKey(reference);
  if (key === null) return null;

  const encoded = key.split('/').map(encodeURIComponent).join('/');
  return `${config.endpoint}/${config.bucket}/${encoded}`;
};
