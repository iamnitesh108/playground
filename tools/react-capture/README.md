# react-capture

Records real React behaviour for the `react` module. Each file in `experiments/` is a JSX module
exporting `run({ render, act, log, container })`. `harness.mjs` loads it through the project's
Vite (for JSX), with the development build of React rendering into a jsdom document; `act()`
makes every step complete before the next. `compile.mjs` records real compiler output: JSX
through Vite's Oxc transform, and a component through React Compiler 1.0.

```sh
npm install
node capture.mjs ../../src/modules/react/data/captures.ts
```

Check the reconciliation simulator against the DOM operations React performed (from the
repository root):

```sh
node tools/react-capture/check-simulator.mjs
```
