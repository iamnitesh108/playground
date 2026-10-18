// AWS Signature Version 4 for S3, written out step by step (the same steps lesson "The S3 API on the wire"
// walks through). Used to send requests a normal client would not: e.g. one signed with a clock that is wrong.
import { createHash, createHmac } from 'node:crypto'
import { request } from 'node:http'

const sha256 = (data) => createHash('sha256').update(data).digest('hex')
const hmac = (key, data) => createHmac('sha256', key).update(data).digest()

/** 20261018T130000Z */
export const amzDate = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')

/**
 * Signs a request. `path` is the URI path (already encoded), `query` an object, `headers` lowercase names.
 * Returns the headers to send plus every intermediate value.
 */
export function sign({ method, path, query = {}, headers = {}, body = '', accessKey, secretKey, region = 'us-east-1', service = 's3', date = new Date() }) {
  const stamp = amzDate(date)
  const day = stamp.slice(0, 8)
  const payloadHash = sha256(body)
  const all = { ...headers, 'x-amz-content-sha256': payloadHash, 'x-amz-date': stamp }
  const names = Object.keys(all).map((h) => h.toLowerCase()).sort()
  const canonicalQuery = Object.keys(query)
    .sort()
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(query[k])}`)
    .join('&')
  // 1. canonical request
  const canonicalRequest = [method, path, canonicalQuery, ...names.map((n) => `${n}:${String(all[n]).trim()}`), '', names.join(';'), payloadHash].join('\n')
  // 2. string to sign
  const scope = `${day}/${region}/${service}/aws4_request`
  const stringToSign = ['AWS4-HMAC-SHA256', stamp, scope, sha256(canonicalRequest)].join('\n')
  // 3. signing key: four HMACs, starting from "AWS4" + secret key
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${secretKey}`, day), region), service), 'aws4_request')
  // 4. signature
  const signature = createHmac('sha256', signingKey).update(stringToSign).digest('hex')
  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${names.join(';')}, Signature=${signature}`
  return { headers: { ...all, authorization }, canonicalRequest, stringToSign, signature, query: canonicalQuery }
}

/** Sends a signed request to localhost:<port>, presenting `host` as the Host header. */
export function send({ port, method, path, query, headers, body = '' }) {
  return new Promise((resolve, reject) => {
    const qs = query ? `?${query}` : ''
    const req = request({ host: '127.0.0.1', port, method, path: path + qs, headers }, (res) => {
      let data = ''
      res.on('data', (d) => (data += d))
      res.on('end', () => resolve({ status: res.statusCode, statusText: res.statusMessage, headers: res.headers, body: data }))
    })
    req.on('error', reject)
    req.end(body)
  })
}
