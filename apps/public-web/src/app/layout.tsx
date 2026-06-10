import type { Metadata } from 'next'
import Link from 'next/link'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'DocPublish',
    template: '%s | DocPublish',
  },
  description: 'Plateforme de publication et de consultation de documents',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Merriweather:wght@400;700&display=swap"
          rel="stylesheet"
        />
      </head>

      <body>
        <header className="site-header">
          <div className="container">
            <nav className="navbar">
              <Link href="/" className="logo">
                <div className="logo-icon">D</div>

                <div>
                  <div className="logo-title">DocPublish</div>
                  <div className="logo-subtitle">
                    Document Publishing Platform
                  </div>
                </div>
              </Link>

              <div className="nav-links">
                <Link href="/?lang=fr">Documents FR</Link>
                <Link href="/?lang=other">Autres langues</Link>
              </div>
            </nav>
          </div>
        </header>

        <main className="main-content">
          <div className="container">{children}</div>
        </main>

        <footer className="site-footer">
          <div className="container footer-content">
            <div>
              <strong>DocPublish</strong>
              <p>
                Plateforme de publication et de diffusion de documents.
              </p>
            </div>

            <div className="footer-meta">
              <span>Sakly Firas — Technical Assessment</span>
              <span>© 2026</span>
            </div>
          </div>
        </footer>
      </body>
    </html>
  )
}