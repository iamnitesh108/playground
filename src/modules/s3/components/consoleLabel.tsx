import { CONSOLE } from '../data/console'

export type ConsolePage = keyof typeof CONSOLE.pages

/** A label the RustFS console really shows (from the recording); fails loudly if the recording no longer has it. */
export function consoleLabel(page: ConsolePage, text: string) {
  if (!(CONSOLE.pages[page] as readonly string[]).some((l) => l === text || l.startsWith(`${text} `) || l.startsWith(`${text}:`))) {
    throw new Error(`console page ${page} has no "${text}"`)
  }
  return <strong>{text}</strong>
}
