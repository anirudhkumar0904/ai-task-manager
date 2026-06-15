export type Role = 'admin' | 'user'

export interface User {
  id: number
  name: string
  email: string
  role: Role
  is_active?: boolean
}

export type TaskStatus = 'pending' | 'in_progress' | 'completed'
export type TaskPriority = 'low' | 'medium' | 'high'

export interface Task {
  id: number
  title: string
  description?: string
  status: TaskStatus
  priority: TaskPriority
  assigned_to_id?: number
  created_by_id: number
  assignee?: { id: number; name: string; email: string }
  due_date?: string
  created_at: string
  updated_at?: string
}

export interface TaskListResponse {
  tasks: Task[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export interface Document {
  id: number
  title: string
  original_filename: string
  file_size?: number
  mime_type?: string
  content_preview?: string
  chunk_count: number
  is_indexed: boolean
  uploaded_by_id: number
  created_at: string
}

export interface SearchResult {
  document_id: number
  document_title: string
  chunk_text: string
  score: number
  rank: number
}

export interface SearchResponse {
  query: string
  results: SearchResult[]
  total_results: number
  search_time_ms: number
}

export interface AnalyticsData {
  tasks: {
    total: number
    pending: number
    in_progress: number
    completed: number
    completion_rate: number
  }
  searches: {
    total_searches: number
    top_queries: { query: string; count: number }[]
  }
  users: {
    total_users: number
    active_users: number
    admin_count: number
    user_count: number
  }
  documents: {
    total_documents: number
    indexed_documents: number
    total_chunks: number
  }
  recent_activity: {
    id: number
    action: string
    description?: string
    user_id?: number
    created_at?: string
  }[]
}
