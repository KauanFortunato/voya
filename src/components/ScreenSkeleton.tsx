import './ScreenSkeleton.css'

export default function ScreenSkeleton() {
  return (
    <main className="screen-skeleton" aria-busy="true" aria-label="Carregando conteúdo">
      <div className="screen-skeleton__header">
        <div>
          <span className="skeleton-line skeleton-line--short" />
          <span className="skeleton-line skeleton-line--title" />
        </div>
        <span className="skeleton-circle" />
      </div>
      <span className="skeleton-block skeleton-block--hero" />
      <span className="skeleton-block skeleton-block--summary" />
      <span className="skeleton-line skeleton-line--section" />
      <span className="skeleton-block skeleton-block--card" />
      <span className="skeleton-block skeleton-block--card" />
      <span className="skeleton-block skeleton-block--card" />
    </main>
  )
}
