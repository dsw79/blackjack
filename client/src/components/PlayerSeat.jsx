import Card from './Card'

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

const resultStyles = {
  win:   { text: '🎉 Win!',  color: '#4ade80' },
  lose:  { text: '😔 Lose',  color: '#f87171' },
  bust:  { text: '💥 Bust',  color: '#ef4444' },
  push:  { text: '🤝 Push',  color: '#facc15' },
  stand: { text: '✋ Stand', color: '#60a5fa' },
}

export default function PlayerSeat({ player, isMe, isCurrentTurn, currentHandIndex }) {
  const allHandsDone = player.hands.every(h => h.gameOver)

  return (
    <div className="flex flex-col items-center gap-2" style={{ minWidth: '90px' }}>
      <div className="flex gap-2 items-end justify-center flex-wrap">
        {player.hands.map((hand, i) => {
          const isActiveHand = i === currentHandIndex && !hand.gameOver
          const score = hand.cards.length > 0 ? getHandValue(hand.cards) : null
          const result = resultStyles[hand.result]

          return (
            <div key={i} className="flex flex-col items-center gap-1">
              {result ? (
                <div className="text-xs font-black" style={{ color: result.color }}>
                  {result.text}
                </div>
              ) : score ? (
                <div className="text-white text-xs font-bold">{score}</div>
              ) : null}

              <div className={`flex gap-0.5 sm:gap-1 p-1 sm:p-2 rounded-lg transition-all
                ${isActiveHand && isCurrentTurn ? 'ring-2 ring-yellow-400 ring-offset-1 ring-offset-transparent' : ''}`}>
                {hand.cards.map((card, j) => (
                  <Card key={j} card={card} isNew={true} />
                ))}
              </div>

              <div className="text-zinc-500 text-xs">
                Bet: <span className="text-yellow-300">${hand.bet.toFixed(2)}</span>
              </div>
            </div>
          )
        })}
      </div>

      <div className={`w-full rounded-xl px-2 py-1.5 flex flex-col items-center gap-0.5 border transition-all
        ${isMe ? 'border-yellow-400' : 'border-zinc-700'}
        ${isCurrentTurn && !allHandsDone ? 'bg-yellow-400/10' : 'bg-black/40'}`}>
        <div className="text-white text-xs font-bold tracking-wide truncate max-w-full">
          {player.name}{isMe ? ' 👤' : ''}
        </div>
        <div className="text-yellow-400 text-xs font-mono">
          ${player.chips.toFixed(2)}
        </div>
        {isCurrentTurn && !allHandsDone && (
          <div className="text-yellow-400 text-xs animate-pulse">● playing</div>
        )}
      </div>
    </div>
  )
}