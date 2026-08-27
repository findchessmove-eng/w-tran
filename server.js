const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const words = require('./words');

// Fisher-Yates array shuffling algorithm for unbiased randomization
function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Helper to check if guess matches the answer (including singular/plural equivalents)
function areWordsEquivalent(w1, w2) {
  const s1 = w1.toLowerCase().trim();
  const s2 = w2.toLowerCase().trim();
  if (s1 === s2) return true;
  
  // Helper to check standard plural endings
  const checkPlural = (singular, plural) => {
    if (plural === singular + 's') return true;
    if (plural === singular + 'es') return true;
    if (singular.endsWith('y') && plural === singular.slice(0, -1) + 'ies') return true;
    if (singular.endsWith('f') && plural === singular.slice(0, -1) + 'ves') return true;
    if (singular.endsWith('fe') && plural === singular.slice(0, -2) + 'ves') return true;
    return false;
  };

  return checkPlural(s1, s2) || checkPlural(s2, s1);
}

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// Serve static assets from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Express routing for direct room URLs
app.get('/room/:code', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Global state for active rooms
const rooms = {};

// Helper to generate a unique 4-digit numeric room code (e.g. 4829)
function generateRoomCode() {
  let code;
  do {
    code = Math.floor(1000 + Math.random() * 9000).toString();
  } while (rooms[code]);
  return code;
}

// Helper to generate hint pattern for a word
function generateHint(word, level = 0) {
  // Let's use the first English synonym as the hint template
  const target = word.english[0].toLowerCase();
  let hint = '';
  
  if (level === 0) {
    // Level 0: Just underscores matching letters
    for (let char of target) {
      if (char === ' ') {
        hint += ' ';
      } else {
        hint += '_';
      }
    }
  } else if (level === 1) {
    // Level 1: Reveal first and last letter
    for (let i = 0; i < target.length; i++) {
      const char = target[i];
      if (char === ' ') {
        hint += ' ';
      } else if (i === 0 || i === target.length - 1) {
        hint += target[i].toUpperCase();
      } else {
        hint += '_';
      }
    }
  } else {
    // Level 2: Reveal first, last, and every 3rd letter
    for (let i = 0; i < target.length; i++) {
      const char = target[i];
      if (char === ' ') {
        hint += ' ';
      } else if (i === 0 || i === target.length - 1 || i % 3 === 0) {
        hint += target[i].toUpperCase();
      } else {
        hint += '_';
      }
    }
  }
  
  // Format hint with spaces for display (e.g. "A _ _ L E")
  return hint.split('').join(' ');
}

// Generate authentic Classic 75-Ball Bingo Card (B:1-15, I:16-30, N:31-45 with FREE, G:46-60, O:61-75)
function generate75BallCard() {
  function getSample(min, max, count) {
    const pool = [];
    for (let i = min; i <= max; i++) pool.push(i);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, count);
  }

  const bCol = getSample(1, 15, 5);
  const iCol = getSample(16, 30, 5);
  const nCol = getSample(31, 45, 4); // Middle is FREE space
  const gCol = getSample(46, 60, 5);
  const oCol = getSample(61, 75, 5);

  const card = [];
  for (let row = 0; row < 5; row++) {
    card.push(bCol[row]);
    card.push(iCol[row]);
    if (row === 2) {
      card.push('FREE');
    } else {
      card.push(nCol[row > 2 ? row - 1 : row]);
    }
    card.push(gCol[row]);
    card.push(oCol[row]);
  }
  return card;
}

// Helper to get formatted 75-Ball label (e.g. B-7, I-22, N-38, G-54, O-69)
function get75BallLabel(num) {
  if (num === 'FREE' || num === 'free') return 'FREE ⭐';
  const n = parseInt(num);
  if (n <= 15) return `B-${n}`;
  if (n <= 30) return `I-${n}`;
  if (n <= 45) return `N-${n}`;
  if (n <= 60) return `G-${n}`;
  return `O-${n}`;
}

// Helper to calculate completed lines on a 5x5 Bingo board (flat 25-array with FREE center space)
function checkBingoLines(board, calledNumbers) {
  if (!board || !Array.isArray(board) || board.length !== 25) return 0;
  
  let lines = 0;
  const calledSet = new Set([...calledNumbers, 'FREE', 'free']);
  const checkIndices = (indices) => indices.every(idx => calledSet.has(board[idx]) || board[idx] === 'FREE');

  // Check 5 rows
  for (let r = 0; r < 5; r++) {
    const rowIndices = [r*5, r*5+1, r*5+2, r*5+3, r*5+4];
    if (checkIndices(rowIndices)) lines++;
  }
  // Check 5 columns
  for (let c = 0; c < 5; c++) {
    const colIndices = [c, c+5, c+10, c+15, c+20];
    if (checkIndices(colIndices)) lines++;
  }
  // Check Diagonal 1
  const diag1Indices = [0, 6, 12, 18, 24];
  if (checkIndices(diag1Indices)) lines++;
  // Check Diagonal 2
  const diag2Indices = [4, 8, 12, 16, 20];
  if (checkIndices(diag2Indices)) lines++;

  return lines;
}

// Function to start the turn timer for Bingo
function startBingoTurnTimer(roomCode) {
  const room = rooms[roomCode];
  if (!room || room.gameType !== 'bingo' || room.gameState !== 'playing') return;

  if (room.timer) {
    clearInterval(room.timer);
    room.timer = null;
  }

  // If timer is disabled (0), no countdown needed
  if (!room.bingoTurnTimerVal || room.bingoTurnTimerVal <= 0) {
    room.timeLeft = 0;
    return;
  }

  room.timeLeft = room.bingoTurnTimerVal;

  room.timer = setInterval(() => {
    const r = rooms[roomCode];
    if (!r || r.gameState !== 'playing') {
      if (r && r.timer) {
        clearInterval(r.timer);
        r.timer = null;
      }
      return;
    }

    r.timeLeft -= 1;
    io.to(roomCode).emit('timer_tick', { timeLeft: r.timeLeft });

    if (r.timeLeft <= 0) {
      clearInterval(r.timer);
      r.timer = null;

      // Draw a random uncalled number (1 to 75)
      const allNumbers = [];
      for (let i = 1; i <= 75; i++) {
        if (!r.calledNumbers.includes(i)) allNumbers.push(i);
      }

      if (allNumbers.length > 0) {
        const timeoutNum = allNumbers[Math.floor(Math.random() * allNumbers.length)];
        const currentTurnPlayer = r.players[r.currentTurnPlayerId];
        const turnName = currentTurnPlayer ? currentTurnPlayer.username : 'Player';
        io.to(roomCode).emit('chat_message', {
          sender: 'System',
          message: `⏰ ${turnName} ran out of time! Number ${timeoutNum} was randomly called.`,
          system: true
        });
        processCalledNumber(roomCode, timeoutNum);
      }
    }
  }, 1000);
}

// Function to send updated room state to all clients in the room
function broadcastRoomUpdate(roomCode) {
  const room = rooms[roomCode];
  if (!room) return;

  const playersList = Object.values(room.players).map(p => ({
    id: p.id,
    username: p.username,
    avatar: p.avatar || '🐱',
    score: p.score,
    roundScore: p.roundScore,
    hasGuessed: p.hasGuessed,
    votedShowAnswer: p.votedShowAnswer,
    lives: p.lives,
    isReady: p.isReady,
    completedLines: p.completedLines || 0,
    matchWins: p.matchWins || 0
  }));

  // Sort players by score/wins
  if (room.gameType === 'bingo') {
    playersList.sort((a, b) => {
      if (b.matchWins !== a.matchWins) return b.matchWins - a.matchWins;
      return b.completedLines - a.completedLines;
    });
  } else {
    playersList.sort((a, b) => b.score - a.score);
  }

  // Compute how many show answer votes we have (relevant for translate mode)
  const totalPlayers = Object.keys(room.players).length;
  const showAnswerVotes = Object.values(room.players).filter(p => p.votedShowAnswer).length;

  const basePayload = {
    code: roomCode,
    gameState: room.gameState,
    gameType: room.gameType || 'translate',
    hostId: room.hostId,
    players: playersList,
    totalPlayers,
    currentTurnPlayerId: room.currentTurnPlayerId,
    timeLeft: room.timeLeft,
    
    // Shabd Anuvad Specific
    round: room.round,
    totalRounds: room.totalRounds,
    showAnswerVotes,
    hintsRevealed: room.hintsRevealed,
    hintState: room.hintState,
    currentHindiWord: (room.gameState === 'playing' && room.currentWord) ? room.currentWord.hindi : null,
    gameMode: room.gameMode,
    
    // Bingo Specific
    calledNumbers: room.calledNumbers || [],
    bingoTurnTimerVal: room.bingoTurnTimerVal || 0
  };

  Object.keys(room.players).forEach(socketId => {
    const p = room.players[socketId];
    io.to(socketId).emit('room_update', {
      ...basePayload,
      myBingoBoard: p.bingoBoard || null
    });
  });
}

// Process a called bingo number, update player score/lines, check win condition, and rotate turns
function processCalledNumber(roomCode, number) {
  const room = rooms[roomCode];
  if (!room) return;

  // Stop current turn timer
  if (room.timer) {
    clearInterval(room.timer);
    room.timer = null;
  }

  if (!room.calledNumbers.includes(number)) {
    room.calledNumbers.push(number);
  }

  // Notify clients about the called number
  io.to(roomCode).emit('bingo_number_called', {
    number: number,
    calledNumbers: room.calledNumbers
  });

  // Recalculate completed lines and winning status for all players (Classic 5 lines to win)
  const winners = [];
  Object.values(room.players).forEach(p => {
    p.completedLines = checkBingoLines(p.bingoBoard, room.calledNumbers);
    p.score = p.completedLines;

    if (p.completedLines >= 5) {
      winners.push(p);
    }
  });

  if (winners.length > 0) {
    // Increment match wins for all winners in this game round
    winners.forEach(w => {
      w.matchWins = (w.matchWins || 0) + 1;
    });

    // Check if the overall match is completed
    const targetWins = Math.ceil((room.totalRounds || 5) / 2);
    const matchOver = Object.values(room.players).some(p => (p.matchWins || 0) >= targetWins) || (room.round >= room.totalRounds);

    if (matchOver) {
      room.gameState = 'game_over';

      // Leaderboard shows total matchWins
      const finalScores = Object.values(room.players).map(p => ({
        username: p.username,
        avatar: p.avatar || '🐱',
        score: p.matchWins || 0
      })).sort((a, b) => b.score - a.score);

      const matchWinner = finalScores[0];
      const winnerMsg = `${matchWinner.username} won the match with ${matchWinner.score} round wins! 🏆`;

      io.to(roomCode).emit('game_over', { finalScores, message: winnerMsg });
      broadcastRoomUpdate(roomCode);
      return;
    } else {
      // Current round ends, but match is NOT over!
      room.gameState = 'round_end';

      io.to(roomCode).emit('bingo_round_ended', {
        roundWinners: winners.map(w => ({
          username: w.username,
          avatar: w.avatar || '🐱',
          completedLines: w.completedLines,
          matchWins: w.matchWins
        })),
        standings: Object.values(room.players).map(p => ({
          username: p.username,
          avatar: p.avatar || '🐱',
          matchWins: p.matchWins || 0,
          completedLines: p.completedLines || 0
        })).sort((a, b) => b.matchWins - a.matchWins),
        round: room.round,
        totalRounds: room.totalRounds
      });

      // Prepare for the next round
      room.round += 1;

      // Start next board placement setup in 5 seconds
      setTimeout(() => {
        if (!rooms[roomCode]) return;
        room.gameState = 'placement';
        
        // Generate new bomb numbers for the new round
        if (room.bingoMode === 'chaos') {
          const pool = Array.from({ length: 25 }, (_, i) => i + 1);
          for (let i = pool.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [pool[i], pool[j]] = [pool[j], pool[i]];
          }
          room.bombNumbers = pool.slice(0, 3);
        }
        if (room.bingoMode === 'duocall') {
          room.duoCallCount = 0;
        }

        Object.values(room.players).forEach(p => {
          p.isReady = false;
          p.bingoBoard = null;
          p.completedLines = 0;
          p.score = 0;
        });
        io.to(roomCode).emit('bingo_start_placement');
        broadcastRoomUpdate(roomCode);
      }, 5000);

      broadcastRoomUpdate(roomCode);
      return;
    }
  }

  // Handle turn rotation based on Game Mode
  if (room.bingoMode === 'duocall') {
    room.duoCallCount = (room.duoCallCount || 0) + 1;
    if (room.duoCallCount < 2) {
      // Keep turn on the same active player for their second call
      startBingoTurnTimer(roomCode);
      broadcastRoomUpdate(roomCode);
      return;
    }
    // Turn completed after 2 calls, reset counter
    room.duoCallCount = 0;
  }

  // Rotate turn to next player
  room.turnIndex = (room.turnIndex + 1) % room.turnOrder.length;
  room.currentTurnPlayerId = room.turnOrder[room.turnIndex];

  // Resume turn timer
  startBingoTurnTimer(roomCode);

  broadcastRoomUpdate(roomCode);
}

// Function to end the current round
function endRound(roomCode, consensusReached = false) {
  const room = rooms[roomCode];
  if (!room) return;

  if (room.timer) {
    clearInterval(room.timer);
    room.timer = null;
  }

  room.gameState = 'round_end';
  
  // Reset votedShowAnswer for the next round
  Object.values(room.players).forEach(p => {
    p.votedShowAnswer = false;
  });

  // Survival Mode: Decrement life if active player failed to guess
  let activePlayerFailed = false;
  if (room.gameMode === 'survival' && room.currentTurnPlayerId) {
    const activePlayer = room.players[room.currentTurnPlayerId];
    if (activePlayer && !activePlayer.hasGuessed) {
      activePlayer.lives -= 1;
      activePlayerFailed = true;
      io.to(roomCode).emit('chat_message', {
        sender: 'System',
        message: `${activePlayer.username} failed the translation and lost a life! ❤️ Remaining: ${activePlayer.lives}`,
        system: true
      });
    }
    // Shift turn index to next player for subsequent round
    room.turnIndex += 1;
  }

  const correctAnswers = room.currentWord.english.map(w => w.toUpperCase()).join(', ');
  
  // Collect players who scored this round
  const roundScorers = Object.values(room.players)
    .filter(p => p.hasGuessed)
    .map(p => ({
      username: p.username,
      avatar: p.avatar || 'cyber_ninja',
      roundScore: p.roundScore || 0,
      score: p.score
    }))
    .sort((a, b) => b.roundScore - a.roundScore);

  const standings = Object.values(room.players).map(p => ({
    username: p.username,
    avatar: p.avatar || 'cyber_ninja',
    score: p.score,
    lives: p.lives
  })).sort((a, b) => b.score - a.score);

  io.to(roomCode).emit('round_ended', {
    round: room.round,
    totalRounds: room.totalRounds,
    hindiWord: room.currentWord ? room.currentWord.hindi : '',
    correctAnswer: correctAnswers,
    consensus: consensusReached,
    reason: consensusReached ? 'consensus' : (room.timeLeft <= 0 ? 'timeout' : 'all_guessed'),
    exploded: activePlayerFailed,
    roundScorers: roundScorers,
    standings: standings
  });

  broadcastRoomUpdate(roomCode);

  // Wait before starting the next round (1 second for survival mode, 4.5 seconds for classic)
  const transitionDelay = room.gameMode === 'survival' ? 1000 : 4500;
  setTimeout(() => {
    if (!rooms[roomCode]) return; // Room might have been closed

    // In survival mode, check if all players have 0 lives
    if (room.gameMode === 'survival') {
      const activePlayers = Object.values(room.players).filter(p => p.lives > 0);
      if (activePlayers.length === 0) {
        // Force early Game Over
        room.gameState = 'game_over';
        const finalScores = Object.values(room.players).map(p => ({
          username: p.username,
          avatar: p.avatar || '🐱',
          score: p.score
        })).sort((a, b) => b.score - a.score);

        io.to(roomCode).emit('game_over', { finalScores, message: "All players have been eliminated!" });
        broadcastRoomUpdate(roomCode);
        return;
      }
    }

    if (room.gameMode === 'survival') {
      const activePlayers = Object.values(room.players).filter(p => p.lives > 0);
      const totalPlayers = Object.keys(room.players).length;
      const isGameOver = (totalPlayers > 1) ? (activePlayers.length <= 1) : (activePlayers.length === 0);
      
      if (isGameOver) {
        room.gameState = 'game_over';
        const finalScores = Object.values(room.players).map(p => ({
          username: p.username,
          avatar: p.avatar || '🐱',
          score: p.score
        })).sort((a, b) => b.score - a.score);

        const winnerMsg = activePlayers.length === 1 ? `Winner is ${activePlayers[0].username}! 🏆` : "Game Over!";
        io.to(roomCode).emit('game_over', { finalScores, message: winnerMsg });
        broadcastRoomUpdate(roomCode);
        return;
      }
      
      startNextRound(roomCode);
      return;
    }

    if (room.round >= room.totalRounds) {
      // Game Over (Classic Mode)
      room.gameState = 'game_over';
      const finalScores = Object.values(room.players).map(p => ({
        username: p.username,
        avatar: p.avatar || '🐱',
        score: p.score
      })).sort((a, b) => b.score - a.score);

      io.to(roomCode).emit('game_over', { finalScores });
      broadcastRoomUpdate(roomCode);
    } else {
      // Start next round (Classic Mode)
      startNextRound(roomCode);
    }
  }, transitionDelay);
}

// Function to start a new round
function startNextRound(roomCode) {
  const room = rooms[roomCode];
  if (!room) return;

  room.round += 1;
  room.gameState = 'playing';
  room.timeLeft = room.roundTime || 40;
  room.hintsRevealed = 0;

  // In Survival Mode, select the next player whose turn it is
  if (room.gameMode === 'survival') {
    const activePlayers = Object.values(room.players).filter(p => p.lives > 0);
    if (activePlayers.length === 0) {
      // Game Over immediately
      room.gameState = 'game_over';
      const finalScores = Object.values(room.players).map(p => ({
        username: p.username,
        score: p.score
      })).sort((a, b) => b.score - a.score);
      io.to(roomCode).emit('game_over', { finalScores, message: "All players have been eliminated!" });
      broadcastRoomUpdate(roomCode);
      return;
    }

    // Search turnOrder from current turnIndex for the next player with lives left
    let foundTurn = false;
    for (let i = 0; i < room.turnOrder.length; i++) {
      const checkIndex = (room.turnIndex + i) % room.turnOrder.length;
      const testPlayerId = room.turnOrder[checkIndex];
      const testPlayer = room.players[testPlayerId];

      if (testPlayer && testPlayer.lives > 0) {
        room.turnIndex = checkIndex;
        room.currentTurnPlayerId = testPlayerId;
        foundTurn = true;
        break;
      }
    }

    if (!foundTurn) {
      // Fallback: assign first living player
      room.currentTurnPlayerId = activePlayers[0].id;
    }
  }

  // Pick a random word from selected list
  const wordIndex = (room.round - 1) % room.roundWords.length;
  room.currentWord = room.roundWords[wordIndex];
  room.hintState = generateHint(room.currentWord, 0);

  // Reset player guess states for the round
  Object.values(room.players).forEach(p => {
    p.hasGuessed = false;
    p.roundScore = 0;
    p.votedShowAnswer = false;
  });

  io.to(roomCode).emit('round_started', {
    round: room.round,
    totalRounds: room.totalRounds,
    hindiWord: room.currentWord.hindi,
    hintState: room.hintState,
    timeLeft: room.timeLeft,
    roundTime: room.roundTime || 40,
    gameMode: room.gameMode,
    currentTurnPlayerId: room.currentTurnPlayerId
  });

  broadcastRoomUpdate(roomCode);

  // Start round timer countdown
  room.timer = setInterval(() => {
    room.timeLeft -= 1;

    // Calculate hint times dynamically (60% and 30% of total round time)
    const hint1Time = Math.floor(room.roundTime * 0.6);
    const hint2Time = Math.floor(room.roundTime * 0.3);

    // Check for auto-hints
    if (room.timeLeft === hint1Time && room.hintsRevealed === 0) {
      room.hintsRevealed = 1;
      room.hintState = generateHint(room.currentWord, 1);
      io.to(roomCode).emit('hint_update', {
        hintsRevealed: room.hintsRevealed,
        hintState: room.hintState,
        message: "Hint Revealed! First and last letters visible."
      });
    }

    if (room.timeLeft === hint2Time && room.hintsRevealed === 1) {
      room.hintsRevealed = 2;
      room.hintState = generateHint(room.currentWord, 2);
      io.to(roomCode).emit('hint_update', {
        hintsRevealed: room.hintsRevealed,
        hintState: room.hintState,
        message: "Final Hint Revealed! Extra letters visible."
      });
    }

    // Check for timeout
    if (room.timeLeft <= 0) {
      endRound(roomCode);
    } else {
      io.to(roomCode).emit('timer_tick', { timeLeft: room.timeLeft });
    }
  }, 1000);
}

// Socket communication
io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);

  // 1. Create Room
  socket.on('create_room', ({ username, gameType, avatar }) => {
    if (!username || username.trim() === '') {
      return socket.emit('error_message', 'Invalid username.');
    }

    const roomCode = generateRoomCode();
    
    // Choose 10 random words from words pool for the translate game
    const shuffledWords = [...words].sort(() => 0.5 - Math.random());
    const selectedWords = shuffledWords.slice(0, 10);
    let typeOfGame = 'translate';
    if (gameType === 'bingo' || gameType === 'bingo25') {
      typeOfGame = 'bingo25';
    } else if (gameType === 'bingo75') {
      typeOfGame = 'bingo75';
    }

    rooms[roomCode] = {
      id: roomCode,
      hostId: socket.id,
      players: {},
      gameState: 'lobby',
      gameType: typeOfGame,
      
      // Translate Game Configuration
      round: 0,
      totalRounds: 10,
      roundWords: selectedWords,
      currentWord: null,
      timer: null,
      timeLeft: 40,
      roundTime: 40,
      hintsRevealed: 0,
      hintState: '',
      gameMode: 'classic',
      // Used words memory to prevent repetition
      usedWords: [],
      
      // Bingo Game Configuration
      calledNumbers: [],
      bingoTurnTimerVal: 30, // Default turn time (30s)
      
      // Shared Connection/Turn details
      turnOrder: [],
      turnIndex: 0,
      currentTurnPlayerId: null
    };

    // Add creator as player
    rooms[roomCode].players[socket.id] = {
      id: socket.id,
      username: username.trim(),
      avatar: avatar || '🐱',
      score: 0,
      roundScore: 0,
      hasGuessed: false,
      votedShowAnswer: false,
      lives: 3,
      // Bingo specific fields
      isReady: false,
      bingoBoard: null,
      completedLines: 0,
      matchWins: 0,
      isSpectator: false
    };

    socket.join(roomCode);
    console.log(`Room created: ${roomCode} by ${username} [Game: ${typeOfGame}, Avatar: ${avatar || '🐱'}]`);
    
    broadcastRoomUpdate(roomCode);
  });

  // 2. Join Room
  socket.on('join_room', ({ code, username, avatar }) => {
    if (!code || !username) {
      return socket.emit('error_message', 'Code and Username are required.');
    }

    const roomCode = code.toUpperCase().trim();
    const room = rooms[roomCode];

    if (!room) {
      return socket.emit('error_message', 'Room not found.');
    }

    // Check if username is already taken in this room
    const isNameTaken = Object.values(room.players).some(
      p => p.username.toLowerCase() === username.toLowerCase().trim()
    );
    if (isNameTaken) {
      return socket.emit('error_message', 'Username is already taken in this room.');
    }

    // Join room
    const isSpectator = room.gameState !== 'lobby' && room.gameState !== 'placement' && room.gameType === 'bingo';
    room.players[socket.id] = {
      id: socket.id,
      username: username.trim(),
      avatar: avatar || '🐱',
      score: 0,
      roundScore: 0,
      hasGuessed: false,
      votedShowAnswer: false,
      lives: 3,
      // Bingo specific fields
      isReady: false,
      bingoBoard: null,
      completedLines: 0,
      matchWins: 0,
      isSpectator: isSpectator
    };

    // If mid-game join in Translate Survival mode, add to turnOrder
    if (room.gameState !== 'lobby' && room.gameType === 'translate' && room.gameMode === 'survival' && room.turnOrder) {
      room.turnOrder.push(socket.id);
    }

    socket.join(roomCode);
    console.log(`Player ${username} joined Room ${roomCode}`);

    // Notify room chat
    io.to(roomCode).emit('chat_message', {
      sender: 'System',
      message: `${username.trim()} joined the room!`,
      system: true
    });

    broadcastRoomUpdate(roomCode);
  });

  // 3. Start Game
  socket.on('start_game', (data) => {
    const code = data.code;
    if (!code) return socket.emit('error_message', 'Room code is missing.');

    const roomCode = code.toUpperCase().trim();
    const room = rooms[roomCode];

    if (!room) return socket.emit('error_message', 'Room not found.');
    if (room.hostId !== socket.id) return socket.emit('error_message', 'Only the host can start the game.');
    if (Object.keys(room.players).length < 1) return socket.emit('error_message', 'Not enough players.');

    if (room.gameType === 'bingo75') {
      room.bingoTurnTimerVal = parseInt(data.bingoTurnTimer) || 0;
      const bRounds = parseInt(data.bingoMatchRounds) || 5;
      room.totalRounds = Math.min(Math.max(bRounds, 1), 21);
      room.round = 1;
      room.calledNumbers = [];
      room.gameState = 'playing';
      
      // Automatically generate authentic 75-ball cards for everyone
      const playerIds = Object.keys(room.players);
      playerIds.forEach(id => {
        const p = room.players[id];
        p.bingoBoard = generate75BallCard();
        p.isReady = true;
        p.completedLines = 0;
        p.score = 0;
        p.matchWins = 0;
        p.isSpectator = false;
        io.to(id).emit('bingo_card_assigned', { board: p.bingoBoard });
      });

      room.turnOrder = [...playerIds];
      room.turnIndex = 0;
      room.currentTurnPlayerId = room.turnOrder[0];

      io.to(roomCode).emit('bingo_game_started', {
        currentTurnPlayerId: room.currentTurnPlayerId
      });

      const firstPlayer = room.players[room.currentTurnPlayerId];
      io.to(roomCode).emit('chat_message', {
        sender: 'System',
        message: `🎯 Classic 75-Ball Bingo started! Everyone received their 75-ball card. It's ${firstPlayer ? firstPlayer.username : 'Player'}'s turn to call first!`,
        system: true
      });

      broadcastRoomUpdate(roomCode);

      if (room.bingoTurnTimerVal > 0) {
        startBingoTurnTimer(roomCode);
      }
      return;
    }

    if (room.gameType === 'bingo' || room.gameType === 'bingo25') {
      room.bingoTurnTimerVal = parseInt(data.bingoTurnTimer) || 0;
      const bRounds = parseInt(data.bingoMatchRounds) || 5;
      room.totalRounds = Math.min(Math.max(bRounds, 1), 21);
      room.round = 1;
      room.calledNumbers = [];
      room.gameState = 'placement';
      
      // Reset players states for Bingo 1-25 Board Placement phase
      Object.values(room.players).forEach(p => {
        p.isReady = false;
        p.bingoBoard = null;
        p.completedLines = 0;
        p.score = 0;
        p.matchWins = 0;
        p.isSpectator = false;
      });

      io.to(roomCode).emit('bingo_start_placement');
      broadcastRoomUpdate(roomCode);
      return;
    }

    // Classic/Survival translate game setup
    const roundTime = data.roundTime || 40;
    const totalRounds = data.totalRounds || 10;
    const gameMode = data.gameMode || 'classic';

    room.roundTime = parseInt(roundTime) || 40;
    room.gameMode = gameMode || 'classic';

    const roundsCount = parseInt(totalRounds) || 10;
    room.totalRounds = Math.min(Math.max(roundsCount, 3), 250); // enforce min 3, max 250 rounds

    // Reset scores and states for fresh match
    Object.values(room.players).forEach(p => {
      p.score = 0;
      p.roundScore = 0;
      p.hasGuessed = false;
      p.votedShowAnswer = false;
      p.lives = 3;
      p.isSpectator = false;
    });

    // Filter words pool to exclude used words in this session
    room.usedWords = room.usedWords || [];
    let wordsPool = words.filter(w => !room.usedWords.includes(w.hindi));

    // Safeguard: if pool is exhausted or too small, reset it
    const minNeeded = room.gameMode === 'survival' ? 50 : room.totalRounds;
    if (wordsPool.length < minNeeded) {
      room.usedWords = [];
      wordsPool = [...words];
    }

    const shuffledWords = shuffleArray(wordsPool);
    if (room.gameMode === 'survival') {
      room.roundWords = shuffledWords;
    } else {
      room.roundWords = shuffledWords.slice(0, room.totalRounds);
    }

    // Add selected words to usedWords tracking so they don't repeat in the next match
    room.roundWords.forEach(w => {
      if (!room.usedWords.includes(w.hindi)) {
        room.usedWords.push(w.hindi);
      }
    });

    if (room.gameMode === 'survival') {
      Object.values(room.players).forEach(p => {
        p.score = 0;
        p.lives = 3;
      });
      room.turnOrder = Object.keys(room.players).sort(() => 0.5 - Math.random());
      room.turnIndex = 0;
      room.currentTurnPlayerId = room.turnOrder[0];
    }

    room.round = 0;
    io.to(roomCode).emit('game_started');
    startNextRound(roomCode);
  });

  // Return to Lobby (Host only)
  socket.on('return_to_lobby', ({ code }) => {
    const roomCode = (code || '').toUpperCase().trim();
    const room = rooms[roomCode];
    if (!room) return socket.emit('error_message', 'Room not found.');
    if (room.hostId !== socket.id) return socket.emit('error_message', 'Only the host can return to lobby.');

    if (room.timer) {
      clearInterval(room.timer);
      room.timer = null;
    }

    room.gameState = 'lobby';
    room.round = 0;
    room.calledNumbers = [];
    
    // Reset all player match scores & states
    Object.values(room.players).forEach(p => {
      p.score = 0;
      p.roundScore = 0;
      p.hasGuessed = false;
      p.votedShowAnswer = false;
      p.lives = 3;
      p.isReady = false;
      p.bingoBoard = null;
      p.completedLines = 0;
      p.matchWins = 0;
      p.isSpectator = false;
    });

    io.to(roomCode).emit('chat_message', {
      sender: 'System',
      message: 'Host returned everyone to the Lobby.',
      system: true
    });

    broadcastRoomUpdate(roomCode);
  });

  // Bingo: Submit Board
  socket.on('submit_bingo_board', ({ code, board }) => {
    const roomCode = code.toUpperCase().trim();
    const room = rooms[roomCode];
    if (!room || room.gameState !== 'placement') return;

    const player = room.players[socket.id];
    if (!player) return;

    // Validate board
    if (!Array.isArray(board) || board.length !== 25) {
      return socket.emit('error_message', 'Invalid board structure.');
    }

    const uniqueNumbers = new Set(board);
    const isValid = board.every(n => typeof n === 'number' && n >= 1 && n <= 25) && uniqueNumbers.size === 25;
    if (!isValid) {
      return socket.emit('error_message', 'Board must contain unique numbers from 1 to 25.');
    }

    player.bingoBoard = board;
    player.isReady = true;

    socket.emit('bingo_board_accepted');
    
    io.to(roomCode).emit('chat_message', {
      sender: 'System',
      message: `${player.username} is ready!`,
      system: true
    });

    // Check if everyone is ready
    const allPlayersReady = Object.values(room.players).every(p => p.isReady);
    if (allPlayersReady) {
      room.gameState = 'playing';
      room.calledNumbers = [];
      
      if (room.bingoMode === 'real_life') {
        room.currentTurnPlayerId = null;
        
        io.to(roomCode).emit('bingo_game_started', {
          currentTurnPlayerId: null
        });

        io.to(roomCode).emit('chat_message', {
          sender: 'System',
          message: `Game started! Real Life Auto-Caller 🎙️ is preparing to draw numbers.`,
          system: true
        });

        startBingoAutoCaller(roomCode);
      } else {
        if (room.bingoMode === 'duocall') {
          room.duoCallCount = 0;
        }
        room.turnOrder = Object.keys(room.players).sort(() => 0.5 - Math.random());
        room.turnIndex = 0;
        room.currentTurnPlayerId = room.turnOrder[0];

        io.to(roomCode).emit('bingo_game_started', {
          currentTurnPlayerId: room.currentTurnPlayerId
        });

        io.to(roomCode).emit('chat_message', {
          sender: 'System',
          message: `Game started! It is ${room.players[room.currentTurnPlayerId].username}'s turn to call first.`,
          system: true
        });

        startBingoTurnTimer(roomCode);
      }
    }

    broadcastRoomUpdate(roomCode);
  });

  // Bingo: Call Number (supports 1-25 for Bingo 1-25 and 1-75 for 75-Ball Bingo)
  socket.on('call_bingo_number', ({ code, number }) => {
    const roomCode = code.toUpperCase().trim();
    const room = rooms[roomCode];
    if (!room || (room.gameType !== 'bingo' && room.gameType !== 'bingo25' && room.gameType !== 'bingo75') || room.gameState !== 'playing') return;

    if (room.currentTurnPlayerId !== socket.id) {
      return socket.emit('error_message', 'It is not your turn to call a number!');
    }

    const num = parseInt(number);
    const maxNum = (room.gameType === 'bingo75') ? 75 : 25;

    if (isNaN(num) || num < 1 || num > maxNum) {
      return socket.emit('error_message', `Please call a valid number between 1 and ${maxNum}.`);
    }

    if (room.calledNumbers.includes(num)) {
      return socket.emit('error_message', `Number ${num} has already been called!`);
    }

    const currentTurnPlayer = room.players[socket.id];
    const displayLabel = (room.gameType === 'bingo75') ? get75BallLabel(num) : num;

    io.to(roomCode).emit('chat_message', {
      sender: currentTurnPlayer ? currentTurnPlayer.username : 'Player',
      message: `called ${displayLabel}!`,
      system: false
    });

    processCalledNumber(roomCode, num);
  });

  // 4. Submit Guess
  socket.on('submit_guess', ({ code, guess }) => {
    const roomCode = code.toUpperCase().trim();
    const room = rooms[roomCode];

    if (!room || room.gameState !== 'playing') return;

    // Survival Mode turn filter
    if (room.gameMode === 'survival' && socket.id !== room.currentTurnPlayerId) {
      return socket.emit('error_message', "It is not your turn to type!");
    }

    const player = room.players[socket.id];
    if (!player || player.hasGuessed) return;

    const sanitizedGuess = guess.toLowerCase().trim();
    const isCorrect = room.currentWord.english.some(ans => areWordsEquivalent(sanitizedGuess, ans));

    if (isCorrect) {
      player.hasGuessed = true;
      player.roundScore = 1;
      player.score += 1;

      socket.emit('guess_result', { correct: true });
      
      io.to(roomCode).emit('chat_message', {
        sender: 'System',
        message: `${player.username} guessed the word correctly!`,
        system: true
      });

      broadcastRoomUpdate(roomCode);

      // Check if the round should end
      if (room.gameMode === 'survival') {
        endRound(roomCode);
      } else {
        const allPlayersGuessed = Object.values(room.players).every(p => p.hasGuessed);
        if (allPlayersGuessed) {
          endRound(roomCode);
        }
      }
    } else {
      socket.emit('guess_result', { correct: false });
    }
  });

  // 5. Vote Show Answer
  socket.on('vote_show_answer', ({ code }) => {
    const roomCode = code.toUpperCase().trim();
    const room = rooms[roomCode];

    if (!room || room.gameState !== 'playing') return;

    const player = room.players[socket.id];
    if (!player) return;

    // Toggle vote
    player.votedShowAnswer = !player.votedShowAnswer;

    // System message
    const action = player.votedShowAnswer ? 'voted to show answer' : 'cancelled show answer vote';
    const currentVotes = Object.values(room.players).filter(p => p.votedShowAnswer).length;
    const totalPlayers = Object.keys(room.players).length;

    io.to(roomCode).emit('chat_message', {
      sender: 'System',
      message: `${player.username} ${action} (${currentVotes}/${totalPlayers})`,
      system: true
    });

    broadcastRoomUpdate(roomCode);

    // If everyone voted to show answer, end the round and show answer
    const allVoted = Object.values(room.players).every(p => p.votedShowAnswer);
    if (allVoted) {
      endRound(roomCode, true);
    }
  });

  // 6. Chat messaging
  socket.on('send_chat', ({ code, message }) => {
    const roomCode = code.toUpperCase().trim();
    const room = rooms[roomCode];
    if (!room) return;

    const player = room.players[socket.id];
    if (!player) return;

    if (!message || message.trim() === '') return;

    io.to(roomCode).emit('chat_message', {
      sender: player.username,
      message: message.trim(),
      system: false
    });
  });

  // 7. Disconnection
  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.id}`);
    
    // Find room the socket was in
    for (const roomCode in rooms) {
      const room = rooms[roomCode];
      if (room.players[socket.id]) {
        const username = room.players[socket.id].username;
        delete room.players[socket.id];

        // Notify other players
        io.to(roomCode).emit('chat_message', {
          sender: 'System',
          message: `${username} left the game.`,
          system: true
        });

        // Check if room is empty
        if (Object.keys(room.players).length === 0) {
          if (room.timer) {
            clearInterval(room.timer);
          }
          delete rooms[roomCode];
          console.log(`Room ${roomCode} deleted since it became empty.`);
        } else {
          // If the disconnected player was host, assign host to someone else
          if (room.hostId === socket.id) {
            const nextHostId = Object.keys(room.players)[0];
            room.hostId = nextHostId;
            const newHostName = room.players[nextHostId].username;

            io.to(roomCode).emit('chat_message', {
              sender: 'System',
              message: `${newHostName} is now the host of the room.`,
              system: true
            });
          }

          // Survival Mode cleanup
          if (room.gameMode === 'survival') {
            room.turnOrder = room.turnOrder.filter(id => id !== socket.id);
            // If the active player left, end the round immediately
            if (room.gameState === 'playing' && room.currentTurnPlayerId === socket.id) {
              endRound(roomCode);
              return;
            }
          }

          // Bingo Mode cleanup
          if (room.gameType === 'bingo') {
            room.turnOrder = room.turnOrder.filter(id => id !== socket.id);
            
            if (room.gameState === 'placement') {
              const allReady = Object.values(room.players).every(p => p.isReady);
              if (allReady && Object.keys(room.players).length > 0) {
                room.gameState = 'playing';
                room.calledNumbers = [];
                room.turnOrder = Object.keys(room.players).sort(() => 0.5 - Math.random());
                room.turnIndex = 0;
                room.currentTurnPlayerId = room.turnOrder[0];
                io.to(roomCode).emit('bingo_game_started', {
                  currentTurnPlayerId: room.currentTurnPlayerId
                });
                startBingoTurnTimer(roomCode);
              }
            } else if (room.gameState === 'playing') {
              const remainingPlayersCount = Object.keys(room.players).length;
              if (remainingPlayersCount <= 1 && remainingPlayersCount > 0) {
                room.gameState = 'game_over';
                const lastPlayerId = Object.keys(room.players)[0];
                const lastPlayer = room.players[lastPlayerId];
                const finalScores = [{ username: lastPlayer.username, score: lastPlayer.completedLines }];
                io.to(roomCode).emit('game_over', {
                  finalScores,
                  message: `All other players disconnected. ${lastPlayer.username} wins by default! 🏆`
                });
                if (room.timer) {
                  clearInterval(room.timer);
                  room.timer = null;
                }
              } else if (room.currentTurnPlayerId === socket.id) {
                if (room.turnIndex >= room.turnOrder.length) {
                  room.turnIndex = 0;
                }
                room.currentTurnPlayerId = room.turnOrder[room.turnIndex];
                io.to(roomCode).emit('chat_message', {
                  sender: 'System',
                  message: `Player left. It is now ${room.players[room.currentTurnPlayerId].username}'s turn.`,
                  system: true
                });
                startBingoTurnTimer(roomCode);
              }
            }
          }

          // If the game was active, check if the remaining players have all guessed or voted
          if (room.gameType === 'translate' && room.gameState === 'playing') {
            const allVoted = Object.values(room.players).every(p => p.votedShowAnswer);
            const allGuessed = Object.values(room.players).every(p => p.hasGuessed);

            if (allVoted) {
              endRound(roomCode, true);
            } else if (allGuessed) {
              endRound(roomCode);
            } else {
              broadcastRoomUpdate(roomCode);
            }
          } else {
            broadcastRoomUpdate(roomCode);
          }
        }
        break; // socket can only be in one room
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
