import {
  CalendarClock,
  CheckSquare,
  ChevronRight,
  FileCheck2,
  Pencil,
  Plane,
  Route,
  WalletCards,
} from 'lucide-react'
import { Link } from 'react-router-dom'

import SubpageHeader from '../components/SubpageHeader'
import './OverviewPage.css'

const planningItems = [
  { label: 'Roteiro planeado', value: 82, to: '/itinerary', icon: Route },
  { label: 'Documentos confirmados', value: 60, to: '/more/documents', icon: FileCheck2 },
  { label: 'Checklist concluído', value: 38, to: '/more/checklist', icon: CheckSquare },
  { label: 'Orçamento definido', value: 100, to: '/more/budget', icon: WalletCards },
]

export default function OverviewPage() {
  return (
    <main className="overview-page" id="main-content">
      <SubpageHeader
        kicker="12–18 setembro 2026"
        title="A sua viagem"
        actionIcon={Pencil}
        actionLabel="Editar viagem"
      />

      <section className="overview-hero" aria-labelledby="overview-trip-title">
        <span className="overview-hero__eyebrow">Próxima viagem</span>
        <h2 id="overview-trip-title">Roma &amp; Veneza</h2>
        <p>Uma semana entre história, cafés e canais.</p>
        <div className="overview-route" aria-hidden="true">
          <span>ROMA</span>
          <i />
          <Plane size={19} />
          <span>VENEZA</span>
        </div>
        <div className="overview-stats">
          <div><strong>7</strong><span>dias</span></div>
          <div><strong>2</strong><span>cidades</span></div>
          <div><strong>4</strong><span>viajantes</span></div>
        </div>
      </section>

      <section className="overview-section" aria-labelledby="planning-title">
        <div className="overview-section__heading">
          <h2 id="planning-title">Planeamento</h2>
          <span className="overview-status">Em andamento</span>
        </div>
        <div className="planning-list">
          {planningItems.map(({ label, value, to, icon: Icon }) => (
            <Link className="planning-row" to={to} key={label}>
              <span className="planning-row__icon"><Icon size={18} aria-hidden="true" /></span>
              <span className="planning-row__content">
                <span><strong>{label}</strong><b>{value}%</b></span>
                <span
                  className="planning-progress"
                  role="progressbar"
                  aria-label={label}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={value}
                >
                  <i style={{ transform: `scaleX(${value / 100})` }} />
                </span>
              </span>
              <ChevronRight size={17} aria-hidden="true" />
            </Link>
          ))}
        </div>
      </section>

      <section className="overview-section" aria-labelledby="milestones-title">
        <div className="overview-section__heading">
          <h2 id="milestones-title">Próximos marcos</h2>
        </div>
        <div className="milestone-list">
          <article className="milestone-row">
            <span className="milestone-date">08<small>SET</small></span>
            <span><strong>Check-in do voo</strong><small>Abre em 3 dias · TAP</small></span>
            <CalendarClock size={19} aria-hidden="true" />
          </article>
          <article className="milestone-row">
            <span className="milestone-date">12<small>SET</small></span>
            <span><strong>Partida para Roma</strong><small>Lisboa · Terminal 1 · 06:20</small></span>
            <Plane size={19} aria-hidden="true" />
          </article>
        </div>
      </section>
    </main>
  )
}
