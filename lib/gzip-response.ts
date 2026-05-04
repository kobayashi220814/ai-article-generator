import { promisify } from "util"
import { brotliCompress, constants } from "zlib"

const brotliAsync = promisify(brotliCompress)

export async function gzipJson(data: unknown): Promise<Response> {
  const json = JSON.stringify(data)
  const compressed = await brotliAsync(Buffer.from(json), {
    params: { [constants.BROTLI_PARAM_QUALITY]: 4 },
  })
  return new Response(compressed, {
    headers: {
      "Content-Type": "application/json",
      "Content-Encoding": "br",
      "Vary": "Accept-Encoding",
    },
  })
}
