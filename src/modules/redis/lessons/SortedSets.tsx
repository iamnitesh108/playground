import { Callout, LessonGoals, Predict, Recap, Table, TermList } from '@/shared/ui'
import { CliSession, SkiplistPlayground } from '../components'
import { CAPTURE } from '../data/captures'

const Z = CAPTURE.types.transitions.find((t) => t.type === 'sorted set')!
const zLimit = CAPTURE.types.config['zset-max-listpack-entries']
const zValue = CAPTURE.types.config['zset-max-listpack-value']

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

      <h2>A leaderboard, recorded</h2>
      <CliSession title="recorded" steps={CAPTURE.patterns.leaderboard} />
      <p>
        <code>bob</code> and <code>dan</code> both started at 2800; <code>ZINCRBY</code> moved <code>bob</code> up in one command, atomically — no
        read-modify-write in the client. <code>ZRANGE … BYSCORE</code> walks a score range, <code>ZCOUNT</code> counts one without returning it.
      </p>

      <h2>The skiplist</h2>
      <p>
        Every member is a node on level 1, in order. Each node is also placed on level 2 with probability ¼, on level 3 with ¼ of that, and so on (Redis
        allows up to 32 levels). A search starts on the highest level, moves right while the next node is still smaller, and drops one level when it
        would overshoot. It goes through about log₄(n) levels and visits only a few nodes on each — O(log n) in total, a handful of steps even for millions of members — and inserting needs no
        rebalancing: a new node just gets a random height.
      </p>
      <SkiplistPlayground />

      <Predict
        question={<p>A sorted set holds 10 million members. Roughly how does the cost of <code>ZRANK</code> compare with the same command on a set of 1,000 members?</p>}
        options={['10,000× slower — it has to count', 'A few times slower — it grows with log n', 'Exactly the same']}
        answer={1}
        explanation="Each skiplist link stores its span, so the rank is summed while searching. log(10,000,000) is only about twice log(1,000): a few more steps, not 10,000× more."
      />

      <h2>How fast is each command?</h2>
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
      <p>
        Up to <code>zset-max-listpack-entries</code> ({zLimit}) members of at most {zValue} bytes, a sorted set is a listpack: member, score, member,
        score… kept in order in one block. Operations are O(n), but n is at most {zLimit}. Recorded: the encoding changed from{' '}
        <code>{Z.steps[0].encoding}</code> to <code>{Z.steps[1].encoding}</code> at member {Z.steps[1].count}, and the key then used{' '}
        {Z.steps[1].memory.toLocaleString()} bytes. Like hashes and sets, a sorted set never converts back.
      </p>
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
