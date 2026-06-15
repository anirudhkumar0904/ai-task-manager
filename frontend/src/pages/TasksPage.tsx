import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { Plus, Filter, ChevronLeft, ChevronRight, X } from 'lucide-react'
import api from '@/services/api'
import type { Task, TaskStatus, TaskPriority, User } from '@/types'
import { useAuthStore } from '@/store/authStore'
import { format } from 'date-fns'

const statusLabels: Record<TaskStatus, string> = {
  pending: 'Pending', in_progress: 'In Progress', completed: 'Completed'
}

const priorityOptions: TaskPriority[] = ['low', 'medium', 'high']
const statusOptions: TaskStatus[] = ['pending', 'in_progress', 'completed']

const taskSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  description: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high']),
  assigned_to_id: z.number().optional(),
  due_date: z.string().optional(),
})
type TaskForm = z.infer<typeof taskSchema>

export default function TasksPage() {
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'admin'
  const [tasks, setTasks] = useState<Task[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<TaskStatus | ''>('')
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | ''>('')
  const [showModal, setShowModal] = useState(false)
  const [users, setUsers] = useState<User[]>([])

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<TaskForm>({
    resolver: zodResolver(taskSchema),
    defaultValues: { priority: 'medium' },
  })

  const fetchTasks = async () => {
    setLoading(true)
    try {
      const params: any = { page, page_size: 10 }
      if (statusFilter) params.status = statusFilter
      if (priorityFilter) params.priority = priorityFilter
      const { data } = await api.get('/tasks', { params })
      setTasks(data.tasks)
      setTotal(data.total)
      setTotalPages(data.total_pages)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchTasks() }, [page, statusFilter, priorityFilter])

  useEffect(() => {
    if (isAdmin) api.get('/users').then(r => setUsers(r.data))
  }, [isAdmin])

  const updateStatus = async (taskId: number, newStatus: TaskStatus) => {
    try {
      await api.patch(`/tasks/${taskId}/status`, { status: newStatus })
      toast.success('Status updated')
      fetchTasks()
    } catch {
      toast.error('Failed to update status')
    }
  }

  const deleteTask = async (taskId: number) => {
    if (!confirm('Delete this task?')) return
    try {
      await api.delete(`/tasks/${taskId}`)
      toast.success('Task deleted')
      fetchTasks()
    } catch {
      toast.error('Failed to delete task')
    }
  }

  const createTask = async (data: TaskForm) => {
    try {
      const payload: any = { ...data }
      if (payload.assigned_to_id) payload.assigned_to_id = Number(payload.assigned_to_id)
      if (!payload.due_date) delete payload.due_date
      await api.post('/tasks', payload)
      toast.success('Task created')
      setShowModal(false)
      reset()
      fetchTasks()
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to create task')
    }
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tasks</h1>
          <p className="text-slate-500 text-sm mt-1">{total} total tasks</p>
        </div>
        {isAdmin && (
          <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> New Task
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="card p-4 mb-6 flex flex-wrap items-center gap-3">
        <Filter className="w-4 h-4 text-slate-400" />
        <select className="input w-auto" value={statusFilter} onChange={e => { setStatusFilter(e.target.value as any); setPage(1) }}>
          <option value="">All statuses</option>
          {statusOptions.map(s => <option key={s} value={s}>{statusLabels[s]}</option>)}
        </select>
        <select className="input w-auto" value={priorityFilter} onChange={e => { setPriorityFilter(e.target.value as any); setPage(1) }}>
          <option value="">All priorities</option>
          {priorityOptions.map(p => <option key={p} value={p} className="capitalize">{p}</option>)}
        </select>
        {(statusFilter || priorityFilter) && (
          <button onClick={() => { setStatusFilter(''); setPriorityFilter(''); setPage(1) }}
            className="text-sm text-slate-500 hover:text-red-600 flex items-center gap-1">
            <X className="w-3 h-3" /> Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <p className="text-lg font-medium">No tasks found</p>
            <p className="text-sm mt-1">Try adjusting your filters</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Task</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Priority</th>
                {isAdmin && <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Assignee</th>}
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Due</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tasks.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <p className="font-medium text-slate-800">{t.title}</p>
                    {t.description && <p className="text-xs text-slate-400 truncate max-w-xs mt-0.5">{t.description}</p>}
                  </td>
                  <td className="px-6 py-4">
                    <select
                      value={t.status}
                      onChange={e => updateStatus(t.id, e.target.value as TaskStatus)}
                      className={`badge-${t.status} border-0 cursor-pointer bg-transparent font-medium text-xs`}
                    >
                      {statusOptions.map(s => <option key={s} value={s}>{statusLabels[s]}</option>)}
                    </select>
                  </td>
                  <td className="px-6 py-4"><span className={`badge-${t.priority}`}>{t.priority}</span></td>
                  {isAdmin && <td className="px-6 py-4 text-sm text-slate-600">{t.assignee?.name || '—'}</td>}
                  <td className="px-6 py-4 text-sm text-slate-500">
                    {t.due_date ? format(new Date(t.due_date), 'MMM d, yyyy') : '—'}
                  </td>
                  <td className="px-6 py-4">
                    {isAdmin && (
                      <button onClick={() => deleteTask(t.id)} className="text-slate-400 hover:text-red-600 text-xs transition-colors">Delete</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-slate-500">Page {page} of {totalPages}</p>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => p - 1)} disabled={page === 1} className="btn-secondary py-1.5 px-3 disabled:opacity-40">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={() => setPage(p => p + 1)} disabled={page === totalPages} className="btn-secondary py-1.5 px-3 disabled:opacity-40">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Create task modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="card p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-slate-800 text-lg">Create Task</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600"><X /></button>
            </div>
            <form onSubmit={handleSubmit(createTask)} className="space-y-4">
              <div>
                <label className="label">Title *</label>
                <input {...register('title')} className="input" placeholder="Task title" />
                {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title.message}</p>}
              </div>
              <div>
                <label className="label">Description</label>
                <textarea {...register('description')} className="input resize-none h-24" placeholder="Optional details…" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Priority</label>
                  <select {...register('priority')} className="input">
                    {priorityOptions.map(p => <option key={p} value={p} className="capitalize">{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Assign to</label>
                  <select {...register('assigned_to_id', { valueAsNumber: true })} className="input">
                    <option value="">Unassigned</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Due date</label>
                <input {...register('due_date')} type="datetime-local" className="input" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="btn-primary flex-1">
                  {isSubmitting ? 'Creating…' : 'Create Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
