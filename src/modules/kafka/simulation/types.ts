export interface KafkaRecord {
  topic: string
  partition: number
  offset: number
  key: string | null
  value: string
  timestamp: number
  headers?: Record<string, string>
}

export type OffsetReset = 'earliest' | 'latest'
