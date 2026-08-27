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
// 16 Cool Gamer Vector Avatars (High-contrast, sleek cyberpunk/esports badges)
const COOL_AVATARS = [
  { id: 'cyber_ninja', name: 'Cyber Ninja', bg: 'linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)', border: '#38bdf8', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a5 5 0 0 0-5 5v2a5 5 0 0 0 10 0V7a5 5 0 0 0-5-5z"/><path d="M8 11h8"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/><path d="M4 18v-2a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v2"/><circle cx="12" cy="7" r="1" fill="#38bdf8"/></svg>' },
  { id: 'dragon_blaze', name: 'Dragon Blaze', bg: 'linear-gradient(135deg, #f59e0b 0%, #dc2626 100%)', border: '#fbbf24', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 3z"/><path d="M12 18a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" fill="#fde047"/></svg>' },
  { id: 'cyber_skull', name: 'Cyber Skull', bg: 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)', border: '#f472b6', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="12" r="1.5" fill="#22d3ee"/><circle cx="15" cy="12" r="1.5" fill="#f43f5e"/><path d="M8 20v-2h8v2"/><path d="M12.5 17l-.5-1-.5 1"/><path d="M16 20a2 2 0 0 0 1.56-3.25 8 8 0 1 0-11.12 0A2 2 0 0 0 8 20"/></svg>' },
  { id: 'mecha_titan', name: 'Mecha Titan', bg: 'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)', border: '#818cf8', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="5" width="16" height="14" rx="3"/><path d="M12 2v3"/><line x1="8" y1="12" x2="16" y2="12" stroke="#38bdf8" stroke-width="3"/><path d="M9 16h6"/><circle cx="2" cy="12" r="1.5" fill="white"/><circle cx="22" cy="12" r="1.5" fill="white"/></svg>' },
  { id: 'frost_wolf', name: 'Frost Wolf', bg: 'linear-gradient(135deg, #06b6d4 0%, #0284c7 100%)', border: '#67e8f9', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15 8 21 9 17 14 18 20 12 17 6 20 7 14 3 9 9 8 12 2"/><circle cx="12" cy="12" r="2" fill="#a5f3fc"/></svg>' },
  { id: 'phoenix_flame', name: 'Phoenix Flame', bg: 'linear-gradient(135deg, #ea580c 0%, #b91c1c 100%)', border: '#fb923c', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l3 6 6 1-4.5 4.5 1 6.5L12 17l-5.5 3 1-6.5L3 9l6-1z"/><path d="M12 7v6l3-1"/></svg>' },
  { id: 'shadow_rogue', name: 'Shadow Rogue', bg: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', border: '#94a3b8', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a8 8 0 0 0-8 8v12l8-4 8 4V10a8 8 0 0 0-8-8z"/><circle cx="9" cy="10" r="1.5" fill="#f87171"/><circle cx="15" cy="10" r="1.5" fill="#f87171"/></svg>' },
  { id: 'cyber_samurai', name: 'Cyber Samurai', bg: 'linear-gradient(135deg, #ef4444 0%, #991b1b 100%)', border: '#f87171', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2v17.5c0 1.4-1.1 2.5-2.5 2.5h0c-1.4 0-2.5-1.1-2.5-2.5V2"/><path d="M6 9l6-4 6 4"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="8" y1="19" x2="16" y2="19"/></svg>' },
  { id: 'astral_mage', name: 'Astral Mage', bg: 'linear-gradient(135deg, #a855f7 0%, #6b21a8 100%)', border: '#c084fc', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l2.5 6.5L21 11l-5 4.5 1.5 7L12 19l-5.5 3.5L8 15.5 3 11l6.5-2.5z"/><circle cx="12" cy="12" r="3" fill="#fde047"/></svg>' },
  { id: 'toxic_viper', name: 'Toxic Viper', bg: 'linear-gradient(135deg, #10b981 0%, #047857 100%)', border: '#34d399', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2c5.5 0 10 4.5 10 10s-4.5 10-10 10S2 17.5 2 12 6.5 2 12 2z"/><path d="M8 12s1.5 2 4 2 4-2 4-2"/><circle cx="9" cy="9" r="1.5" fill="#a7f3d0"/><circle cx="15" cy="9" r="1.5" fill="#a7f3d0"/></svg>' },
  { id: 'space_trooper', name: 'Space Trooper', bg: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)', border: '#60a5fa', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a9 9 0 0 0-9 9v4a3 3 0 0 0 3 3h12a3 3 0 0 0 3-3v-4a9 9 0 0 0-9-9z"/><ellipse cx="12" cy="11" rx="6" ry="3" fill="#fbbf24"/></svg>' },
  { id: 'valkyrie_storm', name: 'Valkyrie Storm', bg: 'linear-gradient(135deg, #f59e0b 0%, #b45309 100%)', border: '#fcd34d', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" fill="#fef08a"/></svg>' },
  { id: 'demon_warlord', name: 'Demon Warlord', bg: 'linear-gradient(135deg, #be123c 0%, #881337 100%)', border: '#fb7185', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4l3 5m11-5l-3 5"/><path d="M12 21a8 8 0 0 0 8-8c0-3-2-6-5-7l-3 3-3-3C6 7 4 10 4 13a8 8 0 0 0 8 8z"/><circle cx="9" cy="13" r="1.5" fill="#f43f5e"/><circle cx="15" cy="13" r="1.5" fill="#f43f5e"/></svg>' },
  { id: 'laser_cat', name: 'Laser Cat', bg: 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)', border: '#f472b6', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11V6l4 3 4-4 4 4 4-3v5a8 8 0 1 1-16 0z"/><rect x="6" y="9" width="12" height="4" rx="1" fill="#38bdf8"/></svg>' },
  { id: 'glitch_phantom', name: 'Glitch Phantom', bg: 'linear-gradient(135deg, #14b8a6 0%, #0f766e 100%)', border: '#2dd4bf', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 10h.01M15 10h.01M12 2a8 8 0 0 0-8 8v12l3-3 2.5 2.5L12 19l2.5 2.5L17 19l3 3V10a8 8 0 0 0-8-8z"/><circle cx="9" cy="10" r="1" fill="#67e8f9"/><circle cx="15" cy="10" r="1" fill="#67e8f9"/></svg>' },
  { id: 'apex_champion', name: 'Apex Champion', bg: 'linear-gradient(135deg, #eab308 0%, #ca8a04 100%)', border: '#facc15', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.45 1-1 1H8c-.55 0-1 .45-1 1v1c0 .55.45 1 1 1h8c.55 0 1-.45 1-1v-1c0-.55-.45-1-1-1h-1c-.55 0-1-.45-1-1v-2.34"/><path d="M18 4H6v7a6 6 0 0 0 12 0V4z" fill="#fef08a"/></svg>' }
];

let selectedAvatar = localStorage.getItem('shabd_anuvad_avatar') || 'cyber_ninja';
let voiceCallerEnabled = true;

function getAvatarData(avatarId) {
  return COOL_AVATARS.find(a => a.id === avatarId) || COOL_AVATARS[0];
}

function renderAvatarHtml(avatarId, customClass = '', customStyle = '') {
  const av = getAvatarData(avatarId);
  return `
    <div class="player-avatar ${customClass}" style="background: ${av.bg}; border-color: ${av.border}; ${customStyle}" title="${av.name}">
      ${av.svg}
    </div>
  `;
}

function initAvatarPicker() {
  const grid = document.getElementById('avatar-options-grid');
  const display = document.getElementById('current-avatar-display');
  const nameDisplay = document.getElementById('current-avatar-name');
  if (!grid) return;

  grid.innerHTML = '';
  COOL_AVATARS.forEach(av => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `avatar-option-btn ${av.id === selectedAvatar ? 'selected' : ''}`;
    btn.title = av.name;
    btn.style.background = av.bg;
    btn.style.borderColor = av.border;
    btn.innerHTML = av.svg;
    btn.addEventListener('click', () => {
      selectedAvatar = av.id;
      localStorage.setItem('shabd_anuvad_avatar', av.id);
      if (display) {
        display.style.background = av.bg;
        display.style.borderColor = av.border;
        display.innerHTML = av.svg;
      }
      if (nameDisplay) nameDisplay.textContent = av.name;
      document.querySelectorAll('.avatar-option-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
    });
    grid.appendChild(btn);
  });

  const activeAv = getAvatarData(selectedAvatar);
  if (display) {
    display.style.background = activeAv.bg;
    display.style.borderColor = activeAv.border;
    display.innerHTML = activeAv.svg;
  }
  if (nameDisplay) nameDisplay.textContent = activeAv.name;
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

// Play a quick ink stamp dab sound
function playDabSound() {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(140, now + 0.12);
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.12);
  } catch (e) {}
}

// Game Type selection handler (called from Welcome Screen)
window.selectGameType = function(type) {
  selectedGameType = type;
  
  const translateCard = document.getElementById('select-game-translate');
  const bingo25Card = document.getElementById('select-game-bingo25');
  const bingo75Card = document.getElementById('select-game-bingo75');
  
  if (translateCard) translateCard.classList.toggle('active', type === 'translate');
  if (bingo25Card) bingo25Card.classList.toggle('active', type === 'bingo25');
  if (bingo75Card) bingo75Card.classList.toggle('active', type === 'bingo75');
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

// Play a low-pitched sawtooth explosion rumble for Bomb cell detonations
function playExplosionSound() {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.55);
    
    gain.gain.setValueAtTime(0.22, now);
    gain.gain.linearRampToValueAtTime(0.001, now + 0.55);
    
    const bassOsc = ctx.createOscillator();
    const bassGain = ctx.createGain();
    bassOsc.type = 'sine';
    bassOsc.frequency.setValueAtTime(80, now);
    bassOsc.frequency.exponentialRampToValueAtTime(20, now + 0.7);
    bassGain.gain.setValueAtTime(0.3, now);
    bassGain.gain.linearRampToValueAtTime(0.001, now + 0.7);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    bassOsc.connect(bassGain);
    bassGain.connect(ctx.destination);
    
    osc.start(now);
    osc.stop(now + 0.55);
    bassOsc.start(now);
    bassOsc.stop(now + 0.7);
  } catch (e) {}
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

  // Guarantee Bingo setup grid renders if switching to setup
  if (screenKey === 'bingoSetup') {
    renderBingoSetupGrid();
    updateSetupStatus();
  }
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
  initAvatarPicker();

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

inputRoomCode.addEventListener('input', (e) => {
  e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4);
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
  socket.emit('create_room', { username: username, gameType: selectedGameType, avatar: selectedAvatar });
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
  socket.emit('join_room', { code: currentRoomCode, username: username, avatar: selectedAvatar });
});

// Lobby Screen
lobbyRoomCodeBadge.addEventListener('click', copyRoomCode);

btnStartGame.addEventListener('click', () => {
  if (!isHost) return;

  const isBingo = (selectedGameType === 'bingo' || selectedGameType === 'bingo25' || selectedGameType === 'bingo75');
  if (isBingo) {
    const turnTimer = document.getElementById('bingo-timer-select') ? document.getElementById('bingo-timer-select').value : 0;
    const matchRounds = document.getElementById('bingo-rounds-select') ? document.getElementById('bingo-rounds-select').value : 5;
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
  
  // Pre-focus guess input immediately on mobile
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

// Host Game Over Match Restart Actions
const btnRestartMatch = document.getElementById('btn-restart-match');
const btnReturnLobby = document.getElementById('btn-return-lobby');

if (btnRestartMatch) {
  btnRestartMatch.addEventListener('click', () => {
    if (!isHost || !currentRoomCode) return;
    const isBingo = (selectedGameType === 'bingo' || selectedGameType === 'bingo25' || selectedGameType === 'bingo75');
    if (isBingo) {
      const turnTimer = document.getElementById('bingo-timer-select') ? document.getElementById('bingo-timer-select').value : 0;
      const matchRounds = document.getElementById('bingo-rounds-select') ? document.getElementById('bingo-rounds-select').value : 5;
      socket.emit('start_game', {
        code: currentRoomCode,
        bingoTurnTimer: turnTimer,
        bingoMatchRounds: matchRounds
      });
    } else {
      const roundTime = document.getElementById('timer-select').value;
      const totalRounds = selectRounds.value;
      const mode = document.getElementById('mode-select').value;
      socket.emit('start_game', {
        code: currentRoomCode,
        roundTime: roundTime,
        totalRounds: totalRounds,
        gameMode: mode
      });
    }
  });
}

if (btnReturnLobby) {
  btnReturnLobby.addEventListener('click', () => {
    if (!isHost || !currentRoomCode) return;
    socket.emit('return_to_lobby', { code: currentRoomCode });
  });
}

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
  
  const roundModal = document.getElementById('bingo-round-modal');
  if (roundModal) roundModal.style.display = 'none';

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
  const isBingo = (data.gameType === 'bingo' || data.gameType === 'bingo25' || data.gameType === 'bingo75');
  selectedGameType = data.gameType || 'translate';
  
  // Dynamically update URL to match the active room path
  if (data.gameState === 'lobby' || data.gameState === 'playing' || data.gameState === 'round_end' || data.gameState === 'placement') {
    const targetPath = `/room/${data.code}`;
    if (window.location.pathname !== targetPath) {
      window.history.pushState(null, '', targetPath);
    }
  }

  // Toggle Column headers: visible in 75-Ball, hidden in Bingo 1-25
  const colHeaders = document.querySelector('.bingo-col-headers');
  if (colHeaders) {
    colHeaders.style.display = (data.gameType === 'bingo75') ? 'grid' : 'none';
  }

  // Sync my personal bingo board
  if (data.myBingoBoard) {
    myBingoBoard = data.myBingoBoard;
  }

  // Verify Host status
  isHost = (socket.id === data.hostId);
  
  if (isBingo) {
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
            ${renderAvatarHtml(p.avatar, '', 'width:28px; height:28px; margin-right:8px;')}
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
      renderBingoSetupGrid();
      updateSetupStatus();

      // Render setup ready status list
      const statusContainer = document.getElementById('bingo-players-ready-status');
      if (statusContainer) {
        statusContainer.innerHTML = '';
        data.players.forEach(p => {
          const div = document.createElement('div');
          div.className = 'player-ready-item';
          div.innerHTML = `
            <div style="display:flex; align-items:center;">
              ${renderAvatarHtml(p.avatar, '', 'width:24px; height:24px; font-size:0.8rem;')}
              <span>${p.username} ${p.id === socket.id ? '(You)' : ''}</span>
            </div>
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
      
      const timerStr = (data.bingoTurnTimerVal > 0 && data.timeLeft > 0) ? ` (${data.timeLeft}s)` : '';
      if (me && me.isSpectator) {
        turnBanner.className = 'turn-banner spectating';
        turnBanner.textContent = `👁️ You are Spectating. Wait for the next match!`;
        document.body.classList.remove('bingo-my-turn-active');
      } else if (isMyTurn) {
        turnBanner.className = 'turn-banner my-turn';
        turnBanner.innerHTML = `🎯 It's <strong>YOUR turn</strong>! Pick a number on your board.${timerStr}`;
        document.body.classList.add('bingo-my-turn-active');
      } else {
        turnBanner.className = 'turn-banner waiting-turn';
        turnBanner.innerHTML = `⏳ Waiting for <strong>${activeName}</strong> to call a number...${timerStr}`;
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
          <div class="player-score-info" style="display:flex; align-items:center;">
            ${renderAvatarHtml(p.avatar, '', 'width:26px; height:26px; margin-right:6px;')}
            <span style="font-weight: ${isMe ? 'bold' : 'normal'}">${p.username} ${isMe ? '(You)' : ''}</span>
            ${p.id === data.hostId ? '<span class="player-role-badge" style="font-size:0.6rem; padding:1px 4px; margin-left:4px;">Host</span>' : ''}
            <span class="match-wins-badge" style="margin-left:5px; font-size:0.75rem; color:var(--warning); font-weight:bold;">🏆 ${p.matchWins || 0}</span>
          </div>
          <div class="bingo-score-badge">
            ${lineRepr}
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
            <div class="player-avatar" style="width:24px; height:24px; font-size:0.9rem;">${p.avatar || '🐱'}</div>
            <span class="player-name" style="font-weight: ${isMe ? 'bold' : 'normal'}">${p.username} ${isMe ? '(You)' : ''}</span>
            ${isPlayerHost ? '<span class="player-role-badge">Host</span>' : ''}
          </div>
          <div class="player-status-wrapper">
            <span class="player-score"></span>
          </div>
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
          <div class="player-score-info" style="display:flex; align-items:center;">
            ${renderAvatarHtml(p.avatar, '', 'width:24px; height:24px; margin-right:6px;')}
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

// Bingo Card Assigned event (Receive authentic 75-Ball card from server)
socket.on('bingo_card_assigned', ({ board }) => {
  myBingoBoard = board;
  renderBingoPlayGrid(myBingoBoard, calledNumbers);
});

// 9. Game Over Rank Presentation
socket.on('game_over', (data) => {
  showScreen('gameover');
  
  // Close any active bingo round modal
  const roundModal = document.getElementById('bingo-round-modal');
  if (roundModal) roundModal.style.display = 'none';

  // Show host actions vs guest message
  const hostActions = document.getElementById('host-gameover-actions');
  const guestMsg = document.getElementById('guest-gameover-msg');
  if (isHost) {
    if (hostActions) hostActions.style.display = 'flex';
    if (guestMsg) guestMsg.style.display = 'none';
  } else {
    if (hostActions) hostActions.style.display = 'none';
    if (guestMsg) guestMsg.style.display = 'block';
  }

  // Set Winner Name
  let announcementHtml = '';
  if (data.message) {
    announcementHtml += `<span style="color:var(--secondary); display:block; margin-bottom:12px; font-size:1.2rem;">💔 ${data.message}</span>`;
  }
  
  if (selectedGameType === 'bingo') {
    if (data.finalScores && data.finalScores.length > 0) {
      const winner = data.finalScores[0];
      announcementHtml += `🏆 ${winner.avatar || '🐱'} ${winner.username} won the match!`;
    } else {
      announcementHtml += "No players in the game.";
    }
  } else {
    if (data.finalScores && data.finalScores.length > 0) {
      const winner = data.finalScores[0];
      announcementHtml += `🏆 ${winner.avatar || '🐱'} ${winner.username} wins the match with ${winner.score} correct answers!`;
    } else {
      announcementHtml += "No players in the game.";
    }
  }
  winnerAnnouncementText.innerHTML = announcementHtml;
  
  // Render Leaderboard list
  finalPlayersList.innerHTML = '';
  (data.finalScores || []).forEach((p, idx) => {
    const li = document.createElement('li');
    const unitText = selectedGameType === 'bingo' ? 'Match Wins' : 'Correct';
    li.innerHTML = `
      <div style="display:flex; align-items:center;">
        <span class="rank-badge">${idx + 1}</span>
        ${renderAvatarHtml(p.avatar, '', 'width:28px; height:28px; margin-left:6px;')}
        <span style="font-weight:700;">${p.username}</span>
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
        ${renderAvatarHtml(p.avatar, 'ring-player-avatar', 'width:44px; height:44px;')}
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
  const calledSet = new Set([...calledList, 'FREE', 'free']);

  const checkAndAdd = (indices) => {
    const isComplete = indices.every(idx => calledSet.has(board[idx]) || board[idx] === 'FREE');
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
          if (num && num >= 1 && num <= 75) {
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
      gridEl.appendChild(cell);
    }
  }

  const latestNum = (calledList && calledList.length > 0) ? calledList[calledList.length - 1] : null;

  // Update existing cells in-place smoothly without destroying elements
  for (let i = 0; i < 25; i++) {
    const cell = gridEl.children[i];
    const val = myBoard[i];

    if (val === 'FREE' || val === 'free' || i === 12 && (val === 'FREE' || !val)) {
      cell.className = 'bingo-cell play-mode free-space called';
      cell.innerHTML = '⭐<br><small style="font-size:0.65rem; font-weight:800; letter-spacing:1px;">FREE</small>';
      cell.dataset.number = 'FREE';
      continue;
    }

    const num = parseInt(val) || '';
    cell.dataset.number = num;
    if (cell.textContent !== String(num)) {
      cell.textContent = num;
    }
    
    const isCalled = calledList.includes(num);
    const isLatest = (num === latestNum);
    const isLineCompleted = completedCells.includes(i);

    if (isLineCompleted) {
      cell.className = isLatest 
        ? 'bingo-cell play-mode called line-completed last-called' 
        : 'bingo-cell play-mode called line-completed';
    } else if (isCalled) {
      cell.className = isLatest 
        ? 'bingo-cell play-mode called last-called' 
        : 'bingo-cell play-mode called';
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

// Floating Ball Pop Announcer Helper
function showFloatingBallPop(callerName, displayValue) {
  const announcer = document.getElementById('bingo-pop-announcer');
  const ballIcon = document.getElementById('bingo-pop-ball-icon');
  const callerEl = document.getElementById('bingo-pop-caller-name');
  const valueEl = document.getElementById('bingo-pop-ball-value');
  
  if (announcer && ballIcon && valueEl) {
    if (callerEl) callerEl.textContent = callerName || 'Player Called';
    valueEl.textContent = displayValue;
    
    // Pick column letter or target icon
    if (typeof displayValue === 'string' && displayValue.includes('-')) {
      ballIcon.textContent = displayValue.split('-')[0];
    } else {
      ballIcon.textContent = '🎯';
    }

    announcer.classList.remove('active');
    void announcer.offsetWidth; // trigger reflow
    announcer.classList.add('active');

    if (window.popAnnouncerTimeout) clearTimeout(window.popAnnouncerTimeout);
    window.popAnnouncerTimeout = setTimeout(() => {
      announcer.classList.remove('active');
    }, 2200);
  }
}

// Bind Bingo setup action buttons
const btnBingoRandom = document.getElementById('btn-bingo-random');
const btnBingoClear = document.getElementById('btn-bingo-clear');
let randomizeInterval = null;

if (btnBingoRandom) {
  btnBingoRandom.addEventListener('click', () => {
    let ctx = null;
    try {
      ctx = getAudioContext();
      if (ctx && ctx.state === 'suspended') ctx.resume();
    } catch (e) {}

    if (randomizeInterval) clearInterval(randomizeInterval);
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
    const gridEl = document.getElementById('bingo-setup-grid');
    if (gridEl) {
      for (let i = 0; i < 25; i++) {
        const c = gridEl.children[i];
        if (c) {
          c.textContent = '';
          c.classList.remove('placed');
        }
      }
    }
    const statusEl = document.getElementById('bingo-setup-status-msg');
    if (statusEl) statusEl.textContent = 'Filling board... 🎲';

    // Create random order of cell indices (0 to 24) to fill staggered
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
        btnBingoRandom.disabled = false;
        if (btnBingoClear) btnBingoClear.disabled = false;

        bingoNextNumber = 26;
        updateSetupStatus();
        playSuccessSound();
        return;
      }

      const cellIdx = cellIndices[step];
      const num = numbers[step];
      bingoSetupBoard[cellIdx] = num;
      
      // Direct DOM update on just the 1 target cell (60fps ultra smooth)
      if (gridEl && gridEl.children[cellIdx]) {
        const cell = gridEl.children[cellIdx];
        cell.textContent = num;
        cell.classList.add('placed');
      }

      // Lightweight snappy placement tone
      if (ctx && ctx.state !== 'suspended') {
        try {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(260 + step * 24, ctx.currentTime);
          gain.gain.setValueAtTime(0.04, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.04);
        } catch (e) {}
      }

      step++;
    }, 24); // ~600ms total smooth progression
  });
}

if (btnBingoClear) {
  btnBingoClear.addEventListener('click', () => {
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
  
  if (btnBingoRandom) btnBingoRandom.disabled = false;
  if (btnBingoClear) btnBingoClear.disabled = false;
  
  const setupInstructions = document.getElementById('bingo-setup-instructions');
  if (setupInstructions) {
    setupInstructions.textContent = 'Tap squares to place numbers 1 to 25, or click Randomize 🎲.';
  }
  
  showScreen('bingoSetup');
  renderBingoSetupGrid();
  updateSetupStatus();
  
  document.getElementById('bingo-setup-waiting-list').style.display = 'block';
});

socket.on('bingo_board_accepted', () => {
  const statusEl = document.getElementById('bingo-setup-status-msg');
  if (statusEl) {
    statusEl.innerHTML = `<span style="color: var(--success); font-weight: bold;">Board complete! Waiting for other players... 👍</span>`;
  }
  const waitingList = document.getElementById('bingo-setup-waiting-list');
  if (waitingList) waitingList.style.display = 'block';
});

socket.on('bingo_game_started', ({ currentTurnPlayerId: turnId }) => {
  currentTurnPlayerId = turnId;
  if (!myBingoBoard || myBingoBoard.length !== 25) {
    myBingoBoard = [...bingoSetupBoard];
  }
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

  const displayVal = (selectedGameType === 'bingo75') ? get75BallLabel(number) : `Number ${number}`;
  
  // Pop floating notification
  const activeP = (lastPlayersList && lastPlayersList.find(p => p.id === currentTurnPlayerId));
  const callerName = activeP ? activeP.username : 'Player';
  showFloatingBallPop(callerName, displayVal);

  const banner = document.getElementById('bingo-last-called');
  const container = document.getElementById('bingo-last-called-container');
  if (container && banner) {
    container.style.display = 'flex';
    banner.textContent = (selectedGameType === 'bingo75') ? get75BallLabel(number) : number;
    banner.classList.add('pulse');
    setTimeout(() => banner.classList.remove('pulse'), 800);
  }

  renderBingoPlayGrid(myBingoBoard, calledNumbers);
});

socket.on('bingo_round_ended', (data) => {
  const roundModal = document.getElementById('bingo-round-modal');
  const title = document.getElementById('bingo-round-modal-title');
  const winnersList = document.getElementById('round-winners-list');
  const standingsTbody = document.getElementById('bingo-standings-tbody');
  const countdownBar = document.getElementById('round-countdown-bar');
  
  if (roundModal && title && winnersList && standingsTbody) {
    title.textContent = `Round ${data.round} Result! (Best of ${data.totalRounds})`;
    
    // Render round winners
    winnersList.innerHTML = '';
    const winners = data.roundWinners || [];
    if (winners.length > 0) {
      winners.forEach(w => {
        const item = document.createElement('div');
        item.className = 'round-winner-item';
        item.innerHTML = `
          <div class="winner-user-col">
            ${renderAvatarHtml(w.avatar, '', 'width:28px; height:28px;')}
            <span>${w.username}</span>
          </div>
          <span class="winner-badge">🏆 Winner! (+1 Win)</span>
        `;
        winnersList.appendChild(item);
      });
    } else {
      winnersList.innerHTML = `<div style="color:var(--text-muted); font-size:0.9rem;">Round completed!</div>`;
    }

    // Render series standings
    standingsTbody.innerHTML = '';
    const standings = data.standings || [];
    standings.forEach((p, idx) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><span class="rank-badge" style="font-size:0.75rem; width:20px; height:20px;">${idx + 1}</span></td>
        <td class="standings-user-col">${renderAvatarHtml(p.avatar, '', 'width:24px; height:24px;')} <span>${p.username}</span></td>
        <td><strong style="color:var(--warning);">🏆 ${p.matchWins}</strong></td>
        <td>${p.completedLines} / 5</td>
      `;
      standingsTbody.appendChild(tr);
    });

    // Animate countdown bar
    if (countdownBar) {
      countdownBar.style.transition = 'none';
      countdownBar.style.width = '100%';
      setTimeout(() => {
        countdownBar.style.transition = 'width 5s linear';
        countdownBar.style.width = '0%';
      }, 50);
    }

    roundModal.style.display = 'flex';
  }
});

socket.on('bingo_bomb_detonated', ({ bombNumber, freeStrikeNumber }) => {
  // Trigger screen flash animation
  document.body.classList.add('flash-red-active');
  setTimeout(() => {
    document.body.classList.remove('flash-red-active');
  }, 450);

  // Play explosion sound
  playExplosionSound();

  // Show details in system warning popup
  showAlert(
    '💥 BOMB DETONATED! 💣',
    `Called number ${bombNumber} was a hidden bomb!\n\nThis triggered a free strike on number ${freeStrikeNumber} for all players!`
  );
  
  // Auto close the notification after 3 seconds to keep action fast
  setTimeout(() => {
    closeAlert();
  }, 3000);
});


