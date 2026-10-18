import { Callout, LessonGoals, Predict, Recap, Table, TermList } from '@/shared/ui'
import { BarChart, Flow, StatTiles } from '@/shared/figures'
import { CliSession } from '../components/CliSession'
import { BEYOND as B } from '../data/beyond'

const KB = (b: number) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(2)} MB` : `${(b / 1024).toFixed(1)} KB`)
const kb = (b: number) => Math.round((b / 1024) * 10) / 10
const pct = (n: number, of: number) => `${((n / of) * 100).toFixed(2)} %`
const MODULE_NAMES: Record<string, string> = { ReJSON: 'JSON', search: 'Query Engine', timeseries: 'time series', bf: 'probabilistic', vectorset: 'vector sets' }

export default function BeyondCore() {
  const bl = B.bloom
  const cms = B.cms
  const td = B.tdigest
  const vm = B.vectorMemory
  return (
    <>
      <LessonGoals
        goals={[
          'store and update JSON documents in place, and index them for search and aggregation',
          'keep time series with retention and automatic downsampling',
          'trade a little accuracy for a lot of memory with Bloom, Cuckoo, Count-min, Top-K and t-digest',
          'find similar items with vector sets, and pick a quantisation',
          'decide when one of these beats the core types — and when it does not',
        ]}
        before="Data types and their encodings, and Design patterns with Redis"
      />
      <Callout tone="note" title="Recorded on Redis Open Source 8">
        Everything here ran on the official <code>redis:8</code> image, version {B.version}. Since Redis 8 these data types ship with Redis itself; the
        server reports them as modules: {B.modules.map((m) => `${m.name} (${MODULE_NAMES[m.name] ?? m.name})`).join(', ')}. A plain build from source
        may not include them — <code>MODULE LIST</code> tells you.
      </Callout>

      <h2>What Redis 8 adds</h2>
      <p>Five families of types that each solve one problem the core types solve badly or not at all.</p>
      <Table
        head={['Type', 'Commands', 'Use it for', 'Core-type alternative']}
        rows={[
          ['JSON', <code key="c0">JSON.*</code>, 'Nested documents you read and change in parts', 'A string (rewrite it all) or a hash (flat only)'],
          ['Query Engine', <code key="c1">FT.*</code>, 'Find keys by field values, full text, ranges; aggregate', 'Hand-made sorted-set and set indexes'],
          ['Time series', <code key="c2">TS.*</code>, 'Metrics and sensor readings with retention and downsampling', 'A sorted set per series'],
          ['Probabilistic', <span key="c3"><code>BF.*</code> <code>CF.*</code> <code>CMS.*</code> <code>TOPK.*</code> <code>TDIGEST.*</code></span>, '“Seen before?”, frequencies, top items, percentiles — approximately', 'Sets, hashes, lists (exact, much bigger)'],
          ['Vector sets', <code key="c4">V*</code>, 'Nearest neighbours: similar products, semantic search', 'None'],
        ]}
      />
      <TermList
        items={[
          { term: 'JSONPath', definition: <>A path into a document: <code>$.address.zip</code>, <code>$.orders[*].total</code>, <code>$..zip</code> (anywhere).</> },
          { term: 'index (FT)', definition: 'A structure the Query Engine keeps up to date as keys with a prefix change, so queries do not scan.' },
          { term: 'compaction rule', definition: 'A time series rule that writes an aggregate (avg, max, …) of each time bucket into another series.' },
          { term: 'false positive', definition: '“Probably yes” for something never added. Bloom and Cuckoo filters can say it; they never give a false “no”.' },
          { term: 'quantisation', definition: 'Storing vector components with fewer bits (8-bit, 1-bit) to save memory, at a small cost in accuracy.' },
        ]}
      />

      <h2>JSON documents</h2>
      <p>The JSON type stores a parsed document, so you can read or change one field without sending the whole thing.</p>
      <CliSession title="a customer document, changed in place (recorded)" steps={B.json} />
      <p>
        <code>JSON.NUMINCRBY</code> and <code>JSON.ARRAPPEND</code> are atomic on the server — no read-modify-write race between two clients, which a
        JSON string in a plain key would have. Paths starting with <code>$</code> return arrays, because a path can match several places.
      </p>
      <Predict
        question={<p>The same {B.jsonMemory.bytes}-byte document is stored once as a string (<code>SET</code>) and once as JSON (<code>JSON.SET</code>). Which uses more memory?</p>}
        options={['The string', 'About the same', 'The JSON value']}
        answer={2}
        explanation={`Recorded with MEMORY USAGE: the string takes ${B.jsonMemory.string} bytes, the JSON value ${B.jsonMemory.json}. The JSON type keeps a tree of typed nodes so it can update parts; that structure costs memory.`}
      />
      <BarChart
        title={`One ${B.jsonMemory.bytes}-byte document (MEMORY USAGE, bytes, recorded)`}
        unit=" B"
        bars={[
          { label: 'string (SET)', value: B.jsonMemory.string, hue: 3 },
          { label: 'JSON (JSON.SET)', value: B.jsonMemory.json, hue: 3 },
          { label: 'hash, top-level fields only', value: B.jsonMemory.hash, hue: 3, note: 'only name, city, age — no arrays' },
        ]}
      />
      <Callout tone="tip" title="When JSON is worth it">
        Use JSON when documents are nested and you change parts of them, or when you want to index them. For flat records, a hash is smaller; for
        blobs you always read whole, a string is.
      </Callout>

      <h2>The Query Engine: search and aggregate</h2>
      <p>The Query Engine indexes hashes or JSON documents by field, so you can ask “which customers in London, aged 30 to 40?” without scanning.</p>
      <Flow
        title="Indexing and querying"
        cols={4}
        rows={2}
        rowHeight={92}
        nodes={[
          { id: 'app', label: 'application', sub: 'JSON.SET', col: 0, row: 0, hue: 1, shape: 'actor' },
          { id: 'keys', label: 'customer:*', sub: 'JSON documents', col: 1, row: 0, hue: 3, shape: 'store' },
          { id: 'idx', label: 'idx:customer', sub: 'tag, text, numeric', col: 2, row: 0, hue: 3 },
          { id: 'query', label: 'FT.SEARCH', sub: 'query → plan', col: 1, row: 1, hue: 2 },
          { id: 'res', label: 'results', sub: 'ids + fields', col: 2, row: 1, hue: 6 },
          { id: 'client', label: 'client', sub: '3 of 14 hits', col: 3, row: 1, hue: 1, shape: 'actor' },
        ]}
        edges={[
          { from: 'app', to: 'keys', label: 'write', hue: 1, flow: true },
          { from: 'keys', to: 'idx', label: 'auto-update', hue: 3 },
          { from: 'query', to: 'idx', label: 'lookup', hue: 2 },
          { from: 'query', to: 'res', hue: 6 },
          { from: 'res', to: 'client', hue: 6, flow: true },
        ]}
        steps={[
          { title: 'Define the index once', body: <p><code>FT.CREATE … ON JSON PREFIX 1 customer:</code> names the key prefix and which paths to index as what. Existing keys are indexed in the background.</p>, active: ['keys', 'idx', 'keys>idx'] },
          { title: 'Writes keep it current', body: <p>Every write to a <code>customer:*</code> key updates the index in the same command. No separate sync job.</p>, active: ['app', 'keys', 'idx', 'app>keys', 'keys>idx'] },
          { title: 'Queries use the index', body: <p><code>FT.SEARCH</code> turns the query into a plan (<code>FT.EXPLAIN</code> shows it) — here the intersection of a tag and a numeric range — and returns matching keys.</p>, active: ['query', 'idx', 'res', 'client', 'query>idx', 'query>res', 'res>client'] },
        ]}
      />
      <CliSession title={`${B.searchInfo.docs.toLocaleString()} customer documents, indexed and queried (recorded)`} steps={B.search} />
      <Table
        head={['Field type', 'For', 'Query syntax']}
        rows={[
          ['TAG', 'Exact values: city, status, category', <code key="c5">@city:&#123;London&#125;</code>],
          ['TEXT', 'Words, with stemming: names, descriptions', <code key="c6">@name:grace</code>],
          ['NUMERIC', 'Ranges and sorting: age, price, time', <code key="c7">@age:[30 40]</code>],
          ['GEO / GEOSHAPE', 'Distance and areas', <code key="c8">@loc:[lon lat 5 km]</code>],
          ['VECTOR', 'Similarity search inside an index', <code key="c9">KNN 10 @emb $vec</code>],
        ]}
      />
      <StatTiles
        title={`The same question two ways, ${B.searchVsScan.docs.toLocaleString()} documents (recorded, one run)`}
        stats={[
          { label: 'SCAN + JSON.MGET + filter in the client', value: `${B.searchVsScan.scanMs} ms`, sub: `read ${B.searchVsScan.scanned} documents, found ${B.searchVsScan.hits}`, hue: 8 },
          { label: 'FT.SEARCH with the index', value: `${B.searchVsScan.searchMs} ms`, sub: `found ${B.searchVsScan.searchHits}`, hue: 6 },
          { label: 'index memory', value: `${(B.searchInfo.totalIndexMB * 1024).toFixed(0)} KB`, sub: 'total_index_memory_sz_mb', hue: 3 },
        ]}
      />
      <p>
        The gap grows with the data: the scan reads every document every time; the index touches only matches. The price is memory for the index
        and a little work on every write.
      </p>
      <Callout tone="warn" title="Indexes and Redis Cluster">
        In Redis Open Source an index covers only the keys on its own node. On a cluster you need the distributed Query Engine of the commercial
        editions, or one index per shard queried by the application.
      </Callout>

      <h2>Time series</h2>
      <p>A time series stores (timestamp, value) pairs compactly, deletes old samples by itself, and can downsample automatically.</p>
      <CliSession title="a temperature series with an hourly average rule (recorded)" steps={B.timeseries} />
      <Flow
        title="One write, two series"
        cols={4}
        rows={1}
        nodes={[
          { id: 'sensor', label: 'sensor', sub: 'one reading a minute', col: 0, row: 0, hue: 1, shape: 'actor' },
          { id: 'raw', label: 'temp:kitchen', sub: 'raw, kept 24 h', col: 1, row: 0, hue: 4, shape: 'log' },
          { id: 'rule', label: 'rule: avg 1 h', sub: 'TS.CREATERULE', col: 2, row: 0, hue: 2 },
          { id: 'hourly', label: ':hourly', sub: 'one sample per hour', col: 3, row: 0, hue: 4, shape: 'log' },
        ]}
        edges={[
          { from: 'sensor', to: 'raw', label: 'TS.ADD', hue: 1, flow: true },
          { from: 'raw', to: 'rule', hue: 4 },
          { from: 'rule', to: 'hourly', label: 'bucket closed', hue: 4 },
        ]}
        caption="A bucket's aggregate is written when the first sample of the next bucket arrives — so the last, still open hour is missing from :hourly above."
      />
      <BarChart
        title={`${B.tsMemory.samples.toLocaleString()} samples (KB, recorded)`}
        unit=" KB"
        bars={[
          { label: 'sorted set: score = time, member = "time:value"', value: kb(B.tsMemory.zset), hue: 3, display: KB(B.tsMemory.zset) },
          { label: `time series (${B.tsMemory.chunks} compressed chunks)`, value: kb(B.tsMemory.timeseries), hue: 4, display: KB(B.tsMemory.timeseries) },
        ]}
      />
      <p>
        Samples are stored in compressed chunks (delta-of-delta timestamps, XOR-compressed values). Labels let one <code>TS.MRANGE</code> read many
        series at once by filter, like the last command above.
      </p>

      <h2>Probabilistic types</h2>
      <p>These answer a question approximately, in a fixed, small amount of memory, however many items you add.</p>
      <Table
        head={['Type', 'Answers', 'Can be wrong how', 'Delete?']}
        rows={[
          ['Bloom filter (BF)', 'Have I seen x?', 'Says “probably yes” for some never-added items', 'No'],
          ['Cuckoo filter (CF)', 'Have I seen x?', 'Same, slightly different rate', 'Yes'],
          ['Count-min sketch (CMS)', 'How often did x occur?', 'Counts too high, never too low', 'No'],
          ['Top-K', 'Which k items are most frequent?', 'May miss an item near the cut-off', 'No'],
          ['t-digest', 'What is the 50th / 99th percentile?', 'Small error, smallest at the extremes', 'No (reset)'],
        ]}
      />
      <CliSession title="each type in a few commands (recorded)" steps={B.prob} />
      <p>
        Two details above: <code>TOPK.ADD</code> returns the item it pushed out of the top list (here <code>p3</code>), and with only ten
        latencies the t-digest’s 90th percentile is simply the largest value. Sketches need volume to shine — here they are with real volume.
      </p>

      <h3>Bloom and Cuckoo: {bl.n.toLocaleString()} e-mail addresses</h3>
      <p>
        Both filters were reserved for {bl.n.toLocaleString()} items at a 1 % error rate and filled; then {bl.n.toLocaleString()} addresses that were
        never added were checked.
      </p>
      <StatTiles
        title="False “probably yes” for addresses never added (recorded)"
        stats={[
          { label: 'Bloom filter', value: pct(bl.bfFalse, bl.n), sub: `${bl.bfFalse} of ${bl.n.toLocaleString()} · target 1 %`, hue: 6, bar: { value: bl.bfFalse, max: bl.n * bl.target * 2 } },
          { label: 'Cuckoo filter', value: pct(bl.cfFalse, bl.n), sub: `${bl.cfFalse} of ${bl.n.toLocaleString()}`, hue: 6, bar: { value: bl.cfFalse, max: bl.n * bl.target * 2 } },
          { label: 'false “no”', value: '0', sub: 'never, by design', hue: 6 },
        ]}
      />
      <BarChart
        title={`Memory for ${bl.n.toLocaleString()} addresses (KB, recorded)`}
        unit=" KB"
        bars={[
          { label: 'set (exact)', value: kb(bl.set), hue: 3, display: KB(bl.set) },
          { label: 'Cuckoo filter', value: kb(bl.cf), hue: 3, display: KB(bl.cf) },
          { label: 'Bloom filter, 1 %', value: kb(bl.bf), hue: 3, display: KB(bl.bf) },
        ]}
      />

      <h3>Count-min: {cms.events.toLocaleString()} page views</h3>
      <p>
        A skewed stream over {cms.distinct.toLocaleString()} pages (a few hot ones, a long tail) was counted both exactly in a hash and in a sketch with
        error 0.001 and certainty 99 %.
      </p>
      <StatTiles
        title="Count-min vs exact counts (recorded)"
        stats={[
          { label: 'pages counted too high', value: pct(cms.overcounted, cms.distinct), sub: `${cms.overcounted.toLocaleString()} of ${cms.distinct.toLocaleString()}; never too low`, hue: 8 },
          { label: 'largest overcount', value: `+${cms.maxOver}`, sub: `bound: 0.001 × ${cms.events.toLocaleString()} = ${cms.epsilonBound}`, hue: 2, bar: { value: cms.maxOver, max: cms.epsilonBound } },
          { label: `hottest page ${cms.topPage}`, value: cms.topEst.toLocaleString(), sub: `exact ${cms.topExact.toLocaleString()}`, hue: 6 },
          { label: 'memory', value: KB(cms.cms), sub: `exact hash: ${KB(cms.hash)}`, hue: 3 },
        ]}
      />
      <p>
        Most counts are a little high, all within the bound — and the error is absolute, so it matters for rare items and not at all for hot ones.
        Use it for “which pages are popular”, not for billing.
      </p>

      <h3>t-digest: {td.n.toLocaleString()} latencies</h3>
      <BarChart
        title="Percentiles: exact vs t-digest (ms, recorded)"
        unit=" ms"
        bars={td.quantiles.flatMap((q) => [
          { label: `p${q.q * 100} exact`, value: q.exact, hue: 3 as const },
          { label: `p${q.q * 100} t-digest`, value: q.estimate, hue: 4 as const },
        ])}
      />
      <StatTiles
        stats={[
          { label: 't-digest', value: KB(td.tdigest), sub: 'answers any percentile', hue: 4 },
          { label: 'list of every sample', value: KB(td.list), sub: 'sort it to get a percentile', hue: 3 },
        ]}
      />

      <h2>Vector sets</h2>
      <p>A vector set stores items as lists of numbers (embeddings) and finds the ones closest to a query vector.</p>
      <p>
        The numbers come from an embedding model outside Redis; items that mean similar things get vectors that point in similar directions.
        Real embeddings have hundreds of dimensions — three are enough to see the idea:
      </p>
      <CliSession title="four products, similarity and a filter (recorded)" steps={B.vectors} />
      <p>
        Scores are cosine similarity mapped to 0–1: 1 is the same direction. <code>FILTER</code> checks the JSON attributes of each candidate, so
        “similar, but only shoes under 100” is one command. The index is an HNSW graph: fast, approximate, and the reason a search may very
        occasionally miss the true nearest item.
      </p>
      <BarChart
        title={`${vm.n.toLocaleString()} vectors of ${vm.dims} dimensions (MEMORY USAGE, MB, recorded)`}
        unit=" MB"
        marker={{ value: Math.round((vm.raw / 1024 / 1024) * 100) / 100, label: 'raw 32-bit floats' }}
        bars={[
          { label: 'NOQUANT (32-bit floats)', value: Math.round((vm.NOQUANT / 1024 / 1024) * 100) / 100, hue: 3 },
          { label: 'Q8 (8-bit, the default)', value: Math.round((vm.Q8 / 1024 / 1024) * 100) / 100, hue: 3 },
          { label: 'BIN (1-bit)', value: Math.round((vm.BIN / 1024 / 1024) * 100) / 100, hue: 3 },
        ]}
      />
      <p>
        The vectors themselves shrink 4× with Q8 and 32× with BIN; what stays is the graph (links between neighbours), which is why BIN does not get
        32× smaller overall. Q8 loses very little accuracy; BIN is for very large sets where you re-rank the top results.
      </p>

      <h2>Design rules</h2>
      <p>Reach for these types when the core types would make you build the same thing by hand.</p>
      <Table
        head={['If you need…', 'Use', 'Not']}
        rows={[
          ['A nested object you update in parts', 'JSON', 'A string you rewrite whole'],
          ['A flat record', 'A hash', 'JSON (bigger)'],
          ['Lookup by field values, text, ranges', 'Query Engine index', 'Hand-maintained sets per value'],
          ['Metrics with retention and rollups', 'Time series + compaction rules', 'A sorted set you trim yourself'],
          ['“Seen before?” over millions, small error OK', 'Bloom (or Cuckoo if you delete)', 'A set'],
          ['“How many distinct?”', <span key="c10">HyperLogLog (core: <code>PFADD</code>)</span>, 'A set'],
          ['Frequencies or top items of a stream', 'Count-min / Top-K', 'A hash with a counter per item'],
          ['Percentiles of a stream', 't-digest', 'A list you sort'],
          ['“Similar to this”', 'Vector set', 'Anything else'],
          ['An exact answer (money, permissions)', 'Exact core types', 'Any probabilistic type'],
        ]}
      />
      <Callout tone="warn" title="Check where you will run it">
        These types need a server that has them. Managed services and older versions may lack some or all of them; a replica or a restore target
        without the module cannot load the data.
      </Callout>

      <Recap
        points={[
          `Redis ${B.version.split('.').slice(0, 2).join('.')} ships JSON, the Query Engine, time series, probabilistic types and vector sets with the server.`,
          'JSON updates parts of a document atomically but costs more memory than a string; index documents with FT.CREATE to query them without scanning.',
          'Time series compress samples and downsample with rules — far smaller than a sorted set.',
          `Probabilistic types trade exactness for memory: here a Bloom filter took ${KB(bl.bf)} instead of ${KB(bl.set)} at a ${pct(bl.bfFalse, bl.n)} false-positive rate.`,
          'Vector sets find nearest neighbours with HNSW; Q8 quantisation halves memory at little accuracy cost.',
          'When the answer must be exact, use the core types.',
        ]}
      />
    </>
  )
}
