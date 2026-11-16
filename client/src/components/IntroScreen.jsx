import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

const INTRO_TEXT = 'Issue Ache !'
const CHARACTER_FADE_DURATION = 400
const CHARACTER_STAGGER_DURATION = 100
const VISIBLE_DURATION = 1000
const EXIT_DURATION = 500
const EXIT_DELAY =
  CHARACTER_FADE_DURATION +
  (Array.from(INTRO_TEXT).length - 1) * CHARACTER_STAGGER_DURATION +
  VISIBLE_DURATION

function IntroScreen({ onComplete }) {
  const [isExiting, setIsExiting] = useState(false)

  useEffect(() => {
    const appRoot = document.getElementById('root')
    const previousInert = appRoot?.inert ?? false
    const previousDocumentOverflow = document.documentElement.style.overflow
    const previousBodyOverflow = document.body.style.overflow
    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches
    const exitDelay = prefersReducedMotion ? VISIBLE_DURATION : EXIT_DELAY
    const totalDuration = exitDelay + (prefersReducedMotion ? 0 : EXIT_DURATION)

    if (appRoot) appRoot.inert = true
    document.documentElement.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'

    const exitTimer = prefersReducedMotion
      ? undefined
      : window.setTimeout(() => setIsExiting(true), exitDelay)
    const completionTimer = window.setTimeout(
      () => onComplete(false),
      totalDuration,
    )

    return () => {
      if (exitTimer !== undefined) window.clearTimeout(exitTimer)
      window.clearTimeout(completionTimer)
      if (appRoot) appRoot.inert = previousInert
      document.documentElement.style.overflow = previousDocumentOverflow
      document.body.style.overflow = previousBodyOverflow
    }
  }, [onComplete])

  return createPortal(
    <div
      aria-label="Issue Ache !"
      className={`intro-screen${isExiting ? ' is-exiting' : ''}`}
      role="status"
    >
      <p className="intro-screen__title">
        {Array.from(INTRO_TEXT, (character, index) => (
          <span
            aria-hidden="true"
            className="intro-screen__character"
            key={`${character}-${index}`}
            style={{ animationDelay: `${index * CHARACTER_STAGGER_DURATION}ms` }}
          >
            {character}
          </span>
        ))}
      </p>
    </div>,
    document.body,
  )
}

export default IntroScreen
