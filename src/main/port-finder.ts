import net from 'node:net'

export const findFreePort = async (): Promise<number> => {
  return await new Promise((resolve, reject) => {
    const server = net.createServer()

    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (!address || typeof address === 'string') {
        reject(new Error('Failed to resolve a free port'))
        return
      }

      const { port } = address
      server.close((closeError) => {
        if (closeError) {
          reject(closeError)
          return
        }
        resolve(port)
      })
    })
  })
}
