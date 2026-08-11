import {
  Bell,
  CheckSquare,
  ChevronRight,
  FileText,
  LogOut,
  Route,
  Settings,
  Users,
  WalletCards,
} from 'lucide-react'
import { Link } from 'react-router-dom'

import IconButton from '../components/IconButton'
import { useAuth } from '../auth/auth'
import './MorePage.css'

const menuItems = [
  { to: '/more/overview', title: 'Visão geral', subtitle: 'Progresso e próximos marcos', icon: Route },
  { to: '/more/checklist', title: 'Checklist', subtitle: '6 de 16 itens concluídos', icon: CheckSquare },
  { to: '/more/documents', title: 'Documentos', subtitle: 'Reservas, bilhetes e ficheiros', icon: FileText },
  { to: '/more/budget', title: 'Orçamento', subtitle: '€672 disponíveis', icon: WalletCards },
  { to: '/more/travelers', title: 'Viajantes', subtitle: 'Kauan, Kairon, Helieny e Anicio', icon: Users },
  { to: '/more/settings', title: 'Configurações', subtitle: 'Notificações, mapas e idioma', icon: Settings },
]

export default function MorePage() {
  const { user, logout } = useAuth()
  const initials = user?.displayName.slice(0, 2).toLocaleUpperCase('pt-PT') ?? 'VF'

  return (
    <main className="more-page" id="main-content">
      <header className="more-header">
        <div>
          <p>Organização</p>
          <h1>Mais</h1>
        </div>
        <IconButton icon={Bell} ariaLabel="Notificações" />
      </header>

      <section className="more-profile" aria-label="Perfil atual">
        <span className="more-avatar" aria-hidden="true">{initials}</span>
        <div>
          <h2>{user?.displayName}</h2>
          <p>{user?.role === 'organizer' ? 'Organizador' : 'Viajante'} · Itália 2026</p>
        </div>
        <span className="more-ready">Pronto</span>
      </section>

      <nav className="more-menu" aria-label="Organização da viagem">
        {menuItems.map(({ to, title, subtitle, icon: Icon }) => (
          <Link className="more-menu__row" to={to} key={to}>
            <span className="more-menu__icon"><Icon size={20} aria-hidden="true" /></span>
            <span className="more-menu__label">
              <strong>{title}</strong>
              <small>{subtitle}</small>
            </span>
            <ChevronRight className="more-menu__arrow" size={18} aria-hidden="true" />
          </Link>
        ))}
      </nav>

      <button className="more-logout" type="button" onClick={() => void logout()}>
        <LogOut size={18} aria-hidden="true" />
        Sair desta conta
      </button>
    </main>
  )
}
