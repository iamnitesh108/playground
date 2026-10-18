import type { LearningModule } from '@/core/module'
import { ModuleRegistry } from '@/core/registry'

/**
 * Every folder here with an index.ts that default-exports a LearningModule is a module.
 * Adding a topic is adding a folder — this file and the app never change.
 */
const found = import.meta.glob<LearningModule>('./*/index.ts', { eager: true, import: 'default' })

export const registry = new ModuleRegistry(Object.values(found))
