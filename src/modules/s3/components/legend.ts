import type { Hue } from '@/shared/figures'

/** One meaning per colour, the same in every figure of the module. */
export const HUE = {
  client: 1,
  server: 2,
  data: 3,
  disk: 4,
  identity: 5,
  ok: 6,
  network: 7,
  error: 8,
} as const satisfies Record<string, Hue>

export const LEGEND: readonly { hue: Hue; label: string }[] = [
  { hue: HUE.client, label: 'client / your application' },
  { hue: HUE.server, label: 'S3 server (RustFS)' },
  { hue: HUE.data, label: 'bucket / object / data' },
  { hue: HUE.disk, label: 'disk / drive' },
  { hue: HUE.identity, label: 'identity / policy / key' },
  { hue: HUE.ok, label: 'success / allowed' },
  { hue: HUE.network, label: 'network / HTTP / signing' },
  { hue: HUE.error, label: 'error / denied / failed' },
]
