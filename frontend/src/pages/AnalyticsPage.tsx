import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'
import { BarChart3, Users, FileText, Search, TrendingUp } from 'lucide-react'
import api from '@/services/api'
import type { AnalyticsData } from '@/types'
import { format } from 'date-fns'

const STATUS_COLORS = {
  pending: '#f59e0b',
  in_progress: '#3b82f6',
  completed: '#10b981',
}

function StatCard({ label, value, icon: Icon, color, sub }: any) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <p className="text-3xl font-bold text-slate-900">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  )
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/analytics')
      .then(r => setData(r.data))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!data) return null

  const taskPieData = [
    { name: 'Pending', value: data.tasks.pending, color: STATUS_COLORS.pending },
    { name: 'In Progress', value: data.tasks.in_progress, color: STATUS_COLORS.in_progress },
    { name: 'Completed', value: data.tasks.completed, color: STATUS_COLORS.completed },
  ]

  const topQueriesData = data.searches.top_queries.map(q => ({
    query: q.query.length > 20 ? q.query.slice(0, 20) + '…' : q.query,
    count: q.count,
  }))

  const actionLabels: Record<string, string> = {
    login: '🔐 Login',
    task_create: '✅ Task Created',
    task_update: '✏️ Task Updated',
    task_delete: '🗑️ Task Deleted',
    document_upload: '📄 Doc Uploaded',
    search: '🔍 Search',
    user_create: '👤 User Created',
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
          <BarChart3 className="w-7 h-7 text-primary-600" />
          Analytics
        </h1>
        <p className="text-slate-500 text-sm mt-1">System-wide metrics and activity</p>
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Tasks" value={data.tasks.total} icon={TrendingUp}
          color="bg-primary-50 text-primary-600" sub={`${data.tasks.completion_rate}% done`} />
        <StatCard label="Total Users" value={data.users.total_users} icon={Users}
          color="bg-green-50 text-green-600" sub={`${data.users.active_users} active`} />
        <StatCard label="Documents" value={data.documents.total_documents} icon={FileText}
          color="bg-blue-50 text-blue-600" sub={`${data.documents.total_chunks} chunks indexed`} />
        <StatCard label="Searches" value={data.searches.total_searches} icon={Search}
          color="bg-purple-50 text-purple-600" sub="Total AI queries" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Task status pie */}
        <div className="card p-6">
          <h2 className="font-semibold text-slate-800 mb-4">Task Distribution</h2>
          {data.tasks.total === 0 ? (
            <p className="text-center text-slate-400 py-12">No tasks yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={taskPieData} cx="50%" cy="50%" innerRadius={60} outerRadius={90}
                  paddingAngle={4} dataKey="value" label={({ name, value }) => `${name}: ${value}`}
                  labelLine={false}>
                  {taskPieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Legend />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Top search queries */}
        <div className="card p-6">
          <h2 className="font-semibold text-slate-800 mb-4">Top Search Queries</h2>
          {topQueriesData.length === 0 ? (
            <p className="text-center text-slate-400 py-12">No searches yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={topQueriesData} layout="vertical" margin={{ left: 10 }}>
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                <YAxis type="category" dataKey="query" width={140} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#6366f1" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Task breakdown cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Pending', value: data.tasks.pending, color: 'border-yellow-400 bg-yellow-50 text-yellow-700' },
          { label: 'In Progress', value: data.tasks.in_progress, color: 'border-blue-400 bg-blue-50 text-blue-700' },
          { label: 'Completed', value: data.tasks.completed, color: 'border-green-400 bg-green-50 text-green-700' },
        ].map(item => (
          <div key={item.label} className={`card p-5 border-l-4 ${item.color}`}>
            <p className="text-sm font-medium">{item.label}</p>
            <p className="text-3xl font-bold mt-1">{item.value}</p>
          </div>
        ))}
      </div>

      {/* Recent activity */}
      <div className="card p-6">
        <h2 className="font-semibold text-slate-800 mb-4">Recent Activity</h2>
        {data.recent_activity.length === 0 ? (
          <p className="text-slate-400 text-sm text-center py-8">No activity logged yet</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {data.recent_activity.map(act => (
              <div key={act.id} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <span className="text-lg">{actionLabels[act.action]?.split(' ')[0] || '📌'}</span>
                  <div>
                    <p className="text-sm font-medium text-slate-800">
                      {actionLabels[act.action]?.split(' ').slice(1).join(' ') || act.action}
                    </p>
                    <p className="text-xs text-slate-400">{act.description}</p>
                  </div>
                </div>
                {act.created_at && (
                  <p className="text-xs text-slate-400 flex-shrink-0 ml-4">
                    {format(new Date(act.created_at), 'MMM d, h:mm a')}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
