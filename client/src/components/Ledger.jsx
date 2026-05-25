export default function Ledger({ ledger }) {
  const entries = Object.values(ledger)
  if (entries.length === 0) return null

  return (
    <div className="w-56 rounded-xl border border-zinc-800 overflow-hidden"
      style={{ background: 'rgba(0,0,0,0.6)' }}>

      <div className="text-xs text-zinc-500 uppercase tracking-widest px-3 py-2 border-b border-zinc-800 flex items-center gap-2">
        <span>📒</span> Ledger
      </div>

      <div className="flex flex-col">
        <div className="grid grid-cols-4 px-3 py-1 text-zinc-600 text-xs border-b border-zinc-900">
          <span>Player</span>
          <span className="text-right">In</span>
          <span className="text-right">Out</span>
          <span className="text-right">Net</span>
        </div>

        {entries.map((entry, i) => {
          const net = parseFloat((entry.currentChips - entry.totalBuyIn).toFixed(2))
          const isPositive = net > 0
          const isNegative = net < 0

          return (
            <div key={i} className={`grid grid-cols-4 px-3 py-2 text-xs border-b border-zinc-900/50
              ${!entry.active ? 'opacity-50' : ''}`}>
              <span className="text-white truncate flex items-center gap-1">
                {!entry.active && <span className="text-zinc-600">•</span>}
                {entry.name}
              </span>
              <span className="text-right text-zinc-400">${entry.totalBuyIn.toFixed(2)}</span>
              <span className="text-right text-zinc-300">${entry.currentChips.toFixed(2)}</span>
              <span className={`text-right font-bold
                ${isPositive ? 'text-green-400' : isNegative ? 'text-red-400' : 'text-zinc-400'}`}>
                {isPositive ? '+' : ''}{net.toFixed(2)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}