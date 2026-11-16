import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '../lib/api.js'

function NotificationCenter({ institutionId }) {
  const [open, setOpen] = useState(false)
  const [searchParams] = useSearchParams()
  const departmentId = searchParams.get('departmentId') || undefined
  const queryClient = useQueryClient()
  const queryKey = ['notifications', institutionId, departmentId]
  const notifications = useQuery({
    queryKey,
    queryFn: async () => (await api.get(`/notifications/${institutionId}`, {
      params: { limit: 8, ...(departmentId ? { departmentId } : {}) },
    })).data.data,
    retry: false,
  })
  const markRead = useMutation({
    mutationFn: async (notificationId) => api.patch(
      `/notifications/${institutionId}/${notificationId}/read`,
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
    <div className="relative">
      <button
        aria-expanded={open}
        aria-label={`Notifications${notifications.data?.unreadCount ? `, ${notifications.data.unreadCount} unread` : ''}`}
        className="relative min-h-10 rounded-lg border border-slate-300 bg-white px-4 font-semibold text-slate-700 hover:bg-slate-50"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        Notifications
        {notifications.data?.unreadCount > 0 && (
          <span className="ml-2 inline-flex min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 py-0.5 text-xs font-bold text-white">
            {notifications.data.unreadCount > 99 ? '99+' : notifications.data.unreadCount}
          </span>
        )}
      </button>
      {open && (
        <section className="absolute right-0 z-30 mt-2 w-[min(24rem,calc(100vw-2.5rem))] rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold text-slate-950">Notifications</h2>
            <button
              className="text-xs font-semibold text-blue-700 underline disabled:opacity-50"
              disabled={!notifications.data?.unreadCount || markAllRead.isPending}
              onClick={() => markAllRead.mutate()}
              type="button"
            >
              Mark all read
            </button>
          </div>
          {notifications.isLoading ? (
            <p className="py-5 text-sm text-slate-600" role="status">Loading notifications…</p>
          ) : notifications.isError ? (
            <div className="py-4 text-sm text-red-800" role="alert">
              <p>{notifications.error.response?.data?.error?.message || 'Could not load notifications.'}</p>
              <button className="mt-2 font-semibold underline" onClick={() => notifications.refetch()} type="button">Try again</button>
            </div>
          ) : notifications.data.notifications.length === 0 ? (
            <p className="py-5 text-sm text-slate-600">You have no notifications.</p>
          ) : (
            <ul className="mt-3 grid max-h-96 gap-2 overflow-y-auto">
              {notifications.data.notifications.map((notification) => (
                <li className={`rounded-lg p-3 ${notification.readAt ? 'bg-slate-50' : 'bg-blue-50'}`} key={notification.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{notification.title}</p>
                      <p className="mt-1 text-sm text-slate-700">{notification.message}</p>
                      <time className="mt-2 block text-xs text-slate-500">{new Date(notification.createdAt).toLocaleString()}</time>
                    </div>
                    {!notification.readAt && (
                      <button
                        aria-label={`Mark ${notification.title} as read`}
                        className="shrink-0 text-xs font-semibold text-blue-700 underline disabled:opacity-50"
                        disabled={markRead.isPending}
                        onClick={() => markRead.mutate(notification.id)}
                        type="button"
                      >
                        Read
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <Link
            className="mt-3 block border-t border-slate-100 pt-3 text-center text-sm font-semibold text-blue-700 underline"
            onClick={() => setOpen(false)}
            to={`/notifications/${encodeURIComponent(institutionId)}`}
          >
            View all notifications
          </Link>
        </section>
      )}
    </div>
  )
}

export default NotificationCenter
