import hljs from 'highlight.js/lib/core'
import bash from 'highlight.js/lib/languages/bash'
import groovy from 'highlight.js/lib/languages/groovy'
import ini from 'highlight.js/lib/languages/ini'
import java from 'highlight.js/lib/languages/java'
import javascript from 'highlight.js/lib/languages/javascript'
import json from 'highlight.js/lib/languages/json'
import lua from 'highlight.js/lib/languages/lua'
import properties from 'highlight.js/lib/languages/properties'
import sql from 'highlight.js/lib/languages/sql'
import typescript from 'highlight.js/lib/languages/typescript'
import xml from 'highlight.js/lib/languages/xml'
import yaml from 'highlight.js/lib/languages/yaml'
import { cli } from './cliLanguage'
import { conf } from './confLanguage'
import { detect } from './detect'
import { output } from './outputLanguage'
import { redis } from './redisLanguage'
import './highlight.css'

const LANGUAGES = { bash, groovy, ini, java, javascript, json, lua, properties, sql, typescript, xml, yaml, redis, cli, conf, output }
for (const [name, language] of Object.entries(LANGUAGES)) hljs.registerLanguage(name, language)

/** Names used in lessons that highlight.js knows under another name. */
const ALIASES: Record<string, string> = { bash: 'cli', sh: 'cli', shell: 'cli', console: 'cli', ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript', yml: 'yaml', toml: 'ini', 'redis-cli': 'redis', text: 'output', plaintext: 'output' }

/** Languages worth guessing for blocks that do not say what they are. */
const GUESSABLE = ['bash', 'java', 'javascript', 'yaml', 'json', 'sql', 'lua', 'typescript', 'xml', 'properties']

/** Below this relevance a guess is more likely wrong than right, so the block stays plain. */
const MIN_RELEVANCE = 4

const render = (code: string, language: string) => hljs.highlight(code, { language, ignoreIllegals: true }).value

/**
 * Highlighted HTML for a piece of code. The language comes from the caller, else from the first line (detect),
 * else from highlight.js's guess; text nobody can place gets the light output mode. highlight.js escapes the
 * code, so the HTML is safe to insert.
 */
export function highlight(code: string, language?: string): string {
  const named = language ? (ALIASES[language] ?? language) : undefined
  if (named && hljs.getLanguage(named)) return render(code, named)
  const detected = detect(code)
  if (detected) return render(code, detected)
  const guess = hljs.highlightAuto(code, GUESSABLE)
  if (guess.relevance < MIN_RELEVANCE) return render(code, 'output')
  // command lines read better in the command-line mode than in bash's
  return guess.language === 'bash' ? render(code, 'cli') : guess.value
}
