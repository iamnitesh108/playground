import type { HLJSApi, Language } from 'highlight.js'

/**
 * Shell commands as typed at a prompt: the program name, --flags, quoted arguments, $VARIABLES and # comments.
 * highlight.js's bash mode leaves program names and flags plain, which is most of a command line.
 */
export function cli(hljs: HLJSApi): Language {
  return {
    name: 'cli',
    contains: [
      hljs.HASH_COMMENT_MODE,
      hljs.QUOTE_STRING_MODE,
      hljs.APOS_STRING_MODE,
      { scope: 'variable', begin: /\$\{[^}]*\}|\$[A-Za-z_][A-Za-z0-9_]*/ },
      // the program: first word of a line, or after a pipe, && or ;
      { scope: 'title', begin: /(?:^|(?<=[|;&]\s*))\s*(?:sudo\s+)?[A-Za-z0-9_./-]+/, relevance: 0 },
      { scope: 'attr', begin: /(?<=\s)--?[A-Za-z][A-Za-z0-9-]*(?==)?/ },
      { scope: 'number', begin: /(?<=[\s=:])\d+(?:\.\d+)?(?=[\s,]|$)/ },
      { scope: 'keyword', begin: /(?<=\s)(?:\||&&|\|\||>|>>|<|2>&1)(?=\s)/ },
    ],
  }
}
