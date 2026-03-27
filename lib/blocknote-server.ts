import { BlockNoteEditor } from "@blocknote/core"
import "@blocknote/core/fonts/inter.css"

let editorInstance: BlockNoteEditor | null = null

function getEditor() {
  if (!editorInstance) {
    editorInstance = BlockNoteEditor.create()
  }
  return editorInstance
}

export async function htmlToBlocks(html: string) {
  const editor = getEditor()
  const blocks = await editor.tryParseHTMLToBlocks(html)
  return blocks
}
