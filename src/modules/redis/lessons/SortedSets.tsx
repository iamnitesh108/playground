import { Callout, LessonGoals, Predict, Recap, Table, TermList } from '@/shared/ui'
import { CliSession } from '../components/CliSession'
import { SkiplistPlayground } from '../components/SkiplistPlayground'
import { CAPTURE } from '../data/captures'
import { BarChart, Flow, StatTiles } from '@/shared/figures'

const Z = CAPTURE.types.transitions.find((t) => t.type === 'sorted set')!
const zLimit = CAPTURE.types.config['zset-max-listpack-entries']
const zValue = CAPTURE.types.config['zset-max-listpack-value']

/** Final scores of the recorded leaderboard: replay its ZADD and ZINCRBY commands. */
const board = (() => {
  const scores = new Map<string, number>()
  for (const step of CAPTURE.patterns.leaderboard) {
    const args = step.cmd.split(' ')
    if (args[0] === 'ZADD') for (let i = 2; i + 1 < args.length; i += 2) scores.set(args[i + 1], Number(args[i]))
    if (args[0] === 'ZINCRBY') scores.set(args[3], (scores.get(args[3]) ?? 0) + Number(args[2]))
  }
  // highest first; equal scores ordered by member, as Redis does
  return [...scores].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? 1 : -1))
})()

/** Expected nodes per skiplist level for a million members (each level keeps a node with probability 1/4). */
const LEVELS = Array.from({ length: 6 }, (_, k) => ({ level: k + 1, nodes: Math.round(1_000_000 / 4 ** k) }))

export default function SortedSets() {
  return (
    <>
      <LessonGoals
        goals={[
          'explain the two structures inside a big sorted set: a skiplist and a hash table',
          'say how fast each sorted-set command is, and why',
          'build a leaderboard and a time index the right way',
        ]}
        before="Lesson 3 — data types and their encodings"
      />

      <h2>What a sorted set must do</h2>
      <p>
        A sorted set holds unique members, each with a score (a 64-bit floating point number), kept in order of score. It has to answer two different
        questions quickly:
      </p>
      <ul>
        <li>
          <strong>By member:</strong> what is <code>bob</code>’s score? Is <code>bob</code> in the set? — a lookup.
        </li>
        <li>
          <strong>By position or score:</strong> who are the top 10? Who is between 3000 and 4000? What is <code>ann</code>’s rank? — an ordered walk.
        </li>
      </ul>
      <p>
        No single structure is good at both, so a big sorted set uses two: a <strong>hash table</strong> member → score for the first kind, and a{' '}
        <strong>skiplist</strong> ordered by (score, member) for the second. Both point at the same member strings.
      </p>
      <TermList
        items={[
          { term: 'score', definition: 'The number a member is ordered by. Ties are ordered by the member bytes, so the order is always well defined.' },
          { term: 'rank', definition: 'A member’s position: 0 for the lowest score (ZRANK) or for the highest (ZREVRANK).' },
          { term: 'skiplist', definition: 'A sorted linked list with extra “express lane” links on higher levels, so a search can skip many nodes at a time.' },
          { term: 'span', definition: 'Each skiplist link also stores how many nodes it skips — summing spans along a search gives the rank in O(log n).' },
        ]}
      />
      <Flow
        title="Inside a big sorted set: two structures, one set of members"
        cols={4}
        rows={2}
        rowHeight={96}
        nodes={[
          { id: 'client', label: 'client', sub: 'ZADD / ZSCORE / ZRANK', col: 0, row: 0, rowSpan: 2, hue: 1, shape: 'actor' },
          { id: 'zset', label: 'sorted set key', sub: 'encoding: skiplist', col: 1, row: 0, rowSpan: 2, hue: 3 },
          { id: 'dict', label: 'hash table', sub: 'lookup: member → score', col: 2, row: 0, hue: 3, shape: 'store' },
          { id: 'skip', label: 'skiplist', sub: 'order: (score, member)', col: 2, row: 1, hue: 3, shape: 'log' },
          { id: 'members', label: 'member strings', sub: 'shared by both', col: 3, row: 0, rowSpan: 2, hue: 3 },
        ]}
        edges={[
          { from: 'client', to: 'zset', flow: true, hue: 1 },
          { from: 'zset', to: 'dict', hue: 3 },
          { from: 'zset', to: 'skip', hue: 3 },
          { from: 'dict', to: 'members', hue: 3, dashed: true },
          { from: 'skip', to: 'members', hue: 3, dashed: true },
        ]}
        steps={[
          { title: 'ZADD writes both', body: <p>A new member is inserted into the skiplist at its place in the order (O(log n)) and added to the hash table with its score (O(1)).</p>, active: ['client', 'zset', 'dict', 'skip', 'members', 'client>zset', 'zset>dict', 'zset>skip'] },
          { title: 'ZSCORE asks the hash table', body: <p>“What is bob’s score?” is a single hash lookup: O(1), no matter how big the set is.</p>, active: ['client', 'zset', 'dict', 'client>zset', 'zset>dict'] },
          { title: 'ZRANK and ZRANGE walk the skiplist', body: <p>“Who is in the top 10?” or “what is ann’s rank?” need order: a skiplist search, O(log n), then a walk along the bottom level for each result.</p>, active: ['client', 'zset', 'skip', 'client>zset', 'zset>skip'] },
        ]}
      />

      <h2>A leaderboard, recorded</h2>
      <p>A leaderboard is the classic sorted set: the score is the points, and the order is the ranking.</p>
      <CliSession title="recorded" steps={CAPTURE.patterns.leaderboard} />
      <BarChart
        title="The board after these commands — highest score first (what ZREVRANGE walks)"
        bars={board.map(([member, score], i) => ({ label: `#${i + 1} ${member}`, value: score, display: score.toLocaleString(), hue: (i === 0 ? 6 : 3) as 3 | 6 }))}
      />
      <p>
        <code>bob</code> and <code>dan</code> both started at 2800; <code>ZINCRBY</code> moved <code>bob</code> up in one command, atomically — no
        read-modify-write in the client. <code>ZRANGE … BYSCORE</code> walks a score range, <code>ZCOUNT</code> counts one without returning it.
      </p>

      <h2>The skiplist</h2>
      <p>The skiplist is what keeps ranks and ranges fast: a sorted list with extra shortcut links.</p>
      <p>
        Every member is a node on level 1, in order. Each node is also placed on level 2 with probability ¼, on level 3 with ¼ of that, and so on (Redis
        allows up to 32 levels).
      </p>
      <p>
        A search starts on the highest level, moves right while the next node is still smaller, and drops one level when it would overshoot. It goes
        through about log₄(n) levels and visits only a few nodes on each — O(log n) in total, a handful of steps even for millions of members — and inserting needs no
        rebalancing: a new node just gets a random height.
      </p>
      <BarChart
        title="Expected nodes on each skiplist level, 1,000,000 members (probability ¼ per level)"
        bars={LEVELS.map((l) => ({ label: `level ${l.level}`, value: l.nodes, display: l.nodes.toLocaleString(), hue: 3 }))}
      />
      <p>
        A search starts on the sparse top levels and drops down, so it touches only a few nodes per level — that is why the levels shrink by four each
        time and still reach every member at the bottom. Try it:
      </p>
      <SkiplistPlayground />

      <Predict
        question={<p>A sorted set holds 10 million members. Roughly how does the cost of <code>ZRANK</code> compare with the same command on a set of 1,000 members?</p>}
        options={['10,000× slower — it has to count', 'A few times slower — it grows with log n', 'Exactly the same']}
        answer={1}
        explanation="Each skiplist link stores its span, so the rank is summed while searching. log(10,000,000) is only about twice log(1,000): a few more steps, not 10,000× more."
      />

      <h2>How fast is each command?</h2>
      <p>Each command’s cost follows from which of the two structures it uses.</p>
      <Table
        head={['Command', 'Cost', 'Why']}
        rows={[
          ['ZSCORE, ZMSCORE', 'O(1) per member', 'hash table lookup'],
          ['ZADD, ZREM, ZINCRBY', 'O(log n) per member', 'skiplist insert/delete + hash table update'],
          ['ZRANK, ZREVRANK', 'O(log n)', 'search, adding spans'],
          ['ZRANGE start stop (by rank)', 'O(log n + m)', 'find the start, then walk m results'],
          ['ZRANGE … BYSCORE / BYLEX, ZCOUNT', 'O(log n + m) / O(log n)', 'search the bound, then walk'],
          ['ZPOPMIN, ZPOPMAX, BZPOPMIN', 'O(log n) per element', 'remove from one end'],
          ['ZRANGE 0 -1 on a big set', 'O(n)', 'returns everything — avoid in hot paths'],
          ['ZUNIONSTORE, ZINTERSTORE', 'O(n log n) roughly', 'builds a new set — heavy on big inputs'],
        ]}
      />

      <h2>Small sorted sets are listpacks</h2>
      <p>Small sorted sets skip both structures and live in one compact block.</p>
      <p>
        Up to <code>zset-max-listpack-entries</code> ({zLimit}) members of at most {zValue} bytes, a sorted set is a listpack: member, score, member,
        score… kept in order in one block. Operations are O(n), but n is at most {zLimit}. Recorded: the encoding changed from{' '}
        <code>{Z.steps[0].encoding}</code> to <code>{Z.steps[1].encoding}</code> at member {Z.steps[1].count}, and the key then used{' '}
        {Z.steps[1].memory.toLocaleString()} bytes. Like hashes and sets, a sorted set never converts back.
      </p>
      <StatTiles
        title="Recorded MEMORY USAGE of one sorted set"
        stats={[
          { label: `${Z.steps[0].count} member, ${Z.steps[0].encoding}`, value: `${Z.steps[0].memory} B`, hue: 6 },
          { label: `${Z.steps[1].count} members, ${Z.steps[1].encoding}`, value: `${Z.steps[1].memory.toLocaleString()} B`, sub: 'skiplist nodes + hash table + member strings', hue: 8 },
        ]}
      />
      <Callout tone="note" title="Geo indexes are sorted sets">
        GEOADD stores each place as a sorted-set member whose score is a 52-bit geohash of its coordinates, so nearby places get nearby scores and a
        radius search becomes a few score-range walks. Lesson 15 shows it.
      </Callout>

      <h2>Design rules</h2>
      <ul>
        <li>
          <strong>Leaderboards:</strong> ZINCRBY to add points, ZREVRANGE … WITHSCORES for the top N, ZREVRANK for “your position”. All O(log n), so
          millions of players are fine.
        </li>
        <li>
          <strong>Time indexes and delayed jobs:</strong> use a Unix timestamp as the score; ZRANGE … BYSCORE −inf now finds what is due;
          ZREMRANGEBYSCORE trims old entries. (The sliding-window rate limiter in lesson 9 works this way.)
        </li>
        <li>
          <strong>Ties:</strong> equal scores are ordered by member bytes. If ties must be broken by time, encode it into the score: points × 10⁶ − seconds since the contest started (fewer than 10⁶), so one point always outweighs the time
          part; keep the result below 2⁵³, where doubles stop being exact. Or encode it into the member.
        </li>
        <li>
          <strong>Scores are doubles:</strong> integers are exact up to 2⁵³. Beyond that, or for money with fractions, store integers (cents) or keep the
          exact value elsewhere.
        </li>
        <li>
          <strong>One huge sorted set is one hot key:</strong> it lives on one server and one thread. For very large boards, shard by region or time
          window, or pre-compute the top N.
        </li>
      </ul>

      <Recap
        points={[
          'A big sorted set is a skiplist (order, ranks, ranges) plus a hash table (member → score), sharing the members.',
          'Lookups by member are O(1); inserts, ranks and range starts are O(log n); returning m results adds m.',
          `Up to ${zLimit} short members a sorted set is a single listpack — smaller, and fast enough because it is small.`,
        ]}
      />
    </>
  )
}
