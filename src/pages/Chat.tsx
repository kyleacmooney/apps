import { useState, useRef, useEffect, useCallback } from "react"
import { Link } from "react-router-dom"
import { Home, Send, Trash2, Square, Sparkles, User, AlertCircle, Settings, Menu, Plus, History, X } from "lucide-react"
import { useAuth } from "@/context/AuthContext"
import { useDataClient } from "@/context/SupabaseContext"
import { usePersistedState } from "@/lib/use-persisted-state"
import { SUPABASE_URL } from "@/lib/supabase"

const CHAT_EDGE_URL = `${SUPABASE_URL}/functions/v1/chat`
const OAUTH_TOKEN_KEY = "claude-oauth-token"

const SYSTEM_PROMPT = [
  "You are a helpful AI assistant embedded in a personal tools app.",
  "You help the user with their workouts, exercises, plant care, and other life management tasks.",
  "Be concise and friendly. Use markdown formatting when helpful.",
].join(" ")

export function getClaudeOAuthToken(): string | null {
  return localStorage.getItem(OAUTH_TOKEN_KEY)
}

export function setClaudeOAuthToken(token: string) {
  localStorage.setItem(OAUTH_TOKEN_KEY, token)
}

export function clearClaudeOAuthToken() {
  localStorage.removeItem(OAUTH_TOKEN_KEY)
}

interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: number
}

interface ChatThread {
  id: string
  title: string
  updated_at: string
}

function parseSSEStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  onToken: (text: string) => void,
  onDone: () => void,
  onError: (err: string) => void,
) {
  const decoder = new TextDecoder()
  let buffer = ""

  function processLines(chunk: string) {
    buffer += chunk
    const lines = buffer.split("\n")
    buffer = lines.pop() ?? ""

    for (const line of lines) {
      if (line.startsWith("event: ")) continue
      if (!line.startsWith("data: ")) continue
      const data = line.slice(6).trim()
      if (data === "[DONE]") continue

      try {
        const event = JSON.parse(data)
        if (
          event.type === "content_block_delta" &&
          event.delta?.type === "text_delta"
        ) {
          onToken(event.delta.text)
        } else if (event.type === "message_stop") {
          onDone()
        } else if (event.type === "error") {
          onError(event.error?.message ?? "Unknown stream error")
        }
      } catch {
        // skip malformed lines
      }
    }
  }

  async function pump(): Promise<void> {
    const { done, value } = await reader.read()
    if (done) {
      if (buffer.trim()) processLines("\n")
      onDone()
      return
    }
    processLines(decoder.decode(value, { stream: true }))
    return pump()
  }

  pump().catch((err) => onError(err?.message ?? "Stream read error"))
}

export function Chat() {
  const { user, session } = useAuth()
  const supabase = useDataClient()
  const userId = user?.id ?? "guest"

  const [threads, setThreads] = useState<ChatThread[]>([])
  const [currentThreadId, setCurrentThreadId] = usePersistedState<string | null>(
    `chat-current-thread:${userId}`,
    null,
  )
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = usePersistedState(`chat-input:${userId}`, "")
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasToken, setHasToken] = useState(() => !!getClaudeOAuthToken())
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    setHasToken(!!getClaudeOAuthToken())
  }, [])

  // Load threads
  useEffect(() => {
    if (!user) return
    const fetchThreads = async () => {
      const { data, error } = await supabase
        .from("chat_threads")
        .select("*")
        .order("updated_at", { ascending: false })
      if (!error && data) {
        setThreads(data)
      }
    }
    fetchThreads()
  }, [user, supabase])

  // Load messages for current thread
  useEffect(() => {
    if (!currentThreadId) {
      setMessages([])
      return
    }
    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("thread_id", currentThreadId)
        .order("created_at", { ascending: true })
      if (!error && data) {
        setMessages(
          data.map((m) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            timestamp: new Date(m.created_at).getTime(),
          })),
        )
      }
    }
    fetchMessages()
  }, [currentThreadId, supabase])

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  useEffect(() => {
    if (!isStreaming) textareaRef.current?.focus()
  }, [isStreaming])

  const sendMessage = useCallback(async () => {
    const trimmed = input.trim()
    if (!trimmed || isStreaming) return

    const token = getClaudeOAuthToken()
    if (!token) {
      setError("No Claude OAuth token configured. Add one in Settings → AI Chat.")
      return
    }
    if (!session?.access_token) {
      setError("Sign in to use AI Chat.")
      return
    }

    setError(null)

    if (!user) {
      setError("Sign in to save conversation history.")
      return
    }

    let threadId = currentThreadId
    if (!threadId) {
      const { data, error: threadError } = await supabase
        .from("chat_threads")
        .insert({
          user_id: user.id,
          title: trimmed.slice(0, 40) + (trimmed.length > 40 ? "..." : ""),
        })
        .select()
        .single()

      if (threadError) {
        setError("Failed to create conversation history.")
        return
      }
      threadId = data.id
      setCurrentThreadId(threadId)
      setThreads((prev) => [data, ...prev])
    }

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
      timestamp: Date.now(),
    }

    // Save user message to Supabase
    await supabase.from("chat_messages").insert({
      thread_id: threadId,
      role: "user",
      content: trimmed,
    })

    const assistantMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
      timestamp: Date.now(),
    }

    const updatedMessages = [...messages, userMsg]
    setMessages([...updatedMessages, assistantMsg])
    setInput("")
    setIsStreaming(true)

    const abortController = new AbortController()
    abortRef.current = abortController

    try {
      const apiMessages = updatedMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }))

      // Proxy via Supabase edge to avoid Anthropic "CORS not allowed for this Organization" when calling from the browser
      const response = await fetch(CHAT_EDGE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session!.access_token}`,
        },
        body: JSON.stringify({
          messages: apiMessages,
          system: SYSTEM_PROMPT,
          oauth_token: token,
          model: "claude-sonnet-4-20250514",
          max_tokens: 4096,
        }),
        signal: abortController.signal,
      })

      if (!response.ok) {
        const resBody = await response.text()
        let errorMsg = `API error: ${response.status}`
        try {
          const parsed = JSON.parse(resBody)
          errorMsg = parsed.error ?? errorMsg
        } catch { /* use default */ }

        if (response.status === 401) {
          errorMsg = "Invalid or expired OAuth token. Update it in Settings → AI Chat."
        }
        throw new Error(errorMsg)
      }

      if (!response.body) throw new Error("No response stream")

      const reader = response.body.getReader()

      let fullAssistantContent = ""
      parseSSEStream(
        reader,
        (token) => {
          fullAssistantContent += token
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsg.id
                ? { ...m, content: fullAssistantContent }
                : m,
            ),
          )
        },
        async () => {
          setIsStreaming(false)
          abortRef.current = null

          // Save assistant message to Supabase when done
          if (fullAssistantContent) {
            await supabase.from("chat_messages").insert({
              thread_id: threadId!,
              role: "assistant",
              content: fullAssistantContent,
            })
          }
        },
        (errMsg) => {
          setError(errMsg)
          setIsStreaming(false)
          abortRef.current = null
        },
      )
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        setIsStreaming(false)
        abortRef.current = null
        return
      }
      setError((err as Error).message)
      setMessages(updatedMessages)
      setIsStreaming(false)
      abortRef.current = null
    }
  }, [input, isStreaming, messages, setMessages, setInput, session])

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort()
    setIsStreaming(false)
    abortRef.current = null
  }, [])

  const clearChat = useCallback(() => {
    setCurrentThreadId(null)
    setMessages([])
    setInput("")
    setError(null)
  }, [setInput, setCurrentThreadId])

  const deleteThread = useCallback(async (e: React.MouseEvent, threadId: string) => {
    e.stopPropagation()
    const { error } = await supabase
      .from("chat_threads")
      .delete()
      .eq("id", threadId)

    if (!error) {
      setThreads((prev) => prev.filter((t) => t.id !== threadId))
      if (currentThreadId === threadId) {
        clearChat()
      }
    }
  }, [supabase, currentThreadId, clearChat])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="h-[100dvh] bg-bg-primary flex flex-col relative overflow-hidden">
      {/* Sidebar Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 w-72 bg-bg-secondary border-r border-border-default z-50 transform transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col h-full">
          <div className="p-4 border-b border-border-default flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider">History</h2>
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="p-1 hover:bg-bg-elevated rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-text-muted" />
            </button>
          </div>

          <div className="p-4">
            <button
              onClick={() => {
                clearChat()
                setIsSidebarOpen(false)
              }}
              className="w-full flex items-center gap-2 px-4 py-2 bg-ai text-white rounded-lg text-sm font-medium hover:brightness-110 transition-all"
            >
              <Plus className="w-4 h-4" />
              New Chat
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-1">
            {threads.map((thread) => (
              <div
                key={thread.id}
                onClick={() => {
                  setCurrentThreadId(thread.id)
                  setIsSidebarOpen(false)
                }}
                className={`group flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                  currentThreadId === thread.id
                    ? 'bg-ai/10 text-ai'
                    : 'text-text-secondary hover:bg-bg-elevated'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <History className="w-4 h-4 shrink-0 opacity-60" />
                  <span className="text-sm truncate">{thread.title}</span>
                </div>
                <button
                  onClick={(e) => deleteThread(e, thread.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            {threads.length === 0 && (
              <div className="px-4 py-8 text-center">
                <p className="text-xs text-text-muted">No conversations yet</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="border-b border-border-default bg-bg-secondary/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="text-text-muted hover:text-text-primary transition-colors p-1 -ml-1"
              title="History"
            >
              <Menu className="w-5 h-5" />
            </button>
            <Link
              to="/"
              className="text-text-muted hover:text-text-primary transition-colors"
            >
              <Home className="w-5 h-5" />
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-ai" />
            <h1 className="text-lg font-semibold text-text-primary truncate max-w-[150px] sm:max-w-[300px]">
              {currentThreadId
                ? threads.find(t => t.id === currentThreadId)?.title || "AI Chat"
                : "AI Chat"}
            </h1>
          </div>
          <button
            onClick={() => {
              if (confirm("Clear current conversation?")) {
                clearChat()
              }
            }}
            className="text-text-muted hover:text-text-primary transition-colors"
            title="New chat"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        {messages.length === 0 && !hasToken && (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-16">
            <div className="w-16 h-16 rounded-2xl bg-ai-bg border border-ai-border flex items-center justify-center mb-4">
              <Sparkles className="w-8 h-8 text-ai" />
            </div>
            <h2 className="text-xl font-semibold text-text-primary mb-2">
              Set up AI Chat
            </h2>
            <p className="text-text-muted text-sm max-w-xs mb-4">
              Add your Claude OAuth token in Settings to start chatting. Your token stays on your device — it's never sent to our servers.
            </p>
            <Link
              to="/settings"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-ai text-white text-sm font-medium hover:brightness-110 transition-all no-underline"
            >
              <Settings className="w-4 h-4" />
              Open Settings
            </Link>
          </div>
        )}

        {messages.length === 0 && hasToken && (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-ai-bg border border-ai-border flex items-center justify-center mb-4">
              <Sparkles className="w-8 h-8 text-ai" />
            </div>
            <h2 className="text-xl font-semibold text-text-primary mb-2">
              AI Assistant
            </h2>
            <p className="text-text-muted text-sm max-w-xs">
              Ask about workouts, exercises, plant care, or anything else.
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {msg.role === "assistant" && (
              <div className="w-7 h-7 rounded-lg bg-ai-bg border border-ai-border flex items-center justify-center shrink-0 mt-0.5">
                <Sparkles className="w-3.5 h-3.5 text-ai" />
              </div>
            )}
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-ai text-white rounded-br-md"
                  : "bg-bg-secondary border border-border-default text-text-primary rounded-bl-md"
              }`}
            >
              {msg.role === "assistant" && !msg.content && isStreaming ? (
                <span className="inline-flex gap-1 py-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-ai/60 animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-ai/60 animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-ai/60 animate-bounce [animation-delay:300ms]" />
                </span>
              ) : (
                <MessageContent content={msg.content} />
              )}
            </div>
            {msg.role === "user" && (
              <div className="w-7 h-7 rounded-lg bg-bg-elevated border border-border-default flex items-center justify-center shrink-0 mt-0.5">
                <User className="w-3.5 h-3.5 text-text-muted" />
              </div>
            )}
          </div>
        ))}

        {error && (
          <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-border-default bg-bg-secondary/80 backdrop-blur-sm">
        <div className="max-w-2xl mx-auto px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={hasToken ? "Ask anything..." : "Set up token in Settings first"}
            rows={1}
            className="flex-1 resize-none rounded-xl border border-border-default bg-bg-primary px-4 py-2.5 text-sm text-text-primary placeholder:text-text-dim focus:outline-none focus:border-ai-border transition-colors field-sizing-content max-h-32"
            disabled={isStreaming || !hasToken}
          />
          {isStreaming ? (
            <button
              onClick={stopStreaming}
              className="shrink-0 w-10 h-10 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center justify-center text-red-400 hover:bg-red-500/30 transition-colors"
              title="Stop generating"
            >
              <Square className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={sendMessage}
              disabled={!input.trim() || !hasToken}
              className="shrink-0 w-10 h-10 rounded-xl bg-ai flex items-center justify-center text-white disabled:opacity-30 disabled:cursor-not-allowed hover:brightness-110 transition-all"
              title="Send message"
            >
              <Send className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function MessageContent({ content }: { content: string }) {
  if (!content) return null

  const parts = content.split(/(```[\s\S]*?```|`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g)

  return (
    <span className="whitespace-pre-wrap break-words">
      {parts.map((part, i) => {
        if (part.startsWith("```") && part.endsWith("```")) {
          const inner = part.slice(3, -3)
          const newlineIdx = inner.indexOf("\n")
          const code = newlineIdx >= 0 ? inner.slice(newlineIdx + 1) : inner
          return (
            <pre
              key={i}
              className="my-2 p-3 rounded-lg bg-bg-primary/80 border border-border-default overflow-x-auto text-xs font-mono text-text-secondary"
            >
              {code}
            </pre>
          )
        }
        if (part.startsWith("`") && part.endsWith("`")) {
          return (
            <code
              key={i}
              className="px-1.5 py-0.5 rounded bg-bg-primary/80 text-ai text-xs font-mono"
            >
              {part.slice(1, -1)}
            </code>
          )
        }
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <strong key={i} className="font-semibold">
              {part.slice(2, -2)}
            </strong>
          )
        }
        if (
          part.startsWith("*") &&
          part.endsWith("*") &&
          !part.startsWith("**")
        ) {
          return (
            <em key={i} className="italic">
              {part.slice(1, -1)}
            </em>
          )
        }
        return <span key={i}>{part}</span>
      })}
    </span>
  )
}
