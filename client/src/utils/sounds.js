const getCtx = () => {
  if (!window._audioCtx) {
    window._audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  }
  return window._audioCtx
}

function playTone(freq, duration, type = 'sine', volume = 0.3) {
  try {
    const ctx = getCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = type
    osc.frequency.setValueAtTime(freq, ctx.currentTime)
    gain.gain.setValueAtTime(volume, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + duration)
  } catch (e) {}
}

export function playCardDeal() {
  playTone(600, 0.08, 'triangle', 0.2)
  setTimeout(() => playTone(400, 0.06, 'triangle', 0.15), 40)
}

export function playChipClick() {
  playTone(1200, 0.05, 'square', 0.15)
}

export function playWin() {
  playTone(523, 0.15, 'sine', 0.3)
  setTimeout(() => playTone(659, 0.15, 'sine', 0.3), 150)
  setTimeout(() => playTone(784, 0.3, 'sine', 0.3), 300)
}

export function playBlackjack() {
  [523, 659, 784, 1047].forEach((freq, i) => {
    setTimeout(() => playTone(freq, 0.2, 'sine', 0.35), i * 120)
  })
}

export function playLose() {
  playTone(400, 0.2, 'sine', 0.3)
  setTimeout(() => playTone(320, 0.2, 'sine', 0.3), 200)
  setTimeout(() => playTone(260, 0.4, 'sine', 0.3), 400)
}

export function playBust() {
  playTone(300, 0.1, 'sawtooth', 0.25)
  setTimeout(() => playTone(200, 0.3, 'sawtooth', 0.2), 100)
}