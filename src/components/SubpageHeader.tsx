import { ArrowLeft, type LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'

import IconButton from './IconButton'
import './SubpageHeader.css'

type SubpageHeaderProps = {
  kicker: string
  title: string
  actionIcon?: LucideIcon
  actionLabel?: string
  onAction?: () => void
}

export default function SubpageHeader({
  kicker,
  title,
  actionIcon,
  actionLabel,
  onAction,
}: SubpageHeaderProps) {
  return (
    <header className="subpage-header">
      <Link className="subpage-back" to="/more" aria-label="Voltar para Mais">
        <ArrowLeft size={18} aria-hidden="true" />
        <span>Mais</span>
      </Link>
      <div className="subpage-header__main">
        <div>
          <p>{kicker}</p>
          <h1>{title}</h1>
        </div>
        {actionIcon && actionLabel && (
          <IconButton icon={actionIcon} ariaLabel={actionLabel} onClick={onAction} />
        )}
      </div>
    </header>
  )
}
