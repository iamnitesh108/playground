// A rejected promise nobody handles. Expected: the process exits with code 1.
setTimeout(() => console.log('this line never runs'), 100)
Promise.reject(new Error('card declined'))
