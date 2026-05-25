const socket = io();

let myId = null;
let isDealer = false;
let roomCode = null;

socket.on('connect', () => {
  myId = socket.id;
});

function createRoom() {
  const name = document.getElementById('name-input').value.trim();
  if (!name) { alert('Enter your name first!'); return; }
  socket.emit('createRoom', { name });
}

function joinRoom() {
  const name = document.getElementById('name-input').value.trim();
  const room = document.getElementById('room-input').value.trim();
  if (!name || !room) { alert('Enter your name and room code!'); return; }
  socket.emit('joinRoom', { name, room });
}

socket.on('roomCreated', ({ roomCode: code }) => {
  roomCode = code;
  isDealer = true;
  document.getElementById('lobby').style.display = 'none';
  document.getElementById('game').style.display = 'flex';
  document.getElementById('room-code-corner').textContent = 'Room: ' + roomCode;
  document.getElementById('bet-area').style.display = 'none';
  document.getElementById('controls').innerHTML = `<button onclick="deal()">Deal</button>`;
});

socket.on('roomJoined', ({ roomCode: code }) => {
  roomCode = code;
  isDealer = false;
  document.getElementById('lobby').style.display = 'none';
  document.getElementById('game').style.display = 'flex';
  document.getElementById('room-code-corner').textContent = 'Room: ' + roomCode;
});

socket.on('playerJoined', ({ name }) => {
  console.log(name + ' joined the room');
});

function placeBet() {
  const input = document.getElementById('bet-input');
  const amount = parseInt(input.value);
  if (!amount || amount <= 0) return;
  input.value = '';
  socket.emit('placeBet', { amount });
}

socket.on('betSubmitted', ({ amount }) => {
  document.getElementById('bet-status').textContent = 'Waiting for dealer to accept your bet of ' + amount + '...';
});

socket.on('betAccepted', ({ chips, bet }) => {
  document.getElementById('chips-display').textContent = 'Chips: ' + chips;
  document.getElementById('bet-display').textContent = 'Bet: ' + bet;
  document.getElementById('bet-status').textContent = '✓ Bet accepted!';
});

socket.on('betRejected', () => {
  document.getElementById('bet-status').textContent = '✗ Bet rejected. Try again.';
});

socket.on('betPending', ({ playerId, name, amount }) => {
  const pendingDiv = document.getElementById('pending-bets');
  const row = document.createElement('div');
  row.classList.add('pending-bet-row');
  row.id = 'bet-' + playerId;
  row.innerHTML = `
    <span>${name} wants to bet ${amount}</span>
    <button class="accept-btn" onclick="acceptBet('${playerId}')">Accept</button>
    <button class="reject-btn" onclick="rejectBet('${playerId}')">Reject</button>
  `;
  pendingDiv.appendChild(row);
});

function acceptBet(playerId) {
  socket.emit('acceptBet', { playerId });
  document.getElementById('bet-' + playerId)?.remove();
}

function rejectBet(playerId) {
  socket.emit('rejectBet', { playerId });
  document.getElementById('bet-' + playerId)?.remove();
}

function deal() { socket.emit('deal'); }
function hit() { socket.emit('hit'); }
function stand() { socket.emit('stand'); }
function doubleDown() { socket.emit('doubleDown'); }
function split() { socket.emit('split'); }
function newRound() { socket.emit('newRound'); }

socket.on('newRound', () => {
  document.getElementById('dealer-hand').innerHTML = '';
  document.getElementById('dealer-score').textContent = '';
  document.getElementById('players-row').innerHTML = '';
  document.getElementById('pending-bets').innerHTML = '';
  document.getElementById('controls').innerHTML = '';
  document.getElementById('bet-status').textContent = '';
  document.getElementById('bet-display').textContent = 'Bet: 0';
  document.getElementById('turn-message').textContent = '';
  if (isDealer) {
    document.getElementById('controls').innerHTML = `<button onclick="deal()">Deal</button>`;
  }
});

function renderCard(card) {
  if (card.value === '?') {
    const cardDiv = document.createElement('div');
    cardDiv.classList.add('card', 'hidden-card');
    return cardDiv;
  }
  const isRed = card.suit === '♥' || card.suit === '♦';
  const cardDiv = document.createElement('div');
  cardDiv.classList.add('card');
  if (isRed) cardDiv.classList.add('red');
  cardDiv.innerHTML = `
    <span class="corner top">${card.value} ${card.suit}</span>
    <span class="suit-center">${card.suit}</span>
    <span class="corner bottom">${card.value} ${card.suit}</span>
  `;
  return cardDiv;
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

socket.on('gameState', (state) => {
  const dealerHandDiv = document.getElementById('dealer-hand');
  const dealerScoreEl = document.getElementById('dealer-score');
  const turnMsg = document.getElementById('turn-message');

  dealerHandDiv.innerHTML = '';
  for (let card of state.dealerHand) {
    dealerHandDiv.appendChild(renderCard(card));
  }
  const visibleCards = state.dealerHand.filter(c => c.value !== '?');
  if (visibleCards.length > 0) {
    dealerScoreEl.textContent = 'Dealer: ' + getHandValue(visibleCards);
  }

  if (state.currentTurn) {
    const currentPlayer = state.players.find(p => p.id === state.currentTurn);
    if (currentPlayer) {
      if (state.currentTurn === myId) {
        turnMsg.textContent = 'Your turn!';
        turnMsg.style.color = '#FFD700';
      } else {
        turnMsg.textContent = currentPlayer.name + "'s turn";
        turnMsg.style.color = 'rgba(255,255,255,0.6)';
      }
    }
  } else {
    turnMsg.textContent = '';
  }

  const playersRow = document.getElementById('players-row');
  playersRow.innerHTML = '';

  for (let player of state.players) {
    const isMe = player.id === myId;
    const isMyTurn = state.currentTurn === myId && isMe;

    const seat = document.createElement('div');
    seat.classList.add('player-seat');
    if (isMe) seat.classList.add('me');
    if (state.currentTurn === player.id) seat.classList.add('active-turn');

    const nameDiv = document.createElement('div');
    nameDiv.classList.add('player-name');
    nameDiv.textContent = player.name + (isMe ? ' (you)' : '');
    seat.appendChild(nameDiv);

    const chipsDiv = document.createElement('div');
    chipsDiv.classList.add('player-bet-info');
    chipsDiv.textContent = 'Chips: ' + player.chips;
    seat.appendChild(chipsDiv);

    const handsWrapper = document.createElement('div');
    handsWrapper.classList.add('hands-wrapper');

    for (let i = 0; i < player.hands.length; i++) {
      const hand = player.hands[i];
      const isActiveHand = i === player.currentHandIndex && !hand.gameOver;

      const handDiv = document.createElement('div');
      handDiv.classList.add('hand-block');
      if (isActiveHand && state.currentTurn === player.id) handDiv.classList.add('active-hand');

      const betDiv = document.createElement('div');
      betDiv.classList.add('player-bet-info');
      betDiv.textContent = 'Bet: ' + hand.bet;
      handDiv.appendChild(betDiv);

      const cardsDiv = document.createElement('div');
      cardsDiv.classList.add('player-cards');
      for (let card of hand.cards) {
        cardsDiv.appendChild(renderCard(card));
      }
      handDiv.appendChild(cardsDiv);

      const score = hand.cards.length > 0 ? getHandValue(hand.cards) : '';
      let resultText = score ? score : '';
      if (hand.result === 'bust') resultText = '💥 Bust';
      if (hand.result === 'win') resultText = '🎉 Win!';
      if (hand.result === 'lose') resultText = '😔 Lose';
      if (hand.result === 'push') resultText = '🤝 Push';
      if (hand.result === 'stand') resultText = '✋ ' + score;

      const resultDiv = document.createElement('div');
      resultDiv.classList.add('player-result');
      resultDiv.textContent = resultText;
      handDiv.appendChild(resultDiv);

      handsWrapper.appendChild(handDiv);
    }

    seat.appendChild(handsWrapper);
    playersRow.appendChild(seat);

    if (isMe && !isDealer) {
      document.getElementById('chips-display').textContent = 'Chips: ' + player.chips;

      if (isMyTurn && player.hands.length > 0) {
        const currentHand = player.hands[player.currentHandIndex];
        if (currentHand && !currentHand.gameOver) {
          const canDouble = currentHand.cards.length === 2 && player.chips >= currentHand.bet;
          const canSplit = currentHand.cards.length === 2 &&
            currentHand.cards[0].value === currentHand.cards[1].value &&
            player.chips >= currentHand.bet &&
            player.hands.length < 4;

          let btns = `<button onclick="hit()">Hit</button><button onclick="stand()">Stand</button>`;
          if (canDouble) btns += `<button onclick="doubleDown()">Double</button>`;
          if (canSplit) btns += `<button onclick="split()">Split</button>`;
          document.getElementById('controls').innerHTML = btns;
        }
      } else if (!isMyTurn) {
        const allMyHandsDone = player.hands.every(h => h.gameOver);
        if (allMyHandsDone && player.hands.length > 0) {
          document.getElementById('controls').innerHTML = '';
        }
      }
    }
  }

  if (isDealer) {
    const allDone = state.players.length > 0 &&
      state.players.every(p => p.hands.every(h => h.gameOver));
    if (allDone && state.players.some(p => p.hands.length > 0)) {
      document.getElementById('controls').innerHTML = `<button onclick="newRound()">New Round</button>`;
    }
  }
});

function sendChat() {
  const input = document.getElementById('chat-input');
  const message = input.value.trim();
  if (!message) return;
  socket.emit('chat', { message });
  input.value = '';
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') sendChat();
});

socket.on('chat', ({ name, message }) => {
  const messages = document.getElementById('chat-messages');
  const msg = document.createElement('div');
  msg.classList.add('chat-msg');
  msg.innerHTML = `<span>${name}:</span> ${message}`;
  messages.appendChild(msg);
  messages.scrollTop = messages.scrollHeight;
});