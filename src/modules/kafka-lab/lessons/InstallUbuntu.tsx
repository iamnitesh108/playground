import { Callout, CodeBlock, ConfigExplorer, Table } from '@/shared/ui'
import { KAFKA_UNIT, SYSCTL } from '../configs/os'
import {
  FORMAT_STANDALONE,
  FORMATTED_DIR,
  GRACEFUL_STOP,
  LOG_FILES,
  OPEN_FILES,
  QUORUM_STATUS,
  SYSTEMCTL_STATUS,
  VERIFY_DOWNLOAD,
} from '../transcripts'

export default function InstallUbuntu() {
  return (
    <>
      <p>
        This is how Kafka is installed on a Linux server: the official binary release, a dedicated system user, a clear
        directory layout, and systemd to supervise the process. Steps were run on Ubuntu 24.04 LTS; on Debian and RHEL
        derivatives only the package commands differ. Run every step on each Kafka server.
      </p>

      <h2>1. Java</h2>
      <CodeBlock code={`sudo apt update
sudo apt install -y openjdk-21-jre-headless
java -version          # openjdk version "21.0.x"`} />
      <p>Kafka 4.x servers need Java 17, 21 or 25. The headless JRE is enough — no GUI libraries, no compiler.</p>

      <h2>2. A user for the service</h2>
      <CodeBlock code={`sudo useradd --system --no-create-home --home-dir /var/lib/kafka --shell /usr/sbin/nologin kafka`} />
      <p>
        A system account that cannot log in. Kafka runs as this user; it will own only the data and log directories.
      </p>

      <h2>3. Download and verify</h2>
      <CodeBlock
        title="download from the CDN, verify against the Apache main site"
        code={`KAFKA_VERSION=4.3.1
SCALA_VERSION=2.13
TGZ=kafka_\${SCALA_VERSION}-\${KAFKA_VERSION}.tgz
cd /tmp
curl -fsSLO https://dlcdn.apache.org/kafka/\${KAFKA_VERSION}/\${TGZ}
curl -fsSLO https://downloads.apache.org/kafka/\${KAFKA_VERSION}/\${TGZ}.sha512
curl -fsSLO https://downloads.apache.org/kafka/\${KAFKA_VERSION}/\${TGZ}.asc
curl -fsSL  https://downloads.apache.org/kafka/KEYS -o kafka-KEYS

# Checksum. Kafka publishes it in GnuPG "print-md" format (upper case, grouped,
# wrapped), so "sha512sum -c" cannot read it directly; normalise and compare.
expected=$(cut -d: -f2 \${TGZ}.sha512 | tr -d ' \\n' | tr 'A-F' 'a-f')
actual=$(sha512sum \${TGZ} | cut -d' ' -f1)
[ "$expected" = "$actual" ] && echo "sha512 OK"

# Signature: proves the release was signed by a Kafka release manager.
gpg --import kafka-KEYS
gpg --verify \${TGZ}.asc \${TGZ}`}
      />
      <CodeBlock title="output" code={VERIFY_DOWNLOAD} />
      <p>
        <code>dlcdn.apache.org</code> serves current releases; older ones are on <code>archive.apache.org/dist/kafka/</code>
        . The checksum, signature and <code>KEYS</code> always come from <code>downloads.apache.org</code>. The{' '}
        <code>[unknown]</code> trust level is normal — the key is not signed by anyone you trust yet; “Good signature” is
        what matters.
      </p>

      <h2>4. Install layout</h2>
      <CodeBlock
        code={`sudo tar -xzf /tmp/kafka_2.13-4.3.1.tgz -C /opt
sudo ln -sfn /opt/kafka_2.13-4.3.1 /opt/kafka
sudo mkdir -p /etc/kafka /var/lib/kafka/data /var/log/kafka
sudo chown -R kafka:kafka /var/lib/kafka /var/log/kafka
sudo chmod 750 /var/lib/kafka /var/log/kafka`}
      />
      <Table
        head={['Path', 'Owner', 'Holds']}
        rows={[
          ['/opt/kafka_2.13-4.3.1', 'root', 'The release, read-only to the service'],
          ['/opt/kafka → kafka_2.13-4.3.1', 'root', 'Symlink used everywhere; an upgrade switches it'],
          ['/etc/kafka', 'root (files root:kafka 640)', 'Configuration'],
          ['/var/lib/kafka/data', 'kafka', 'Partition data and KRaft metadata (log.dirs)'],
          ['/var/log/kafka', 'kafka', 'server.log, controller.log, GC log, …'],
        ]}
      />

      <h2>5. Operating system settings</h2>
      <ConfigExplorer file="/etc/sysctl.d/90-kafka.conf" format="properties" entries={SYSCTL} />
      <CodeBlock code={`sudo sysctl --system      # apply now; files in /etc/sysctl.d/ are also applied at boot`} />
      <p>
        Data disks: format them with XFS and mount them at <code>/var/lib/kafka</code> with <code>noatime</code> — an{' '}
        <code>/etc/fstab</code> line such as <code>UUID=… /var/lib/kafka xfs defaults,noatime 0 2</code>. Create{' '}
        <code>data</code> and set ownership after mounting. The file-descriptor limit is set in the systemd unit below.
      </p>

      <h2>6. Configuration</h2>
      <p>
        Write <code>/etc/kafka/server.properties</code> from the previous lesson — the single-node file, or the controller
        / broker file for this node — then protect it:
      </p>
      <CodeBlock code={`sudo chown root:kafka /etc/kafka/server.properties
sudo chmod 640 /etc/kafka/server.properties`} />

      <h2>7. Format the storage</h2>
      <p>
        A KRaft node cannot start on an empty directory: it must be formatted once with the cluster id. Run it{' '}
        <strong>as the kafka user</strong> — formatted as root, the files belong to root and the service fails with{' '}
        <code>AccessDeniedException</code>.
      </p>
      <CodeBlock
        title="single node"
        code={`CLUSTER_ID=$(sudo -u kafka /opt/kafka/bin/kafka-storage.sh random-uuid)
echo "$CLUSTER_ID" | sudo tee /etc/kafka/cluster-id
sudo -u kafka /opt/kafka/bin/kafka-storage.sh format --standalone -t "$CLUSTER_ID" -c /etc/kafka/server.properties`}
      />
      <CodeBlock title="output" code={FORMAT_STANDALONE} />
      <CodeBlock title="sudo ls -l /var/lib/kafka/data" code={FORMATTED_DIR} />
      <CodeBlock
        title="cluster: generate the id once, use it on all six nodes"
        code={`# on one machine
/opt/kafka/bin/kafka-storage.sh random-uuid          # e.g. 5MH1hgc3Tb2zB5vvliCvrw

# on every controller and broker, with that same id
sudo -u kafka /opt/kafka/bin/kafka-storage.sh format -t 5MH1hgc3Tb2zB5vvliCvrw -c /etc/kafka/server.properties`}
      />
      <p>
        <code>--standalone</code> is only for a single node with <code>controller.quorum.bootstrap.servers</code>. With a
        fixed <code>controller.quorum.voters</code> list no extra flag is needed; the output then says “Formatting
        metadata directory”. Nodes formatted with different ids will not form one cluster.
      </p>

      <h2>8. The systemd unit</h2>
      <ConfigExplorer file="/etc/systemd/system/kafka.service" format="raw" entries={KAFKA_UNIT} />
      <CodeBlock code={`sudo systemd-analyze verify /etc/systemd/system/kafka.service    # no output = valid
sudo systemctl daemon-reload
sudo systemctl enable --now kafka`} />
      <CodeBlock title="systemctl status kafka" code={SYSTEMCTL_STATUS} />
      <CodeBlock title="grep 'Max open files' /proc/$(systemctl show -p MainPID --value kafka)/limits" code={OPEN_FILES} />
      <CodeBlock title="ls /var/log/kafka" code={LOG_FILES} />
      <CodeBlock title="sudo systemctl stop kafka; systemctl show -p Result,ExecMainStatus kafka" code={GRACEFUL_STOP} />
      <p>
        <code>journalctl -u kafka -f</code> follows the console output; the detailed logs are the files in{' '}
        <code>/var/log/kafka</code>, rotated by Kafka’s own log4j configuration.
      </p>

      <h2>9. Firewall</h2>
      <CodeBlock
        title="ufw — allow only the networks that need each port"
        code={`sudo ufw allow from 10.0.0.0/8 to any port 9092 proto tcp    # clients and other brokers
sudo ufw allow from 10.0.0.0/8 to any port 9093 proto tcp    # controller quorum (cluster nodes only)
sudo ufw enable`}
      />
      <p>Use your real subnets. Port 9093 only needs to be open between Kafka nodes, never to clients.</p>

      <h2>10. Check it</h2>
      <CodeBlock
        code={`/opt/kafka/bin/kafka-topics.sh --bootstrap-server kafka-1:9092 --create --topic payments --partitions 3
/opt/kafka/bin/kafka-topics.sh --bootstrap-server kafka-1:9092 --describe --topic payments

# cluster: all three controllers voting, all brokers registered as observers
/opt/kafka/bin/kafka-metadata-quorum.sh --bootstrap-server broker-1:9092 describe --status`}
      />
      <CodeBlock title="quorum status of the 3 + 3 cluster" code={QUORUM_STATUS} />
      <Callout tone="tip" title="Order for a cluster">
        Start the three controllers first (they wait for each other to elect a leader), then the brokers. Clients use
        several brokers in <code>bootstrap.servers</code>, e.g. <code>broker-1:9092,broker-2:9092,broker-3:9092</code>.
      </Callout>

      <h2>Upgrading later</h2>
      <ol>
        <li>Download and verify the new release into <code>/opt/kafka_2.13-&lt;new&gt;</code> on every node.</li>
        <li>
          One node at a time — controllers first, then brokers: switch the symlink, <code>sudo systemctl restart kafka</code>,
          and wait until{' '}
          <code>kafka-topics.sh --bootstrap-server broker-1:9092 --describe --under-replicated-partitions</code> prints
          nothing before the next node.
        </li>
        <li>
          When all nodes run the new version, raise the cluster’s metadata version:{' '}
          <code>kafka-features.sh --bootstrap-server broker-1:9092 upgrade --release-version 4.3 --dry-run</code>, then
          without <code>--dry-run</code>. Until then a rollback is still possible.
        </li>
      </ol>
      <p>Always read the upgrade notes of the target version first.</p>
    </>
  )
}
