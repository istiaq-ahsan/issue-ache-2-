import { useState } from 'react'
import { Moon, Sun } from 'lucide-react'

function ThemeToggle() {
  const [isDark, setIsDark] = useState(() => document.documentElement.dataset.theme === 'dark')

  function toggleTheme() {
    const nextTheme = isDark ? 'light' : 'dark'
    document.documentElement.dataset.theme = nextTheme
    window.localStorage.setItem('issue-ache-theme', nextTheme)
    window.dispatchEvent(new CustomEvent('issue-ache-theme-change', { detail: nextTheme }))
    setIsDark(nextTheme === 'dark')
  }

  return (
    <button
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} theme`}
      className="icon-button"
      onClick={toggleTheme}
      title={`Switch to ${isDark ? 'light' : 'dark'} theme`}
      type="button"
    >
      {isDark ? <Sun aria-hidden="true" size={18} /> : <Moon aria-hidden="true" size={18} />}
    </button>
  )
}

export default ThemeToggle
