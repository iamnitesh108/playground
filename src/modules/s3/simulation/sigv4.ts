/*
 * AWS Signature Version 4, step by step, with the Web Crypto API (in browsers and in Node).
 * Given the canonical request a client built, it recomputes the string to sign, the signing key and the
 * signature — the same work the server does to check a request.
 */

const encoder = new TextEncoder()

export const toHex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')

export async function sha256Hex(text: string): Promise<string> {
  return toHex(await crypto.subtle.digest('SHA-256', encoder.encode(text)))
}

async function hmac(key: ArrayBuffer | Uint8Array<ArrayBuffer>, data: string): Promise<ArrayBuffer> {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return crypto.subtle.sign('HMAC', k, encoder.encode(data))
}

export interface CanonicalParts {
  method: string
  path: string
  query: string
  headers: [string, string][]
  signedHeaders: string
  payloadHash: string
}

/** Splits a canonical request into its six parts. */
export function parseCanonical(canonical: string): CanonicalParts {
  const lines = canonical.split('\n')
  const blank = lines.indexOf('', 3)
  return {
    method: lines[0],
    path: lines[1],
    query: lines[2],
    headers: lines.slice(3, blank).map((l) => [l.slice(0, l.indexOf(':')), l.slice(l.indexOf(':') + 1)]),
    signedHeaders: lines[blank + 1],
    payloadHash: lines[blank + 2],
  }
}

/** Puts the parts back together: one line each, headers as name:value, a blank line after the headers. */
export function buildCanonical(p: CanonicalParts): string {
  return [p.method, p.path, p.query, ...p.headers.map(([n, v]) => `${n}:${v}`), '', p.signedHeaders, p.payloadHash].join('\n')
}

export interface SigningInput {
  canonicalRequest: string
  /** x-amz-date, e.g. 20261018T130746Z */
  amzDate: string
  region: string
  service: string
  secretKey: string
}

export interface SigningSteps {
  canonicalHash: string
  scope: string
  stringToSign: string
  kDate: string
  kRegion: string
  kService: string
  kSigning: string
  signature: string
}

export async function signSteps({ canonicalRequest, amzDate, region, service, secretKey }: SigningInput): Promise<SigningSteps> {
  const day = amzDate.slice(0, 8)
  const canonicalHash = await sha256Hex(canonicalRequest)
  const scope = `${day}/${region}/${service}/aws4_request`
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, canonicalHash].join('\n')
  const kDate = await hmac(encoder.encode(`AWS4${secretKey}`), day)
  const kRegion = await hmac(kDate, region)
  const kService = await hmac(kRegion, service)
  const kSigning = await hmac(kService, 'aws4_request')
  const signature = toHex(await hmac(kSigning, stringToSign))
  return { canonicalHash, scope, stringToSign, kDate: toHex(kDate), kRegion: toHex(kRegion), kService: toHex(kService), kSigning: toHex(kSigning), signature }
}
