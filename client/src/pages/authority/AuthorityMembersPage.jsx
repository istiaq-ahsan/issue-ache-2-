import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import api from '../../lib/api.js'

function AuthorityMembersPage() {
  const { institutionId } = useParams()
  const [searchParams] = useSearchParams()
  const departmentId = searchParams.get('departmentId') || ''
  const [role, setRole] = useState('STUDENT')
  const queryClient = useQueryClient()
  const queryKey = ['authority-members', institutionId, role, departmentId]
  const members = useQuery({
    queryKey,
    queryFn: async () => {
      const resource = role === 'STUDENT' ? 'students' : 'teachers'
      const params = departmentId ? { departmentId } : undefined
      return (await api.get(`/authority/institutions/${encodeURIComponent(institutionId)}/${resource}`, { params })).data.data.members
    },
    retry: false,
  })
  const setEnabled = useMutation({
    mutationFn: async ({ memberId, enabled }) => {
      const resource = role === 'STUDENT' ? 'students' : 'teachers'
      return api.patch(
        `/authority/institutions/${encodeURIComponent(institutionId)}/${resource}/${encodeURIComponent(memberId)}/status`,
        { enabled },
      )
    },
    onSuccess: async () => {
      toast.success(`${role === 'STUDENT' ? 'Student' : 'Teacher'} access updated`)
      await queryClient.invalidateQueries({ queryKey: ['authority-members', institutionId] })
    },
    onError: (error) => toast.error(error.apiMessage || 'Could not update member access.'),
  })

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-5 py-9 sm:px-8">
      <header>
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Authority workspace</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-950">Students and teachers</h1>
          <p className="mt-2 text-slate-600">View and manage members in your assigned departments.</p>
        </div>
      </header>

      <div className="mt-6 flex gap-2" role="tablist" aria-label="Member type">
        {['STUDENT', 'TEACHER'].map((value) => (
          <button
            aria-selected={role === value}
            className={`rounded-lg px-4 py-2 text-sm font-semibold ${role === value ? 'bg-blue-700 text-white' : 'border border-slate-300 bg-white text-slate-700'}`}
            key={value}
            onClick={() => setRole(value)}
            role="tab"
            type="button"
          >
            {value === 'STUDENT' ? 'Students' : 'Teachers'}
          </button>
        ))}
      </div>

      {members.isLoading ? (
        <p className="mt-7 text-slate-600" role="status">Loading {role.toLowerCase()}…</p>
      ) : members.isError ? (
        <div className="mt-7 rounded-xl border border-red-200 bg-red-50 p-5 text-red-900" role="alert">
          <p>{members.error.apiMessage || 'Could not load members.'}</p>
          <button className="mt-3 font-semibold underline" onClick={() => members.refetch()} type="button">Try again</button>
        </div>
      ) : members.data.length === 0 ? (
        <p className="mt-7 rounded-xl border border-dashed border-slate-300 bg-white p-6 text-slate-600">No {role.toLowerCase()} are assigned to this department scope.</p>
      ) : (
        <div className="mt-7 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full min-w-[54rem] text-left text-sm">
            <thead className="bg-slate-50 text-slate-600"><tr><th className="px-4 py-3">Member</th><th className="px-4 py-3">Official ID</th><th className="px-4 py-3">Departments</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Access</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {members.data.map((member) => {
                const canToggle = ['ACTIVE', 'INACTIVE'].includes(member.status)
                return (
                  <tr key={member.id}>
                    <td className="px-4 py-4"><p className="font-semibold text-slate-950">{member.user.name}</p><p className="mt-1 text-slate-500">{member.user.email}</p></td>
                    <td className="px-4 py-4">{member.studentId || member.teacherId || '—'}</td>
                    <td className="px-4 py-4"><div className="flex flex-wrap gap-1.5">{member.departments.map((department) => <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-800" key={department.id}>{department.name}</span>)}</div></td>
                    <td className="px-4 py-4"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{member.status}</span></td>
                    <td className="px-4 py-4">
                      {canToggle ? (
                        <button
                          className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                          disabled={setEnabled.isPending}
                          onClick={() => setEnabled.mutate({ memberId: member.id, enabled: member.status !== 'ACTIVE' })}
                          type="button"
                        >
                          {member.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                        </button>
                      ) : <span className="text-slate-400">Not available</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  )
}

export default AuthorityMembersPage
