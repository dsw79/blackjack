const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('client/dist'));

const rooms = {};

const SUITS = ['♠', '♥', '♦', '♣'];
const VALUES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

function createDeck() {
  let deck = [];
  for (let suit of SUITS) {
    for (let value of VALUES) {
      deck.push({ suit, value });
    }
  }
  return deck;
}

function shuffle(deck) {
  for (let i = deck.length - 1; i > 0; i--) {
    let j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function getHandValue(cards) {
  let total = 0;
  let aces = 0;
  for (let card of cards) {
    if (card.value === 'A') { aces++; total += 11; }
    else if (['J', 'Q', 'K'].includes(card.value)) { total += 10; }
    else { total += parseInt(card.value); }
  }
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return total;
}

function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function makeHand(bet) {
  return { cards: [], bet, result: null, gameOver: false };
}

function getNextTurn(room, currentId) {
  const currentPlayer = room.players.find(p => p.id === currentId);
  if (currentPlayer) {
    const nextHandIndex = currentPlayer.currentHandIndex + 1;
    if (nextHandIndex < currentPlayer.hands.length && !currentPlayer.hands[nextHandIndex].gameOver) {
      currentPlayer.currentHandIndex = nextHandIndex;
      return currentId;
    }
  }
  const activePlayers = room.players.filter(p => p.hands.some(h => !h.gameOver));
  const currentIndex = activePlayers.findIndex(p => p.id === currentId);
  return activePlayers[currentIndex + 1]?.id || null;
}

function buildGameState(room, hideDealer = false) {
  const dealerHand = hideDealer
    ? [room.dealerHand[0], { suit: '?', value: '?' }]
    : room.dealerHand;
  return {
    dealerHand,
    currentTurn: room.currentTurn,
    players: room.players.map(p => ({
      id: p.id,
      name: p.name,
      chips: p.chips,
      hands: p.hands,
      currentHandIndex: p.currentHandIndex,
      acceptedBet: p.acceptedBet,
    })),
  };
}

function emitPlayerList(room) {
  io.to(room.code).emit('playerList', {
    players: room.players.map(p => ({
      id: p.id,
      name: p.name,
      chips: p.chips,
      acceptedBet: p.acceptedBet || 0,
      status: p.status,
    }))
  });
}

function emitLedger(room) {
  io.to(room.code).emit('ledgerUpdate', { ledger: room.ledger });
}

function isNatural(cards) {
  return cards.length === 2 &&
    cards.some(c => c.value === 'A') &&
    cards.some(c => ['10', 'J', 'Q', 'K'].includes(c.value));
}

function resolveGame(room) {
  if (room.forcedOutcome === 'win') {
    const bustCard = room.deck.find(c => getHandValue([...room.dealerHand, c]) > 21);
    if (bustCard) {
      room.deck = room.deck.filter(c => c !== bustCard);
      room.dealerHand.push(bustCard);
    } else {
      room.dealerHand.push(room.deck.pop());
    }
    for (let player of room.players) {
      for (let hand of player.hands) {
        if (hand.result === 'bust') continue;
        player.chips = parseFloat((player.chips + hand.bet * 2).toFixed(2));
        hand.result = 'win';
      }
      player.acceptedBet = 0;
      if (room.ledger[player.id]) room.ledger[player.id].currentChips = player.chips;
    }
    room.forcedOutcome = null;
    room.currentTurn = null;
    return;
  }

  if (room.forcedOutcome === 'lose') {
    while (getHandValue(room.dealerHand) < 17) {
      room.dealerHand.push(room.deck.pop());
    }
    const playerTotals = room.players
      .flatMap(p => p.hands.filter(h => h.result !== 'bust').map(h => getHandValue(h.cards)))
      .filter(v => !isNaN(v) && v > 0);
    const highestPlayerTotal = playerTotals.length > 0 ? Math.max(...playerTotals) : 0;

    if (highestPlayerTotal > 0 && getHandValue(room.dealerHand) <= highestPlayerTotal) {
      const winCard = room.deck.find(c => {
        const val = getHandValue([...room.dealerHand, c]);
        return val > highestPlayerTotal && val <= 21;
      });
      if (winCard) {
        room.deck = room.deck.filter(c => c !== winCard);
        room.dealerHand.push(winCard);
      }
    }

    const dealerTotal = getHandValue(room.dealerHand);
    for (let player of room.players) {
      for (let hand of player.hands) {
        if (hand.result === 'bust') continue;
        const playerTotal = getHandValue(hand.cards);
        if (dealerTotal > 21 || playerTotal > dealerTotal) {
          player.chips = parseFloat((player.chips + hand.bet * 2).toFixed(2));
          hand.result = 'win';
        } else if (playerTotal === dealerTotal) {
          player.chips = parseFloat((player.chips + hand.bet).toFixed(2));
          hand.result = 'push';
        } else {
          hand.result = 'lose';
        }
      }
      player.acceptedBet = 0;
      if (room.ledger[player.id]) room.ledger[player.id].currentChips = player.chips;
    }
    room.forcedOutcome = null;
    room.currentTurn = null;
    return;
  }

  while (getHandValue(room.dealerHand) < 17) {
    room.dealerHand.push(room.deck.pop());
  }

  const dealerTotal = getHandValue(room.dealerHand);
  const dealerHasBlackjack = isNatural(room.dealerHand);

  for (let player of room.players) {
    for (let hand of player.hands) {
      if (hand.result === 'bust') continue;
      const playerTotal = getHandValue(hand.cards);
      const playerHasBlackjack = isNatural(hand.cards) && playerTotal === 21;

      if (playerHasBlackjack && dealerHasBlackjack) {
        player.chips = parseFloat((player.chips + hand.bet).toFixed(2));
        hand.result = 'push';
      } else if (dealerTotal > 21 || playerTotal > dealerTotal) {
        const payout = playerHasBlackjack ? hand.bet * 2.5 : hand.bet * 2;
        player.chips = parseFloat((player.chips + payout).toFixed(2));
        hand.result = 'win';
      } else if (playerTotal === dealerTotal) {
        player.chips = parseFloat((player.chips + hand.bet).toFixed(2));
        hand.result = 'push';
      } else {
        hand.result = 'lose';
      }
    }
    player.acceptedBet = 0;
    if (room.ledger[player.id]) room.ledger[player.id].currentChips = player.chips;
  }
  room.currentTurn = null;
}

io.on('connection', (socket) => {
  console.log('a user connected:', socket.id);

  socket.on('createRoom', ({ name }) => {
    const roomCode = generateRoomCode();
    rooms[roomCode] = {
      code: roomCode,
      dealer: { id: socket.id, name },
      players: [],
      deck: [],
      dealerHand: [],
      currentTurn: null,
      forcedNextCard: null,
      forcedOutcome: null,
      ledger: {},
    };
    socket.join(roomCode);
    socket.roomCode = roomCode;
    socket.emit('roomCreated', { roomCode });
    console.log(`${name} created room ${roomCode}`);
  });

  socket.on('joinRoom', ({ name, room }) => {
    const roomCode = room.toUpperCase();
    if (!rooms[roomCode]) {
      socket.emit('roomError', { message: 'Room not found!' });
      return;
    }
    rooms[roomCode].players.push({
      id: socket.id,
      name,
      chips: 0,
      hands: [],
      currentHandIndex: 0,
      pendingBet: 0,
      acceptedBet: 0,
      pendingBuyIn: 0,
      status: 'waitingBuyIn',
    });
    socket.join(roomCode);
    socket.roomCode = roomCode;
    socket.emit('roomJoined', { roomCode });
    emitPlayerList(rooms[roomCode]);
    console.log(`${name} joined room ${roomCode}`);
  });

  socket.on('requestBuyIn', ({ amount }) => {
    const room = rooms[socket.roomCode];
    if (!room) return;
    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;
    const parsed = parseFloat(parseFloat(amount).toFixed(2));
    if (!parsed || parsed <= 0) return;
    player.pendingBuyIn = parsed;
    player.status = 'waitingBuyIn';
    const dealerSocket = [...io.sockets.sockets.values()].find(s => s.id === room.dealer.id);
    if (dealerSocket) {
      dealerSocket.emit('buyInPending', { playerId: socket.id, name: player.name, amount: parsed });
    }
    socket.emit('buyInSubmitted', { amount: parsed });
    emitPlayerList(room);
  });

  socket.on('approveBuyIn', ({ playerId }) => {
    const room = rooms[socket.roomCode];
    if (!room || socket.id !== room.dealer.id) return;
    const player = room.players.find(p => p.id === playerId);
    if (!player) return;
    player.chips = parseFloat((player.chips + player.pendingBuyIn).toFixed(2));
    if (!room.ledger[playerId]) {
      room.ledger[playerId] = {
        name: player.name,
        totalBuyIn: 0,
        currentChips: 0,
        active: true,
      };
    }
    room.ledger[playerId].totalBuyIn = parseFloat((room.ledger[playerId].totalBuyIn + player.pendingBuyIn).toFixed(2));
    room.ledger[playerId].currentChips = player.chips;
    player.pendingBuyIn = 0;
    player.status = 'active';
    const playerSocket = [...io.sockets.sockets.values()].find(s => s.id === playerId);
    if (playerSocket) {
      playerSocket.emit('buyInApproved', { chips: player.chips });
    }
    emitPlayerList(room);
    emitLedger(room);
  });

  socket.on('rejectBuyIn', ({ playerId }) => {
    const room = rooms[socket.roomCode];
    if (!room || socket.id !== room.dealer.id) return;
    const player = room.players.find(p => p.id === playerId);
    if (!player) return;
    player.pendingBuyIn = 0;
    const playerSocket = [...io.sockets.sockets.values()].find(s => s.id === playerId);
    if (playerSocket) {
      playerSocket.emit('buyInRejected');
    }
  });

  socket.on('placeBet', ({ amount }) => {
    const room = rooms[socket.roomCode];
    if (!room) return;
    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;
    const parsed = parseFloat(parseFloat(amount).toFixed(2));
    if (!parsed || parsed <= 0) return;
    if (parsed > player.chips) {
      socket.emit('betError', { message: 'Not enough chips!' });
      return;
    }
    player.pendingBet = parsed;
    const dealerSocket = [...io.sockets.sockets.values()].find(s => s.id === room.dealer.id);
    if (dealerSocket) {
      dealerSocket.emit('betPending', { playerId: socket.id, name: player.name, amount: parsed });
    }
    socket.emit('betSubmitted', { amount: parsed });
  });

  socket.on('acceptBet', ({ playerId }) => {
    const room = rooms[socket.roomCode];
    if (!room || socket.id !== room.dealer.id) return;
    const player = room.players.find(p => p.id === playerId);
    if (!player) return;
    player.chips = parseFloat((player.chips - player.pendingBet).toFixed(2));
    player.hands = [makeHand(player.pendingBet)];
    player.acceptedBet = player.pendingBet;
    player.currentHandIndex = 0;
    player.pendingBet = 0;
    const playerSocket = [...io.sockets.sockets.values()].find(s => s.id === playerId);
    if (playerSocket) {
      playerSocket.emit('betAccepted', { chips: player.chips, bet: player.hands[0].bet });
    }
    emitPlayerList(room);
  });

  socket.on('rejectBet', ({ playerId }) => {
    const room = rooms[socket.roomCode];
    if (!room || socket.id !== room.dealer.id) return;
    const player = room.players.find(p => p.id === playerId);
    if (!player) return;
    player.pendingBet = 0;
    const playerSocket = [...io.sockets.sockets.values()].find(s => s.id === playerId);
    if (playerSocket) {
      playerSocket.emit('betRejected');
    }
  });

  socket.on('deal', () => {
    const room = rooms[socket.roomCode];
    if (!room || socket.id !== room.dealer.id) return;
    room.deck = shuffle(createDeck());
    room.dealerHand = [room.deck.pop(), room.deck.pop()];
    for (let player of room.players) {
      if (player.hands.length > 0 && player.hands[0].bet > 0) {
        player.hands[0].cards = [room.deck.pop(), room.deck.pop()];
        player.hands[0].gameOver = false;
        player.hands[0].result = null;
        player.currentHandIndex = 0;
      }
    }
    room.currentTurn = room.players.find(p => p.hands.length > 0 && p.hands[0].bet > 0)?.id || null;
    io.to(room.code).emit('gameState', buildGameState(room, true));
  });

  socket.on('hit', () => {
    const room = rooms[socket.roomCode];
    if (!room) return;
    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;
    const hand = player.hands[player.currentHandIndex];
    if (!hand || hand.gameOver) return;

    let nextCard;
    if (room.forcedNextCard === 'bust') {
      nextCard = room.deck.find(c => getHandValue([...hand.cards, c]) > 21);
      if (nextCard) room.deck = room.deck.filter(c => c !== nextCard);
      else nextCard = room.deck.pop();
      room.forcedNextCard = null;
      socket.emit('cheatUsed');
    } else if (room.forcedNextCard === 'good') {
      nextCard = room.deck.find(c => {
        const val = getHandValue([...hand.cards, c]);
        return val >= 18 && val <= 21;
      });
      if (nextCard) room.deck = room.deck.filter(c => c !== nextCard);
      else nextCard = room.deck.pop();
      room.forcedNextCard = null;
      socket.emit('cheatUsed');
    } else if (room.forcedOutcome === 'win') {
      nextCard = room.deck.find(c => getHandValue([...hand.cards, c]) <= 21);
      if (nextCard) room.deck = room.deck.filter(c => c !== nextCard);
      else nextCard = room.deck.pop();
    } else {
      nextCard = room.deck.pop();
    }
    hand.cards.push(nextCard);

    if (getHandValue(hand.cards) > 21 && room.forcedOutcome !== 'win') {
      hand.gameOver = true;
      hand.result = 'bust';
      room.currentTurn = getNextTurn(room, player.id);
    }

    const allDone = room.players.every(p => p.hands.every(h => h.gameOver));
    if (allDone) {
      resolveGame(room);
      io.to(room.code).emit('gameState', buildGameState(room, false));
      emitLedger(room);
    } else {
      io.to(room.code).emit('gameState', buildGameState(room, true));
    }
  });

  socket.on('stand', () => {
    const room = rooms[socket.roomCode];
    if (!room) return;
    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;
    const hand = player.hands[player.currentHandIndex];
    if (!hand || hand.gameOver) return;
    hand.gameOver = true;
    hand.result = 'stand';
    room.currentTurn = getNextTurn(room, player.id);
    const allDone = room.players.every(p => p.hands.every(h => h.gameOver));
    if (allDone) {
      resolveGame(room);
      io.to(room.code).emit('gameState', buildGameState(room, false));
      emitLedger(room);
    } else {
      io.to(room.code).emit('gameState', buildGameState(room, true));
    }
  });

  socket.on('doubleDown', () => {
    const room = rooms[socket.roomCode];
    if (!room) return;
    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;
    const hand = player.hands[player.currentHandIndex];
    if (!hand || hand.gameOver || hand.cards.length !== 2) return;
    if (player.chips < hand.bet) return;
    player.chips = parseFloat((player.chips - hand.bet).toFixed(2));
    hand.bet = parseFloat((hand.bet * 2).toFixed(2));
    hand.cards.push(room.deck.pop());
    hand.gameOver = true;
    hand.result = getHandValue(hand.cards) > 21 ? 'bust' : 'stand';
    room.currentTurn = getNextTurn(room, player.id);
    const allDone = room.players.every(p => p.hands.every(h => h.gameOver));
    if (allDone) {
      resolveGame(room);
      io.to(room.code).emit('gameState', buildGameState(room, false));
      emitLedger(room);
    } else {
      io.to(room.code).emit('gameState', buildGameState(room, true));
    }
  });

  socket.on('split', () => {
    const room = rooms[socket.roomCode];
    if (!room) return;
    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;
    const hand = player.hands[player.currentHandIndex];
    if (!hand || hand.gameOver || hand.cards.length !== 2) return;
    if (hand.cards[0].value !== hand.cards[1].value) return;
    if (player.chips < hand.bet) return;
    player.chips = parseFloat((player.chips - hand.bet).toFixed(2));
    const secondCard = hand.cards.pop();
    hand.cards.push(room.deck.pop());
    const newHand = makeHand(hand.bet);
    newHand.cards = [secondCard, room.deck.pop()];
    player.hands.splice(player.currentHandIndex + 1, 0, newHand);
    io.to(room.code).emit('gameState', buildGameState(room, true));
  });

  socket.on('newRound', () => {
    const room = rooms[socket.roomCode];
    if (!room || socket.id !== room.dealer.id) return;
    for (let player of room.players) {
      player.hands = [];
      player.currentHandIndex = 0;
      player.pendingBet = 0;
      player.acceptedBet = 0;
    }
    room.dealerHand = [];
    room.deck = [];
    room.currentTurn = null;
    room.forcedNextCard = null;
    room.forcedOutcome = null;
    io.to(room.code).emit('newRound');
    emitPlayerList(room);
    emitLedger(room);
  });

  socket.on('chat', ({ message }) => {
    const room = rooms[socket.roomCode];
    if (!room) return;
    const isDealer = room.dealer.id === socket.id;
    if (message.trim() === '/dealer123') {
      if (isDealer) socket.emit('cheatEnabled');
      return;
    }
    const player = room.players.find(p => p.id === socket.id);
    const name = isDealer ? room.dealer.name : player?.name || 'Unknown';
    io.to(room.code).emit('chat', { name, message });
  });

  socket.on('setCheat', ({ type }) => {
    const room = rooms[socket.roomCode];
    if (!room || socket.id !== room.dealer.id) return;
    room.forcedNextCard = type === 'bustNext' ? 'bust' : type === 'goodNext' ? 'good' : null;
    room.forcedOutcome = type === 'win' ? 'win' : type === 'lose' ? 'lose' : null;
    socket.emit('cheatSet', { type });
  });

  socket.on('kickPlayer', ({ playerId }) => {
    const room = rooms[socket.roomCode];
    if (!room || socket.id !== room.dealer.id) return;
    const player = room.players.find(p => p.id === playerId);
    if (!player) return;

    for (let hand of player.hands) {
      if (!hand.gameOver) {
        hand.gameOver = true;
        hand.result = 'lose';
      }
    }

    if (room.currentTurn === playerId) {
      room.currentTurn = getNextTurn(room, playerId);
    }

    room.players = room.players.filter(p => p.id !== playerId);

    const playerSocket = [...io.sockets.sockets.values()].find(s => s.id === playerId);
    if (playerSocket) {
      playerSocket.emit('kicked');
      playerSocket.leave(room.code);
    }

    const allDone = room.players.length === 0 || room.players.every(p => p.hands.every(h => h.gameOver));
    if (allDone && room.players.length > 0) {
      resolveGame(room);
      io.to(room.code).emit('gameState', buildGameState(room, false));
      emitLedger(room);
    } else if (room.players.length > 0) {
      io.to(room.code).emit('gameState', buildGameState(room, true));
    }

    emitPlayerList(room);
  });

  socket.on('disconnect', () => {
    console.log('user disconnected:', socket.id);
    const room = rooms[socket.roomCode];
    if (room && room.ledger[socket.id]) {
      room.ledger[socket.id].active = false;
      emitLedger(room);
    }
  });
});

server.listen(3000, () => {
  console.log('server running on http://localhost:3000');
});