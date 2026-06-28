import { useState } from 'react'
import { Search, Zap, FileText, Clock, Sparkles, ChevronDown, ChevronUp } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/services/api'
import type { SearchResponse } from '@/types'

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [result, setResult] = useState<SearchResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState<string[]>([])
  const [showSources, setShowSources] = useState(false)

  const doSearch = async (q?: string) => {
    const searchQuery = (q ?? query).trim()
    if (!searchQuery) return
    setLoading(true)
    setShowSources(false)
    try {
      const { data } = await api.post('/search', { query: searchQuery, top_k: 5 })
      setResult(data)
      setHistory(prev => [searchQuery, ...prev.filter(h => h !== searchQuery)].slice(0, 8))
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Search failed')
    } finally {
      setLoading(false)
    }
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') doSearch()
  }

  const scoreColor = (score: number) => {
    if (score > 0.7) return 'text-green-600 bg-green-50'
    if (score > 0.4) return 'text-yellow-600 bg-yellow-50'
    return 'text-slate-600 bg-slate-100'
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
          <Zap className="w-7 h-7 text-primary-600" />
          AI Semantic Search
        </h1>
        <p className="text-slate-500 mt-1">Ask a question in plain language — answers are grounded in your indexed documents</p>
      </div>

      {/* Search bar */}
      <div className="card p-4 mb-6">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKey}
              className="input pl-12 py-3 text-base"
              placeholder="Ask anything — e.g. 'How many sick leave days do I get?'"
            />
          </div>
          <button onClick={() => doSearch()} disabled={loading || !query.trim()} className="btn-primary px-6 flex items-center gap-2">
            {loading ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Search className="w-4 h-4" />}
            Search
          </button>
        </div>

        {/* Recent queries */}
        {history.length > 0 && !result && (
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="text-xs text-slate-400 self-center"><Clock className="w-3 h-3 inline mr-1" />Recent:</span>
            {history.map(h => (
              <button key={h} onClick={() => { setQuery(h); doSearch(h) }}
                className="text-xs bg-slate-100 hover:bg-primary-50 hover:text-primary-700 text-slate-600 px-3 py-1 rounded-full transition-colors">
                {h}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Loading skeleton for the answer card */}
      {loading && (
        <div className="card p-6 mb-6 border-l-4 border-primary-400 animate-pulse">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-primary-400" />
            <div className="h-3 w-24 bg-slate-200 rounded" />
          </div>
          <div className="space-y-2">
            <div className="h-3 bg-slate-200 rounded w-full" />
            <div className="h-3 bg-slate-200 rounded w-5/6" />
          </div>
        </div>
      )}

      {/* Results */}
      {result && !loading && (
        <div>
          {/* AI-generated direct answer, chatbot-style */}
          {result.ai_answer && (
            <div className="card p-6 mb-6 border-l-4 border-primary-500 bg-gradient-to-br from-primary-50/60 to-white">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-full bg-primary-600 flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="text-xs font-semibold text-primary-700 uppercase tracking-wide">AI Answer</span>
              </div>
              <p className="text-slate-800 text-base leading-relaxed">{result.ai_answer}</p>
            </div>
          )}

          {/* Header row */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-semibold text-slate-700">
                {result.total_results} source{result.total_results !== 1 ? 's' : ''} for "{result.query}"
              </p>
              <p className="text-xs text-slate-400 mt-0.5">{result.search_time_ms}ms · Semantic similarity search</p>
            </div>
            <button onClick={() => setResult(null)} className="text-xs text-slate-400 hover:text-slate-600">Clear</button>
          </div>

          {result.total_results === 0 ? (
            <div className="card p-12 text-center text-slate-400">
              <Search className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No matching documents found</p>
              <p className="text-sm mt-1">Try different keywords or upload more documents</p>
            </div>
          ) : (
            <>
              {/* If we have an AI answer, sources are collapsed by default to keep focus on the answer */}
              {result.ai_answer ? (
                <button
                  onClick={() => setShowSources(s => !s)}
                  className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-3 transition-colors"
                >
                  {showSources ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  {showSources ? 'Hide' : 'Show'} source passages
                </button>
              ) : null}

              {(showSources || !result.ai_answer) && (
                <div className="space-y-4">
                  {result.results.map((r) => (
                    <div key={r.rank} className="card p-5 hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-primary-100 text-primary-700 text-xs font-bold flex items-center justify-center">
                            {r.rank}
                          </span>
                          <div className="flex items-center gap-1.5 text-slate-600">
                            <FileText className="w-4 h-4 text-blue-500" />
                            <span className="font-semibold text-sm">{r.document_title}</span>
                          </div>
                        </div>
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${scoreColor(r.score)}`}>
                          {(r.score * 100).toFixed(1)}% match
                        </span>
                      </div>

                      {/* Highlighted chunk */}
                      <div className="bg-slate-50 rounded-lg p-4 border-l-4 border-primary-400">
                        <p className="text-sm text-slate-700 leading-relaxed">{r.chunk_text}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Empty state */}
      {!result && !loading && (
        <div className="text-center py-20 text-slate-300">
          <Search className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium text-slate-400">Start by entering a question</p>
          <p className="text-sm mt-1 text-slate-300">The AI will find the most relevant document sections and answer directly</p>
        </div>
      )}
    </div>
  )
}
