import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'

// react-markdown + remark-gfm, mapped to the prototype's rb- classes. HTML
// escaping stays ON — no rehype-raw, no dangerouslySetInnerHTML — so any raw
// markup in body_md renders as inert text. Renders in both RSC (online recipe
// page) and the client shell (offline), so no 'use client' here.

// Headings shift down one level (the page <h1> is the recipe title) while the
// visual style is driven by the rb-h{sourceLevel} class.
const components: Components = {
  h1: ({ children }) => <h2 className="rb-h rb-h1">{children}</h2>,
  h2: ({ children }) => <h3 className="rb-h rb-h2">{children}</h3>,
  h3: ({ children }) => <h4 className="rb-h rb-h3">{children}</h4>,
  h4: ({ children }) => <h5 className="rb-h rb-h4">{children}</h5>,
  h5: ({ children }) => <h6 className="rb-h rb-h4">{children}</h6>,
  h6: ({ children }) => <h6 className="rb-h rb-h4">{children}</h6>,
  p: ({ children }) => <p className="rb-p">{children}</p>,
  ul: ({ children }) => <ul className="rb-list">{children}</ul>,
  ol: ({ children }) => <ol className="rb-list">{children}</ol>,
  hr: () => <hr className="rb-hr" />,
  blockquote: ({ children }) => (
    <blockquote className="rb-blockquote">{children}</blockquote>
  ),
  code: ({ children }) => <code className="rb-code">{children}</code>,
  // The signature element: tables render as bordered field-cards.
  table: ({ children }) => (
    <div className="rb-table-wrap">
      <table className="rb-table">{children}</table>
    </div>
  ),
}

export function RecipeMarkdown({ source }: { source: string }) {
  return (
    <div className="rb-md">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {source}
      </ReactMarkdown>
    </div>
  )
}
