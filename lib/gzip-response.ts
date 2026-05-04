import { promisify } from "util"
import { gzip } from "zlib"

const gzipAsync = promisify(gzip)

export async function gzipJson(data: unknown): Promise<Response> {
  const json = JSON.stringify(data)
  const compressed = await gzipAsync(Buffer.from(json))
  return new Response(compressed, {
    headers: {
      "Content-Type": "application/json",
      "Content-Encoding": "gzip",
      "Vary": "Accept-Encoding",
    },
  })
}
