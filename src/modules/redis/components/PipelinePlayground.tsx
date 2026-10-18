import { useState } from 'react'
import { Demo } from '@/shared/ui'
import { totalMs } from '../simulation/pipeline'
import { BarList } from './BarList'
import { Slider } from './Slider'
import styles from './play.module.css'

const fmt = (ms: number) => (ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : `${ms.toFixed(ms < 10 ? 1 : 0)} ms`)

/** time ≈ round trips × RTT + commands × server time */
export function PipelinePlayground() {
  const [commands, setCommands] = useState(10_000)
  const [rtt, setRtt] = useState(0.5)
  const [batch, setBatch] = useState(100)
  const serverUs = 1.5
  const one = totalMs({ commands, rttMs: rtt, serverUs, batch: 1 })
  const piped = totalMs({ commands, rttMs: rtt, serverUs, batch })
  const single = totalMs({ commands, rttMs: rtt, serverUs, batch: commands })
  return (
    <Demo
      title="Round trips decide the time, not the server"
      hint="0.05 ms is a fast local network; 0.5 ms is two machines in one data centre; 30 ms is another region. The server spends about 1.5 µs executing a simple command."
      controls={
        <>
          <Slider label="commands" value={commands} min={100} max={100_000} step={100} format={(v) => v.toLocaleString()} onChange={setCommands} />
          <Slider label="round trip" value={rtt} min={0.05} max={30} step={0.05} format={(v) => `${v} ms`} onChange={setRtt} />
          <Slider label="pipeline size" value={batch} min={2} max={1000} format={(v) => `${v}`} onChange={setBatch} />
        </>
      }
    >
      <BarList
        title={`Time to send ${commands.toLocaleString()} commands`}
        bars={[
          { label: 'one at a time', value: one, display: fmt(one) },
          { label: `pipelines of ${batch}`, value: piped, display: fmt(piped), emphasis: true },
          { label: 'one big pipeline', value: single, display: fmt(single) },
        ]}
      />
      <dl className={styles.stats}>
        <div><dt>round trips, one at a time</dt><dd>{commands.toLocaleString()}</dd></div>
        <div><dt>round trips, pipelined</dt><dd>{Math.ceil(commands / batch).toLocaleString()}</dd></div>
        <div className={styles.good}><dt>speed-up</dt><dd>{(one / piped).toFixed(1)}×</dd></div>
      </dl>
    </Demo>
  )
}
