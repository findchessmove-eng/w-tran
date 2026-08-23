// Client-Side Javascript: Shabd Anuvad

const socket = io();

// Application State
let currentRoomCode = null;
let currentUsername = null;
let isHost = false;
let hasGuessedThisRound = false;
let currentRoundTime = 40;
let lastPlayersList = [];
let blockInput = false;

// DOM Elements: Navigation
const screens = {
  welcome: document.getElementById('screen-welcome'),
  lobby: document.getElementById('screen-lobby'),
  game: document.getElementById('screen-game'),
  gameover: document.getElementById('screen-gameover')
};

// DOM Elements: Welcome Screen
const inputUsername = document.getElementById('username-input');
const btnCreateRoom = document.getElementById('btn-create-room');
const btnShowJoin = document.getElementById('btn-show-join');
const joinFormContainer = document.getElementById('join-form-container');
const inputRoomCode = document.getElementById('room-code-input');
const btnJoinRoom = document.getElementById('btn-join-room');

// DOM Elements: Lobby Screen
const lobbyRoomCode = document.getElementById('lobby-room-code');
const lobbyRoomCodeBadge = document.getElementById('lobby-room-code-badge');
const lobbyPlayerCount = document.getElementById('lobby-player-count');
const lobbyPlayersList = document.getElementById('lobby-players-list');
const hostSettings = document.getElementById('host-settings');
const selectRounds = document.getElementById('rounds-select');
const btnStartGame = document.getElementById('btn-start-game');
const guestWaitingMsg = document.getElementById('guest-waiting-msg');
const lobbyChatBox = document.getElementById('lobby-chat-box');
const lobbyChatInput = document.getElementById('lobby-chat-input');
const btnLobbySendChat = document.getElementById('btn-lobby-send-chat');

// DOM Elements: Game Screen
const gameCurrentRound = document.getElementById('game-current-round');
const gameTotalRounds = document.getElementById('game-total-rounds');
const gameTimerBar = document.getElementById('game-timer-bar');
const gameTimerText = document.getElementById('game-timer-text');
const promptHindiWord = document.getElementById('prompt-hindi-word');
const wordHintLetters = document.getElementById('word-hint-letters');
const hintAlertBox = document.getElementById('hint-alert-box');
const guessInput = document.getElementById('guess-input');
const btnSubmitGuess = document.getElementById('btn-submit-guess');
const guessFeedback = document.getElementById('guess-feedback');
const btnVoteShowAnswer = document.getElementById('btn-vote-show-answer');
const showAnswerVotesCount = document.getElementById('show-answer-votes-count');
const gamePlayersList = document.getElementById('game-players-list');
const gameChatBox = document.getElementById('game-chat-box');
const gameChatInput = document.getElementById('game-chat-input');
const btnGameSendChat = document.getElementById('btn-game-send-chat');

// DOM Elements: Game Over Screen
const winnerAnnouncementText = document.getElementById('winner-announcement-text');
const finalPlayersList = document.getElementById('final-players-list');
const btnBackHome = document.getElementById('btn-back-home');

// DOM Elements: Custom Alert Modal
const alertPopup = document.getElementById('alert-popup');
const alertTitle = document.getElementById('alert-title');
const alertMessage = document.getElementById('alert-message');
const btnCloseAlert = document.getElementById('btn-close-alert');

// --- Audio Synthesizer (Web Audio API) ---
let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

// Play a cheerful double-chime for a correct guess
function playSuccessSound() {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(523.25, now); // C5
    osc1.frequency.exponentialRampToValueAtTime(880.00, now + 0.15); // A5
    
    gain1.gain.setValueAtTime(0.12, now);
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    
    osc1.start(now);
    osc1.stop(now + 0.3);

    setTimeout(() => {
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(659.25, now + 0.1); // E5
      osc2.frequency.exponentialRampToValueAtTime(1046.50, now + 0.25); // C6
      
      gain2.gain.setValueAtTime(0.12, now + 0.1);
      gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
      
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      
      osc2.start(now + 0.1);
      osc2.stop(now + 0.4);
    }, 100);
  } catch (e) {
    console.warn("Web Audio API not supported or blocked:", e);
  }
}

// Play a low-pitched sawtooth buzz for an incorrect guess
function playErrorSound() {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.linearRampToValueAtTime(90, now + 0.22);
    
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start(now);
    osc.stop(now + 0.25);
  } catch (e) {
    console.warn("Audio playback error:", e);
  }
}

// Play a short click for the timer tick
function playTickSound(isWarning = false) {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sine';
    // Warning tick is high-pitched, normal tick is low
    osc.frequency.setValueAtTime(isWarning ? 1200 : 700, now);
    
    gain.gain.setValueAtTime(isWarning ? 0.08 : 0.03, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start(now);
    osc.stop(now + 0.05);
  } catch (e) {
    console.warn("Audio playback error:", e);
  }
}

// Play a simulated white-noise explosion rumble
function playExplosionSound() {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    
    // Create white noise buffer
    const bufferSize = ctx.sampleRate * 1.5;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    
    // Lowpass filter for deep boom rumble
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, now);
    filter.frequency.exponentialRampToValueAtTime(10, now + 1.2);
    
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.4);
    
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    
    noise.start(now);
    noise.stop(now + 1.5);
  } catch (e) {
    console.warn("Audio playback error:", e);
  }
}

// Add user interaction listener to unlock AudioContext in browser
document.addEventListener('click', () => {
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}, { once: false });

// --- Helper Functions ---

// Switch screens smoothly
function showScreen(screenKey) {
  Object.keys(screens).forEach(key => {
    if (key === screenKey) {
      screens[key].classList.add('active');
    } else {
      screens[key].classList.remove('active');
    }
  });
}

// Show Custom Alert Popup
function showAlert(title, message) {
  alertTitle.textContent = title;
  alertMessage.textContent = message;
  alertPopup.classList.add('visible');
}

// Close Custom Alert Popup
function closeAlert() {
  alertPopup.classList.remove('visible');
}

// Copy Code to Clipboard
function copyRoomCode() {
  if (!currentRoomCode) return;
  const inviteUrl = `${window.location.protocol}//${window.location.host}/room/${currentRoomCode}`;
  navigator.clipboard.writeText(inviteUrl).then(() => {
    const originalText = lobbyRoomCodeBadge.innerHTML;
    lobbyRoomCodeBadge.innerHTML = 'INVITE LINK COPIED! 📋';
    setTimeout(() => {
      lobbyRoomCodeBadge.innerHTML = originalText;
    }, 2000);
  }).catch(err => {
    console.error('Failed to copy room code: ', err);
  });
}

// Append Chat Message
function appendChatMessage(container, sender, message, isSystem = false) {
  const msgEl = document.createElement('div');
  msgEl.className = isSystem ? 'chat-msg chat-msg-system' : 'chat-msg';

  if (isSystem) {
    msgEl.innerHTML = `<span class="chat-msg-text">${message}</span>`;
  } else {
    msgEl.innerHTML = `<span class="chat-msg-sender">${sender}:</span> <span class="chat-msg-text">${message}</span>`;
  }

  container.appendChild(msgEl);
  container.scrollTop = container.scrollHeight;
}

// Submit Guess
function handleGuessSubmit() {
  const guess = guessInput.value.trim();
  if (guess === '' || hasGuessedThisRound) return;
  
  socket.emit('submit_guess', { code: currentRoomCode, guess: guess });
  guessInput.value = '';
}

// Set Guess Input State helper for mobile/iPad/Android soft keyboard preservation
function setGuessInputEnabled(enabled, placeholder = "", isCorrect = false, forceDisable = false) {
  if (forceDisable) {
    guessInput.disabled = true;
    guessInput.readOnly = false;
    blockInput = false;
    guessInput.placeholder = placeholder || "Waiting...";
    guessInput.classList.remove('input-correct');
    guessInput.classList.remove('input-not-my-turn');
    btnSubmitGuess.disabled = true;
  } else {
    guessInput.disabled = false;
    guessInput.readOnly = false;
    blockInput = !enabled;
    guessInput.placeholder = placeholder || "Type your English translation...";
    
    if (blockInput) {
      guessInput.classList.add('input-not-my-turn');
      btnSubmitGuess.disabled = true;
    } else {
      guessInput.classList.remove('input-not-my-turn');
      btnSubmitGuess.disabled = false;
    }
    
    if (isCorrect) {
      guessInput.classList.add('input-correct');
    } else {
      guessInput.classList.remove('input-correct');
    }
  }
}

// Block typing when input is in soft-disabled state (keeps mobile keyboard open)
guessInput.addEventListener('keydown', (e) => {
  if (blockInput) {
    e.preventDefault();
  }
});

guessInput.addEventListener('input', (e) => {
  if (blockInput) {
    guessInput.value = '';
  }
});

// Send Chat Message
function handleChatSend(inputElement) {
  const message = inputElement.value.trim();
  if (message === '') return;
  
  socket.emit('send_chat', { code: currentRoomCode, message: message });
  inputElement.value = '';
}

// --- Event Listeners ---

// Auto-focus username input on page load (or load last used name) and parse direct room URL
window.addEventListener('DOMContentLoaded', () => {
  const savedUsername = localStorage.getItem('shabd_anuvad_username');
  if (savedUsername) {
    inputUsername.value = savedUsername;
  }
  
  // Parse direct room URL code, e.g. /room/ABCD
  const pathMatch = window.location.pathname.match(/\/room\/([A-Za-z0-9]{4})/);
  if (pathMatch) {
    const urlRoomCode = pathMatch[1].toUpperCase();
    inputRoomCode.value = urlRoomCode;
    joinFormContainer.classList.add('visible');
    
    setTimeout(() => {
      if (!inputUsername.value.trim()) {
        inputUsername.focus();
      } else {
        inputRoomCode.focus();
      }
    }, 80);
  } else {
    setTimeout(() => {
      if (inputUsername.value) {
        inputUsername.focus();
        inputUsername.select();
      } else {
        inputUsername.focus();
      }
    }, 50);
  }
});

// Welcome Screen
btnShowJoin.addEventListener('click', () => {
  joinFormContainer.classList.toggle('visible');
  if (joinFormContainer.classList.contains('visible')) {
    setTimeout(() => inputRoomCode.focus(), 50);
  }
});

inputUsername.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    if (joinFormContainer.classList.contains('visible')) {
      inputRoomCode.focus();
    } else {
      btnCreateRoom.click();
    }
  }
});

inputRoomCode.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    btnJoinRoom.click();
  }
});

btnCreateRoom.addEventListener('click', () => {
  const username = inputUsername.value.trim();
  if (username === '') {
    return showAlert('Error', 'Please enter a username first.');
  }
  // Store username in local storage for convenience
  localStorage.setItem('shabd_anuvad_username', username);
  currentUsername = username;
  socket.emit('create_room', { username: username });
});

btnJoinRoom.addEventListener('click', () => {
  const username = inputUsername.value.trim();
  const roomCode = inputRoomCode.value.trim();
  
  if (username === '') {
    return showAlert('Error', 'Please enter a username.');
  }
  if (roomCode === '') {
    return showAlert('Error', 'Please enter a room code.');
  }
  
  // Store username in local storage for convenience
  localStorage.setItem('shabd_anuvad_username', username);
  currentUsername = username;
  currentRoomCode = roomCode.toUpperCase();
  socket.emit('join_room', { code: currentRoomCode, username: username });
});

// Lobby Screen
lobbyRoomCodeBadge.addEventListener('click', copyRoomCode);

btnStartGame.addEventListener('click', () => {
  if (!isHost) return;
  const rounds = selectRounds.value;
  const gameMode = document.getElementById('mode-select').value;
  const roundTime = document.getElementById('timer-select').value;
  socket.emit('start_game', { 
    code: currentRoomCode, 
    totalRounds: rounds,
    gameMode: gameMode,
    roundTime: roundTime
  });
});

btnLobbySendChat.addEventListener('click', () => handleChatSend(lobbyChatInput));
lobbyChatInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') handleChatSend(lobbyChatInput);
});

// Game Screen
btnSubmitGuess.addEventListener('click', handleGuessSubmit);
guessInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') handleGuessSubmit();
});

btnVoteShowAnswer.addEventListener('click', () => {
  socket.emit('vote_show_answer', { code: currentRoomCode });
});

btnGameSendChat.addEventListener('click', () => handleChatSend(gameChatInput));
gameChatInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') handleChatSend(gameChatInput);
});

// Auto-focus guess input when clicking/tapping anywhere on the game board
// Auto-focus guess input when clicking/tapping anywhere on the game board
function handleScreenGameTap(e) {
  if (
    e.target.tagName !== 'BUTTON' && 
    e.target.tagName !== 'INPUT' && 
    e.target.tagName !== 'SELECT' && 
    !blockInput &&
    !guessInput.disabled
  ) {
    guessInput.focus();
  }
}
screens.game.addEventListener('click', handleScreenGameTap);
screens.game.addEventListener('touchend', handleScreenGameTap);

// Game Over Screen
btnBackHome.addEventListener('click', () => {
  currentRoomCode = null;
  isHost = false;
  hasGuessedThisRound = false;
  lobbyChatBox.innerHTML = '';
  gameChatBox.innerHTML = '';
  guessInput.value = '';
  guessInput.className = '';
  guessFeedback.className = 'guess-feedback';
  guessFeedback.textContent = '';
  showScreen('welcome');
  
  if (window.location.pathname !== '/') {
    window.history.pushState(null, '', '/');
  }
});

// Alert Modal Close
btnCloseAlert.addEventListener('click', closeAlert);

// --- Socket Event Handlers ---

// 1. Error Message handler
socket.on('error_message', (message) => {
  showAlert('Alert', message);
});

// 2. Room State Updates
socket.on('room_update', (data) => {
  currentRoomCode = data.code;
  
  // Dynamically update URL to match the active room path
  if (data.gameState === 'lobby' || data.gameState === 'playing' || data.gameState === 'round_end') {
    const targetPath = `/room/${data.code}`;
    if (window.location.pathname !== targetPath) {
      window.history.pushState(null, '', targetPath);
    }
  }

  // Verify Host status
  isHost = (socket.id === data.hostId);
  
  // Lobby/Game screens updates
  if (data.gameState === 'lobby') {
    showScreen('lobby');
    lobbyRoomCode.textContent = data.code;
    lobbyPlayerCount.textContent = data.players.length;
    
    // Render player lists
    lobbyPlayersList.innerHTML = '';
    data.players.forEach(p => {
      const isMe = p.id === socket.id;
      const isPlayerHost = p.id === data.hostId;
      
      const li = document.createElement('li');
      li.innerHTML = `
        <div class="player-name-wrapper">
          <div class="player-avatar">${p.username.charAt(0).toUpperCase()}</div>
          <span style="font-weight: ${isMe ? 'bold' : 'normal'}">${p.username} ${isMe ? '(You)' : ''}</span>
        </div>
        ${isPlayerHost ? '<span class="player-role-badge">Host</span>' : ''}
      `;
      lobbyPlayersList.appendChild(li);
    });

    // Control Host Panel Visibility
    if (isHost) {
      hostSettings.style.display = 'block';
      guestWaitingMsg.style.display = 'none';
    } else {
      hostSettings.style.display = 'none';
      guestWaitingMsg.style.display = 'block';
    }
  } 
  
  else if (data.gameState === 'playing' || data.gameState === 'round_end') {
    // Cache player list
    lastPlayersList = data.players;
    
    // Toggle JKLM circular playground vs classic word prompt based on gameMode
    const bombPlayground = document.getElementById('bomb-playground');
    const gameClassicPrompt = document.getElementById('game-classic-prompt');
    const playCard = document.querySelector('.play-card');
    
    if (data.gameMode === 'survival') {
      if (bombPlayground) bombPlayground.style.display = 'block';
      if (gameClassicPrompt) gameClassicPrompt.style.display = 'none';
      playCard.classList.add('mode-survival');
      
      const promptHindiWordSurvival = document.getElementById('prompt-hindi-word-survival');
      if (promptHindiWordSurvival && data.currentHindiWord) {
        promptHindiWordSurvival.textContent = data.currentHindiWord;
      }
      
      // Render players around the center bomb
      updatePlayersRing(data.players, data.currentTurnPlayerId, data.gameMode);
    } else {
      if (bombPlayground) bombPlayground.style.display = 'none';
      if (gameClassicPrompt) gameClassicPrompt.style.display = 'block';
      playCard.classList.remove('mode-survival');
      
      if (data.currentHindiWord) {
        promptHindiWord.textContent = data.currentHindiWord;
      }
    }

    // Sync Game Screen UI Elements
    gameCurrentRound.textContent = data.round;
    gameTotalRounds.textContent = data.totalRounds;
    
    // Update show answer votes count
    showAnswerVotesCount.textContent = `(${data.showAnswerVotes}/${data.totalPlayers})`;
    
    // Render Scoreboard
    gamePlayersList.innerHTML = '';
    data.players.forEach(p => {
      const isMe = p.id === socket.id;
      const isPlayerHost = p.id === data.hostId;
      
      const li = document.createElement('li');
      if (p.hasGuessed) {
        li.className = 'player-done';
      }
      
      let statusHtml = '';
      if (p.hasGuessed) {
        statusHtml = `<span class="player-guess-status">Guessed</span>`;
      }
      
      let voteHtml = '';
      if (p.votedShowAnswer) {
        voteHtml = `<span class="vote-star">⭐ Answer Vote</span>`;
      }

      // Add hearts for survival mode
      let livesHtml = '';
      if (data.gameMode === 'survival') {
        const livesCount = Math.max(0, p.lives);
        if (livesCount === 0) {
          livesHtml = `<span class="vote-star" style="background: rgba(255,0,0,0.12); color:#ff3b30; border-color:#ff3b30;">💀 Eliminated</span>`;
        } else {
          livesHtml = `<span style="margin-left: 8px; font-size: 0.9rem;">${'❤️'.repeat(livesCount)}</span>`;
        }
      }

      li.innerHTML = `
        <div class="player-score-info">
          <span style="font-weight: ${isMe ? 'bold' : 'normal'}">${p.username} ${isMe ? '(You)' : ''}</span>
          ${isPlayerHost ? '<span class="player-role-badge" style="font-size:0.6rem; padding:1px 4px;">Host</span>' : ''}
          ${livesHtml}
          ${voteHtml}
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          ${statusHtml}
          <span class="player-score-val">${p.score} Correct</span>
        </div>
      `;
      gamePlayersList.appendChild(li);
    });

    // Sync my own guess state
    const me = data.players.find(p => p.id === socket.id);
    if (me) {
      hasGuessedThisRound = me.hasGuessed;
      
      // Update Show Answer vote button style
      if (me.votedShowAnswer) {
        btnVoteShowAnswer.classList.remove('btn-warning');
        btnVoteShowAnswer.classList.add('btn-secondary');
        btnVoteShowAnswer.innerHTML = `Voted Show Answer <span id="show-answer-votes-count">(${data.showAnswerVotes}/${data.totalPlayers})</span>`;
      } else {
        btnVoteShowAnswer.classList.remove('btn-secondary');
        btnVoteShowAnswer.classList.add('btn-warning');
        btnVoteShowAnswer.innerHTML = `Show Answer <span id="show-answer-votes-count">(${data.showAnswerVotes}/${data.totalPlayers})</span>`;
      }

      // Check input enablement based on game mode and turn
      const turnBanner = document.getElementById('game-turn-banner');
      
      if (data.gameMode === 'survival') {
        turnBanner.style.display = 'block';
        const activePlayer = data.players.find(p => p.id === data.currentTurnPlayerId);
        const activeName = activePlayer ? activePlayer.username : 'Unknown';
        
        if (socket.id === data.currentTurnPlayerId) {
          // My turn!
          turnBanner.classList.add('my-turn');
          turnBanner.innerHTML = `👉 IT IS YOUR TURN! Translate the word.`;
          
          if (me.hasGuessed) {
            setGuessInputEnabled(false, "Correct answer submitted!", true);
            btnSubmitGuess.disabled = true;
          } else if (data.gameState === 'playing') {
            const isEliminated = me.lives <= 0;
            setGuessInputEnabled(!isEliminated, isEliminated ? "You are eliminated!" : "Type your English translation...");
            btnSubmitGuess.disabled = isEliminated;
          } else {
            setGuessInputEnabled(false, "Waiting...");
            btnSubmitGuess.disabled = true;
          }
        } else {
          // Someone else's turn!
          turnBanner.classList.remove('my-turn');
          turnBanner.innerHTML = `Waiting for <span style="font-weight:bold; color:var(--accent);">${activeName}</span>'s turn...`;
          
          setGuessInputEnabled(false, `Waiting for ${activeName}...`);
          btnSubmitGuess.disabled = true;
        }
      } else {
        // Classic race mode
        turnBanner.style.display = 'none';
        
        if (me.hasGuessed) {
          setGuessInputEnabled(false, "Answer guessed correctly!", true);
          btnSubmitGuess.disabled = true;
        } else if (data.gameState === 'playing') {
          setGuessInputEnabled(true, "Type your English translation...");
          btnSubmitGuess.disabled = false;
        } else {
          setGuessInputEnabled(false, "Waiting...");
          btnSubmitGuess.disabled = true;
        }
      }
    }
  }
});

// 3. Transition to Game Mode
socket.on('game_started', () => {
  showScreen('game');
  guessFeedback.textContent = '';
  guessFeedback.className = 'guess-feedback';
});

// 4. Start of a new game round
socket.on('round_started', (data) => {
  hasGuessedThisRound = false;
  currentRoundTime = data.roundTime || 40; // store selected duration
  
  const playCard = document.querySelector('.play-card');
  const bombPlayground = document.getElementById('bomb-playground');
  const gameClassicPrompt = document.getElementById('game-classic-prompt');
  const bombBody = document.getElementById('playground-bomb');
  
  // Reset input fields
  guessInput.value = '';
  guessInput.className = '';
  guessFeedback.textContent = '';
  guessFeedback.className = 'guess-feedback';
  
  wordHintLetters.textContent = data.hintState;
  
  hintAlertBox.textContent = "Round started! Translate the Hindi word to English.";
  hintAlertBox.style.color = "var(--text-muted)";
  
  // Reset progress bar
  gameTimerBar.style.width = '100%';
  gameTimerText.textContent = `${data.timeLeft}s`;

  // Apply Survival Mode turn lock and visual bomb layout on round start
  const turnBanner = document.getElementById('game-turn-banner');
  if (data.gameMode === 'survival') {
    if (bombPlayground) bombPlayground.style.display = 'block';
    if (gameClassicPrompt) gameClassicPrompt.style.display = 'none';
    playCard.classList.add('mode-survival');
    
    if (bombBody) {
      bombBody.classList.remove('bomb-ticking', 'bomb-explode');
    }
    
    const promptHindiWordSurvival = document.getElementById('prompt-hindi-word-survival');
    if (promptHindiWordSurvival) {
      promptHindiWordSurvival.textContent = data.hindiWord;
    }
    
    // Position players around the bomb
    updatePlayersRing(lastPlayersList, data.currentTurnPlayerId, data.gameMode);
    
    turnBanner.style.display = 'block';
    const isMyTurn = (socket.id === data.currentTurnPlayerId);
    
    if (isMyTurn) {
      turnBanner.classList.add('my-turn');
      turnBanner.innerHTML = `👉 IT IS YOUR TURN! Translate the word.`;
      
      setGuessInputEnabled(true, "Type your English translation...");
      btnSubmitGuess.disabled = false;
      
      // Focus guess input box immediately only if it is my turn
      setTimeout(() => {
        guessInput.focus();
      }, 50);
    } else {
      turnBanner.classList.remove('my-turn');
      turnBanner.innerHTML = `Waiting for active player's turn...`;
      
      setGuessInputEnabled(false, `Waiting for player's turn...`);
      btnSubmitGuess.disabled = true;
    }
  } else {
    // Classic Mode: enable and focus for everyone
    if (bombPlayground) bombPlayground.style.display = 'none';
    if (gameClassicPrompt) gameClassicPrompt.style.display = 'block';
    playCard.classList.remove('mode-survival');
    
    if (bombBody) {
      bombBody.classList.remove('bomb-ticking', 'bomb-explode');
    }
    
    promptHindiWord.textContent = data.hindiWord;
    
    turnBanner.style.display = 'none';
    setGuessInputEnabled(true, "Type your English translation...");
    btnSubmitGuess.disabled = false;
    
    setTimeout(() => {
      guessInput.focus();
    }, 50);
  }
});

// 5. Timer Tick Update
socket.on('timer_tick', (data) => {
  // Update progress bar width
  const percentage = (data.timeLeft / currentRoundTime) * 100;
  
  gameTimerBar.style.width = `${percentage}%`;
  gameTimerText.textContent = `${data.timeLeft}s`;
  
  // Play tick sound (isWarning: true if time is low, i.e., <= 10 seconds remaining)
  playTickSound(data.timeLeft <= 10);

  // Trigger bomb ticking visual animation on low time (survival mode only)
  if (data.timeLeft <= 8) {
    const bombBody = document.getElementById('playground-bomb');
    if (bombBody && document.querySelector('.play-card').classList.contains('mode-survival')) {
      bombBody.classList.add('bomb-ticking');
    }
  }
});

// 6. Hint Reveal Updates
socket.on('hint_update', (data) => {
  wordHintLetters.textContent = data.hintState;
  hintAlertBox.textContent = data.message;
  hintAlertBox.style.color = "var(--accent)";
});

// 7. Feedback for player's guess
socket.on('guess_result', (data) => {
  if (data.correct) {
    hasGuessedThisRound = true;
    setGuessInputEnabled(false, "Correct!", true);
    btnSubmitGuess.disabled = true;
    
    guessFeedback.textContent = "Correct!";
    guessFeedback.className = 'guess-feedback correct';
    
    // Play success chime
    playSuccessSound();
  } else {
    guessInput.classList.add('input-incorrect');
    setTimeout(() => {
      guessInput.classList.remove('input-incorrect');
    }, 400);
    
    guessFeedback.textContent = "Incorrect translation. Try again!";
    guessFeedback.className = 'guess-feedback incorrect';
    
    // Play error buzz
    playErrorSound();
  }
});

// 8. Round Over Summary
socket.on('round_ended', (data) => {
  // Disable everything
  setGuessInputEnabled(false, "Round over...");
  btnSubmitGuess.disabled = true;

  // Trigger explosion graphics and sound if flagged
  if (data.exploded) {
    const bombBody = document.getElementById('playground-bomb');
    if (bombBody) {
      bombBody.classList.remove('bomb-ticking');
      bombBody.classList.add('bomb-explode');
    }
    
    // Play explosion sound effect
    playExplosionSound();

    // Trigger red screen flash
    document.body.classList.add('screen-flash-red');
    setTimeout(() => {
      document.body.classList.remove('screen-flash-red');
    }, 450);
  }
  
  let endReasonText = "";
  if (data.reason === 'consensus') {
    endReasonText = "All players voted to reveal the answer!";
  } else if (data.reason === 'timeout') {
    endReasonText = "Time's up!";
  } else {
    endReasonText = "All players guessed correctly!";
  }

  hintAlertBox.textContent = `${endReasonText} Next round starting soon...`;
  hintAlertBox.style.color = "var(--warning)";
  
  // Display the full correct word
  wordHintLetters.textContent = data.correctAnswer;
  
  guessFeedback.textContent = `Correct Answer: ${data.correctAnswer}`;
  guessFeedback.className = 'guess-feedback correct';
});

// 9. Game Over Rank Presentation
socket.on('game_over', (data) => {
  showScreen('gameover');
  
  // Set Winner Name
  let announcementHtml = '';
  if (data.message) {
    announcementHtml += `<span style="color:var(--secondary); display:block; margin-bottom:12px; font-size:1.2rem;">💔 ${data.message}</span>`;
  }
  
  if (data.finalScores.length > 0) {
    const winner = data.finalScores[0];
    announcementHtml += `🏆 ${winner.username} wins the match with ${winner.score} correct answers!`;
  } else {
    announcementHtml += "No players in the game.";
  }
  winnerAnnouncementText.innerHTML = announcementHtml;
  
  // Render Leaderboard list
  finalPlayersList.innerHTML = '';
  data.finalScores.forEach((p, idx) => {
    const li = document.createElement('li');
    li.innerHTML = `
      <div>
        <span class="rank-badge">${idx + 1}</span>
        <span>${p.username}</span>
      </div>
      <span class="final-score-points">${p.score} Correct</span>
    `;
    finalPlayersList.appendChild(li);
  });
});

// 10. Chat messaging broadcast receiver
socket.on('chat_message', (data) => {
  // Append to lobby chat
  appendChatMessage(lobbyChatBox, data.sender, data.message, data.system);
  // Append to game chat
  appendChatMessage(gameChatBox, data.sender, data.message, data.system);
});

// --- JKLM Style Circular Ring Layout Calculations ---

function updatePlayersRing(players, currentTurnPlayerId, gameMode) {
  const ringContainer = document.getElementById('bomb-players-ring');
  const pointerArrow = document.getElementById('bomb-pointer-arrow');
  const playground = document.getElementById('bomb-playground');
  
  if (!ringContainer || !playground) return;
  
  // Clear old nodes
  ringContainer.innerHTML = '';
  
  if (gameMode !== 'survival' || players.length === 0) {
    pointerArrow.style.display = 'none';
    return;
  }
  
  pointerArrow.style.display = 'block';
  
  // Calculate radius based on container dimensions
  const rect = playground.getBoundingClientRect();
  const radius = Math.min(rect.width, rect.height) * 0.42; // 42% of container dimension
  
  // Adjust arrow lengths dynamically
  const arrowShaft = document.querySelector('.arrow-shaft');
  const arrowHead = document.querySelector('.arrow-head');
  if (arrowShaft && arrowHead) {
    const shaftHeight = Math.max(20, Math.round(radius * 0.35));
    arrowShaft.style.height = `${shaftHeight}px`;
    arrowHead.style.bottom = `calc(50% + ${shaftHeight}px)`;
  }
  
  // Render each player around the circle
  let activeIndex = -1;
  
  players.forEach((p, idx) => {
    const isMe = p.id === socket.id;
    const isActive = p.id === currentTurnPlayerId;
    if (isActive) {
      activeIndex = idx;
    }
    
    // Position
    const angle = (idx / players.length) * 2 * Math.PI - Math.PI / 2; // start from top
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    
    // Create card element
    const node = document.createElement('div');
    node.className = `ring-player-node ${isActive ? 'active-turn' : ''}`;
    node.style.left = `calc(50% + ${x}px)`;
    node.style.top = `calc(50% + ${y}px)`;
    
    // Render hearts
    let heartsHtml = '';
    const livesCount = Math.max(0, p.lives);
    if (livesCount === 0) {
      heartsHtml = '💀';
    } else {
      heartsHtml = '❤️'.repeat(livesCount);
    }
    
    // Guess status label
    let statusText = '';
    let statusClass = '';
    if (p.hasGuessed) {
      statusText = 'Guessed!';
      statusClass = 'guessed';
    } else if (isActive) {
      statusText = 'Typing...';
      statusClass = 'typing';
    }
    
    node.innerHTML = `
      <div class="ring-player-avatar-wrapper">
        <div class="ring-player-hearts">${heartsHtml}</div>
        <div class="ring-player-avatar" style="background: ${getAvatarColor(p.username)}">
          ${p.username.charAt(0).toUpperCase()}
        </div>
      </div>
      <span class="ring-player-name" style="font-weight: ${isMe ? 'bold' : 'normal'}; border-color: ${isMe ? 'var(--primary)' : 'rgba(255,255,255,0.05)'}">
        ${p.username} ${isMe ? '(You)' : ''}
      </span>
      <div class="ring-player-status ${statusClass}">${statusText}</div>
    `;
    
    ringContainer.appendChild(node);
  });
  
  // Rotate pointer arrow to point to active player
  if (activeIndex !== -1) {
    const angleDegrees = (activeIndex / players.length) * 360;
    pointerArrow.style.transform = `rotate(${angleDegrees}deg)`;
  }
}

// Simple deterministic hash to get a solid color for the avatar
function getAvatarColor(username) {
  const colors = [
    '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', 
    '#ef4444', '#14b8a6', '#f43f5e', '#06b6d4', '#6366f1'
  ];
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash % colors.length);
  return colors[index];
}


