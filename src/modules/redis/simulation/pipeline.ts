/*
 * Round trips. Every command waits for its reply before the next is sent, unless
 * commands are pipelined: written together and answered together.
 * time ≈ round trips × RTT + commands × server time per command.
 */

export interface PipelineInput {
  commands: number
  rttMs: number
  /** Server time per simple command, microseconds. */
  serverUs: number
  /** Commands per round trip (1 = no pipelining). */
  batch: number
}

export function totalMs({ commands, rttMs, serverUs, batch }: PipelineInput): number {
  const trips = Math.ceil(commands / Math.max(1, batch))
  return trips * rttMs + (commands * serverUs) / 1000
}

export function throughput(input: PipelineInput): number {
  return input.commands / (totalMs(input) / 1000)
}
