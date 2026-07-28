import { useState, useMemo } from 'react'
import { DOCS_MODULES, DOCS_MODULE_ORDER } from '../config/docs'
import type { ModuleDoc } from '../config/docs'

function DocContent({ doc }: { doc: ModuleDoc }) {
  return (
    <div style={{ maxWidth: '860px' }}>
      {doc.sections.map((section, si) => (
        <div key={si} style={{ marginBottom: '28px' }}>
          <h2
            style={{
              fontSize: '15px',
              fontWeight: 600,
              color: 'var(--text-primary)',
              margin: '0 0 12px 0',
              paddingBottom: '6px',
              borderBottom: '1px solid var(--border)',
            }}
          >
            {section.heading}
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {section.items.map((item, ii) => {
              if (typeof item === 'string') {
                return (
                  <p
                    key={ii}
                    style={{
                      margin: 0,
                      fontSize: '12.5px',
                      lineHeight: 1.65,
                      color: 'var(--text-secondary)',
                    }}
                  >
                    {item}
                  </p>
                )
              }
              return (
                <div key={ii} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <strong
                    style={{
                      fontSize: '12.5px',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                    }}
                  >
                    {item.term}
                  </strong>
                  <p
                    style={{
                      margin: 0,
                      fontSize: '12.5px',
                      lineHeight: 1.65,
                      color: 'var(--text-secondary)',
                      paddingLeft: '12px',
                    }}
                  >
                    {item.desc}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

function ModuleSidebar({
  modules,
  activeKey,
  search,
  onSelect,
  onSearchChange,
}: {
  modules: { key: string; doc: ModuleDoc }[]
  activeKey: string
  search: string
  onSelect: (key: string) => void
  onSearchChange: (val: string) => void
}) {
  const filtered = useMemo(() => {
    if (!search.trim()) return modules
    const q = search.toLowerCase()
    return modules.filter(
      (m) =>
        m.doc.title.toLowerCase().includes(q) ||
        m.doc.sections.some((s) =>
          s.items.some((item) => {
            if (typeof item === 'string') return item.toLowerCase().includes(q)
            return item.term.toLowerCase().includes(q) || item.desc.toLowerCase().includes(q)
          })
        )
    )
  }, [modules, search])

  return (
    <div
      style={{
        width: '240px',
        minWidth: '240px',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-base)',
      }}
    >
      {/* Search */}
      <div
        style={{
          padding: '12px',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 10px',
            borderRadius: '8px',
            border: '1px solid var(--border)',
            background: 'var(--bg-surface)',
          }}
        >
          <i className="ti ti-search text-xs" style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search topics..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              fontSize: '11px',
              color: 'var(--text-primary)',
            }}
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-muted)',
                padding: 0,
                display: 'flex',
              }}
            >
              <i className="ti ti-x text-xs" />
            </button>
          )}
        </div>
      </div>

      {/* Module list */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '6px' }}>
        {filtered.length === 0 && (
          <p
            style={{
              fontSize: '11px',
              color: 'var(--text-muted)',
              textAlign: 'center',
              padding: '24px 12px',
              margin: 0,
            }}
          >
            No matching topics found
          </p>
        )}
        {filtered.map(({ key, doc }) => {
          const active = key === activeKey
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelect(key)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '7px 10px',
                borderRadius: '8px',
                border: 'none',
                background: active ? `${doc.color}18` : 'transparent',
                color: active ? doc.color : 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: '11.5px',
                fontWeight: active ? 600 : 400,
                textAlign: 'left',
                transition: 'all 0.1s ease',
                marginBottom: '2px',
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  ;(e.currentTarget as HTMLElement).style.background = 'var(--hover-bg)'
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  ;(e.currentTarget as HTMLElement).style.background = 'transparent'
                }
              }}
            >
              <i className={`ti ${doc.icon}`} style={{ fontSize: '14px', flexShrink: 0 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {doc.title}
              </span>
            </button>
          )
        })}
      </nav>

      {/* Footer */}
      <div
        style={{
          padding: '8px 12px',
          borderTop: '1px solid var(--border)',
          fontSize: '10px',
          color: 'var(--text-muted)',
        }}
      >
        {modules.length} module{modules.length !== 1 ? 's' : ''}
        {search ? ` (${filtered.length} matched)` : ''}
      </div>
    </div>
  )
}

export default function DocumentationPage() {
  const [activeKey, setActiveKey] = useState(DOCS_MODULE_ORDER[0])
  const [search, setSearch] = useState('')

  const modules = DOCS_MODULE_ORDER.map((key) => ({ key, doc: DOCS_MODULES[key] }))
  const activeDoc = DOCS_MODULES[activeKey]

  return (
    <div
      style={{
        display: 'flex',
        height: '100%',
        overflow: 'hidden',
        background: 'var(--bg-base)',
      }}
    >
      {/* Sidebar */}
      <ModuleSidebar
        modules={modules}
        activeKey={activeKey}
        search={search}
        onSelect={setActiveKey}
        onSearchChange={setSearch}
      />

      {/* Content area */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '28px 36px',
          background: 'var(--bg-surface)',
        }}
      >
        {activeDoc && (
          <>
            {/* Module header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '24px',
                paddingBottom: '16px',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: `${activeDoc.color}18`,
                  color: activeDoc.color,
                  flexShrink: 0,
                }}
              >
                <i className={`ti ${activeDoc.icon}`} style={{ fontSize: '20px' }} />
              </div>
              <div>
                <h1
                  style={{
                    fontSize: '18px',
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    margin: 0,
                    lineHeight: 1.2,
                  }}
                >
                  {activeDoc.title}
                </h1>
                <p
                  style={{
                    fontSize: '11px',
                    color: 'var(--text-muted)',
                    margin: '2px 0 0',
                  }}
                >
                  Documentation & User Guide
                </p>
              </div>
            </div>

            {/* Sections */}
            <DocContent doc={activeDoc} />
          </>
        )}
      </div>
    </div>
  )
}
