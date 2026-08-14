import type { MotionProps } from 'motion/react'

type DialogMotionProps = Pick<MotionProps, 'initial' | 'animate' | 'exit'>

const enterEase = [0.22, 1, 0.36, 1] as const
const exitEase = [0.4, 0, 1, 1] as const

export function dialogBackdropMotion(reduceMotion: boolean | null): DialogMotionProps {
  return {
    initial: reduceMotion ? false : { opacity: 0 },
    animate: { opacity: 1, transition: { duration: reduceMotion ? 0 : 0.18, ease: enterEase } },
    exit: reduceMotion ? undefined : { opacity: 0, transition: { duration: 0.16, ease: exitEase } },
  }
}

export function bottomSheetMotion(reduceMotion: boolean | null): DialogMotionProps {
  return {
    initial: reduceMotion ? false : { y: '100%' },
    animate: {
      y: 0,
      transition: reduceMotion
        ? { duration: 0 }
        : { type: 'spring', duration: 0.34, bounce: 0 },
    },
    exit: reduceMotion
      ? undefined
      : { y: '100%', transition: { duration: 0.22, ease: exitEase } },
  }
}
