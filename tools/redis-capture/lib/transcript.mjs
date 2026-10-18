// Records commands and their replies as an interactive redis-cli would show them.
import { formatReply, splitArgs } from './format.mjs'

export class Transcript {
  constructor() {
    this.steps = []
    this.t0 = Date.now()
  }

  /** Runs one command line on a client and records it. `who` labels the connection. */
  async run(client, line, who) {
    const reply = await client.send(...splitArgs(line))
    this.steps.push({ ...(who ? { who } : {}), cmd: line, out: formatReply(reply).trimEnd() })
    return reply
  }

  /** Records a step whose reply arrives later (a blocked command). Returns a function to await it. */
  start(client, line, who) {
    this.steps.push({ ...(who ? { who } : {}), cmd: line, out: '(blocked, waiting…)' })
    const pending = client.send(...splitArgs(line))
    return async () => {
      const reply = await pending
      this.steps.push({ ...(who ? { who } : {}), cmd: `(${splitArgs(line)[0]} returns)`, out: formatReply(reply).trimEnd() })
      return reply
    }
  }

  /** A narrative line between commands, e.g. "(2 seconds later)". */
  note(text) { this.steps.push({ note: text }) }

  /** Records shell commands' text output (redis-cli flags, ls, …) as a step. */
  shell(cmd, out) { this.steps.push({ shell: true, cmd, out: out.trimEnd() }) }
}
