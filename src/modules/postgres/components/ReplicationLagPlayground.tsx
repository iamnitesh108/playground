import { useMemo, useState } from 'react'
import { StatTiles } from '@/shared/figures'
import { Demo, Segmented } from '@/shared/ui'
import { simulateLag, waitsFor, type SyncLevel } from '../simulation/replicationLag'
import { ReplicationLsnChart } from './ReplicationLsnChart'
import styles from './ReplicationLagPlayground.module.css'

const LEVELS: { value: SyncLevel; label: string }[] = [
  { value: 'off', label: 'off' },
  { value: 'local', label: 'local' },
  { value: 'remote_write', label: 'remote_write' },
  { value: 'on', label: 'on' },
  { value: 'remote_apply', label: 'remote_apply' },
]

const fmtMs = (ms: number) => (!Number.isFinite(ms) ? 'waiting…' : ms < 1 ? `${ms.toFixed(2)} ms` : `${ms.toFixed(ms < 10 ? 1 : 0)} ms`)

/** synchronous_commit × a standby: commit time, failover loss and stale reads over a minute of writes. */
export function ReplicationLagPlayground() {
  const [level, setLevel] = useState<SyncLevel>('on')
  const [sync, setSync] = useState<'yes' | 'no'>('yes')
  const [rtt, setRtt] = useState(2)
  const [replay, setReplay] = useState(50)
  const [outage, setOutage] = useState<'none' | 'down'>('none')
  const WRITE = 10
  const r = useMemo(
    () =>
      simulateLag({
        level,
        syncStandby: sync === 'yes',
        rttMs: rtt,
        writeMBps: WRITE,
        replayMBps: (WRITE * replay) / 100,
        outage: outage === 'down' ? { from: 20, to: 35 } : null,
        flushMs: 1,
        duration: 60,
      }),
    [level, sync, rtt, replay, outage],
  )
  const every = r.samples.filter((_, i) => i % 5 === 0)
  const waits = waitsFor(level, sync === 'yes')
  return (
    <Demo
      title="A primary, a standby and synchronous_commit"
      hint="Clients write 10 MB of WAL per second for a minute. Pick what COMMIT waits for, slow the standby’s replay, or take the standby away for 15 seconds."
      controls={
        <div className={styles.controls}>
          <Segmented label="synchronous_commit" value={level} options={LEVELS} onChange={setLevel} />
          <Segmented label="synchronous_standby_names" value={sync} options={[{ value: 'yes', label: "'standby1'" }, { value: 'no', label: "'' (async)" }]} onChange={setSync} />
          <Segmented label="network round trip" value={rtt} options={[1, 2, 10, 50].map((v) => ({ value: v, label: `${v} ms` }))} onChange={setRtt} />
          <Segmented label="standby replay speed" value={replay} options={[50, 100, 200].map((v) => ({ value: v, label: `${v} %` }))} onChange={setReplay} />
          <Segmented label="standby" value={outage} options={[{ value: 'none', label: 'always up' }, { value: 'down', label: 'down 20–35 s' }]} onChange={setOutage} />
        </div>
      }
    >
      <p className={styles.waits}>
        COMMIT waits for: <strong>{waits}</strong>
      </p>
      <ReplicationLsnChart
        title="WAL position over time (MB since start)"
        series={[
          { label: 'primary wrote', hue: 4, points: every.map((s) => [s.t, s.primary]) },
          { label: 'standby flushed', hue: 5, points: every.map((s) => [s.t, s.flushed]), dashed: true },
          { label: 'standby replayed', hue: 6, points: every.map((s) => [s.t, s.replayed]) },
        ]}
        bands={outage === 'down' ? [{ from: 20, to: 35, label: 'standby down' }] : []}
      />
      <StatTiles
        stats={[
          { label: 'one COMMIT takes', value: fmtMs(r.commitMs), sub: 'at the end of the minute', hue: 1 },
          { label: 'lost by a failover at the worst moment', value: `${r.unflushedMB.toFixed(1)} MB`, sub: r.unflushedMB > 0.05 ? `committed, not on the standby (at ${r.unflushedAt.toFixed(0)} s)` : 'every commit reached the standby in time', hue: r.unflushedMB > 0.05 ? 8 : 6 },
          { label: 'standby reads are behind', value: `${r.replayLagS.toFixed(1)} s`, sub: 'replay lag', hue: 5 },
          { label: 'commits stalled', value: `${r.blockedS} s`, sub: 'waiting for the standby', hue: r.blockedS > 0 ? 8 : 6 },
        ]}
      />
      <p className={styles.risk}>{r.risk}</p>
      <p className={styles.note}>Model, not a recording: constant load, a 120 MB/s link, 1 ms fsync on both servers. The recorded numbers are above.</p>
    </Demo>
  )
}
