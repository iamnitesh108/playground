// Server rendering to HTML, then hydrating it in the "browser" — matching and mismatching.
import { useState } from 'react'
import { renderToString } from 'react-dom/server'
import { hydrateRoot } from 'react-dom/client'
export async function run({ act }) {
  const container = document.createElement('div') // its own container: hydrateRoot creates the root
  document.body.append(container)
  const out = {}
  function Clock({ time }) { return <p>Rendered at <time>{time}</time></p> }
  function LikeButton() {
    const [likes, setLikes] = useState(0)
    return <button onClick={() => setLikes(likes + 1)}>{likes} likes</button>
  }
  function App({ time }) { return <main><Clock time={time} /><LikeButton /></main> }

  out.html = renderToString(<App time="10:00:00" />)

  // Same props on the client: hydration attaches to the existing DOM.
  container.innerHTML = out.html
  const serverButton = container.querySelector('button')
  const ok = []
  const root = await act(async () => hydrateRoot(container, <App time="10:00:00" />, { onRecoverableError: (e) => ok.push(e.message) }))
  await act(() => container.querySelector('button').click())
  out.match = { sameButtonNode: container.querySelector('button') === serverButton, afterClick: container.querySelector('button').textContent, recoverableErrors: ok }
  await act(() => root.unmount())

  // Different text on the client: a mismatch.
  container.innerHTML = out.html
  const errors = []
  const root2 = await act(async () => hydrateRoot(container, <App time="10:00:03" />, { onRecoverableError: (e) => errors.push(e.message.split('\n')[0]) }))
  out.mismatch = { recoverableErrors: errors, html: container.innerHTML }
  await act(() => root2.unmount())
  return out
}
