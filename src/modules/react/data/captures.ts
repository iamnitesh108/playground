// Recorded with React 19.3.0 (development build, react-dom/client in jsdom) by tools/react-capture — do not edit by hand.

export const CAPTURE = {
 "react": "19.3.0",
 "compiled": {
  "jsx": {
   "source": "export function Cart({ items }) {\n  return (\n    <section className=\"cart\">\n      <h2>Cart ({items.length})</h2>\n      {items.map((item) => <CartItem key={item.id} item={item} />)}\n    </section>\n  )\n}",
   "output": "import { jsx as _jsx, jsxs as _jsxs } from \"react/jsx-runtime\";\nexport function Cart({ items }) {\n\treturn /* @__PURE__ */ _jsxs(\"section\", {\n\t\tclassName: \"cart\",\n\t\tchildren: [/* @__PURE__ */ _jsxs(\"h2\", { children: [\n\t\t\t\"Cart (\",\n\t\t\titems.length,\n\t\t\t\")\"\n\t\t] }), items.map((item) => /* @__PURE__ */ _jsx(CartItem, { item }, item.id))]\n\t});\n}"
  },
  "compiler": {
   "source": "function OrderTotal({ items, currency }) {\n  const total = items.reduce((sum, item) => sum + item.price * item.qty, 0)\n  return <p className=\"total\">{total.toFixed(2)} {currency}</p>\n}",
   "output": "import { c as _c } from \"react/compiler-runtime\";\nfunction OrderTotal(t0) {\n  const $ = _c(8);\n  if ($[0] !== \"18d59a97cd37168a12ebd55b05ec32d1a1e76f93bb8a27c22154f6b3ccb1385e\") {\n    for (let $i = 0; $i < 8; $i += 1) {\n      $[$i] = Symbol.for(\"react.memo_cache_sentinel\");\n    }\n    $[0] = \"18d59a97cd37168a12ebd55b05ec32d1a1e76f93bb8a27c22154f6b3ccb1385e\";\n  }\n  const {\n    items,\n    currency\n  } = t0;\n  let t1;\n  let t2;\n  if ($[1] !== items) {\n    const total = items.reduce(_temp, 0);\n    t1 = \"total\";\n    t2 = total.toFixed(2);\n    $[1] = items;\n    $[2] = t1;\n    $[3] = t2;\n  } else {\n    t1 = $[2];\n    t2 = $[3];\n  }\n  let t3;\n  if ($[4] !== currency || $[5] !== t1 || $[6] !== t2) {\n    t3 = <p className={t1}>{t2} {currency}</p>;\n    $[4] = currency;\n    $[5] = t1;\n    $[6] = t2;\n    $[7] = t3;\n  } else {\n    t3 = $[7];\n  }\n  return t3;\n}\nfunction _temp(sum, item) {\n  return sum + item.price * item.qty;\n}"
  }
 },
 "elements": {
  "element": {
   "$$typeof": "Symbol(react.transitional.element)",
   "type": "function Button",
   "key": "pay",
   "props": {
    "kind": "primary",
    "children": "Pay"
   },
   "frozen": true
  },
  "nested": {
   "$$typeof": "Symbol(react.transitional.element)",
   "type": "div",
   "key": null,
   "props": {
    "className": "cart",
    "children": "[element]"
   },
   "frozen": true
  },
  "childTypes": [
   "h2",
   "Button"
  ]
 },
 "rerender": {
  "mount": [
   "App (count 0)",
   "Header",
   "MemoHeader",
   "Cart",
   "CartItem tea",
   "CartItem milk",
   "Footer"
  ],
  "appState": [
   "App (count 1)",
   "Header",
   "Cart",
   "CartItem tea",
   "CartItem milk",
   "Footer"
  ],
  "cartState": [
   "Cart"
  ],
  "sameValue": [],
  "childrenMount": [
   "Page",
   "Collapsible (open true)",
   "Expensive"
  ],
  "childrenToggle": [
   "Collapsible (open false)"
  ]
 },
 "batching": {
  "three": {
   "renders": 1,
   "value": "1"
  },
  "updater": {
   "renders": 1,
   "value": "4"
  },
  "afterAwait": {
   "renders": 1,
   "value": "5"
  },
  "flushSync": {
   "renders": 2,
   "value": "6"
  },
  "seen": [
   "n right after setN: 0"
  ]
 },
 "keys": {
  "list": {
   "index": {
    "before": [
     "tea: \"note for tea\"",
     "milk: \"\""
    ],
    "after": [
     "coffee: \"note for tea\"",
     "tea: \"\"",
     "milk: \"\""
    ]
   },
   "id": {
    "before": [
     "tea: \"note for tea\"",
     "milk: \"\""
    ],
    "after": [
     "coffee: \"\"",
     "tea: \"note for tea\"",
     "milk: \"\""
    ]
   }
  },
  "preserve": {
   "before": [
    "Alice: 2",
    "Alice (keyed): 2"
   ],
   "after": [
    "Bob: 2",
    "Bob (keyed): 0"
   ]
  }
 },
 "effects": {
  "mount": [
   "render Parent n=0",
   "render Child n=0",
   "  layout effect Child n=0",
   "  layout effect Parent n=0",
   "  effect Child n=0",
   "  effect Parent n=0",
   "  effect Parent [] (mount only)"
  ],
  "update": [
   "render Parent n=1",
   "render Child n=1",
   "  layout cleanup Child n=0",
   "  layout cleanup Parent n=0",
   "  layout effect Child n=1",
   "  layout effect Parent n=1",
   "  cleanup Child n=0",
   "  cleanup Parent n=0",
   "  effect Child n=1",
   "  effect Parent n=1"
  ],
  "unmountChild": [
   "render Parent n=1",
   "  layout cleanup Child n=1",
   "  cleanup Child n=1"
  ],
  "unmountParent": [
   "  layout cleanup Parent n=1",
   "  cleanup Parent n=1"
  ],
  "strictMount": [
   "render Child n=7",
   "render Child n=7",
   "  layout effect Child n=7",
   "  effect Child n=7",
   "  layout cleanup Child n=7",
   "  cleanup Child n=7",
   "  layout effect Child n=7",
   "  effect Child n=7"
  ],
  "domReady": [
   "layout effect sees DOM: \"hello\""
  ]
 },
 "hooks": {
  "shown": "Should have a queue. You are likely calling Hooks conditionally, which is not allowed. (https://react.dev/link/invalid-hook-call)",
  "consoleErrors": [
   "React has detected a change in the order of Hooks called by Profile. This will lead to bugs and errors if not fixed. For more information, read the Rules of Hooks: https://react.dev/link/rules-of-hooks\n\n   Previous render            Next render\n   ------------------------------------------------------\n1. useState                   useState\n2. useState                   useState\n3. useEffect                  useState\n   ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^\n",
   "Error: Should have a queue. You are likely calling Hooks conditionally, which is not allowed. (https://react.dev/link/invalid-hook-call)\n    at updateReducerImpl (/node_modules/react-dom/cjs/react-dom-client.development.js:8355:15)\n    at updateReducer (/node_modules/react-dom/cjs/react-dom-client.development.js:8350:14)\n    at Object.useState (/node_modules/react-dom/cjs/react-dom-client.development.js:29181:18)\n    at process.env.NODE_ENV.exports.useState (/node_modules/react/cjs/react.development.js:1309:34)\n    at Profile (/tools/react-capture/experiments/hooks.jsx:36:53)\n    at Object.react_stack_bottom_frame (/node_modules/react-dom/cjs/react-dom-client.development.js:28571:20)\n    at renderWithHooks (/node_modules/react-dom/cjs/react-dom-client.development.js:8030:22)\n    at updateFunctionComponent (/node_modules/react-dom/cjs/react-dom-client.development.js:10569:19)\n    at beginWork (/node_modules/react-dom/cjs/react-dom-client.development.js:12205:18)\n    at runWithFiberInDEV (/node_modules/react-dom/cjs/react-dom-client.development.js:1045:30)\n    at performUnitOfWork (/node_modules/react-dom/cjs/react-dom-client.development.js:19176:22)\n    at workLoopSync (/node_modules/react-dom/cjs/react-dom-client.development.js:19004:41)\n    at renderRootSync (/node_modules/react-dom/cjs/react-dom-client.development.js:18985:11)\n    at performWorkOnRoot (/node_modules/react-dom/cjs/react-dom-client.development.js:18094:35)\n    at performSyncWorkOnRoot (/node_modules/react-dom/cjs/react-dom-client.development.js:20680:7)\n    at flushSyncWorkAcrossRoots_impl (/node_modules/react-dom/cjs/react-dom-client.development.js:20522:21)\n    at processRootScheduleInMicrotask (/node_modules/react-dom/cjs/react-dom-client.development.js:20561:9)\n    at /node_modules/react-dom/cjs/react-dom-client.development.js:20690:11\n    at flushActQueue (/node_modules/react/cjs/react.development.js:664:34)\n    at process.env.NODE_ENV.exports.act (/node_modules/react/cjs/react.development.js:960:10)\n    at Module.run (/tools/react-capture/experiments/hooks.jsx:57:8)\n    at async Object.run (file:///tools/react-capture/harness.mjs:29:20)\n    at async file:///tools/react-capture/capture.mjs:13:13 {\n  [stack]: [Getter/Setter],\n  [message]: 'Should have a queue. You are likely calling Hooks conditionally, which is not allowed. (https://react.dev/link/invalid-hook-call)'\n}\n\nThe above error occurred in the <Profile> component.\n\nReact will try to recreate this component tree from scratch using the error boundary you provided, Boundary.\n"
  ]
 },
 "memoization": {
  "parentRenders": 4,
  "childRenders": {
   "plain props": 1,
   "inline function": 4,
   "useCallback": 1,
   "inline object": 4,
   "useMemo": 1
  }
 },
 "reconcile": [
  {
   "name": "move last to front",
   "from": [
    "a",
    "b",
    "c",
    "d"
   ],
   "to": [
    "d",
    "a",
    "b",
    "c"
   ],
   "ops": [
    "move a at end",
    "move b at end",
    "move c at end"
   ],
   "result": [
    "d",
    "a",
    "b",
    "c"
   ]
  },
  {
   "name": "move first to end",
   "from": [
    "a",
    "b",
    "c",
    "d"
   ],
   "to": [
    "b",
    "c",
    "d",
    "a"
   ],
   "ops": [
    "move a at end"
   ],
   "result": [
    "b",
    "c",
    "d",
    "a"
   ]
  },
  {
   "name": "swap two",
   "from": [
    "a",
    "b",
    "c",
    "d"
   ],
   "to": [
    "a",
    "c",
    "b",
    "d"
   ],
   "ops": [
    "move b before d"
   ],
   "result": [
    "a",
    "c",
    "b",
    "d"
   ]
  },
  {
   "name": "reverse",
   "from": [
    "a",
    "b",
    "c",
    "d"
   ],
   "to": [
    "d",
    "c",
    "b",
    "a"
   ],
   "ops": [
    "move c at end",
    "move b at end",
    "move a at end"
   ],
   "result": [
    "d",
    "c",
    "b",
    "a"
   ]
  },
  {
   "name": "insert in the middle",
   "from": [
    "a",
    "b",
    "c"
   ],
   "to": [
    "a",
    "x",
    "b",
    "c"
   ],
   "ops": [
    "insert x before b"
   ],
   "result": [
    "a",
    "x",
    "b",
    "c"
   ]
  },
  {
   "name": "remove one",
   "from": [
    "a",
    "b",
    "c",
    "d"
   ],
   "to": [
    "a",
    "c",
    "d"
   ],
   "ops": [
    "remove b"
   ],
   "result": [
    "a",
    "c",
    "d"
   ]
  },
  {
   "name": "replace all",
   "from": [
    "a",
    "b"
   ],
   "to": [
    "c",
    "d"
   ],
   "ops": [
    "remove a",
    "remove b",
    "insert c at end",
    "insert d at end"
   ],
   "result": [
    "c",
    "d"
   ]
  },
  {
   "name": "mixed",
   "from": [
    "a",
    "b",
    "c",
    "d",
    "e"
   ],
   "to": [
    "e",
    "b",
    "x",
    "a",
    "d"
   ],
   "ops": [
    "remove c",
    "move b at end",
    "insert x at end",
    "move a at end",
    "move d at end"
   ],
   "result": [
    "e",
    "b",
    "x",
    "a",
    "d"
   ]
  }
 ],
 "concurrent": {
  "transition": [
   "render Search text=\"tea\" query=\"\" isPending=true",
   "  render Results query=\"\"",
   "render Search text=\"tea\" query=\"tea\" isPending=false",
   "  render Results query=\"tea\""
  ],
  "suspenseFirst": {
   "log": [
    "render Page"
   ],
   "html": "<p>Loading order…</p>"
  },
  "suspenseResolved": {
   "log": [
    "render Order (data: PAID)"
   ],
   "html": "<p>Order 42: PAID</p>"
  }
 },
 "hydration": {
  "html": "<main><p>Rendered at <time>10:00:00</time></p><button>0<!-- --> likes</button></main>",
  "match": {
   "sameButtonNode": true,
   "afterClick": "1 likes",
   "recoverableErrors": []
  },
  "mismatch": {
   "recoverableErrors": [
    "Hydration failed because the server rendered text didn't match the client. As a result this tree will be regenerated on the client. This can happen if a SSR-ed Client Component used:"
   ],
   "html": "<main><p>Rendered at <time>10:00:03</time></p><button>0 likes</button></main>"
  }
 }
} as const
