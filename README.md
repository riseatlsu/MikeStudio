#  MikeBotStudio 
<img width="300" height="300" alt="image" src="https://github.com/user-attachments/assets/c7b12518-d9a0-4a5f-96df-f11b5c71fc13" />

**MikeBotStudio** is a visual playground for learning robotics and programming concepts through interactive block-based coding (Blockly) and game simulation (Phaser).  

---

## 🚀 Features

- 🎮 **Phaser-based Simulation** — Real-time robot movement and interaction.
- 🧱 **Blockly Integration** — Drag-and-drop block programming with instant code generation.
- 🤖 **AI Command Assistant** — Type natural language commands and auto-generate blocks.
- 🧩 **Custom Blocks** — Move, rotate, pick up, and release actions linked to the robot API.

---

## 📦 Requirements

Before running this project, make sure you have:

- [Node.js](https://nodejs.org/en/download) (version 16 or later)
- [npm](https://www.npmjs.com/) (comes with Node.js)
- A local web server such as:
  - [Live Server (VSCode extension)](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer), **or**
  - Python's built-in server (`python3 -m http.server 5500`)

---

## 🛠️ Installation

### 1. Clone the repository

```bash
git clone https://github.com/riseatlsu/MikeBotStudio.git
cd MikeBotStudio
```

### 2. Install dependencies

```bash
npm install
```

This will install all required Node.js packages including dependencies for the ChatGPT integration server.

---

## 🎯 Running the Project

MikeBotStudio has **two components** that need to run simultaneously:

### A. Frontend (HTML/Blockly/Phaser)

```bash
npx vite dev
```
Then go to the localhost link that appears in the terminal.

### B. Backend (ChatGPT Integration Server)

In a **separate terminal**, run the Node.js server for AI command processing:

```bash
npm start
```
Or:
```bash
node server.js
```

The backend server will start on **port 3000** (or as configured) and handle:
- Natural language command processing
- ChatGPT API integration
- Block generation from text commands

---

## 👥 Authors

- **LSU RISE Lab** - [GitHub](https://github.com/riseatlsu)

---

## 🏫 Acknowledgments

- Louisiana State University (LSU)
- [Blockly](https://developers.google.com/blockly) by Google
- [Phaser](https://phaser.io/) game framework
- [OpenAI](https://openai.com/) for ChatGPT API
