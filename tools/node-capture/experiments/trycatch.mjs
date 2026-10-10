// try/catch does not catch an error thrown later in a callback; it does catch an awaited rejection.
try {
  setTimeout(() => { throw new Error('thrown inside setTimeout') }, 0)
  console.log('try block finished without error')
} catch (e) {
  console.log('caught:', e.message)
}
