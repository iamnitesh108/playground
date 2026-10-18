// The three programs lesson "Using S3 day to day" was recorded with (tools/s3-capture), imported as text,
// so the lesson always shows the code that ran.
import javaDemo from '../../../../tools/s3-capture/java-app/src/main/java/demo/s3/UsageDemo.java?raw'
import javaConfig from '../../../../tools/s3-capture/java-app/src/main/resources/application.yml?raw'
import javaBuild from '../../../../tools/s3-capture/java-app/build.gradle?raw'
import tsUsage from '../../../../tools/s3-capture/ts-app/usage.ts?raw'
import tsPackage from '../../../../tools/s3-capture/ts-app/package.json?raw'
import rustMain from '../../../../tools/s3-capture/rust-app/src/main.rs?raw'
import rustCargo from '../../../../tools/s3-capture/rust-app/Cargo.toml?raw'
import { between, region } from './sources'

export type Lang = 'java' | 'ts' | 'rust'
export const LANGS: Lang[] = ['java', 'ts', 'rust']

export const TASKS = ['create-bucket', 'upload', 'list', 'download', 'metadata', 'copy', 'move', 'delete', 'missing', 'presign'] as const
export type Task = (typeof TASKS)[number]

/** The heading each program printed before a task. */
export const SECTION: Record<Task, string> = {
  'create-bucket': 'create a bucket',
  upload: 'upload',
  list: 'list',
  download: 'download',
  metadata: 'metadata',
  copy: 'copy',
  move: 'move',
  delete: 'delete',
  missing: 'missing key',
  presign: 'presign',
}

interface LangInfo {
  label: string
  file: string
  language: string
  source: string
  setup: { title: string; language: string; code: string }[]
}

export const LANG_INFO: Record<Lang, LangInfo> = {
  java: {
    label: 'Micronaut',
    file: 'UsageDemo.java',
    language: 'java',
    source: javaDemo,
    setup: [
      { title: 'application.yml', language: 'yaml', code: javaConfig },
      { title: 'build.gradle (dependencies)', language: 'groovy', code: between(javaBuild, 'dependencies {', 'application {') },
      { title: 'UsageDemo.java (constructor)', language: 'java', code: region(javaDemo, 'inject') },
    ],
  },
  ts: {
    label: 'TypeScript',
    file: 'usage.ts',
    language: 'typescript',
    source: tsUsage,
    setup: [
      { title: 'usage.ts (the client)', language: 'typescript', code: region(tsUsage, 'client') },
      { title: 'package.json', language: 'json', code: tsPackage },
    ],
  },
  rust: {
    label: 'Rust',
    file: 'main.rs',
    language: 'rust',
    source: rustMain,
    setup: [
      { title: 'main.rs (the client)', language: 'rust', code: region(rustMain, 'client') },
      { title: 'Cargo.toml', language: 'ini', code: between(rustCargo, '[dependencies]') },
    ],
  },
}

export const code = (lang: Lang, task: Task) => region(LANG_INFO[lang].source, task)

export const FULL_SOURCES: Record<Lang, { title: string; language: string; code: string }[]> = {
  java: [
    { title: 'UsageDemo.java', language: 'java', code: javaDemo },
    { title: 'application.yml', language: 'yaml', code: javaConfig },
    { title: 'build.gradle', language: 'groovy', code: javaBuild },
  ],
  ts: [
    { title: 'usage.ts', language: 'typescript', code: tsUsage },
    { title: 'package.json', language: 'json', code: tsPackage },
  ],
  rust: [
    { title: 'main.rs', language: 'rust', code: rustMain },
    { title: 'Cargo.toml', language: 'ini', code: rustCargo },
  ],
}
