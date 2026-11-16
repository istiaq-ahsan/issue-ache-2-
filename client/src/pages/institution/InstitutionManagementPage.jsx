import { Link } from 'react-router-dom'
import AuthorityManagementPage from '../members/AuthorityManagementPage.jsx'

const sectionDetails = {
  departments: {
    title: 'Department management',
    description: 'Create, edit, and delete departments. Departments have no separate activation or payment.',
  },
  authorities: {
    title: 'Authority management',
    description:
      'Manage institution Authority accounts and their access.',
  },
}

function InstitutionManagementPage({ institutionId, section }) {
  if (section === 'authorities') {
    return <AuthorityManagementPage institutionId={institutionId} />
  }

  const details = sectionDetails[section]

  return (
    <main className="mx-auto max-w-3xl px-5 py-12">
      <Link
        className="text-sm font-medium text-blue-700 hover:underline"
        to={`/institution/dashboard/${encodeURIComponent(institutionId)}`}
      >
        Back to institution dashboard
      </Link>
      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-7">
        <h1 className="text-2xl font-semibold text-slate-950">{details.title}</h1>
        <p className="mt-3 text-slate-600">{details.description}</p>
        <p className="mt-5 rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
          This management workflow will be available in a later implementation phase.
        </p>
      </section>
    </main>
  )
}

export default InstitutionManagementPage
