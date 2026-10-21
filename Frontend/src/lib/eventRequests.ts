// Timeout still settles when a transport ignores cancellation. Reset/unmount
// aborts the child request; late completions never replace a newer result.
export async function eventRequest<T>(load: (signal: AbortSignal) => Promise<T>, signal: AbortSignal, timeoutMs = 12000): Promise<T> {
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  let cancel: () => void = () => {}
  const interrupted = new Promise<never>((_resolve, reject) => {
    cancel = () => { controller.abort(); reject(new DOMException('Cancelled', 'AbortError')) }
    timer = setTimeout(() => { controller.abort(); reject(new Error('Events request timed out')) }, timeoutMs)
    signal.addEventListener('abort', cancel, { once: true })
  })
  try {
    if (signal.aborted) cancel()
    return await Promise.race([signal.aborted ? interrupted : load(controller.signal), interrupted])
  } finally {
    clearTimeout(timer)
    signal.removeEventListener('abort', cancel)
    controller.abort()
  }
}
