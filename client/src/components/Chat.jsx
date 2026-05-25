import { useState, useEffect, useRef } from 'react'
import { socket } from '../socket'

export default function Chat({ messages }) {
  const [input, setInput] = useState('')
  const [open, setOpen] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendChat = () => {
    if (!input.trim()) return
    socket.emit('chat', { message: input })
    setInput('')
  }

  return (
    <div className="rounded-xl border border-zinc-800 overflow-hidden"
      style={{ background: 'rgba(0,0,0,0.6)' }}>

      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2 text-zinc-500
          text-xs uppercase tracking-widest hover:text-zinc-300 transition-colors">
        <span>💬 Chat {messages.length > 0 && `(${messages.length})`}</span>
        <span>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <>
          <div className="flex flex-col gap-1 p-2 h-36 overflow-y-auto border-t border-zinc-800">
            {messages.map((msg, i) => (
              <div key={i} className="text-xs text-zinc-300 break-words">
                <span className="text-yellow-400 font-bold">{msg.name}: </span>
                {msg.message}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          <div className="flex border-t border-zinc-800">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendChat()}
              placeholder="Say something..."
              className="flex-1 bg-transparent text-white text-xs placeholder-zinc-600
                px-3 py-2 focus:outline-none"
            />
            <button
              onClick={sendChat}
              className="text-xs text-yellow-400 px-3 hover:text-yellow-300 transition-colors">
              Send
            </button>
          </div>
        </>
      )}
    </div>
  )
}