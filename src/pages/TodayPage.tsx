import IconButton from '../components/IconButton';
import './TodayPage.css'
import {
  Bell,
} from 'lucide-react'

export default function TodayPage() {
  return (
    <main className="today-page">
      <header className="today-header">
        <div className="header-info">
          <p className="today-brand">Quinta-feira 12 setembro</p>
          <h1>Bom dia em Roma</h1>
        </div>

        <IconButton
          icon={Bell}
          ariaLabel="Notificações"
        />
      </header>
    </main>
  )
}