import { Link } from 'react-router-dom'

const loginOptions = [
  { label: 'Authority Login', description: 'Access your institution workspace.', to: '/authority/login' },
  { label: 'Institution Admin Login', description: 'Manage your institution and departments.', to: '/institution/login' },
  { label: 'Student Login', description: 'View your student workspace.', to: '/student/login' },
  { label: 'Teacher Login', description: 'View your teacher workspace.', to: '/teacher/login' },
]

function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg items-center px-5 py-12">
      <section className="w-full rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
          Welcome to Issue Ache!
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-950">Choose your login</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Select the account type for your institution workspace.
        </p>

        <nav className="mt-6 grid gap-3" aria-label="Login options">
          {loginOptions.map(({ description, label, to }) => (
            <Link
              className="rounded-lg border border-slate-300 px-4 py-3 hover:border-blue-500 hover:bg-blue-50"
              key={to}
              to={to}
            >
              <span className="block font-semibold text-slate-900">{label}</span>
              <span className="mt-1 block text-sm text-slate-600">{description}</span>
            </Link>
          ))}
        </nav>

        <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm">
          <Link className="font-semibold text-blue-700 underline" to="/pricing">
            Register an institution
          </Link>
          <Link className="font-semibold text-blue-700 underline" to="/student/register">
            Student registration
          </Link>
          <Link className="font-semibold text-blue-700 underline" to="/teacher/register">
            Teacher registration
          </Link>
        </div>
      </section>
    </main>
  )
}

export default LoginPage
