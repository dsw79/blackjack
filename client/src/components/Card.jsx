export default function Card({ card, isNew = false }) {
  if (!card) return null

  if (card.value === '?') {
    return (
      <div className={`w-10 h-14 sm:w-14 sm:h-20 rounded-lg flex items-center justify-center ${isNew ? 'card-deal' : ''}`}
        style={{
          background: 'linear-gradient(135deg, #1a3580, #0a1a50)',
          border: '1px solid #2a4590',
          boxShadow: '2px 2px 6px rgba(0,0,0,0.4)'
        }}>
        <div className="text-blue-300 text-lg">🂠</div>
      </div>
    )
  }

  const isRed = card.suit === '♥' || card.suit === '♦'
  const color = isRed ? '#dc2626' : '#111'

  return (
    <div className={`w-10 h-14 sm:w-14 sm:h-20 bg-white rounded-lg relative overflow-hidden select-none ${isNew ? 'card-deal' : ''}`}
      style={{ border: '1px solid #ddd', boxShadow: '2px 4px 8px rgba(0,0,0,0.5)' }}>

      <div className="absolute top-0.5 left-0.5 leading-none" style={{ color, fontSize: '9px', fontWeight: 800 }}>
        <div>{card.value}</div>
        <div>{card.suit}</div>
      </div>

      <div className="absolute inset-0 flex items-center justify-center"
        style={{ color, fontSize: '16px' }}>
        {card.suit}
      </div>

      <div className="absolute bottom-0.5 right-0.5 leading-none rotate-180"
        style={{ color, fontSize: '9px', fontWeight: 800 }}>
        <div>{card.value}</div>
        <div>{card.suit}</div>
      </div>
    </div>
  )
}