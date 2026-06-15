import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { Upload, FileText, Trash2, CheckCircle, Clock } from 'lucide-react'
import api from '@/services/api'
import type { Document } from '@/types'
import { useAuthStore } from '@/store/authStore'
import { format } from 'date-fns'

export default function DocumentsPage() {
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'admin'
  const [docs, setDocs] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [title, setTitle] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const fetchDocs = async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/documents')
      setDocs(data.documents)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { fetchDocs() }, [])

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file || !title.trim()) { toast.error('Please provide a title and file'); return }
    setUploading(true)
    try {
      const form = new FormData()
      form.append('title', title.trim())
      form.append('file', file)
      await api.post('/documents', form, { headers: { 'Content-Type': 'multipart/form-data' } })
      toast.success('Document uploaded and indexed!')
      setTitle('')
      setFile(null)
      if (fileRef.current) fileRef.current.value = ''
      fetchDocs()
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (id: number, docTitle: string) => {
    if (!confirm(`Delete "${docTitle}"?`)) return
    try {
      await api.delete(`/documents/${id}`)
      toast.success('Document deleted')
      fetchDocs()
    } catch {
      toast.error('Failed to delete document')
    }
  }

  const formatSize = (bytes?: number) => {
    if (!bytes) return '—'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Knowledge Base</h1>
        <p className="text-slate-500 text-sm mt-1">Upload documents to enable AI-powered semantic search</p>
      </div>

      {/* Upload form — admin only */}
      {isAdmin && (
        <div className="card p-6 mb-6">
          <h2 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <Upload className="w-4 h-4" /> Upload Document
          </h2>
          <form onSubmit={handleUpload} className="space-y-4">
            <div>
              <label className="label">Document title *</label>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="input max-w-md"
                placeholder="E.g. Company HR Policy 2024"
              />
            </div>
            <div>
              <label className="label">File (.txt or .pdf) *</label>
              <div
                className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center hover:border-primary-400 transition-colors cursor-pointer max-w-md"
                onClick={() => fileRef.current?.click()}
              >
                <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                {file ? (
                  <p className="text-sm text-slate-700 font-medium">{file.name}</p>
                ) : (
                  <p className="text-sm text-slate-400">Click to choose a file or drag & drop</p>
                )}
                <p className="text-xs text-slate-300 mt-1">Max 10 MB</p>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".txt,.pdf"
                className="hidden"
                onChange={e => setFile(e.target.files?.[0] || null)}
              />
            </div>
            <button type="submit" disabled={uploading || !file || !title} className="btn-primary flex items-center gap-2">
              {uploading ? (
                <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Uploading & indexing…</>
              ) : (
                <><Upload className="w-4 h-4" /> Upload & Index</>
              )}
            </button>
          </form>
        </div>
      )}

      {/* Documents list */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : docs.length === 0 ? (
        <div className="card p-16 text-center text-slate-400">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No documents yet</p>
          <p className="text-sm mt-1">{isAdmin ? 'Upload a document above to get started' : 'Ask your admin to upload documents'}</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {docs.map(doc => (
            <div key={doc.id} className="card p-5 flex items-start gap-4 hover:shadow-md transition-shadow">
              <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
                <FileText className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-semibold text-slate-800">{doc.title}</h3>
                    <p className="text-xs text-slate-400 mt-0.5">{doc.original_filename} · {formatSize(doc.file_size)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {doc.is_indexed ? (
                      <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">
                        <CheckCircle className="w-3 h-3" /> {doc.chunk_count} chunks
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-yellow-600 bg-yellow-50 px-2 py-1 rounded-full">
                        <Clock className="w-3 h-3" /> Not indexed
                      </span>
                    )}
                    {isAdmin && (
                      <button onClick={() => handleDelete(doc.id, doc.title)} className="text-slate-300 hover:text-red-500 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
                {doc.content_preview && (
                  <p className="text-sm text-slate-500 mt-2 line-clamp-2">{doc.content_preview}</p>
                )}
                <p className="text-xs text-slate-300 mt-2">{format(new Date(doc.created_at), 'MMM d, yyyy')}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
