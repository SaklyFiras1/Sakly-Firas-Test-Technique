const API = process.env.API_URL || 'http://localhost:4000'

interface Article {
  id: string
  slug: string
  title: string
  summary: string
  language: string
  publishedAt: string
}

interface ArticlesResponse {
  articles: Article[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}

async function getArticles(lang?: string): Promise<Article[]> {
  const qs = lang ? `?languageGroup=${lang}` : ''
  const res = await fetch(`${API}/api/public/articles${qs}`, { next: { revalidate: 30 } })
  if (!res.ok) return []
  const data: ArticlesResponse = await res.json()
  return data.articles
}

// FIX: Next.js 14+ requires searchParams to be awaited as a Promise
export default async function Home({
  searchParams
}: {
  searchParams: Promise<{ lang?: string }>
}) {
  const { lang: langParam } = await searchParams
  const lang = langParam === 'fr' ? 'fr' : langParam === 'other' ? 'other' : undefined
  const articles = await getArticles(lang)

  return (
    <div>
      <div style={{ marginBottom: 8 }}>
        <h1 style={{ fontFamily: 'var(--serif)', fontSize: 28, fontWeight: 600, marginBottom: 8 }}>Documents publiés</h1>
        <p style={{ color: 'var(--muted)', fontSize: 15 }}>Archives de documents officiels et rapports.</p>
      </div>

      <div className="lang-tabs">
        <a href="/" className={`lang-tab ${!lang ? 'active' : ''}`}>Tous</a>
        <a href="/?lang=fr" className={`lang-tab ${lang === 'fr' ? 'active' : ''}`}>Documents FR</a>
        <a href="/?lang=other" className={`lang-tab ${lang === 'other' ? 'active' : ''}`}>Autres langues</a>
      </div>

      {articles.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📭</div>
          <h2>Aucun article publié</h2>
          <p>Les documents publiés apparaîtront ici.</p>
        </div>
      ) : (
        <div className="article-grid">
          {articles.map(article => (
            <a key={article.id} href={`/articles/${article.slug}`} className="article-card">
              <div className="article-meta">
                <span className="article-lang">{article.language.toUpperCase()}</span>
                <span className="article-date">
                  {new Date(article.publishedAt).toLocaleDateString('fr-FR', {
                    day: 'numeric', month: 'long', year: 'numeric'
                  })}
                </span>
              </div>
              <div className="article-title">{article.title}</div>
              <div className="article-summary">{article.summary}</div>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
