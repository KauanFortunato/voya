import { ArrowLeft, type LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'

import IconButton from './IconButton'
import './SubpageHeader.css'

type SubpageHeaderProps = {
  kicker: string
  title: string
  backTo?: string
  backLabel?: string
  actionIcon?: LucideIcon
  actionLabel?: string
  onAction?: () => void
}

export default function SubpageHeader({
  kicker,
  title,
  backTo = '/more',
  backLabel = 'Mais',
  actionIcon,
  actionLabel,
  onAction,
}: SubpageHeaderProps) {
  return (
    <header className="subpage-header">
      <Link className="subpage-back" to={backTo} aria-label={`Voltar para ${backLabel}`}>
        <ArrowLeft size={18} aria-hidden="true" />
        <span>{backLabel}</span>
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
