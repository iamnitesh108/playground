import type { HLJSApi, Language } from 'highlight.js'

/** Directive-per-line config files such as redis.conf and sentinel.conf: `directive arg arg`, # comments. */
export function conf(hljs: HLJSApi): Language {
  return {
    name: 'conf',
    contains: [
      hljs.HASH_COMMENT_MODE,
      { scope: 'attr', begin: /^\s*[a-z][\w-]*(?=\s)/ },
      hljs.QUOTE_STRING_MODE,
      { scope: 'literal', begin: /\b(?:yes|no|on|off|true|false)\b/ },
      { scope: 'number', begin: /(?<![\w.-])-?\d+(?:\.\d+)?(?:[kmg]b?)?(?![\w-])/ },
    ],
  }
}
