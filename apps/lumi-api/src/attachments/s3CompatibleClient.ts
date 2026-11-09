import { createHash, createHmac } from 'node:crypto';

export type S3CompatibleConfig = {
  readonly endpoint: string;
  readonly region: string;
  readonly bucket: string;
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
  /** Cloudflare R2 path-style URLs are the default for private family blobs. */
  readonly forcePathStyle?: boolean;
};

export type S3Fetch = (
  input: string,
  init: {
    method: string;
    headers: Record<string, string>;
    body?: Uint8Array;
  },
) => Promise<{
  status: number;
  headers: Headers | { get(name: string): string | null };
  arrayBuffer(): Promise<ArrayBuffer>;
}>;

function sha256Hex(bytes: Uint8Array | string): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function hmac(key: Buffer | string, value: string): Buffer {
  return createHmac('sha256', key).update(value, 'utf8').digest();
}

function amzDate(now: Date): { amzDate: string; dateStamp: string } {
  const iso = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  return { amzDate: iso, dateStamp: iso.slice(0, 8) };
}

/**
 * Minimal S3-compatible client for private attachment objects. Uses SigV4 so
 * the same adapter can target R2 (eu) without a public CDN URL.
 */
export function createS3CompatibleClient(input: {
  readonly config: S3CompatibleConfig;
  readonly fetchImpl?: S3Fetch;
  readonly now?: () => Date;
}) {
  const fetchImpl = input.fetchImpl ?? (globalThis.fetch as unknown as S3Fetch);
  const nowFn = input.now ?? (() => new Date());
  const endpoint = input.config.endpoint.replace(/\/$/, '');
  const pathStyle = input.config.forcePathStyle !== false;

  function objectUrl(objectKey: string): { url: string; canonicalUri: string } {
    const encodedKey = objectKey
      .split('/')
      .map((part) => encodeURIComponent(part))
      .join('/');
    if (pathStyle) {
      const canonicalUri = `/${input.config.bucket}/${encodedKey}`;
      return { url: `${endpoint}${canonicalUri}`, canonicalUri };
    }
    const host = new URL(endpoint).host;
    return {
      url: `https://${input.config.bucket}.${host}/${encodedKey}`,
      canonicalUri: `/${encodedKey}`,
    };
  }

  async function signedRequest(init: {
    method: string;
    objectKey: string;
    body?: Uint8Array;
    contentType?: string;
    extraHeaders?: Record<string, string>;
  }) {
    const { amzDate: amz, dateStamp } = amzDate(nowFn());
    const { url, canonicalUri } = objectUrl(init.objectKey);
    const host = new URL(url).host;
    const payloadHash = sha256Hex(init.body ?? '');
    const headers: Record<string, string> = {
      host,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amz,
      ...(init.contentType ? { 'content-type': init.contentType } : {}),
      ...(init.extraHeaders ?? {}),
    };
    const signedHeaderNames = Object.keys(headers)
      .map((name) => name.toLowerCase())
      .sort();
    const canonicalHeaders = signedHeaderNames
      .map((name) => `${name}:${headers[name]!.trim()}\n`)
      .join('');
    const signedHeaders = signedHeaderNames.join(';');
    const canonicalRequest = [
      init.method,
      canonicalUri,
      '',
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join('\n');
    const credentialScope = `${dateStamp}/${input.config.region}/s3/aws4_request`;
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amz,
      credentialScope,
      sha256Hex(canonicalRequest),
    ].join('\n');
    const kDate = hmac(`AWS4${input.config.secretAccessKey}`, dateStamp);
    const kRegion = hmac(kDate, input.config.region);
    const kService = hmac(kRegion, 's3');
    const kSigning = hmac(kService, 'aws4_request');
    const signature = createHmac('sha256', kSigning).update(stringToSign, 'utf8').digest('hex');
    headers.authorization = `AWS4-HMAC-SHA256 Credential=${input.config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const response = await fetchImpl(url, {
      method: init.method,
      headers,
      ...(init.body ? { body: init.body } : {}),
    });
    return response;
  }

  return {
    async putObject(objectKey: string, bytes: Uint8Array, contentType: string) {
      const response = await signedRequest({
        method: 'PUT',
        objectKey,
        body: bytes,
        contentType,
      });
      return response.status >= 200 && response.status < 300;
    },
    async getObject(objectKey: string) {
      const response = await signedRequest({ method: 'GET', objectKey });
      if (response.status === 404) return null;
      if (response.status < 200 || response.status >= 300) return null;
      return new Uint8Array(await response.arrayBuffer());
    },
    async deleteObject(objectKey: string) {
      const response = await signedRequest({ method: 'DELETE', objectKey });
      return response.status === 204 || response.status === 200 || response.status === 404;
    },
  };
}

export type S3CompatibleClient = ReturnType<typeof createS3CompatibleClient>;
