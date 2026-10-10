import type { LearningModule } from '@/core/module'

export const reactModule: LearningModule = {
  id: 'react',
  title: 'React internals',
  description:
    'How React really works, recorded from React 19: elements and JSX, render and commit, state snapshots and batching, reconciliation and keys, effects, hooks, memoization and the React Compiler, transitions and Suspense, server rendering and hydration.',
  tags: ['react', 'rendering', 'hooks', 'reconciliation', 'performance'],
  groups: [
    {
      title: 'Foundations',
      lessons: [
        { slug: 'elements', title: 'Elements and JSX', summary: 'What JSX compiles to, and what a React element really is.', load: () => import('./lessons/Elements') },
        { slug: 'rendering', title: 'Render and commit', summary: 'When a component renders again, and what React does with the result.', load: () => import('./lessons/Rendering') },
        { slug: 'state', title: 'State is a snapshot', summary: 'Why setCount(count + 1) three times adds one, and how updates are batched.', load: () => import('./lessons/State') },
        { slug: 'reconciliation', title: 'Reconciliation and keys', summary: 'How React matches old and new trees, why index keys break state, and which DOM nodes move.', load: () => import('./lessons/Reconciliation') },
      ],
    },
    {
      title: 'Effects and hooks',
      lessons: [
        { slug: 'effects', title: 'Effects and their timing', summary: 'Render, layout effects, paint, effects and cleanups — in recorded order, and in Strict Mode.', load: () => import('./lessons/Effects') },
        { slug: 'hooks', title: 'How hooks work', summary: 'Hooks are a list matched by call order — and what happens when the order changes.', load: () => import('./lessons/Hooks') },
      ],
    },
    {
      title: 'Performance and the server',
      lessons: [
        { slug: 'memoization', title: 'memo, useMemo, useCallback and the Compiler', summary: 'When memoization helps, why it silently fails, and what React Compiler generates.', load: () => import('./lessons/Memoization') },
        { slug: 'concurrent', title: 'Transitions and Suspense', summary: 'Urgent and non-urgent updates, and showing a fallback while data loads.', load: () => import('./lessons/Concurrent') },
        { slug: 'hydration', title: 'Server rendering and hydration', summary: 'HTML from the server, made interactive in the browser — and what a mismatch does.', load: () => import('./lessons/Hydration') },
      ],
    },
  ],
}
