import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

const API = process.env.API_URL || 'http://localhost:4000'

interface Article {
  id: string
  slug: string
  title: string
  summary: string
  bodyHtml: string
  language: string
  publishedAt: string
}

async function getArticle(slug: string): Promise<Article | null> {
  const res = await fetch(`${API}/api/public/articles/${slug}`, { next: { revalidate: 60 } })
  if (!res.ok) return null
  return res.json()
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const article = await getArticle(slug)
  if (!article) return { title: 'Article introuvable' }
  return { title: article.title, description: article.summary }
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const article = await getArticle(slug)
  if (!article) notFound()

  return (
    <article>
      <header className="article-header">
        <div className="article-meta">
          <span className="article-lang">{article.language.toUpperCase()}</span>
          <span className="article-date">
            Publié le {new Date(article.publishedAt).toLocaleDateString('fr-FR', {
              day: 'numeric', month: 'long', year: 'numeric'
            })}
          </span>
        </div>
        <h1 className="article-title">{article.title}</h1>
        <p className="article-summary">{article.summary}</p>
      </header>

      <div
        className="article-body"
        dangerouslySetInnerHTML={{ __html: article.bodyHtml }}
      />

      <div style={{ marginTop: 48, paddingTop: 24, borderTop: '1px solid var(--border)' }}>
        <a href="/" style={{ color: 'var(--muted)', fontSize: 14 }}>← Retour aux documents</a>
      </div>
    </article>
  )
}
