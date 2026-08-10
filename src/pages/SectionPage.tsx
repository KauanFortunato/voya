import { Plus } from 'lucide-react'

import SubpageHeader from '../components/SubpageHeader'
import './SectionPage.css'

type SectionPageProps = {
  kicker: string
  title: string
}

export default function SectionPage({ kicker, title }: SectionPageProps) {
  return (
    <main className="section-page" id="main-content">
      <SubpageHeader
        kicker={kicker}
        title={title}
        actionIcon={Plus}
        actionLabel={`Adicionar em ${title}`}
      />
      <section className="section-page__placeholder" aria-labelledby="section-progress-title">
        <span className="section-page__eyebrow">Em construção</span>
        <h2 id="section-progress-title">Esta área será a próxima etapa</h2>
        <p>
          A estrutura já está preparada para carregar esta tela somente quando ela for aberta.
        </p>
        <div className="section-page__progress" aria-label="Progresso da implementação">
          <span />
        </div>
      </section>
    </main>
  )
}
