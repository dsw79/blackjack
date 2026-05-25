import { useEffect } from 'react'
import confetti from 'canvas-confetti'

function getHandValue(cards) {
  let total = 0, aces = 0
  for (let card of cards) {
    if (card.value === 'A') { aces++; total += 11 }
    else if (['J','Q','K'].includes(card.value)) total += 10
    else total += parseInt(card.value)
  }
  while (total > 21 && aces > 0) { total -= 10; aces-- }
  return total
}

export default function ResultOverlay({ gameState, myId, onClose }) {
  if (!gameState) return null

  const allDone = gameState.players.every(p => p.hands.every(h => h.gameOver))
  if (!allDone) return null

  const me = gameState.players.find(p => p.id === myId)
  if (!me) return null

  const results = me.hands.map(h => h.result)
  const hasWin = results.includes('win')
  const hasBust = results.includes('bust')
  const hasLose = results.includes('lose')
  const hasPush = results.every(r => r === 'push')

  const isBlackjack = me.hands.length === 1 &&
    me.hands[0].result === 'win' &&
    me.hands[0].cards.length === 2 &&
    me.hands[0].cards.some(c => c.value === 'A') &&
    me.hands[0].cards.some(c => ['10', 'J', 'Q', 'K'].includes(c.value)) &&
    getHandValue(me.hands[0].cards) === 21

  useEffect(() => {
    if (isBlackjack) {
      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#FFD700', '#FF6B00', '#ffffff']
      })
    } else if (hasWin) {
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 },
        colors: ['#4ade80', '#22c55e', '#ffffff']
      })
    }
  }, [])

  let emoji, headline, subtext, bg

  if (isBlackjack) {
    emoji = '🃏'
    headline = 'BLACKJACK!'
    subtext = 'Pays 3:2'
    bg = 'linear-gradient(135deg, rgba(255,215,0,0.95), rgba(255,107,0,0.95))'
  } else if (hasWin) {
    emoji = '🎉'
    headline = 'You Win!'
    subtext = 'Nice hand'
    bg = 'linear-gradient(135deg, rgba(22,163,74,0.95), rgba(21,128,61,0.95))'
  } else if (hasBust) {
    emoji = '💥'
    headline = 'Bust!'
    subtext = 'Over 21'
    bg = 'linear-gradient(135deg, rgba(185,28,28,0.95), rgba(153,27,27,0.95))'
  } else if (hasLose) {
    emoji = '😔'
    headline = 'Dealer Wins'
    subtext = 'Better luck next time'
    bg = 'linear-gradient(135deg, rgba(109,40,217,0.95), rgba(91,33,182,0.95))'
  } else if (hasPush) {
    emoji = '🤝'
    headline = 'Push'
    subtext = 'Bet returned'
    bg = 'linear-gradient(135deg, rgba(37,99,235,0.95), rgba(29,78,216,0.95))'
  } else {
    return null
  }

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50 cursor-pointer"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}>
      <div className="flex flex-col items-center gap-3 px-16 py-10 rounded-3xl result-pop"
        style={{ background: bg, boxShadow: '0 0 80px rgba(0,0,0,0.5)' }}>
        <div style={{ fontSize: '64px' }}>{emoji}</div>
        <div className="text-white font-black tracking-widest uppercase"
          style={{ fontSize: '36px', textShadow: '0 2px 10px rgba(0,0,0,0.3)' }}>
          {headline}
        </div>
        <div className="text-white/70 text-sm tracking-widest uppercase">{subtext}</div>
        <div className="text-white/50 text-xs mt-2">tap to continue</div>
      </div>
    </div>
  )
}