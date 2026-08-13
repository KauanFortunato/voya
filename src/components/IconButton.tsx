import type { LucideIcon } from 'lucide-react'
import './IconButton.css'

type IconButtonProps = {
  icon: LucideIcon
  onClick?: () => void
  ariaLabel: string
}

export default function IconButton({
  icon: Icon,
  onClick,
  ariaLabel,
}: IconButtonProps) {
  return (
    <button
      className="icon-button"
      onClick={onClick}
      aria-label={ariaLabel}
    >
      <Icon size={20} />
    </button>
  )
}