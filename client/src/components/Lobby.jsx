import { useState } from 'react'
import { socket } from '../socket'

export default function Lobby() {
  const [name, setName] = useState('')
  const [roomCode, setRoomCode] = useState('')
  const [tab, setTab] = useState('create')

  const createRoom = () => {
    if (!name.trim()) return
    socket.emit('createRoom', { name })
  }

  const joinRoom = () => {
    if (!name.trim() || !roomCode.trim()) return
    socket.emit('joinRoom', { name, room: roomCode })
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-8 px-4"
      style={{ background: 'radial-gradient(ellipse at top, #1a0a2e 0%, #0a0a0a 70%)' }}>

      <div className="text-center">
        <div className="text-6xl mb-2">🃏</div>
        <h1 className="text-7xl font-black tracking-widest uppercase"
          style={{
            fontFamily: 'Georgia, serif',
            color: '#FFD700',
            textShadow: '0 0 20px #FFD700, 0 0 40px #FF6B00, 0 0 80px #FF0000'
          }}>
          Blackjack
        </h1>
        <p className="text-pink-400 tracking-[0.3em] text-sm mt-2 uppercase"
          style={{ textShadow: '0 0 10px #FF69B4' }}>
          Las Vegas Style
        </p>
      </div>

      <div className="w-full max-w-sm bg-zinc-900 rounded-2xl border border-zinc-700 p-6 flex flex-col gap-4"
        style={{ boxShadow: '0 0 30px rgba(255, 215, 0, 0.1)' }}>

        <input
          type="text"
          placeholder="Your name"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (tab === 'create' ? createRoom() : joinRoom())}
          className="w-full bg-zinc-800 text-white placeholder-zinc-500 border border-zinc-600 rounded-lg px-4 py-3 text-center focus:outline-none focus:border-yellow-400 transition-colors"
        />

        <div className="flex rounded-lg overflow-hidden border border-zinc-700">
          <button
            onClick={() => setTab('create')}
            className={`flex-1 py-2 text-sm font-bold transition-colors ${tab === 'create' ? 'bg-yellow-400 text-zinc-950' : 'bg-zinc-800 text-zinc-400'}`}>
            Create Game
          </button>
          <button
            onClick={() => setTab('join')}
            className={`flex-1 py-2 text-sm font-bold transition-colors ${tab === 'join' ? 'bg-yellow-400 text-zinc-950' : 'bg-zinc-800 text-zinc-400'}`}>
            Join Game
          </button>
        </div>

        {tab === 'create' ? (
          <button
            onClick={createRoom}
            className="w-full py-3 rounded-lg font-black text-zinc-950 text-lg uppercase tracking-widest transition-all active:scale-95"
            style={{
              background: 'linear-gradient(135deg, #FFD700, #FF6B00)',
              boxShadow: '0 0 20px rgba(255, 215, 0, 0.4)'
            }}>
            Deal Me In
          </button>
        ) : (
          <div className="flex flex-col gap-3">
            <input
              type="text"
              placeholder="Room code"
              value={roomCode}
              onChange={e => setRoomCode(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && joinRoom()}
              className="w-full bg-zinc-800 text-white placeholder-zinc-500 border border-zinc-600 rounded-lg px-4 py-3 text-center focus:outline-none focus:border-yellow-400 transition-colors tracking-widest"
            />
            <button
              onClick={joinRoom}
              className="w-full py-3 rounded-lg font-black text-zinc-950 text-lg uppercase tracking-widest transition-all active:scale-95"
              style={{
                background: 'linear-gradient(135deg, #FF69B4, #FF1493)',
                boxShadow: '0 0 20px rgba(255, 105, 180, 0.4)'
              }}>
              Join Table
            </button>
          </div>
        )}
      </div>

      <div className="flex gap-6 text-3xl opacity-30">
        <span>♠</span><span>♥</span><span>♦</span><span>♣</span>
      </div>
    </div>
  )
}