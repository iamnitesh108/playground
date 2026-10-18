import type { HLJSApi, Language } from 'highlight.js'

/**
 * Recorded output and plain text (INFO sections, tool reports, git and redis-cli replies, logs): a light touch that
 * keeps it reading like a terminal — comments and [sections], key fields, commit ids and refs, numbers, strings,
 * reply types and error words.
 */
export function output(hljs: HLJSApi): Language {
  return {
    name: 'output',
    contains: [
      { scope: 'comment', begin: /^\s*#.*$/ },
      { scope: 'section', begin: /^\s*\[[^\]\n]+\]/ },
      // redis-cli reply types and the replies that mean "done"
      { scope: 'meta', begin: /\((?:integer|nil|empty array|empty list or set|double)\)/ },
      { scope: 'deletion', begin: /\(error\)|\b(?:ERR|ERROR|WRONGTYPE|NOAUTH|NOPERM|WRONGPASS|READONLY|CROSSSLOT|MOVED|ASK|BUSY|OOM|EXECABORT|Exception|FATAL|fatal|error|WARN(?:ING)?|denied|failed|Failed|rejected|Timed out)\b/ },
      { scope: 'addition', begin: /^(?:OK|PONG|QUEUED)$|\b(?:Created|Completed|Successfully|Switched to|done\.)/ },
      // git: (HEAD -> main, origin/main), * graph lines, short and full commit ids
      { scope: 'meta', begin: /\((?:HEAD|tag:|origin\/)[^)\n]*\)/ },
      { scope: 'number', begin: /(?<![\w/-])[0-9a-f]{7,40}(?![\w/-])/, relevance: 0 },
      // the current branch in `git branch`
      { scope: 'title', begin: /^\*\s+(?=[\w./-]+\s*$)/, end: /$/ },
      { scope: 'attr', begin: /^\s*[A-Za-z_][\w.-]*(?=\s*[:=]\s*\S)/ },
      hljs.QUOTE_STRING_MODE,
      { scope: 'number', begin: /(?<![\w.-])-?\d+(?:\.\d+)?(?:[KMG]B?|ms|s|%|B)?(?![\w-]|\.\d)/ },
    ],
  }
}
