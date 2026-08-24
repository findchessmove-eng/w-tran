// Client-Side Javascript: Shabd Anuvad & Bingo
const socket = io();

// Application State
let currentRoomCode = null;
let currentUsername = null;
let isHost = false;
let hasGuessedThisRound = false;
let currentRoundTime = 40;
let lastPlayersList = [];
let blockInput = false;

// Bingo specific application state
let selectedGameType = 'translate';
let bingoSetupBoard = Array(25).fill(null);
let bingoNextNumber = 1;
let myBingoBoard = [];
let calledNumbers = [];
let currentTurnPlayerId = null;
let previousLinesCount = 0;
let randomizeInterval = null;

// Game Type selection handler (called from Welcome Screen)
window.selectGameType = function(type) {
  selectedGameType = type;
  
  const translateCard = document.getElementById('select-game-translate');
  const bingoCard = document.getElementById('select-game-bingo');
  
  if (type === 'bingo') {
    translateCard.classList.remove('active');
    bingoCard.classList.add('active');
  } else {
    translateCard.classList.add('active');
    bingoCard.classList.remove('active');
  }
};

// DOM Elements: Navigation
const screens = {
  welcome: document.getElementById('screen-welcome'),
  lobby: document.getElementById('screen-lobby'),
  game: document.getElementById('screen-game'),
  bingoSetup: document.getElementById('screen-bingo-setup'),
  bingoGame: document.getElementById('screen-bingo-game'),
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

// Play an ascending arpeggio chime when a line is completed
function playLineCompleteSound() {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    
    // Distinct ascending arpeggio notes (C5, E5, G5, C6)
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle'; // softer than square
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);
      
      gain.gain.setValueAtTime(0.12, now + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.35);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 0.35);
    });
  } catch (e) {
    console.warn("Audio playback error:", e);
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

// Full-screen overlay to unlock soft keyboard on mobile devices for guest players
function showMobileStartOverlay() {
  if (document.getElementById('mobile-start-overlay')) return;
  
  const overlay = document.createElement('div');
  overlay.id = 'mobile-start-overlay';
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100vw';
  overlay.style.height = '100vh';
  overlay.style.background = 'rgba(10, 10, 15, 0.95)';
  overlay.style.display = 'flex';
  overlay.style.flexDirection = 'column';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.style.zIndex = '99999';
  overlay.style.backdropFilter = 'blur(15px)';
  overlay.style.padding = '30px';
  overlay.style.textAlign = 'center';
  
  overlay.innerHTML = `
    <h2 style="font-family: 'Outfit', sans-serif; font-size: 2rem; color: #fff; margin-bottom: 15px; text-shadow: 0 0 10px rgba(255,255,255,0.3);">
      Match is Starting! 🚀
    </h2>
    <p style="font-family: var(--font-main); font-size: 1.1rem; color: rgba(255,255,255,0.7); margin-bottom: 30px; max-width: 320px;">
      Tap the button below to join the arena and unlock your keyboard.
    </p>
    <button id="btn-mobile-unlock" class="btn btn-primary btn-glow" style="padding: 16px 32px; font-size: 1.2rem; border-radius: 12px; width: 100%; max-width: 280px; box-shadow: 0 0 20px rgba(0, 240, 255, 0.4);">
      ENTER ARENA ⚔️
    </button>
  `;
  
  document.body.appendChild(overlay);
  
  const unlockBtn = document.getElementById('btn-mobile-unlock');
  const triggerUnlock = (e) => {
    e.preventDefault();
    e.stopPropagation();
    document.body.removeChild(overlay);
    
    setTimeout(() => {
      guessInput.focus();
    }, 20);
  };
  
  unlockBtn.addEventListener('click', triggerUnlock);
  unlockBtn.addEventListener('touchend', triggerUnlock);
}

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
  socket.emit('create_room', { username: username, gameType: selectedGameType });
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
  
  if (selectedGameType === 'bingo') {
    const turnTimer = document.getElementById('bingo-timer-select').value;
    const matchRounds = document.getElementById('bingo-rounds-select').value;
    socket.emit('start_game', {
      code: currentRoomCode,
      bingoTurnTimer: turnTimer,
      bingoMatchRounds: matchRounds
    });
    return;
  }

  const rounds = selectRounds.value;
  const gameMode = document.getElementById('mode-select').value;
  const roundTime = document.getElementById('timer-select').value;
  socket.emit('start_game', { 
    code: currentRoomCode, 
    totalRounds: rounds,
    gameMode: gameMode,
    roundTime: roundTime
  });
  
  // Pre-focus guess input immediately on host click gesture to open soft keyboard
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  if (isMobile) {
    guessInput.focus();
  }
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
  
  // Clear Bingo states
  bingoSetupBoard = Array(25).fill(null);
  bingoNextNumber = 1;
  myBingoBoard = [];
  calledNumbers = [];
  currentTurnPlayerId = null;
  document.body.classList.remove('bingo-my-turn-active');
  const bingoChatBox = document.getElementById('bingo-chat-box');
  if (bingoChatBox) bingoChatBox.innerHTML = '';
  
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
  if (data.gameState === 'lobby' || data.gameState === 'playing' || data.gameState === 'round_end' || data.gameState === 'placement') {
    const targetPath = `/room/${data.code}`;
    if (window.location.pathname !== targetPath) {
      window.history.pushState(null, '', targetPath);
    }
  }

  // Verify Host status
  isHost = (socket.id === data.hostId);
  
  if (data.gameType === 'bingo') {
    selectedGameType = 'bingo';
    
    // Toggle lobby settings panels
    const tGroup = document.getElementById('translate-settings-group');
    const bGroup = document.getElementById('bingo-settings-group');
    if (tGroup && bGroup) {
      tGroup.style.display = 'none';
      bGroup.style.display = 'block';
    }

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
    else if (data.gameState === 'placement') {
      showScreen('bingoSetup');
      // Render setup ready status list
      const statusContainer = document.getElementById('bingo-players-ready-status');
      if (statusContainer) {
        statusContainer.innerHTML = '';
        data.players.forEach(p => {
          const div = document.createElement('div');
          div.className = 'player-ready-item';
          div.innerHTML = `
            <span>${p.username} ${p.id === socket.id ? '(You)' : ''}</span>
            <span class="ready-badge ${p.isReady ? 'ready' : 'not-ready'}">${p.isReady ? 'Ready 👍' : 'Placing... ✍️'}</span>
          `;
          statusContainer.appendChild(div);
        });
      }
    } 
    else if (data.gameState === 'playing') {
      showScreen('bingoGame');
      currentTurnPlayerId = data.currentTurnPlayerId;
      lastPlayersList = data.players; // Cache for timer countdown
      calledNumbers = data.calledNumbers;

      // Draw active board
      renderBingoPlayGrid(myBingoBoard, data.calledNumbers);

      // Light up letters
      const me = data.players.find(p => p.id === socket.id);
      if (me) {
        const myLines = me.completedLines || 0;
        document.getElementById('bingo-my-lines').textContent = `${myLines} / 5`;
        
        // Play line complete sound if we scored a new completed line
        if (myLines > previousLinesCount) {
          playLineCompleteSound();
        }
        previousLinesCount = myLines;
        
        const letters = document.querySelectorAll('.bingo-letter');
        letters.forEach((l, idx) => {
          if (idx < myLines) {
            l.classList.add('lit');
          } else {
            l.classList.remove('lit');
          }
        });
      }

      // Turn banner
      const activePlayer = data.players.find(p => p.id === data.currentTurnPlayerId);
      const activeName = activePlayer ? activePlayer.username : 'Player';
      const isMyTurn = data.currentTurnPlayerId === socket.id;
      const turnBanner = document.getElementById('bingo-turn-banner');
      
      if (isMyTurn) {
        turnBanner.textContent = `⭐ It's Your Turn! Call a number.`;
        turnBanner.classList.add('your-turn');
        document.body.classList.add('bingo-my-turn-active');
      } else {
        turnBanner.textContent = `It's ${activeName}'s Turn.`;
        turnBanner.classList.remove('your-turn');
        document.body.classList.remove('bingo-my-turn-active');
      }

      // Draw scoreboard
      const scoreboard = document.getElementById('bingo-players-list');
      scoreboard.innerHTML = '';
      data.players.forEach(p => {
        const isMe = p.id === socket.id;
        const isTurn = p.id === data.currentTurnPlayerId;
        const li = document.createElement('li');
        if (isTurn) {
          li.className = 'active-turn';
        }
        
        const letters = ['B', 'I', 'N', 'G', 'O'];
        const pLines = p.completedLines || 0;
        let lineRepr = letters.map((l, idx) => idx < pLines ? `<span class="score-letter lit">${l}</span>` : `<span class="score-letter">${l}</span>`).join(' ');

        li.innerHTML = `
          <div class="player-score-info">
            <span style="font-weight: ${isMe ? 'bold' : 'normal'}">${p.username} ${isMe ? '(You)' : ''}</span>
            ${p.id === data.hostId ? '<span class="player-role-badge" style="font-size:0.6rem; padding:1px 4px;">Host</span>' : ''}
            <span class="match-wins-badge" style="margin-left:5px; font-size:0.75rem; color:var(--warning); font-weight:bold;">🏆 ${p.matchWins || 0} Wins</span>
          </div>
          <div class="bingo-score-badge">
            ${lineRepr} (${pLines} lines)
          </div>
        `;
        scoreboard.appendChild(li);
      });
    }
  } else {
    selectedGameType = 'translate';
    
    // Toggle lobby settings panels
    const tGroup = document.getElementById('translate-settings-group');
    const bGroup = document.getElementById('bingo-settings-group');
    if (tGroup && bGroup) {
      tGroup.style.display = 'block';
      bGroup.style.display = 'none';
    }

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
  }
});

// 3. Transition to Game Mode
socket.on('game_started', () => {
  showScreen('game');
  guessFeedback.textContent = '';
  guessFeedback.className = 'guess-feedback';
  
  // Mobile soft-keyboard auto-unlock overlay for guest players
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  if (isMobile && !isHost) {
    showMobileStartOverlay();
  }
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
  if (selectedGameType === 'bingo') {
    const activePlayer = lastPlayersList.find(p => p.id === currentTurnPlayerId);
    const activeName = activePlayer ? activePlayer.username : "Player";
    const isMe = currentTurnPlayerId === socket.id;
    const turnBanner = document.getElementById('bingo-turn-banner');
    
    if (turnBanner) {
      if (isMe) {
        turnBanner.textContent = `⭐ It's Your Turn! Call a number (${data.timeLeft}s)`;
        turnBanner.classList.add('your-turn');
      } else {
        turnBanner.textContent = `It's ${activeName}'s Turn (${data.timeLeft}s)`;
        turnBanner.classList.remove('your-turn');
      }
    }
    playTickSound(data.timeLeft <= 8);
    return;
  }

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
  
  if (selectedGameType === 'bingo') {
    if (data.finalScores.length > 0) {
      const winner = data.finalScores[0];
      announcementHtml += `🏆 ${winner.username} won the match!`;
    } else {
      announcementHtml += "No players in the game.";
    }
  } else {
    if (data.finalScores.length > 0) {
      const winner = data.finalScores[0];
      announcementHtml += `🏆 ${winner.username} wins the match with ${winner.score} correct answers!`;
    } else {
      announcementHtml += "No players in the game.";
    }
  }
  winnerAnnouncementText.innerHTML = announcementHtml;
  
  // Render Leaderboard list
  finalPlayersList.innerHTML = '';
  data.finalScores.forEach((p, idx) => {
    const li = document.createElement('li');
    const unitText = selectedGameType === 'bingo' ? 'Match Wins' : 'Correct';
    li.innerHTML = `
      <div>
        <span class="rank-badge">${idx + 1}</span>
        <span>${p.username}</span>
      </div>
      <span class="final-score-points">${p.score} ${unitText}</span>
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
  // Append to bingo game chat
  const bingoChatBox = document.getElementById('bingo-chat-box');
  if (bingoChatBox) {
    appendChatMessage(bingoChatBox, data.sender, data.message, data.system);
  }
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

// -------------------------------------------------------------
// BINGO HELPER FUNCTIONS
// -------------------------------------------------------------

function renderBingoSetupGrid() {
  const gridEl = document.getElementById('bingo-setup-grid');
  if (!gridEl) return;
  
  // Create cells once if not already initialized
  if (gridEl.children.length !== 25) {
    gridEl.innerHTML = '';
    
    // Bind click listener on parent container via event delegation once
    if (!gridEl.dataset.hasListener) {
      gridEl.dataset.hasListener = 'true';
      gridEl.addEventListener('click', (e) => {
        const cell = e.target.closest('.bingo-cell');
        if (!cell) return;
        
        const idx = parseInt(cell.dataset.index);
        if (isNaN(idx)) return;
        
        // If cell is already placed, ignore click
        if (bingoSetupBoard[idx] !== null) return;
        
        if (bingoNextNumber <= 25) {
          bingoSetupBoard[idx] = bingoNextNumber;
          bingoNextNumber++;
          renderBingoSetupGrid();
          updateSetupStatus();
          
          // Play simple click note
          try {
            const ctx = getAudioContext();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(261.63 * Math.pow(1.059463, bingoNextNumber - 2), ctx.currentTime);
            gain.gain.setValueAtTime(0.05, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.1);
          } catch (err) {}
        }
      });
    }

    for (let i = 0; i < 25; i++) {
      const cell = document.createElement('div');
      cell.className = 'bingo-cell';
      cell.dataset.index = i;
      gridEl.appendChild(cell);
    }
  }

  // Update existing cells in-place
  for (let i = 0; i < 25; i++) {
    const cell = gridEl.children[i];
    const value = bingoSetupBoard[i];
    
    if (value !== null) {
      if (cell.textContent !== String(value)) {
        cell.textContent = value;
      }
      if (!cell.classList.contains('placed')) {
        cell.classList.add('placed');
      }
    } else {
      if (cell.textContent !== '') {
        cell.textContent = '';
      }
      if (cell.classList.contains('placed')) {
        cell.classList.remove('placed');
      }
    }
  }
}

function updateSetupStatus() {
  const statusEl = document.getElementById('bingo-setup-status-msg');
  if (!statusEl) return;
  
  const placedCount = bingoSetupBoard.filter(v => v !== null).length;
  statusEl.textContent = `Progress: ${placedCount} / 25 numbers placed.`;
  
  if (placedCount === 25) {
    statusEl.innerHTML = `<span style="color: var(--success); font-weight: bold;">Board complete! Submitting...</span>`;
    
    // Automatically submit board
    socket.emit('submit_bingo_board', {
      code: currentRoomCode,
      board: bingoSetupBoard
    });
  }
}

// Calculate which cell indices are part of completed rows, columns, or diagonals
function getCompletedCellIndices(board, calledList) {
  if (!board || board.length !== 25) return [];

  const completedIndices = new Set();

  const checkAndAdd = (indices) => {
    const isComplete = indices.every(idx => calledList.includes(board[idx]));
    if (isComplete) {
      indices.forEach(idx => completedIndices.add(idx));
    }
  };

  // Check 5 rows
  for (let r = 0; r < 5; r++) {
    const rowIndices = [r*5, r*5+1, r*5+2, r*5+3, r*5+4];
    checkAndAdd(rowIndices);
  }

  // Check 5 columns
  for (let c = 0; c < 5; c++) {
    const colIndices = [c, c+5, c+10, c+15, c+20];
    checkAndAdd(colIndices);
  }

  // Check Diagonal 1 (top-left to bottom-right)
  const diag1Indices = [0, 6, 12, 18, 24];
  checkAndAdd(diag1Indices);

  // Check Diagonal 2 (top-right to bottom-left)
  const diag2Indices = [4, 8, 12, 16, 20];
  checkAndAdd(diag2Indices);

  return Array.from(completedIndices);
}

function renderBingoPlayGrid(myBoard, calledList) {
  const gridEl = document.getElementById('bingo-game-grid');
  if (!gridEl) return;

  const isMyTurn = currentTurnPlayerId === socket.id;
  const completedCells = getCompletedCellIndices(myBoard, calledList);

  // Create play cells once if not already initialized
  if (gridEl.children.length !== 25) {
    gridEl.innerHTML = '';
    
    // Bind click listener on parent container via event delegation once
    if (!gridEl.dataset.hasListener) {
      gridEl.dataset.hasListener = 'true';
      gridEl.addEventListener('click', (e) => {
        const cell = e.target.closest('.bingo-cell');
        if (!cell) return;
        
        if (cell.classList.contains('clickable') && currentTurnPlayerId === socket.id) {
          const num = parseInt(cell.dataset.number);
          if (num) {
            socket.emit('call_bingo_number', {
              code: currentRoomCode,
              number: num
            });
          }
        }
      });
    }

    for (let i = 0; i < 25; i++) {
      const cell = document.createElement('div');
      cell.className = 'bingo-cell play-mode';
      const num = myBoard[i] || '';
      cell.textContent = num;
      cell.dataset.number = num;
      gridEl.appendChild(cell);
    }
  }

  // Update existing cells in-place smoothly without destroying elements
  for (let i = 0; i < 25; i++) {
    const cell = gridEl.children[i];
    const num = myBoard[i] || '';
    
    // Crucial: Update text content and dataset number dynamically for new tournament rounds
    if (cell.textContent !== String(num)) {
      cell.textContent = num;
    }
    cell.dataset.number = num;
    
    const isCalled = calledList.includes(num);
    const isLineCompleted = completedCells.includes(i);

    if (isLineCompleted) {
      if (!cell.classList.contains('line-completed')) {
        cell.className = 'bingo-cell play-mode called line-completed';
      }
    } else if (isCalled) {
      if (!cell.classList.contains('called')) {
        cell.className = 'bingo-cell play-mode called';
      }
    } else {
      // Cell is active (uncalled)
      let className = 'bingo-cell play-mode';
      if (isMyTurn && num !== '') {
        className += ' clickable';
      }
      if (cell.className !== className) {
        cell.className = className;
      }
    }
  }
}

// Bind Bingo setup action buttons
const btnBingoRandom = document.getElementById('btn-bingo-random');
const btnBingoClear = document.getElementById('btn-bingo-clear');

if (btnBingoRandom) {
  btnBingoRandom.addEventListener('click', () => {
    // Crucial for iOS/iPad: Initialize and resume AudioContext inside user interaction block synchronously
    let ctx = null;
    try {
      ctx = getAudioContext();
      if (ctx && ctx.state === 'suspended') {
        ctx.resume();
      }
    } catch (err) {}

    // Clear any active randomize animation
    if (randomizeInterval) clearInterval(randomizeInterval);
    
    // Disable control buttons during fill
    btnBingoRandom.disabled = true;
    if (btnBingoClear) btnBingoClear.disabled = true;

    // Prepare numbers 1 to 25 and shuffle them
    const numbers = Array.from({ length: 25 }, (_, i) => i + 1);
    for (let i = numbers.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
    }

    // Clear board first to start fresh
    bingoSetupBoard = Array(25).fill(null);
    bingoNextNumber = 1;
    renderBingoSetupGrid();
    updateSetupStatus();

    // Create a random order of cell indices (0 to 24) to fill staggered
    const cellIndices = Array.from({ length: 25 }, (_, i) => i);
    for (let i = cellIndices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cellIndices[i], cellIndices[j]] = [cellIndices[j], cellIndices[i]];
    }

    let step = 0;
    randomizeInterval = setInterval(() => {
      if (step >= 25) {
        clearInterval(randomizeInterval);
        randomizeInterval = null;
        
        // Re-enable control buttons
        btnBingoRandom.disabled = false;
        if (btnBingoClear) btnBingoClear.disabled = false;
        
        // Final success sound and auto-ready trigger
        bingoNextNumber = 26;
        renderBingoSetupGrid();
        updateSetupStatus();
        playSuccessSound();
        return;
      }

      const cellIdx = cellIndices[step];
      const num = numbers[step];
      bingoSetupBoard[cellIdx] = num;
      renderBingoSetupGrid();

      // Play snappy ascending note using the pre-fetched context
      if (ctx && ctx.state !== 'suspended') {
        try {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          const freq = 320 + step * 16; // ascending frequency
          osc.frequency.setValueAtTime(freq, ctx.currentTime);
          gain.gain.setValueAtTime(0.04, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.08);
        } catch (e) {}
      }

      step++;
    }, 45); // ~1.1s total duration
  });
}

if (btnBingoClear) {
  btnBingoClear.addEventListener('click', () => {
    // Stop any active randomize animation
    if (randomizeInterval) {
      clearInterval(randomizeInterval);
      randomizeInterval = null;
    }
    if (btnBingoRandom) btnBingoRandom.disabled = false;
    btnBingoClear.disabled = false;

    bingoSetupBoard = Array(25).fill(null);
    bingoNextNumber = 1;
    renderBingoSetupGrid();
    updateSetupStatus();
    playErrorSound();
  });
}

// Bind Bingo chat elements
const btnBingoSendChat = document.getElementById('btn-bingo-send-chat');
const bingoChatInput = document.getElementById('bingo-chat-input');

if (btnBingoSendChat && bingoChatInput) {
  btnBingoSendChat.addEventListener('click', () => handleChatSend(bingoChatInput));
  bingoChatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleChatSend(bingoChatInput);
  });
}

// -------------------------------------------------------------
// BINGO SOCKET RECEIVERS
// -------------------------------------------------------------

socket.on('bingo_start_placement', () => {
  closeAlert(); // Close any active popups/toasts
  if (randomizeInterval) {
    clearInterval(randomizeInterval);
    randomizeInterval = null;
  }
  bingoSetupBoard = Array(25).fill(null);
  bingoNextNumber = 1;
  
  // Enable setup buttons in case they were disabled from a previous round
  if (btnBingoRandom) btnBingoRandom.disabled = false;
  if (btnBingoClear) btnBingoClear.disabled = false;
  
  const setupInstructions = document.getElementById('bingo-setup-instructions');
  if (setupInstructions) {
    setupInstructions.textContent = 'Tap the empty squares below to place numbers 1 to 25. First square gets 1, then 2, etc.';
  }

  showScreen('bingoSetup');
  renderBingoSetupGrid();
  updateSetupStatus();
  
  document.getElementById('bingo-setup-waiting-list').style.display = 'block';
});

socket.on('bingo_board_accepted', () => {
  if (btnBingoRandom) btnBingoRandom.disabled = true;
  if (btnBingoClear) btnBingoClear.disabled = true;
  
  const setupInstructions = document.getElementById('bingo-setup-instructions');
  if (setupInstructions) {
    setupInstructions.textContent = 'Your board has been submitted successfully! Waiting for other players to finish...';
  }
});

socket.on('bingo_game_started', ({ currentTurnPlayerId: turnId }) => {
  currentTurnPlayerId = turnId;
  myBingoBoard = [...bingoSetupBoard];
  calledNumbers = [];
  previousLinesCount = 0; // Reset tracked completed lines count
  
  document.getElementById('bingo-last-called-container').style.display = 'none';
  document.getElementById('bingo-last-called').textContent = '-';
  
  showScreen('bingoGame');
  renderBingoPlayGrid(myBingoBoard, calledNumbers);
});

socket.on('bingo_number_called', ({ number, calledNumbers: list }) => {
  calledNumbers = list;
  playSuccessSound();

  const banner = document.getElementById('bingo-last-called');
  const container = document.getElementById('bingo-last-called-container');
  if (container && banner) {
    container.style.display = 'flex';
    banner.textContent = number;
    banner.classList.add('pulse');
    setTimeout(() => banner.classList.remove('pulse'), 800);
  }
});

socket.on('bingo_round_ended', ({ winnerNames, round, totalRounds }) => {
  showAlert(
    'Round Ended 🏁', 
    `${winnerNames} won Round ${round}! Match length: Best of ${totalRounds}.\n\nPreparing next board in 5 seconds...`
  );
});


