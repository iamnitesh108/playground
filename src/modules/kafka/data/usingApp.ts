// The plain-Java programs the "using Kafka", transactions and share-group recordings ran
// (tools/kafka-capture/using-app), imported as text so the lessons always show what ran.
import buildGradle from '../../../../tools/kafka-capture/using-app/build.gradle?raw'
import config from '../../../../tools/kafka-capture/using-app/src/main/java/demo/using/Config.java?raw'
import topicAdmin from '../../../../tools/kafka-capture/using-app/src/main/java/demo/using/TopicAdmin.java?raw'
import sendPayments from '../../../../tools/kafka-capture/using-app/src/main/java/demo/using/SendPayments.java?raw'
import readPayments from '../../../../tools/kafka-capture/using-app/src/main/java/demo/using/ReadPayments.java?raw'
import groupLag from '../../../../tools/kafka-capture/using-app/src/main/java/demo/using/GroupLag.java?raw'
import resetOffsets from '../../../../tools/kafka-capture/using-app/src/main/java/demo/using/ResetOffsets.java?raw'
import readAtOffset from '../../../../tools/kafka-capture/using-app/src/main/java/demo/using/ReadAtOffset.java?raw'
import payTransactionally from '../../../../tools/kafka-capture/using-app/src/main/java/demo/using/PayTransactionally.java?raw'
import readTransfers from '../../../../tools/kafka-capture/using-app/src/main/java/demo/using/ReadTransfers.java?raw'
import checkTransfers from '../../../../tools/kafka-capture/using-app/src/main/java/demo/using/CheckTransfers.java?raw'
import shareWorker from '../../../../tools/kafka-capture/using-app/src/main/java/demo/using/ShareWorker.java?raw'

export const USING_APP = {
  'build.gradle': buildGradle,
  'Config.java': config,
  'TopicAdmin.java': topicAdmin,
  'SendPayments.java': sendPayments,
  'ReadPayments.java': readPayments,
  'GroupLag.java': groupLag,
  'ResetOffsets.java': resetOffsets,
  'ReadAtOffset.java': readAtOffset,
  'PayTransactionally.java': payTransactionally,
  'ReadTransfers.java': readTransfers,
  'CheckTransfers.java': checkTransfers,
  'ShareWorker.java': shareWorker,
} as const
