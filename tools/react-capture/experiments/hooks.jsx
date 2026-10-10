// Hooks are matched by call order; calling one conditionally breaks that.
import { useState, useEffect, Component } from 'react'
export async function run({ render, act, container }) {
  class Boundary extends Component {
    state = { error: null }
    static getDerivedStateFromError(error) { return { error } }
    render() { return this.state.error ? <p id="err">{this.state.error.message}</p> : this.props.children }
  }
  function Profile() {
    const [loggedIn, setLoggedIn] = useState(false)
    if (loggedIn) {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      const [name] = useState('ann')
      void name
    }
    const [theme] = useState('light')
    useEffect(() => {}, [theme])
    return <button id="login" onClick={() => setLoggedIn(true)}>{theme}</button>
  }
  await render(<Boundary><Profile /></Boundary>)
  await act(() => container.querySelector('#login').click())
  return { shown: container.querySelector('#err')?.textContent ?? container.innerHTML }
}
