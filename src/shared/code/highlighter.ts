import hljs from 'highlight.js/lib/core'
import bash from 'highlight.js/lib/languages/bash'
import groovy from 'highlight.js/lib/languages/groovy'
import ini from 'highlight.js/lib/languages/ini'
import java from 'highlight.js/lib/languages/java'
import json from 'highlight.js/lib/languages/json'
import lua from 'highlight.js/lib/languages/lua'
import properties from 'highlight.js/lib/languages/properties'
import sql from 'highlight.js/lib/languages/sql'
import typescript from 'highlight.js/lib/languages/typescript'
import xml from 'highlight.js/lib/languages/xml'
import yaml from 'highlight.js/lib/languages/yaml'
import { cli } from './cliLanguage'
import { redis } from './redisLanguage'
import './highlight.css'

const LANGUAGES = { bash, groovy, ini, java, json, lua, properties, sql, typescript, xml, yaml, redis, cli }
for (const [name, language] of Object.entries(LANGUAGES)) hljs.registerLanguage(name, language)

/** Names used in lessons that highlight.js knows under another name. */
const ALIASES: Record<string, string> = { bash: 'cli', sh: 'cli', shell: 'cli', console: 'cli', ts: 'typescript', tsx: 'typescript', yml: 'yaml', conf: 'ini', toml: 'ini', 'redis-cli': 'redis' }

/** Languages worth guessing for blocks that do not say what they are. */
const GUESSABLE = ['bash', 'java', 'yaml', 'json', 'sql', 'lua', 'typescript', 'xml', 'properties']

/** Below this relevance a guess is more likely wrong than right, so the block stays plain. */
const MIN_RELEVANCE = 6

/**
 * Highlighted HTML for a piece of code, or null to show it plain: for plain text, and when the language is
 * unknown and no guess is confident. highlight.js escapes the code, so the HTML is safe to insert.
 */
export function highlight(code: string, language?: string): string | null {
  if (language === 'text' || language === 'plaintext' || language === 'output') return null
  const name = language ? (ALIASES[language] ?? language) : undefined
  if (name && hljs.getLanguage(name)) return hljs.highlight(code, { language: name, ignoreIllegals: true }).value
  const guess = hljs.highlightAuto(code, GUESSABLE)
  if (guess.relevance < MIN_RELEVANCE) return null
  // command lines read better in the command-line mode than in bash's
  return guess.language === 'bash' ? hljs.highlight(code, { language: 'cli', ignoreIllegals: true }).value : guess.value
}
