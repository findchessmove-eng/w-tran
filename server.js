const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const words = require('./words');

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
    lives: p.lives // Pass lives count to client
  }));

  // Sort players by score for the leaderboard
  playersList.sort((a, b) => b.score - a.score);

  // Compute how many show answer votes we have
  const totalPlayers = Object.keys(room.players).length;
  const showAnswerVotes = Object.values(room.players).filter(p => p.votedShowAnswer).length;

  io.to(roomCode).emit('room_update', {
    code: roomCode,
    gameState: room.gameState,
    hostId: room.hostId,
    players: playersList,
    round: room.round,
    totalRounds: room.totalRounds,
    showAnswerVotes,
    totalPlayers,
    timeLeft: room.timeLeft,
    hintsRevealed: room.hintsRevealed,
    hintState: room.hintState,
    currentHindiWord: room.gameState === 'playing' ? room.currentWord.hindi : null,
    gameMode: room.gameMode,
    currentTurnPlayerId: room.currentTurnPlayerId
  });
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

    if (room.round >= room.totalRounds) {
      // Game Over
      room.gameState = 'game_over';
      const finalScores = Object.values(room.players).map(p => ({
        username: p.username,
        score: p.score
      })).sort((a, b) => b.score - a.score);

      io.to(roomCode).emit('game_over', { finalScores });
      broadcastRoomUpdate(roomCode);
    } else {
      // Start next round
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
  socket.on('create_room', ({ username }) => {
    if (!username || username.trim() === '') {
      return socket.emit('error_message', 'Invalid username.');
    }

    const roomCode = generateRoomCode();
    
    // Choose 10 random words from words pool for the game
    const shuffledWords = [...words].sort(() => 0.5 - Math.random());
    const selectedWords = shuffledWords.slice(0, 10);

    rooms[roomCode] = {
      id: roomCode,
      hostId: socket.id,
      players: {},
      gameState: 'lobby',
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
      lives: 3
    };

    socket.join(roomCode);
    console.log(`Room created: ${roomCode} by ${username}`);
    
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
      lives: 3
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
  socket.on('start_game', ({ code, totalRounds, difficulty, roundTime, gameMode }) => {
    const roomCode = code.toUpperCase().trim();
    const room = rooms[roomCode];

    if (!room) return socket.emit('error_message', 'Room not found.');
    if (room.hostId !== socket.id) return socket.emit('error_message', 'Only the host can start the game.');
    if (Object.keys(room.players).length < 1) return socket.emit('error_message', 'Not enough players.');

    // Set round configurations
    room.roundTime = parseInt(roundTime) || 40;
    room.gameMode = gameMode || 'classic';

    const roundsCount = parseInt(totalRounds) || 10;
    room.totalRounds = Math.min(Math.max(roundsCount, 3), 20); // enforce min 3, max 20 rounds

    // Select words pool
    const wordsPool = [...words];

    // Shuffle and select from filtered pool
    const shuffledWords = wordsPool.sort(() => 0.5 - Math.random());
    room.roundWords = shuffledWords.slice(0, room.totalRounds);

    // Turn by Turn survival setup
    if (room.gameMode === 'survival') {
      Object.values(room.players).forEach(p => {
        p.score = 0;
        p.lives = 3; // Reset lives for survival
      });
      room.turnOrder = Object.keys(room.players).sort(() => 0.5 - Math.random());
      room.turnIndex = 0;
      room.currentTurnPlayerId = room.turnOrder[0];
    }

    room.round = 0;
    io.to(roomCode).emit('game_started');
    startNextRound(roomCode);
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

          // If the game was active, check if the remaining players have all guessed or voted
          if (room.gameState === 'playing') {
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
