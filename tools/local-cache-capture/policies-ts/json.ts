export const print = (fields: Record<string, unknown>): void => console.log(JSON.stringify(fields))
export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)))
