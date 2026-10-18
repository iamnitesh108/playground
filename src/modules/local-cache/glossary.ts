// Every term of the in-process caching module, with the lesson (slug) that explains it.

export interface GlossaryEntry {
  term: string
  definition: string
  /** Lesson slug where the term is explained. */
  lesson: string
}

/** Every lesson's terms, read from the lessons/*.terms.ts file next to the lesson that explains them. */
export const GLOSSARY: GlossaryEntry[] = Object.values(import.meta.glob<GlossaryEntry[]>('./lessons/*.terms.ts', { eager: true, import: 'terms' })).flat()
