export type Assignment = Map<string, number[]>

/** Strategy that splits a topic's partitions among a group's members. */
export interface PartitionAssignor {
  readonly name: string
  assign(partitions: readonly number[], members: readonly string[]): Assignment
}

function emptyAssignment(members: readonly string[]): Assignment {
  return new Map(members.map((member) => [member, []]))
}

/** Contiguous ranges: first members get one extra when it does not divide evenly. */
export class RangeAssignor implements PartitionAssignor {
  readonly name = 'range'

  assign(partitions: readonly number[], members: readonly string[]): Assignment {
    const result = emptyAssignment(members)
    if (members.length === 0) return result
    const sorted = [...members].sort()
    const per = Math.floor(partitions.length / sorted.length)
    const extra = partitions.length % sorted.length
    let cursor = 0
    sorted.forEach((member, i) => {
      const size = per + (i < extra ? 1 : 0)
      result.set(member, partitions.slice(cursor, cursor + size))
      cursor += size
    })
    return result
  }
}

/** Deals partitions out one at a time like cards. */
export class RoundRobinAssignor implements PartitionAssignor {
  readonly name = 'round robin'

  assign(partitions: readonly number[], members: readonly string[]): Assignment {
    const result = emptyAssignment(members)
    if (members.length === 0) return result
    const sorted = [...members].sort()
    partitions.forEach((partition, i) => {
      result.get(sorted[i % sorted.length])!.push(partition)
    })
    return result
  }
}
