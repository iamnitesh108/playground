import type { ConfigEntry } from '@/shared/ui'

/* OS-level files for running Kafka and Kafka Connect as services. Verified on Ubuntu 24.04 with systemd. */

const unitHeader = (description: string, docs: string, after: string): ConfigEntry => ({
  section: '[Unit]',
  key: 'description and ordering',
  text: `Description=${description}
Documentation=${docs}
Wants=network-online.target
After=${after}`,
  explain: (
    <p>
      <code>After=</code> orders start-up; <code>Wants=network-online.target</code> asks systemd to wait for the network
      to be configured, so the process can bind and resolve host names. Ordering after another unit only matters when
      both run on the same machine.
    </p>
  ),
})

const runAs: ConfigEntry = {
  section: '[Service]',
  key: 'user',
  text: `Type=simple
User=kafka
Group=kafka`,
  explain: (
    <p>
      Run as the unprivileged <code>kafka</code> system user created during installation, never as root. The process can
      write only its data and log directories; the binaries in <code>/opt</code> stay root-owned and read-only to it.
      <code>Type=simple</code>: the start script stays in the foreground and becomes the main process.
    </p>
  ),
}

const environment = (heap: string, logDir: string): ConfigEntry => ({
  key: 'environment',
  text: `Environment="KAFKA_HEAP_OPTS=${heap}"
Environment="LOG_DIR=${logDir}"`,
  explain: (
    <>
      <p>
        <code>KAFKA_HEAP_OPTS</code> sets the JVM heap. Kafka needs surprisingly little heap — typically 4–6 GB on a busy
        broker — because it relies on the OS page cache for data; leave the rest of the RAM to the OS. Set{' '}
        <code>-Xms</code> equal to <code>-Xmx</code>.
      </p>
      <p>
        <code>LOG_DIR</code> is <strong>required</strong>. Without it the scripts use <code>/opt/kafka/logs</code>, which
        the <code>kafka</code> user cannot create, and the JVM refuses to start with{' '}
        <code>Invalid -Xlog option … kafkaServer-gc.log</code>.
      </p>
    </>
  ),
})

const exec = (command: string): ConfigEntry => ({
  key: 'command',
  text: `ExecStart=${command}`,
  explain: (
    <p>
      The start script with the absolute path of the config file. Through the <code>/opt/kafka</code> symlink, an
      upgrade only switches the link and restarts the service.
    </p>
  ),
})

const lifecycle = (stopTimeout: string): ConfigEntry => ({
  key: 'restart and stop',
  text: `Restart=on-failure
RestartSec=10
TimeoutStopSec=${stopTimeout}
SuccessExitStatus=143`,
  explain: (
    <>
      <p>
        <code>systemctl stop</code> sends SIGTERM; Kafka then shuts down cleanly (a broker hands over partition
        leadership first). <code>TimeoutStopSec</code> gives it time before systemd force-kills it — a killed broker
        must recover its logs on the next start.
      </p>
      <p>
        A JVM ending on SIGTERM exits with code 143; <code>SuccessExitStatus=143</code> records that as a normal stop
        instead of a failure (tested: <code>Result=success</code>). <code>Restart=on-failure</code> restarts after a
        crash, but not after a deliberate stop.
      </p>
    </>
  ),
})

const limits: ConfigEntry = {
  key: 'limits',
  text: 'LimitNOFILE=100000',
  explain: (
    <p>
      Kafka keeps a file open for every log segment and index, plus one socket per connection. The Kafka documentation
      recommends at least 100,000 file descriptors; systemd’s default soft limit for services, 1,024, is far too low. Check with <code>{"grep 'Max open files' /proc/$(systemctl show -p MainPID --value kafka)/limits"}</code>.
    </p>
  ),
}

const install: ConfigEntry = {
  section: '[Install]',
  key: 'boot',
  text: 'WantedBy=multi-user.target',
  explain: <p>Makes <code>systemctl enable</code> start the service at boot.</p>,
}

export const KAFKA_UNIT: ConfigEntry[] = [
  unitHeader('Apache Kafka (KRaft broker and controller)', 'https://kafka.apache.org/documentation/', 'network-online.target'),
  runAs,
  environment('-Xms1g -Xmx1g', '/var/log/kafka'),
  exec('/opt/kafka/bin/kafka-server-start.sh /etc/kafka/server.properties'),
  lifecycle('180'),
  limits,
  install,
]

export const CONNECT_UNIT: ConfigEntry[] = [
  unitHeader('Apache Kafka Connect (distributed worker)', 'https://kafka.apache.org/documentation/#connect', 'network-online.target kafka.service'),
  runAs,
  environment('-Xms512m -Xmx1g', '/var/log/kafka-connect'),
  exec('/opt/kafka/bin/connect-distributed.sh /etc/kafka/connect-distributed.properties'),
  lifecycle('60'),
  limits,
  install,
]

export const SYSCTL: ConfigEntry[] = [
  {
    key: 'vm.max_map_count',
    value: '262144',
    defaultValue: '65530',
    explain: (
      <p>
        Every partition segment uses memory-mapped index files — at least two maps per partition. With many partitions
        per broker the default limit is reached and the broker fails with <code>Map failed</code> /{' '}
        <code>OutOfMemoryError</code>. 262,144 is a common setting.
      </p>
    ),
  },
  {
    key: 'vm.swappiness',
    value: '1',
    defaultValue: '60',
    explain: (
      <p>
        Swapping the JVM heap out causes long pauses, which look like a dead broker to the rest of the cluster. A value
        of 1 keeps swapping to a minimum without disabling it entirely. A common operational practice rather than a
        requirement from the Kafka documentation.
      </p>
    ),
  },
]
