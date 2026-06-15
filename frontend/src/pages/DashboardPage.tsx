import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckSquare, FileText, Search, TrendingUp, Clock, AlertCircle } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import api from '@/services/api'
import type { AnalyticsData, Task } from '@/types'
import { format } from 'date-fns'

function StatCard({ label, value, sub, icon: Icon, color }: any) {
  return (
    <div className="card p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-500 font-medium">{label}</p>
          <p className="text-3xl font-bold text-slate-900 mt-1">{value}</p>
          {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [myTasks, setMyTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const [aRes, tRes] = await Promise.all([
          api.get('/analytics'),
          api.get('/tasks?page_size=5'),
        ])
        setAnalytics(aRes.data)
        setMyTasks(tRes.data.tasks)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const a = analytics!

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Good {getTimeOfDay()}, {user?.name?.split(' ')[0]} 👋</h1>
        <p className="text-slate-500 mt-1">Here's what's happening with your workspace.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Tasks" value={a.tasks.total} sub={`${a.tasks.completion_rate}% complete`}
          icon={CheckSquare} color="bg-primary-50 text-primary-600" />
        <StatCard label="Pending" value={a.tasks.pending} sub="Need attention"
          icon={Clock} color="bg-yellow-50 text-yellow-600" />
        <StatCard label="Completed" value={a.tasks.completed} sub="Well done!"
          icon={TrendingUp} color="bg-green-50 text-green-600" />
        <StatCard label="Documents" value={a.documents.total_documents} sub={`${a.documents.indexed_documents} indexed`}
          icon={FileText} color="bg-blue-50 text-blue-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* My recent tasks */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-800">Recent Tasks</h2>
            <button onClick={() => navigate('/tasks')} className="text-sm text-primary-600 hover:underline">View all</button>
          </div>
          {myTasks.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <CheckSquare className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No tasks assigned yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {myTasks.map((t) => (
                <div key={t.id} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg hover:bg-slate-100 cursor-pointer transition-colors" onClick={() => navigate('/tasks')}>
                  <div className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${t.status === 'completed' ? 'bg-green-500' : t.status === 'in_progress' ? 'bg-blue-500' : 'bg-yellow-500'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{t.title}</p>
                    <p className="text-xs text-slate-400 mt-0.5 capitalize">{t.status.replace('_', ' ')}</p>
                  </div>
                  <span className={`badge-${t.priority} flex-shrink-0`}>{t.priority}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent activity */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-800">Recent Activity</h2>
            <button onClick={() => navigate('/analytics')} className="text-sm text-primary-600 hover:underline">Analytics</button>
          </div>
          {a.recent_activity.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">No activity yet</p>
          ) : (
            <div className="space-y-3">
              {a.recent_activity.slice(0, 6).map((act) => (
                <div key={act.id} className="flex gap-3 text-sm">
                  <span className="flex-shrink-0 mt-0.5">
                    <ActivityIcon action={act.action} />
                  </span>
                  <div>
                    <p className="text-slate-700">{act.description || act.action}</p>
                    {act.created_at && (
                      <p className="text-xs text-slate-400">{format(new Date(act.created_at), 'MMM d, h:mm a')}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick search CTA */}
      <div className="mt-6 card p-6 bg-gradient-to-r from-primary-600 to-primary-700 border-0">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-white">Need an answer fast?</h3>
            <p className="text-primary-200 text-sm mt-1">Use AI-powered semantic search across all documents</p>
          </div>
          <button onClick={() => navigate('/search')} className="bg-white text-primary-700 font-medium px-4 py-2 rounded-lg hover:bg-primary-50 transition-colors flex items-center gap-2">
            <Search className="w-4 h-4" />
            Search Docs
          </button>
        </div>
      </div>
    </div>
  )
}

function getTimeOfDay() {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}

function ActivityIcon({ action }: { action: string }) {
  const icons: Record<string, string> = {
    login: '🔐', task_create: '✅', task_update: '✏️',
    document_upload: '📄', search: '🔍', user_create: '👤',
  }
  return <span>{icons[action] || '📌'}</span>
}
