import { CodeBlock, Tabs } from '@/shared/ui'
import { BASICS } from '../data/basics'
import { LANG_INFO, LANGS, usingCode } from '../data/basicsSources'

/** One task of the API tour: the code that ran and what it printed, in each of the three languages. */
export function UsingTask({ task }: { task: keyof typeof BASICS.using.java }) {
  return (
    <Tabs
      items={LANGS.map((lang) => ({
        label: LANG_INFO[lang].label,
        content: (
          <>
            <CodeBlock title={`${LANG_INFO[lang].file} — ${task}`} language={LANG_INFO[lang].language} code={usingCode(lang, task)} />
            <CodeBlock title="recorded output" language="text" code={BASICS.using[lang][task].join('\n')} />
          </>
        ),
      }))}
    />
  )
}
