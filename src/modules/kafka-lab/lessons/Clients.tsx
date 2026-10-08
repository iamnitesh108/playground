import { Callout, ConfigExplorer } from '@/shared/ui'
import { CONSUMER_PROPERTIES, PRODUCER_PROPERTIES } from '../configs/clients'

export default function Clients() {
  return (
    <>
      <p>
        Your programs talk to Kafka through the client library. Producers and consumers are configured with key/value
        properties — the same names whether you put them in a <code>Properties</code> object in Java, a{' '}
        <code>.properties</code> file, a Spring/Micronaut <code>application.yaml</code>, or a Python dict. Below are the
        ones worth knowing, with the values the next lessons use.
      </p>

      <h2>Producer</h2>
      <ConfigExplorer file="producer.properties" format="properties" entries={PRODUCER_PROPERTIES} />

      <h2>Consumer</h2>
      <ConfigExplorer file="consumer.properties" format="properties" entries={CONSUMER_PROPERTIES} />

      <Callout tone="tip" title="Where to look up the rest">
        The full lists, with every default, are in the Kafka documentation under <em>Producer Configs</em> and{' '}
        <em>Consumer Configs</em>. A running client also prints all of its effective values at start-up (look for{' '}
        <code>ProducerConfig values:</code> in the log).
      </Callout>
      <Callout tone="warn" title="Other languages, other defaults">
        Clients built on librdkafka (Python <code>confluent-kafka</code>, Go, .NET, …) use the same setting names but a
        different default partitioner: <code>consistent_random</code> (CRC32) instead of Java’s murmur2. Set{' '}
        <code>partitioner=murmur2_random</code> if Java and non-Java producers write the same keys to the same topic.
      </Callout>
    </>
  )
}
