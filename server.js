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

// Helper to generate a unique 4-letter room code
function generateRoomCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let code;
  do {
    code = '';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
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

// Helper to calculate completed lines on a 5x5 Bingo board (flat 25-array)
function checkBingoLines(board, calledNumbers) {
  if (!board) return 0;
  
  let lines = 0;

  // Helper to check if a list of indices are all called
  const checkIndices = (indices) => indices.every(idx => calledNumbers.includes(board[idx]));

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

  // Check Diagonal 1 (top-left to bottom-right)
  const diag1Indices = [0, 6, 12, 18, 24];
  if (checkIndices(diag1Indices)) lines++;

  // Check Diagonal 2 (top-right to bottom-left)
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

  if (!room.bingoTurnTimerVal || room.bingoTurnTimerVal <= 0) {
    return; // No timer enabled
  }

  room.timeLeft = room.bingoTurnTimerVal;

  room.timer = setInterval(() => {
    room.timeLeft -= 1;

    if (room.timeLeft <= 0) {
      clearInterval(room.timer);
      room.timer = null;
      
      // Auto-call a remaining number
      autoCallBingoNumber(roomCode);
    } else {
      io.to(roomCode).emit('timer_tick', { timeLeft: room.timeLeft });
    }
  }, 1000);
}

// Auto-call a random number if active player runs out of turn time
function autoCallBingoNumber(roomCode) {
  const room = rooms[roomCode];
  if (!room || room.gameState !== 'playing') return;

  const currentTurnPlayer = room.players[room.currentTurnPlayerId];
  if (!currentTurnPlayer) return;

  // Find remaining uncalled numbers
  const allNumbers = Array.from({ length: 25 }, (_, i) => i + 1);
  const remainingNumbers = allNumbers.filter(n => !room.calledNumbers.includes(n));

  if (remainingNumbers.length === 0) return;

  const randomIndex = Math.floor(Math.random() * remainingNumbers.length);
  const selectedNumber = remainingNumbers[randomIndex];

  io.to(roomCode).emit('chat_message', {
    sender: 'System',
    message: `${currentTurnPlayer.username} ran out of time! System auto-called ${selectedNumber}.`,
    system: true
  });

  processCalledNumber(roomCode, selectedNumber);
}

// Start the automatic number caller interval for Real Life Mode
function startBingoAutoCaller(roomCode) {
  const room = rooms[roomCode];
  if (!room || room.gameType !== 'bingo' || room.gameState !== 'playing') return;

  if (room.timer) {
    clearInterval(room.timer);
    room.timer = null;
  }

  // Draw first number after a short delay (e.g. 2.2 seconds) so players can prepare
  setTimeout(() => {
    const r = rooms[roomCode];
    if (!r || r.gameState !== 'playing' || r.bingoMode !== 'real_life') return;
    
    const uncalled = Array.from({ length: 25 }, (_, i) => i + 1)
      .filter(n => !r.calledNumbers.includes(n));
    if (uncalled.length > 0) {
      const firstNum = uncalled[Math.floor(Math.random() * uncalled.length)];
      io.to(roomCode).emit('chat_message', {
        sender: 'Caller 🎙️',
        message: `📢 First number is ${firstNum}!`,
        system: true
      });
      processCalledNumber(roomCode, firstNum);
    }
  }, 2200);

  // Then start recurring draw interval
  room.timer = setInterval(() => {
    const r = rooms[roomCode];
    if (!r || r.gameState !== 'playing' || r.bingoMode !== 'real_life') {
      if (r && r.timer) {
        clearInterval(r.timer);
        r.timer = null;
      }
      return;
    }

    const uncalled = Array.from({ length: 25 }, (_, i) => i + 1)
      .filter(n => !r.calledNumbers.includes(n));

    if (uncalled.length === 0) {
      clearInterval(room.timer);
      room.timer = null;
      return;
    }

    const nextNum = uncalled[Math.floor(Math.random() * uncalled.length)];
    io.to(roomCode).emit('chat_message', {
      sender: 'Caller 🎙️',
      message: `📢 Next number: ${nextNum}!`,
      system: true
    });
    processCalledNumber(roomCode, nextNum);
  }, 4500); // draw every 4.5 seconds
}


// Function to send updated room state to all clients in the room
function broadcastRoomUpdate(roomCode) {
  const room = rooms[roomCode];
  if (!room) return;

  const playersList = Object.values(room.players).map(p => ({
    id: p.id,
    username: p.username,
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

  io.to(roomCode).emit('room_update', {
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

  // Process called numbers queue (allowing chain bomb explosions)
  let numbersToProcess = [number];
  let bombHitOccurred = false;

  while (numbersToProcess.length > 0) {
    const num = numbersToProcess.shift();
    if (!room.calledNumbers.includes(num)) {
      room.calledNumbers.push(num);
    }
    
    // Check if Chaos Mode is active and this number is a hidden bomb!
    if (room.bingoMode === 'chaos' && room.bombNumbers && room.bombNumbers.includes(num)) {
      bombHitOccurred = true;
      // Find remaining uncalled numbers (not in calledNumbers and not already queued in numbersToProcess)
      const uncalled = Array.from({ length: 25 }, (_, i) => i + 1)
        .filter(n => !room.calledNumbers.includes(n) && !numbersToProcess.includes(n));
      
      if (uncalled.length > 0) {
        const freeStrike = uncalled[Math.floor(Math.random() * uncalled.length)];
        numbersToProcess.push(freeStrike);
        
        // Emit bomb detonation event so clients play explosion sound and flash
        io.to(roomCode).emit('bingo_bomb_detonated', { bombNumber: num, freeStrikeNumber: freeStrike });
        io.to(roomCode).emit('chat_message', {
          sender: 'System',
          message: `💥 BOMB DETONATED! Number ${num} exploded, also crossing off ${freeStrike} on all boards!`,
          system: true
        });
      }
    }
  }

  if (!bombHitOccurred) {
    // Notify clients about the standard called number and completed lines updates
    io.to(roomCode).emit('bingo_number_called', {
      number: number,
      calledNumbers: room.calledNumbers
    });
  }

  // Recalculate completed lines for all players
  const winners = [];
  Object.values(room.players).forEach(p => {
    p.completedLines = checkBingoLines(p.bingoBoard, room.calledNumbers);
    p.score = p.completedLines; // Score is lines completed

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
        winnerNames: winners.map(w => w.username).join(', '),
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
  
  io.to(roomCode).emit('round_ended', {
    correctAnswer: correctAnswers,
    consensus: consensusReached,
    reason: consensusReached ? 'consensus' : (room.timeLeft <= 0 ? 'timeout' : 'all_guessed'),
    exploded: activePlayerFailed
  });

  broadcastRoomUpdate(roomCode);

  // Wait before starting the next round (1 second for survival mode, 5 seconds for classic)
  const transitionDelay = room.gameMode === 'survival' ? 1000 : 5000;
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
  socket.on('create_room', ({ username, gameType }) => {
    if (!username || username.trim() === '') {
      return socket.emit('error_message', 'Invalid username.');
    }

    const roomCode = generateRoomCode();
    
    // Choose 10 random words from words pool for the translate game
    const shuffledWords = [...words].sort(() => 0.5 - Math.random());
    const selectedWords = shuffledWords.slice(0, 10);

    const typeOfGame = gameType === 'bingo' ? 'bingo' : 'translate';

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
      score: 0,
      roundScore: 0,
      hasGuessed: false,
      votedShowAnswer: false,
      lives: 3,
      // Bingo specific fields
      isReady: false,
      bingoBoard: null,
      completedLines: 0
    };

    socket.join(roomCode);
    console.log(`Room created: ${roomCode} by ${username} [Game: ${typeOfGame}]`);
    
    broadcastRoomUpdate(roomCode);
  });

  // 2. Join Room
  socket.on('join_room', ({ code, username }) => {
    if (!code || !username) {
      return socket.emit('error_message', 'Code and Username are required.');
    }

    const roomCode = code.toUpperCase().trim();
    const room = rooms[roomCode];

    if (!room) {
      return socket.emit('error_message', 'Room not found.');
    }

    if (room.gameState !== 'lobby') {
      return socket.emit('error_message', 'Game has already started in this room.');
    }

    // Check if username is already taken in this room
    const isNameTaken = Object.values(room.players).some(
      p => p.username.toLowerCase() === username.toLowerCase().trim()
    );
    if (isNameTaken) {
      return socket.emit('error_message', 'Username is already taken in this room.');
    }

    // Join room
    room.players[socket.id] = {
      id: socket.id,
      username: username.trim(),
      score: 0,
      roundScore: 0,
      hasGuessed: false,
      votedShowAnswer: false,
      lives: 3,
      // Bingo specific fields
      isReady: false,
      bingoBoard: null,
      completedLines: 0
    };

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

    if (room.gameType === 'bingo') {
      room.bingoTurnTimerVal = parseInt(data.bingoTurnTimer) || 0;
      const bRounds = parseInt(data.bingoMatchRounds) || 5;
      room.totalRounds = Math.min(Math.max(bRounds, 3), 21); // enforce min 3, max 21 rounds for bingo
      room.round = 1;
      room.bingoMode = data.bingoMode || 'classic';
      room.gameState = 'placement';

      // Pick Hidden Bomb numbers if Chaos mode is active
      if (room.bingoMode === 'chaos') {
        const pool = Array.from({ length: 25 }, (_, i) => i + 1);
        for (let i = pool.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [pool[i], pool[j]] = [pool[j], pool[i]];
        }
        room.bombNumbers = pool.slice(0, 3);
        console.log(`[Chaos Mode] Shuffled bomb numbers: ${room.bombNumbers}`);
      } else {
        room.bombNumbers = [];
      }

      if (room.bingoMode === 'duocall') {
        room.duoCallCount = 0;
      }
      
      // Reset players states for Bingo Board Placement phase
      Object.values(room.players).forEach(p => {
        p.isReady = false;
        p.bingoBoard = null;
        p.completedLines = 0;
        p.score = 0;
        p.matchWins = 0; // Reset wins
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

    const wordsPool = [...words];
    const shuffledWords = shuffleArray(wordsPool);
    if (room.gameMode === 'survival') {
      room.roundWords = shuffledWords;
    } else {
      room.roundWords = shuffledWords.slice(0, room.totalRounds);
    }

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

  // Bingo: Call Number
  socket.on('call_bingo_number', ({ code, number }) => {
    const roomCode = code.toUpperCase().trim();
    const room = rooms[roomCode];
    if (!room || room.gameState !== 'playing' || room.gameType !== 'bingo') return;

    if (socket.id !== room.currentTurnPlayerId) {
      return socket.emit('error_message', "It is not your turn to call a number!");
    }

    const n = parseInt(number);
    if (isNaN(n) || n < 1 || n > 25) {
      return socket.emit('error_message', 'Invalid number called.');
    }

    if (room.calledNumbers.includes(n)) {
      return socket.emit('error_message', 'Number has already been called.');
    }

    const player = room.players[socket.id];
    io.to(roomCode).emit('chat_message', {
      sender: 'System',
      message: `${player.username} called ${n}!`,
      system: true
    });

    processCalledNumber(roomCode, n);
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
    const isCorrect = room.currentWord.english.some(ans => ans.toLowerCase().trim() === sanitizedGuess);

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
