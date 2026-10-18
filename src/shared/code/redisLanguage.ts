import type { HLJSApi, Language } from 'highlight.js'

/** Commands as typed at a redis-cli prompt: the command name, quoted strings, numbers and options. */
export function redis(hljs: HLJSApi): Language {
  return {
    name: 'redis',
    contains: [
      // the first word is the command (two words for container commands like CLIENT LIST, ACL SETUSER)
      { scope: 'keyword', begin: /^\s*(?:(?:ACL|CLIENT|CLUSTER|CONFIG|FUNCTION|LATENCY|MEMORY|MODULE|OBJECT|PUBSUB|SCRIPT|SLOWLOG|XGROUP|XINFO|COMMAND)\s+)?[A-Za-z][A-Za-z.]*\b/ },
      hljs.QUOTE_STRING_MODE,
      hljs.APOS_STRING_MODE,
      { scope: 'number', begin: /(?<![\w:.@-])-?\d+(?:\.\d+)?(?![\w:.@-])/ },
      // options in upper case after the command: NX, EX, WITHSCORES, COUNT, MATCH…
      { scope: 'built_in', begin: /(?<![\w:.@-])[A-Z][A-Z_]+(?![\w:.@-])/ },
    ],
  }
}
