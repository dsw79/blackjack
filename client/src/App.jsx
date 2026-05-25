import { useState, useEffect, useRef } from 'react'
import { socket } from './socket'
import Lobby from './components/Lobby'
import Game from './components/Game'

export default function App() {
  const [screen, setScreen] = useState('lobby')
  const [roomCode, setRoomCode] = useState(null)
  const [isDealer, setIsDealer] = useState(false)
  const [myId, setMyId] = useState(null)
  const [gameState, setGameState] = useState(null)
  const [pendingBets, setPendingBets] = useState([])
  const [pendingBuyIns, setPendingBuyIns] = useState([])
  const [betStatus, setBetStatus] = useState(null)
  const [buyInStatus, setBuyInStatus] = useState(null)
  const [chips, setChips] = useState(0)
  const [messages, setMessages] = useState([])
  const [cheatMode, setCheatMode] = useState(false)
  const [playerList, setPlayerList] = useState([])
  const [ledger, setLedger] = useState({})

  const chipsRef = useRef(0)
  useEffect(() => { chipsRef.current = chips }, [chips])

  useEffect(() => {
    if (socket.connected) setMyId(socket.id)
    socket.on('connect', () => setMyId(socket.id))

    socket.on('roomCreated', ({ roomCode }) => {
      setRoomCode(roomCode)
      setIsDealer(true)
      setScreen('game')
    })

    socket.on('roomJoined', ({ roomCode }) => {
      setRoomCode(roomCode)
      setIsDealer(false)
      setScreen('game')
    })

    socket.on('roomError', ({ message }) => alert(message))

    socket.on('gameState', (state) => {
      setGameState(state)
      const me = state.players.find(p => p.id === socket.id)
      if (me) setChips(me.chips)
    })

    socket.on('buyInSubmitted', ({ amount }) => {
      setBuyInStatus({ type: 'pending', amount })
    })

    socket.on('buyInApproved', ({ chips }) => {
      setChips(chips)
      setBuyInStatus({ type: 'approved', chips })
    })

    socket.on('buyInRejected', () => setBuyInStatus({ type: 'rejected' }))

    socket.on('buyInPending', ({ playerId, name, amount }) => {
      setPendingBuyIns(prev => [...prev, { playerId, name, amount }])
    })

    socket.on('betSubmitted', ({ amount }) => setBetStatus({ type: 'pending', amount }))

    socket.on('betAccepted', ({ chips, bet }) => {
      setChips(chips)
      setBetStatus({ type: 'accepted', bet })
    })

    socket.on('betRejected', () => setBetStatus({ type: 'rejected' }))

    socket.on('betPending', ({ playerId, name, amount }) => {
      setPendingBets(prev => [...prev, { playerId, name, amount }])
    })

    socket.on('newRound', () => {
      setGameState(null)
      setBetStatus(null)
      setPendingBets([])
      if (chipsRef.current === 0) setBuyInStatus(null)
    })

    socket.on('chat', ({ name, message }) => {
      setMessages(prev => [...prev, { name, message }])
    })

    socket.on('cheatEnabled', () => setCheatMode(true))
    socket.on('playerList', ({ players }) => setPlayerList(players))
    socket.on('ledgerUpdate', ({ ledger }) => setLedger(ledger))

    socket.on('kicked', () => {
      setScreen('lobby')
      setGameState(null)
      setRoomCode(null)
      setBetStatus(null)
      setBuyInStatus(null)
      setChips(0)
      alert('You were removed from the table by the dealer.')
    })

    return () => socket.removeAllListeners()
  }, [])

  const approveBuyIn = (playerId) => {
    socket.emit('approveBuyIn', { playerId })
    setPendingBuyIns(prev => prev.filter(b => b.playerId !== playerId))
  }

  const rejectBuyIn = (playerId) => {
    socket.emit('rejectBuyIn', { playerId })
    setPendingBuyIns(prev => prev.filter(b => b.playerId !== playerId))
  }

  const acceptBet = (playerId) => {
    socket.emit('acceptBet', { playerId })
    setPendingBets(prev => prev.filter(b => b.playerId !== playerId))
  }

  const rejectBet = (playerId) => {
    socket.emit('rejectBet', { playerId })
    setPendingBets(prev => prev.filter(b => b.playerId !== playerId))
  }

  if (screen === 'lobby') return <Lobby />

  return (
    <Game
      roomCode={roomCode}
      isDealer={isDealer}
      myId={myId}
      gameState={gameState}
      pendingBets={pendingBets}
      pendingBuyIns={pendingBuyIns}
      betStatus={betStatus}
      buyInStatus={buyInStatus}
      chips={chips}
      messages={messages}
      acceptBet={acceptBet}
      rejectBet={rejectBet}
      approveBuyIn={approveBuyIn}
      rejectBuyIn={rejectBuyIn}
      cheatMode={cheatMode}
      playerList={playerList}
      ledger={ledger}
    />
  )
}