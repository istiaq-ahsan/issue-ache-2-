import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Activity,
  Bell,
  Building2,
  ClipboardCheck,
  FileClock,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquareWarning,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Buildings } from '@phosphor-icons/react'
import { useAuth } from '../../context/use-auth.js'
import BrandLockup from '../../components/navigation/BrandLockup.jsx'
import NotificationCenter from '../../components/NotificationCenter.jsx'
import ThemeToggle from '../../components/ThemeToggle.jsx'

const workspaceConfig = {
  INSTITUTION: {
    label: 'Institution admin',
    links: [
      { label: 'Overview', icon: LayoutDashboard, path: (id) => `/institution/dashboard/${id}`, end: true },
      { label: 'Departments', icon: Building2, path: (id) => `/institution/dashboard/${id}/departments` },
      { label: 'Authorities', icon: UsersRound, path: (id) => `/institution/authorities?institutionId=${id}` },
      { label: 'Audit log', icon: FileClock, path: (id) => `/institution/dashboard/${id}/audit-logs` },
      { label: 'Notifications', icon: Bell, path: (id) => `/notifications/${id}` },
    ],
  },
  AUTHORITY: {
    label: 'Authority workspace',
    links: [
      { label: 'Overview', icon: LayoutDashboard, path: (id) => `/authority/institutions/${id}/dashboard`, end: true },
      { label: 'Registrations', icon: ClipboardCheck, path: (id) => `/authority/institutions/${id}/pending-registrations` },
      { label: 'Department requests', icon: Building2, path: (id) => `/authority/institutions/${id}/department-change-requests` },
      { label: 'Campus issues', icon: MessageSquareWarning, path: (id) => `/authority/institutions/${id}/issues` },
      { label: 'Audit log', icon: FileClock, path: (id) => `/authority/institutions/${id}/audit-logs` },
      { label: 'Notifications', icon: Bell, path: (id) => `/notifications/${id}` },
    ],
  },
  STUDENT: {
    label: 'Student workspace',
    links: [
      { label: 'Dashboard', icon: LayoutDashboard, path: (id) => `/student/dashboard/${id}`, end: true },
      { label: 'Campus issues', icon: MessageSquareWarning, path: (id) => `/student/issues/${id}` },
      { label: 'Report an issue', icon: ClipboardCheck, path: (id) => `/student/issues/${id}/new` },
      { label: 'My profile', icon: UserRound, path: (id) => `/student/profile/${id}` },
      { label: 'Notifications', icon: Bell, path: (id) => `/notifications/${id}` },
    ],
  },
  TEACHER: {
    label: 'Teacher workspace',
    links: [
      { label: 'Dashboard', icon: LayoutDashboard, path: (id) => `/teacher/dashboard/${id}`, end: true },
      { label: 'Campus issues', icon: MessageSquareWarning, path: (id) => `/teacher/issues/${id}` },
      { label: 'Report an issue', icon: ClipboardCheck, path: (id) => `/teacher/issues/${id}/new` },
      { label: 'My profile', icon: UserRound, path: (id) => `/teacher/profile/${id}` },
      { label: 'Notifications', icon: Bell, path: (id) => `/notifications/${id}` },
    ],
  },
}

function WorkspaceLayout({ children, institutionId, role }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const { logout, user } = useAuth()
  const config = workspaceConfig[role]
  const encodedInstitutionId = encodeURIComponent(institutionId)

  async function handleLogout() {
    try {
      await logout()
      toast.success('Signed out')
      const loginPath = {
        AUTHORITY: '/authority/login',
        INSTITUTION: '/institution/login',
        STUDENT: '/student/login',
        TEACHER: '/teacher/login',
      }[role]
      navigate(loginPath || '/login', { replace: true })
    } catch (error) {
      toast.error(error.message || 'Unable to sign out')
    }
  }

  function navigation(isMobile = false) {
    return config.links.map(({ end, icon: Icon, label, path }) => (
      <NavLink
        className={({ isActive }) => `workspace-nav-link${isActive ? ' is-active' : ''}`}
        end={end}
        key={label}
        onClick={() => isMobile && setMobileMenuOpen(false)}
        to={path(encodedInstitutionId)}
      >
        <Icon aria-hidden="true" size={18} strokeWidth={1.8} />
        <span>{label}</span>
      </NavLink>
    ))
  }

  return (
    <div className="workspace-layout">
      <aside className="workspace-sidebar">
        <BrandLockup
          ariaLabel="Issue Ache home"
          className="workspace-brand"
          icon={Buildings}
          iconWeight="duotone"
          linkComponent={NavLink}
        />
        <div className="workspace-context">
          <span className="workspace-context-icon"><Activity aria-hidden="true" size={17} /></span>
          <div><p>{config.label}</p><span>Institution workspace</span></div>
        </div>
        <p className="workspace-nav-label">WORKSPACE</p>
        <nav aria-label={`${config.label} navigation`} className="workspace-nav">{navigation()}</nav>
        <div className="workspace-sidebar-footer">
          <p className="workspace-user-label">SIGNED IN AS</p>
          <p className="workspace-user" title={user?.email}>{user?.displayName || user?.email}</p>
          <button className="workspace-signout" onClick={handleLogout} type="button">
            <LogOut aria-hidden="true" size={17} /> Sign out
          </button>
        </div>
      </aside>

      <div className="workspace-main">
        <header className="workspace-topbar">
          <BrandLockup
            ariaLabel="Issue Ache home"
            className="workspace-mobile-brand"
            icon={Buildings}
            iconWeight="duotone"
            linkComponent={NavLink}
          />
          <div className="workspace-topbar-context">
            <p>{config.label}</p>
            <span>Issue Ache! <span aria-hidden="true">/</span> {config.label}</span>
          </div>
          <div className="workspace-topbar-actions">
            <NotificationCenter institutionId={institutionId} />
            <ThemeToggle />
            <button aria-label="Sign out" className="icon-button workspace-mobile-signout" onClick={handleLogout} type="button">
              <LogOut aria-hidden="true" size={18} />
            </button>
            <button
              aria-expanded={mobileMenuOpen}
              aria-label={mobileMenuOpen ? 'Close navigation' : 'Open navigation'}
              className="icon-button workspace-menu-button"
              onClick={() => setMobileMenuOpen((isOpen) => !isOpen)}
              type="button"
            >
              {mobileMenuOpen ? <X aria-hidden="true" size={19} /> : <Menu aria-hidden="true" size={19} />}
            </button>
            <span className="workspace-avatar" aria-hidden="true">
              {(user?.displayName || user?.email || 'U').trim().charAt(0).toUpperCase()}
            </span>
          </div>
        </header>
        {mobileMenuOpen && <nav aria-label="Mobile workspace navigation" className="workspace-mobile-nav">{navigation(true)}</nav>}
        <div className="workspace-content">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              initial={{ opacity: 0, y: 7 }}
              key={location.pathname}
              transition={{ duration: 0.18, ease: 'easeOut' }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

export default WorkspaceLayout
