/** Simplified Kafka Connect record: where it goes, its key and its value. */
export interface ConnectRecord {
  topic: string
  key: unknown
  value: unknown
}

export interface Predicate {
  readonly type: string
  readonly label: string
  test(record: ConnectRecord): boolean
}

/** A Single Message Transform: one small, stateless change to one record. */
export interface Transform {
  readonly alias: string
  readonly type: string
  readonly description: string
  /** Returns the changed record, or `null` to drop it. */
  apply(record: ConnectRecord): ConnectRecord | null
}

type Json = Record<string, unknown>

const asObject = (value: unknown): Json | undefined =>
  value !== null && typeof value === 'object' ? (value as Json) : undefined

export class TopicNameMatches implements Predicate {
  readonly type = 'TopicNameMatches'
  readonly pattern: string
  private readonly regex: RegExp

  constructor(pattern: string) {
    this.pattern = pattern
    this.regex = new RegExp(`^${pattern}$`)
  }

  get label() {
    return `topic matches /${this.pattern}/`
  }

  test(record: ConnectRecord): boolean {
    return this.regex.test(record.topic)
  }
}

/** Decorator: runs a transform only when the predicate (optionally negated) holds. */
export class ConditionalTransform implements Transform {
  private readonly inner: Transform
  private readonly predicate: Predicate
  private readonly negate: boolean

  constructor(inner: Transform, predicate: Predicate, negate = false) {
    this.inner = inner
    this.predicate = predicate
    this.negate = negate
  }

  get alias() {
    return this.inner.alias
  }

  get type() {
    return this.inner.type
  }

  get description() {
    return `${this.inner.description} (${this.negate ? 'unless' : 'only if'} ${this.predicate.label})`
  }

  apply(record: ConnectRecord): ConnectRecord | null {
    return this.predicate.test(record) !== this.negate ? this.inner.apply(record) : record
  }
}

/** Debezium's "unwrap": replaces the change-event envelope with just the new row. */
export class ExtractNewRecordState implements Transform {
  readonly type = 'io.debezium.transforms.ExtractNewRecordState'
  readonly description = 'Replace the Debezium envelope with the row state in "after"'

  readonly alias: string

  constructor(alias = 'unwrap') {
    this.alias = alias
  }

  apply(record: ConnectRecord): ConnectRecord | null {
    const envelope = asObject(record.value)
    if (!envelope || !('after' in envelope)) return record
    return { ...record, value: envelope.after }
  }
}

/** Picks the destination topic from a field inside the value. */
export class ExtractTopicFromField implements Transform {
  readonly type = 'ExtractTopic$Value'

  readonly alias: string
  private readonly path: string[]

  constructor(alias: string, path: string[]) {
    this.alias = alias
    this.path = path
  }

  get description() {
    return `Set the topic to value.${this.path.join('.')}`
  }

  apply(record: ConnectRecord): ConnectRecord | null {
    let current: unknown = record.value
    for (const segment of this.path) current = asObject(current)?.[segment]
    if (typeof current !== 'string' || current === '') return record
    return { ...record, topic: current }
  }
}

/** Replaces a struct key with one of its fields, e.g. {"id": 7} → 7. */
export class ExtractKeyField implements Transform {
  readonly type = 'ExtractField$Key'

  readonly alias: string
  private readonly field: string

  constructor(alias: string, field: string) {
    this.alias = alias
    this.field = field
  }

  get description() {
    return `Use key.${this.field} as the whole key`
  }

  apply(record: ConnectRecord): ConnectRecord | null {
    const key = asObject(record.key)
    if (!key || !(this.field in key)) return record
    return { ...record, key: key[this.field] }
  }
}

/** Renames the topic with a regular expression, e.g. app.public.orders → orders. */
export class RegexRouter implements Transform {
  readonly type = 'RegexRouter'
  readonly alias: string
  private readonly regex: RegExp
  private readonly replacement: string

  constructor(alias: string, regex: string, replacement: string) {
    this.alias = alias
    this.regex = new RegExp(`^${regex}$`)
    this.replacement = replacement
  }

  get description() {
    return `Rename topics matching ${this.regex.source} to ${this.replacement}`
  }

  apply(record: ConnectRecord): ConnectRecord | null {
    return this.regex.test(record.topic) ? { ...record, topic: record.topic.replace(this.regex, this.replacement) } : record
  }
}

export interface TransformStage {
  label: string
  description: string
  record: ConnectRecord | null
}

/** Runs transforms in order, the way a connector applies its `transforms` list. */
export class TransformChain {
  private readonly transforms: readonly Transform[]

  constructor(transforms: readonly Transform[]) {
    this.transforms = transforms
  }

  trace(input: ConnectRecord): TransformStage[] {
    const stages: TransformStage[] = [{ label: 'Source record', description: 'As produced by the connector', record: input }]
    let current: ConnectRecord | null = input
    for (const transform of this.transforms) {
      current = current && transform.apply(current)
      stages.push({ label: transform.alias, description: transform.description, record: current })
    }
    return stages
  }
}
