import type { LearningModule } from '@/core/module'

export const nodejsModule: LearningModule = {
  id: 'nodejs',
  title: 'Node.js internals',
  description:
    'How Node.js really runs JavaScript, checked against a real Node.js 24: V8 and libuv, the event loop and microtasks, blocking and the thread pool, async patterns, streams and backpressure, HTTP on the wire, and graceful shutdown.',
  tags: ['nodejs', 'event loop', 'libuv', 'streams', 'async'],
  groups: [
    {
      title: 'Foundations',
      lessons: [
        { slug: 'runtime', title: 'What Node.js is made of', summary: 'V8, libuv and the threads inside one Node.js process.', load: () => import('./lessons/Runtime') },
        { slug: 'modules', title: 'CommonJS and ES modules', summary: 'require and import, the module cache, and how Node.js decides which one a file is.', load: () => import('./lessons/Modules') },
        { slug: 'event-loop', title: 'The event loop', summary: 'Timers, I/O and setImmediate: the phases, stepped through with real programs.', load: () => import('./lessons/EventLoop') },
        { slug: 'microtasks', title: 'nextTick and promises', summary: 'The two queues that run between every callback, and why their order differs in ES modules.', load: () => import('./lessons/Microtasks') },
        { slug: 'blocking', title: 'Blocking, the thread pool and workers', summary: 'What one slow function does to everyone, where libuv runs work in parallel, and worker threads.', load: () => import('./lessons/Blocking') },
      ],
    },
    {
      title: 'Async in practice',
      lessons: [
        { slug: 'async', title: 'Promises and async/await', summary: 'Sequential vs concurrent, Promise.all vs allSettled, and where errors go.', load: () => import('./lessons/Async') },
        { slug: 'streams', title: 'Streams and backpressure', summary: 'Chunks, highWaterMark, write() returning false, drain, and pipeline.', load: () => import('./lessons/Streams') },
      ],
    },
    {
      title: 'Building services',
      lessons: [
        { slug: 'http', title: 'HTTP on the wire', summary: 'The bytes of real requests and responses: keep-alive, Content-Length and chunked bodies.', load: () => import('./lessons/Http') },
        { slug: 'shutdown', title: 'Errors, signals and graceful shutdown', summary: 'Crashes and exit codes, SIGTERM, and finishing in-flight requests before exiting.', load: () => import('./lessons/Shutdown') },
      ],
    },
  ],
}
