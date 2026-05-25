import { useState, useEffect, useRef } from 'react'
import { socket } from '../socket'
import Card from './Card'
import PlayerSeat from './PlayerSeat'
import Chat from './Chat'
import Ledger from './Ledger'
import ResultOverlay from './ResultOverlay'
import { playCardDeal, playChipClick, playWin, playLose, playBust, playBlackjack } from '../utils/sounds'

function getHandValue(cards) {
  let total = 0
  let aces = 0
  for (let card of cards) {
    if (card.value === '?') continue
    if (card.value === 'A') { aces++; total += 11 }
    else if (['J', 'Q', 'K'].includes(card.value)) total += 10
    else total += parseInt(card.value)
  }
  while (total > 21 && aces > 0) { total -= 10; aces-- }
  return total
}

export default function Game({
  roomCode, isDealer, myId, gameState,
  pendingBets, pendingBuyIns, betStatus, buyInStatus,
  chips, messages, acceptBet, rejectBet,
  approveBuyIn, rejectBuyIn, cheatMode, playerList, ledger
}) {
  const [betInput, setBetInput] = useState('')
  const [buyInInput, setBuyInInput] = useState('')
  const [cheatSet, setCheatSet] = useState(null)
  const [showOverlay, setShowOverlay] = useState(false)
  const [floatingChips, setFloatingChips] = useState([])
  const [showLedger, setShowLedger] = useState(false)
  const prevGameState = useRef(null)

  useEffect(() => {
    socket.on('cheatSet', ({ type }) => setCheatSet(type))
    socket.on('cheatUsed', () => setCheatSet(null))
    return () => {
      socket.off('cheatSet')
      socket.off('cheatUsed')
    }
  }, [])

  useEffect(() => {
    if (gameState === null) {
      setCheatSet(null)
      setShowOverlay(false)
      prevGameState.current = null
      return
    }

    const prev = prevGameState.current
    const me = gameState.players.find(p => p.id === myId)

    if (!prev && gameState) {
      playCardDeal()
      setTimeout(playCardDeal, 150)
      setTimeout(playCardDeal, 300)
      setTimeout(playCardDeal, 450)
    }

    if (prev && me) {
      const prevMe = prev.players.find(p => p.id === myId)
      if (prevMe) {
        const prevTotal = prevMe.hands.reduce((sum, h) => sum + h.cards.length, 0)
        const newTotal = me.hands.reduce((sum, h) => sum + h.cards.length, 0)
        if (newTotal > prevTotal) playCardDeal()
      }
    }

    if (prev && gameState.dealerHand.length > (prev.dealerHand?.length || 0)) {
      playCardDeal()
    }

    const allDone = gameState.players.every(p => p.hands.every(h => h.gameOver))
    if (allDone && !gameState.dealerTurn && me && !showOverlay) {
      const results = me.hands.map(h => h.result)

      const isBlackjack = me.hands.length === 1 &&
        results[0] === 'win' &&
        me.hands[0].cards.length === 2 &&
        me.hands[0].cards.some(c => c.value === 'A') &&
        me.hands[0].cards.some(c => ['10', 'J', 'Q', 'K'].includes(c.value)) &&
        getHandValue(me.hands[0].cards) === 21

      const hasWin = results.includes('win')
      const hasBust = results.includes('bust')
      const hasLose = results.includes('lose')

      if (isBlackjack) playBlackjack()
      else if (hasWin) playWin()
      else if (hasBust) playBust()
      else if (hasLose) playLose()

      if (!isDealer) {
        const prevMe = prev?.players.find(p => p.id === myId)
        if (prevMe) {
          const diff = me.chips - prevMe.chips
          if (diff !== 0) {
            const id = Date.now()
            setFloatingChips(prev => [...prev, { id, amount: diff }])
            setTimeout(() => setFloatingChips(p => p.filter(f => f.id !== id)), 1200)
          }
        }
        setTimeout(() => setShowOverlay(true), 600)
      }
    }

    prevGameState.current = gameState
  }, [gameState])

  const placeBet = () => {
    const amount = parseFloat(betInput)
    if (!amount || amount <= 0) return
    playChipClick()
    socket.emit('placeBet', { amount })
    setBetInput('')
  }

  const requestBuyIn = () => {
    const amount = parseFloat(buyInInput)
    if (!amount || amount <= 0) return
    playChipClick()
    socket.emit('requestBuyIn', { amount })
    setBuyInInput('')
  }

  const me = gameState?.players.find(p => p.id === myId)
  const isMyTurn = gameState?.currentTurn === myId
  const allDone = gameState?.players.length > 0 &&
    gameState.players.every(p => p.hands.every(h => h.gameOver))
  const currentHand = me?.hands[me?.currentHandIndex]
  const canDouble = isMyTurn && currentHand?.cards.length === 2 && chips >= currentHand?.bet
  const canSplit = isMyTurn && currentHand?.cards.length === 2 &&
    currentHand?.cards[0].value === currentHand?.cards[1].value &&
    chips >= currentHand?.bet && me?.hands.length < 4

  const hasBuyIn = chips > 0 || betStatus?.type === 'accepted' || betStatus?.type === 'pending'

  const dealerHandValue = gameState?.dealerHand
    ? getHandValue(gameState.dealerHand.filter(c => c.value !== '?'))
    : 0

  return (
    <div className="min-h-screen flex flex-col items-center justify-start lg:justify-center p-3 sm:p-6"
      style={{ background: 'radial-gradient(ellipse at top, #1a0a2e 0%, #0a0a0a 70%)' }}>

      {showOverlay && !isDealer && (
        <ResultOverlay
          gameState={gameState}
          myId={myId}
          onClose={() => setShowOverlay(false)}
        />
      )}

      <div className="flex flex-col lg:flex-row gap-4 w-full max-w-5xl">
        <div className="flex-1 flex flex-col gap-3">

          <div className="flex items-center justify-between">
            <h1 className="text-yellow-400 text-lg sm:text-2xl font-black tracking-widest uppercase"
              style={{ textShadow: '0 0 20px #FFD700' }}>
              Blackjack
            </h1>
            <div className="flex items-center gap-2">
              <div className="bg-black/50 text-yellow-400 text-xs px-3 py-1 rounded-full
                border border-yellow-400/30 tracking-widest">
                {roomCode}
              </div>
              <button
                onClick={() => setShowLedger(s => !s)}
                className="lg:hidden bg-black/50 text-zinc-400 text-xs px-2 py-1 rounded-full border border-zinc-700">
                📒
              </button>
            </div>
          </div>

          {showLedger && (
            <div className="lg:hidden">
              <Ledger ledger={ledger} />
            </div>
          )}

          <div className="rounded-3xl sm:rounded-[50px] border-4 border-yellow-900/50 p-4 sm:p-8 flex flex-col gap-4 sm:gap-6"
            style={{
              background: 'radial-gradient(ellipse at center, #1c5c35 0%, #144228 100%)',
              boxShadow: '0 0 60px rgba(0,0,0,0.8), inset 0 0 40px rgba(0,0,0,0.3)',
              minHeight: '420px'
            }}>

            <div className="flex flex-col items-center gap-2">
              <p className="text-zinc-500 text-xs uppercase tracking-[0.3em]">Dealer</p>
              <div className="flex gap-1 sm:gap-2 min-h-16 items-center justify-center flex-wrap">
                {gameState?.dealerHand?.map((card, i) => (
                  <Card key={i} card={card} isNew={true} />
                ))}
              </div>
              {gameState?.dealerHand?.length > 0 && (
                <p className="text-zinc-400 text-sm">{dealerHandValue}</p>
              )}
            </div>

            {(pendingBuyIns.length > 0 || pendingBets.length > 0) && (
              <div className="flex flex-col items-center gap-2">
                {pendingBuyIns.map(b => (
                  <div key={b.playerId} className="flex flex-wrap items-center justify-center gap-2 bg-black/40
                    px-3 py-2 rounded-xl border border-blue-700 text-xs text-white">
                    <span>{b.name} wants to buy in for <span className="text-blue-400">${b.amount.toFixed(2)}</span></span>
                    <div className="flex gap-2">
                      <button onClick={() => approveBuyIn(b.playerId)}
                        className="bg-green-600 hover:bg-green-500 px-3 py-1 rounded-full transition-colors">
                        Approve
                      </button>
                      <button onClick={() => rejectBuyIn(b.playerId)}
                        className="bg-zinc-600 hover:bg-zinc-500 px-3 py-1 rounded-full transition-colors">
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
                {pendingBets.map(b => (
                  <div key={b.playerId} className="flex flex-wrap items-center justify-center gap-2 bg-black/40
                    px-3 py-2 rounded-xl border border-zinc-700 text-xs text-white">
                    <span>{b.name} wants to bet <span className="text-yellow-400">${b.amount.toFixed(2)}</span></span>
                    <div className="flex gap-2">
                      <button onClick={() => acceptBet(b.playerId)}
                        className="bg-green-600 hover:bg-green-500 px-3 py-1 rounded-full transition-colors">
                        Accept
                      </button>
                      <button onClick={() => rejectBet(b.playerId)}
                        className="bg-zinc-600 hover:bg-zinc-500 px-3 py-1 rounded-full transition-colors">
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {gameState?.currentTurn && (
              <p className="text-center text-sm"
                style={{ color: isMyTurn ? '#FFD700' : 'rgba(255,255,255,0.5)' }}>
                {isMyTurn
                  ? 'Your turn!'
                  : `${gameState.players.find(p => p.id === gameState.currentTurn)?.name}'s turn`}
              </p>
            )}

            {!isDealer && !hasBuyIn && (
              <div className="flex flex-col items-center gap-2">
                {!buyInStatus || buyInStatus.type === 'rejected' || (buyInStatus.type === 'approved' && chips === 0) ? (
                  <>
                    {buyInStatus?.type === 'rejected' && (
                      <p className="text-red-400 text-xs">✗ Buy-in rejected. Try again.</p>
                    )}
                    {chips === 0 && buyInStatus?.type === 'approved' && (
                      <p className="text-zinc-400 text-xs">Out of chips! Request a new buy-in.</p>
                    )}
                    <p className="text-zinc-400 text-sm">How much would you like to buy in for?</p>
                    <div className="flex gap-2 items-center">
                      <input
                        type="number"
                        step="0.50"
                        min="0.50"
                        value={buyInInput}
                        onChange={e => setBuyInInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && requestBuyIn()}
                        placeholder="$0.00"
                        className="bg-black/50 text-white placeholder-zinc-600 border border-zinc-700
                          rounded-lg px-4 py-2 text-center w-32 focus:outline-none focus:border-blue-400"
                      />
                      <button onClick={requestBuyIn}
                        className="px-4 py-2 rounded-lg font-bold text-white transition-all active:scale-95"
                        style={{ background: 'linear-gradient(135deg, #1a3a8f, #2255cc)' }}>
                        Request
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="text-zinc-400 text-xs text-center px-4">
                    Waiting for dealer to approve your buy-in of ${buyInStatus.amount?.toFixed(2)}...
                  </p>
                )}
              </div>
            )}

            {!isDealer && hasBuyIn && (
              <div className="flex flex-col items-center gap-2 relative">
                <div className="relative">
                  <p className="text-yellow-400 text-sm font-bold">
                    Chips: ${chips.toFixed(2)}
                  </p>
                  {floatingChips.map(f => (
                    <div key={f.id} className="float-up"
                      style={{ color: f.amount > 0 ? '#4ade80' : '#f87171', top: '-10px', left: '50%', transform: 'translateX(-50%)' }}>
                      {f.amount > 0 ? `+$${f.amount.toFixed(2)}` : `-$${Math.abs(f.amount).toFixed(2)}`}
                    </div>
                  ))}
                </div>
                {!gameState && (
                  <>
                    {!betStatus || betStatus.type === 'rejected' ? (
                      <div className="flex flex-col items-center gap-2">
                        {betStatus?.type === 'rejected' && (
                          <p className="text-red-400 text-xs">✗ Bet rejected. Try again.</p>
                        )}
                        <div className="flex gap-2 items-center">
                          <input
                            type="number"
                            step="0.50"
                            min="0.50"
                            value={betInput}
                            onChange={e => setBetInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && placeBet()}
                            placeholder="$0.00"
                            className="bg-black/50 text-white placeholder-zinc-600 border border-zinc-700
                              rounded-lg px-4 py-2 text-center w-32 focus:outline-none focus:border-yellow-400"
                          />
                          <button onClick={placeBet}
                            className="px-4 py-2 rounded-lg font-bold text-zinc-950 transition-all active:scale-95"
                            style={{ background: 'linear-gradient(135deg, #FFD700, #FF6B00)' }}>
                            Bet
                          </button>
                        </div>
                      </div>
                    ) : betStatus.type === 'pending' ? (
                      <p className="text-zinc-400 text-xs text-center px-4">
                        Waiting for dealer to accept your bet of ${betStatus.amount?.toFixed(2)}...
                      </p>
                    ) : (
                      <p className="text-green-400 text-xs">
                        ✓ Bet of ${betStatus.bet?.toFixed(2)} accepted!
                      </p>
                    )}
                  </>
                )}
              </div>
            )}

            {isMyTurn && currentHand && !currentHand.gameOver && (
              <div className="flex justify-center gap-2 sm:gap-3 flex-wrap">
                <button onClick={() => socket.emit('hit')}
                  className="px-4 sm:px-6 py-2 rounded-lg font-bold text-white border border-zinc-600 hover:bg-white/10 transition-colors text-sm">
                  Hit
                </button>
                <button onClick={() => socket.emit('stand')}
                  className="px-4 sm:px-6 py-2 rounded-lg font-bold text-white border border-zinc-600 hover:bg-white/10 transition-colors text-sm">
                  Stand
                </button>
                {canDouble && (
                  <button onClick={() => socket.emit('doubleDown')}
                    className="px-4 sm:px-6 py-2 rounded-lg font-bold text-yellow-400 border border-yellow-400/50 hover:bg-yellow-400/10 transition-colors text-sm">
                    Double
                  </button>
                )}
                {canSplit && (
                  <button onClick={() => socket.emit('split')}
                    className="px-4 sm:px-6 py-2 rounded-lg font-bold text-pink-400 border border-pink-400/50 hover:bg-pink-400/10 transition-colors text-sm">
                    Split
                  </button>
                )}
              </div>
            )}

            {isDealer && !gameState && (
              <div className="flex justify-center">
                <button onClick={() => socket.emit('deal')}
                  className="px-8 py-3 rounded-lg font-black text-zinc-950 text-lg uppercase tracking-widest transition-all active:scale-95"
                  style={{ background: 'linear-gradient(135deg, #FFD700, #FF6B00)' }}>
                  Deal
                </button>
              </div>
            )}

            {isDealer && gameState?.dealerTurn && (
              <div className="flex flex-col items-center gap-2">
                <p className="text-zinc-400 text-xs uppercase tracking-widest">Your turn — draw or stand</p>
                <div className="flex gap-3">
                  <button onClick={() => socket.emit('dealerDraw')}
                    className="px-6 py-2 rounded-lg font-bold text-white border border-zinc-600 hover:bg-white/10 transition-colors">
                    Draw
                  </button>
                  <button onClick={() => socket.emit('dealerStand')}
                    className="px-6 py-2 rounded-lg font-black text-zinc-950 transition-all active:scale-95"
                    style={{ background: 'linear-gradient(135deg, #FFD700, #FF6B00)' }}>
                    Stand
                  </button>
                </div>
                <p className="text-zinc-500 text-xs">
                  Your hand: {dealerHandValue}
                </p>
              </div>
            )}

            {isDealer && allDone && gameState && !gameState.dealerTurn && (
              <div className="flex justify-center">
                <button onClick={() => { socket.emit('newRound'); setCheatSet(null) }}
                  className="px-8 py-3 rounded-lg font-black text-zinc-950 text-lg uppercase tracking-widest transition-all active:scale-95"
                  style={{ background: 'linear-gradient(135deg, #FFD700, #FF6B00)' }}>
                  New Round
                </button>
              </div>
            )}

            {isDealer && cheatMode && gameState && !gameState.dealerTurn && (
              <div className="flex flex-col items-center gap-2 p-3 rounded-xl border border-red-900/50"
                style={{ background: 'rgba(100,0,0,0.3)' }}>
                <p className="text-red-400 text-xs uppercase tracking-widest">🎰 Dealer Mode</p>
                {cheatSet ? (
                  <p className="text-yellow-400 text-xs">
                    Active: {
                      cheatSet === 'bustNext' ? '💥 Next card busts' :
                      cheatSet === 'goodNext' ? '✅ Next card is good' :
                      cheatSet === 'win' ? '🎉 Everyone wins' :
                      cheatSet === 'lose' ? '😔 Everyone loses' : ''
                    }
                  </p>
                ) : (
                  <p className="text-zinc-500 text-xs">No cheat active</p>
                )}
                <div className="flex gap-2 flex-wrap justify-center">
                  <button onClick={() => socket.emit('setCheat', { type: 'bustNext' })}
                    className="px-3 py-1 rounded bg-red-700 hover:bg-red-600 text-white text-xs transition-colors">
                    Next: Bust
                  </button>
                  <button onClick={() => socket.emit('setCheat', { type: 'goodNext' })}
                    className="px-3 py-1 rounded bg-green-700 hover:bg-green-600 text-white text-xs transition-colors">
                    Next: Good
                  </button>
                  <button onClick={() => socket.emit('setCheat', { type: 'win' })}
                    className="px-3 py-1 rounded bg-yellow-600 hover:bg-yellow-500 text-zinc-950 text-xs transition-colors">
                    All Win
                  </button>
                  <button onClick={() => socket.emit('setCheat', { type: 'lose' })}
                    className="px-3 py-1 rounded bg-purple-700 hover:bg-purple-600 text-white text-xs transition-colors">
                    All Lose
                  </button>
                  <button onClick={() => socket.emit('setCheat', { type: null })}
                    className="px-3 py-1 rounded bg-zinc-700 hover:bg-zinc-600 text-white text-xs transition-colors">
                    Clear
                  </button>
                </div>
              </div>
            )}

            <div className="flex justify-center gap-3 sm:gap-6 flex-wrap mt-auto pt-4 border-t border-white/10">
              {!gameState && playerList.map(p => (
                <div key={p.id} className={`flex flex-col items-center gap-1 bg-black/30
                  rounded-xl px-3 py-2 min-w-20 border
                  ${p.id === myId ? 'border-yellow-400' : 'border-zinc-700'}`}>
                  <div className="text-white text-xs font-bold truncate max-w-full">{p.name}</div>
                  <div className="text-yellow-400 text-xs">
                    {p.chips > 0 ? `$${p.chips.toFixed(2)}` : 'No chips'}
                  </div>
                  {p.acceptedBet > 0 && (
                    <div className="text-green-400 text-xs">Bet: ${p.acceptedBet.toFixed(2)}</div>
                  )}
                  {p.status === 'waitingBuyIn' && p.chips === 0 && (
                    <div className="text-zinc-500 text-xs">Waiting...</div>
                  )}
                  {isDealer && p.id !== myId && (
                    <button
                      onClick={() => socket.emit('kickPlayer', { playerId: p.id })}
                      className="text-xs bg-red-900/50 hover:bg-red-700 text-red-400 hover:text-white
                        px-2 py-0.5 rounded transition-colors mt-1">
                      Kick
                    </button>
                  )}
                </div>
              ))}

              {gameState?.players.map(player => (
                <div key={player.id} className="flex flex-col items-center gap-1">
                  <PlayerSeat
                    player={player}
                    isMe={player.id === myId}
                    isCurrentTurn={gameState.currentTurn === player.id}
                    currentHandIndex={player.currentHandIndex}
                  />
                  {isDealer && gameState.currentTurn === player.id && (
                    <button
                      onClick={() => socket.emit('kickPlayer', { playerId: player.id })}
                      className="text-xs text-red-500 hover:text-red-400 transition-colors mt-1">
                      ✕ Skip turn
                    </button>
                  )}
                </div>
              ))}
            </div>

          </div>

          <div className="flex gap-3 lg:hidden">
            <div className="flex-1">
              <Chat messages={messages} />
            </div>
          </div>

        </div>

        <div className="hidden lg:flex w-56 flex-shrink-0 flex-col gap-4 mt-14">
          <Chat messages={messages} />
          <Ledger ledger={ledger} />
        </div>

      </div>
    </div>
  )
}