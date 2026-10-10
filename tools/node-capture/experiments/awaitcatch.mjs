const charge = () => new Promise((_, reject) => setTimeout(() => reject(new Error('card declined')), 10))
try {
  await charge()
} catch (e) {
  console.log('caught:', e.message)
}
