import { useParams, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '../../lib/api.js'

function NotificationsPage() {
  const { institutionId } = useParams()
  const [searchParams] = useSearchParams()
  const departmentId = searchParams.get('departmentId') || undefined
  const queryClient = useQueryClient()
  const queryKey = ['notifications', institutionId, departmentId]
  const notifications = useQuery({
    queryKey,
    queryFn: async () => (await api.get(`/notifications/${institutionId}`, {
      params: { limit: 100, ...(departmentId ? { departmentId } : {}) },
    })).data.data,
    retry: false,
  })
  const markRead = useMutation({
    mutationFn: async (id) => api.patch(
      `/notifications/${institutionId}/${id}/read`,
      null,
      { params: departmentId ? { departmentId } : undefined },
    ),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey }),
    onError: (error) => toast.error(error.response?.data?.error?.message || 'Could not update notification.'),
  })
  const markAllRead = useMutation({
    mutationFn: async () => api.patch(
      `/notifications/${institutionId}/read-all`,
      null,
      { params: departmentId ? { departmentId } : undefined },
    ),
    onSuccess: async () => {
      toast.success('All notifications marked as read')
      await queryClient.invalidateQueries({ queryKey })
    },
    onError: (error) => toast.error(error.response?.data?.error?.message || 'Could not update notifications.'),
  })

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-5 py-8 sm:px-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="mt-3 text-3xl font-semibold text-slate-950">Notifications</h1>
          <p className="mt-1 text-slate-600">
            {notifications.data?.unreadCount || 0} unread
            {departmentId ? ' in the selected department' : ' across your departments'}
          </p>
        </div>
        <div>
          <button
            className="min-h-10 rounded-lg border border-slate-300 px-4 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            disabled={!notifications.data?.unreadCount || markAllRead.isPending}
            onClick={() => markAllRead.mutate()}
            type="button"
          >
            Mark all read
          </button>
        </div>
      </header>
      {notifications.isLoading ? (
        <p className="mt-7 text-slate-600" role="status">Loading notifications…</p>
      ) : notifications.isError ? (
        <div className="mt-7 rounded-xl border border-red-200 bg-red-50 p-5 text-red-900" role="alert">
          <p>{notifications.error.response?.data?.error?.message || 'Could not load notifications.'}</p>
          <button className="mt-3 font-semibold underline" onClick={() => notifications.refetch()} type="button">Try again</button>
        </div>
      ) : notifications.data.notifications.length === 0 ? (
        <p className="mt-7 rounded-xl border border-dashed border-slate-300 bg-white p-6 text-slate-600">You have no notifications.</p>
      ) : (
        <ul className="mt-7 grid gap-3">
          {notifications.data.notifications.map((notification) => (
            <li className={`rounded-xl border p-5 ${notification.readAt ? 'border-slate-200 bg-white' : 'border-blue-200 bg-blue-50'}`} key={notification.id}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="font-semibold text-slate-950">{notification.title}</h2>
                  <p className="mt-1 text-sm text-slate-700">{notification.message}</p>
                  <time className="mt-2 block text-xs text-slate-500">{new Date(notification.createdAt).toLocaleString()}</time>
                </div>
                {notification.readAt ? (
                  <span className="text-xs font-semibold text-slate-500">Read</span>
                ) : (
                  <button className="text-sm font-semibold text-blue-700 underline disabled:opacity-50" disabled={markRead.isPending} onClick={() => markRead.mutate(notification.id)} type="button">Mark read</button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}

export default NotificationsPage
