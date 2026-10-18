/*
 * How an S3 server answers ListObjectsV2 with a prefix and a delimiter. Keys are flat strings; "folders"
 * are computed at list time: every key that has the delimiter after the prefix is folded into one
 * common prefix (the key up to and including that delimiter).
 */

export interface ListResult {
  /** "Folders": distinct key beginnings ending in the delimiter. */
  commonPrefixes: string[]
  /** Objects directly at this level. */
  contents: string[]
}

/** Byte order of UTF-8 keys, which is the order S3 lists them in. */
export function compareKeys(a: string, b: string): number {
  const ea = new TextEncoder().encode(a)
  const eb = new TextEncoder().encode(b)
  for (let i = 0; i < Math.min(ea.length, eb.length); i++) if (ea[i] !== eb[i]) return ea[i] - eb[i]
  return ea.length - eb.length
}

export function listObjects(keys: readonly string[], prefix = '', delimiter = ''): ListResult {
  const prefixes = new Set<string>()
  const contents: string[] = []
  for (const key of [...keys].sort(compareKeys)) {
    if (!key.startsWith(prefix)) continue
    const rest = key.slice(prefix.length)
    const cut = delimiter ? rest.indexOf(delimiter) : -1
    if (cut >= 0) prefixes.add(prefix + rest.slice(0, cut + delimiter.length))
    else contents.push(key)
  }
  return { commonPrefixes: [...prefixes].sort(compareKeys), contents }
}
