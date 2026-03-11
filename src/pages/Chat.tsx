import { useState, useRef, useEffect, useCallback } from "react"
import { Link } from "react-router-dom"
import { Home, Send, Trash2, Square, Sparkles, AlertCircle, Settings } from "lucide-react"
import { useAuth } from "@/context/AuthContext"
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
  const userId = user?.id ?? "guest"

  const [messages, setMessages] = usePersistedState<ChatMessage[]>(
    `chat-messages:${userId}`,
    [],
  )
  const [input, setInput] = usePersistedState(`chat-input:${userId}`, "")
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasToken, setHasToken] = useState(() => !!getClaudeOAuthToken())

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    setHasToken(!!getClaudeOAuthToken())
  }, [])

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
      setError("No Claude OAuth token configured. Add one in Settings → AI Token.")
      return
    }
    if (!session?.access_token) {
      setError("Sign in to use AI Chat.")
      return
    }

    setError(null)
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
      timestamp: Date.now(),
    }

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
          errorMsg = "Invalid or expired OAuth token. Update it in Settings → AI Token."
        }
        throw new Error(errorMsg)
      }

      if (!response.body) throw new Error("No response stream")

      const reader = response.body.getReader()

      parseSSEStream(
        reader,
        (token) => {
          assistantMsg.content += token
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsg.id
                ? { ...m, content: assistantMsg.content }
                : m,
            ),
          )
        },
        () => {
          setIsStreaming(false)
          abortRef.current = null
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
    setMessages([])
    setInput("")
    setError(null)
  }, [setMessages, setInput])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="h-[100dvh] bg-bg-primary flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-default bg-bg-secondary/80 backdrop-blur-sm sticky top-0 z-10">
        <Link
          to="/"
          className="text-text-muted hover:text-text-primary transition-colors"
        >
          <Home className="w-5 h-5" />
        </Link>
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-ai" />
          <h1 className="text-lg font-semibold text-text-primary">AI Chat</h1>
        </div>
        <button
          onClick={clearChat}
          className="text-text-muted hover:text-text-primary transition-colors"
          title="Clear conversation"
        >
          <Trash2 className="w-5 h-5" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && !hasToken && (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-16">
            <div className="w-16 h-16 rounded-2xl bg-ai-bg border border-ai-border flex items-center justify-center mb-4">
              <Sparkles className="w-8 h-8 text-ai" />
            </div>
            <h2 className="text-xl font-semibold text-text-primary mb-2">
              Set up AI Chat
            </h2>
            <p className="text-text-muted text-sm max-w-xs mb-4">
              Add your Claude OAuth token in Settings to start chatting.
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
            className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[88%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
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

      {/* Input */}
      <div className="border-t border-border-default bg-bg-secondary/80 backdrop-blur-sm px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="flex items-end gap-2 max-w-2xl mx-auto">
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
