# 🎮 Shabd Anuvad - Playing & Deployment Guide

This guide explains how you can play the game with your friends right now, and how you can deploy the game permanently to the internet so it runs 24/7.

---

## 1. Play with Friends Right Now (No Setup Required)

Because your local server is currently running, your friends can join your lobby immediately using one of the following methods:

### Option A: Friends on the Same Wi-Fi (Local Play)
If you and your friends are in the same room or connected to the same Wi-Fi network:
1. Share this local IP link with them:
   👉 **[http://192.168.1.34:3000](http://192.168.1.34:3000)**
2. They can open this link on their phones, tablets, or laptops to join instantly.

### Option B: Friends Anywhere in the World (Remote Play)
If you want to play with friends who are in different houses or countries, you can send them one of the active public tunnels:
* **Primary URL (Serveo)**:
   👉 **[https://7a62325f899e2552-103-61-255-182.serveousercontent.com](https://7a62325f899e2552-103-61-255-182.serveousercontent.com)**
   *(Your friends can click this link on any device to join immediately).*
   
* **Backup URL (Localtunnel)**:
   👉 **[https://lemon-ties-invite.loca.lt](https://lemon-ties-invite.loca.lt)**
   *(If prompted with a passcode screen, enter `103.61.255.182` and click Submit).*

---

## 2. Deploying Permanently Online (Free 24/7 Hosting)

If you want to make the website live permanently so it runs 24/7 even when your computer is closed or shut down, you can host the Node.js server for free.

Because this game uses **WebSockets (Socket.IO)** for instant multiplayer sync, you cannot host it on standard static platforms like Vercel, Netlify, or GitHub Pages (which only support static frontends). You must host it on a platform that runs Node.js background servers.

Here are the top two easiest free deployment options:

### 🌟 Method 1: Render.com (Highly Recommended & Easiest)
Render offers a free tier that supports Node.js servers and WebSockets.

1. **Upload your code to GitHub**:
   * Create a free account on [GitHub](https://github.com).
   * Create a new repository (e.g. `golu-word-game`) and push your game folder files to it.
2. **Connect to Render**:
   * Go to [Render.com](https://render.com) and sign up.
   * Click **New +** and select **Web Service**.
   * Connect your GitHub account and select your repository (`golu-word-game`).
3. **Configure Settings**:
   * **Name**: `shabd-anuvad`
   * **Language**: `Node`
   * **Build Command**: `npm install`
   * **Start Command**: `node server.js`
   * **Plan**: Select **Free**.
4. **Deploy**:
   * Click **Create Web Service**. Render will automatically compile and give you a public URL (e.g. `https://shabd-anuvad.onrender.com`) that you can share with anyone!

---

### 🚀 Method 2: Railway.app
Railway is another premium cloud hosting provider with a very fast setup.

1. Push your code repository to **GitHub**.
2. Go to [Railway.app](https://railway.app) and sign up.
3. Click **New Project** -> select **Deploy from GitHub repo**.
4. Select your repository. Railway automatically detects the `package.json` file and configures the start commands (`node server.js`).
5. Once built, go to your service settings, click **Generate Domain**, and share the URL with your friends!
