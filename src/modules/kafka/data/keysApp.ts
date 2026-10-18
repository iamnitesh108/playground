// The plain-Java programs the keys lesson recorded (tools/kafka-capture/keys-app), imported as text so the
// lesson always shows the code that ran.
import config from '../../../../tools/kafka-capture/keys-app/src/main/java/demo/keys/Config.java?raw'
import sendKeyed from '../../../../tools/kafka-capture/keys-app/src/main/java/demo/keys/SendKeyed.java?raw'
import keyFormats from '../../../../tools/kafka-capture/keys-app/src/main/java/demo/keys/KeyFormats.java?raw'
import spread from '../../../../tools/kafka-capture/keys-app/src/main/java/demo/keys/Spread.java?raw'
import tenantPartitioner from '../../../../tools/kafka-capture/keys-app/src/main/java/demo/keys/TenantPartitioner.java?raw'
import sendTenants from '../../../../tools/kafka-capture/keys-app/src/main/java/demo/keys/SendTenants.java?raw'
import sendStatuses from '../../../../tools/kafka-capture/keys-app/src/main/java/demo/keys/SendStatuses.java?raw'
import slowWorker from '../../../../tools/kafka-capture/keys-app/src/main/java/demo/keys/SlowWorker.java?raw'

export const KEYS_APP = {
  'Config.java': config,
  'SendKeyed.java': sendKeyed,
  'KeyFormats.java': keyFormats,
  'Spread.java': spread,
  'TenantPartitioner.java': tenantPartitioner,
  'SendTenants.java': sendTenants,
  'SendStatuses.java': sendStatuses,
  'SlowWorker.java': slowWorker,
} as const
