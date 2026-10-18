// The Micronaut app the practicals were recorded with: these are its real source files
// (tools/kafka-capture/orders-app), imported as text so the lessons always show what ran.
import application from '../../../../tools/kafka-capture/orders-app/src/main/java/demo/orders/Application.java?raw'
import orderListener from '../../../../tools/kafka-capture/orders-app/src/main/java/demo/orders/OrderListener.java?raw'
import orderProducer from '../../../../tools/kafka-capture/orders-app/src/main/java/demo/orders/OrderProducer.java?raw'
import sendOrders from '../../../../tools/kafka-capture/orders-app/src/main/java/demo/orders/SendOrders.java?raw'
import applicationYml from '../../../../tools/kafka-capture/orders-app/src/main/resources/application.yml?raw'
import buildGradle from '../../../../tools/kafka-capture/orders-app/build.gradle?raw'
import settingsGradle from '../../../../tools/kafka-capture/orders-app/settings.gradle?raw'
import logback from '../../../../tools/kafka-capture/orders-app/src/main/resources/logback.xml?raw'

export const ORDERS_APP = {
  'settings.gradle': settingsGradle,
  'build.gradle': buildGradle,
  'application.yml': applicationYml,
  'Application.java': application,
  'OrderProducer.java': orderProducer,
  'SendOrders.java': sendOrders,
  'OrderListener.java': orderListener,
  'logback.xml': logback,
} as const

/** How the recordings started the app (environment variables map to app.* properties). */
export const RUN_APP = {
  producer: 'KAFKA_BOOTSTRAP=localhost:9092 APP_MODE=producer APP_TOPIC=orders APP_COUNT=6 ./build/install/orders-app/bin/orders-app',
  consumer: (instance: string, group: string, topic = 'orders') => `KAFKA_BOOTSTRAP=localhost:9092 APP_MODE=consumer APP_TOPIC=${topic} APP_GROUP=${group} APP_INSTANCE=${instance} ./build/install/orders-app/bin/orders-app`,
}
