/** Minimal Lexical root for markdown stored as a single text block (round-trips via payload-sdk). */
export function markdownToLexicalState(markdown: string) {
  return {
    root: {
      type: 'root',
      format: '',
      indent: 0,
      version: 1,
      direction: 'ltr',
      children: [
        {
          type: 'paragraph',
          format: '',
          indent: 0,
          version: 1,
          direction: 'ltr',
          children: [
            {
              type: 'text',
              format: 0,
              mode: 'normal',
              style: '',
              detail: 0,
              text: markdown,
              version: 1,
            },
          ],
        },
      ],
    },
  }
}
