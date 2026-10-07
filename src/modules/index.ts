import { ModuleRegistry } from '@/core/registry'
import { kafkaModule } from './kafka'

/** Register new modules here — nothing else in the app needs to change. */
export const registry = new ModuleRegistry([kafkaModule])
