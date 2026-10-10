import { ModuleRegistry } from '@/core/registry'
import { kafkaModule } from './kafka'
import { kafkaSetupModule } from './kafka-lab'
import { postgresModule } from './postgres'
import { nodejsModule } from './nodejs'
import { reactModule } from './react'
import { gitModule } from './git'

/** Register new modules here — nothing else in the app needs to change. */
export const registry = new ModuleRegistry([kafkaModule, kafkaSetupModule, postgresModule, nodejsModule, reactModule, gitModule])
