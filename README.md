🧩 MikeBotStudio — LSU
MikeBotStudio is a visual playground for learning robotics and programming concepts through interactive block-based coding (Blockly) and game simulation (Phaser).
Developed for educational use at Louisiana State University (LSU).

🚀 Features

🎮 Phaser-based Simulation — Real-time robot movement and interaction.
🧱 Blockly Integration — Drag-and-drop block programming with instant code generation.
🤖 AI Command Assistant — Type natural language commands and auto-generate blocks.
🎨 LSU-Themed UI — LSU color palette with responsive and animated design.
🧩 Custom Blocks — Move, rotate, pick up, and release actions linked to the robot API.


📦 Requirements
Before running this project, make sure you have:

Node.js (version 16 or later)
npm (comes with Node.js)
A local web server such as:

Live Server (VSCode extension), or
Python's built-in server (python3 -m http.server 5500)




🛠️ Installation
1. Clone the repository
bashgit clone https://github.com/riseatlsu/MikeBotStudio.git
cd MikeBotStudio
2. Install dependencies
bashnpm install
This will install all required Node.js packages including dependencies for the ChatGPT integration server.

🎯 Running the Project
MikeBotStudio has two components that need to run simultaneously:
A. Frontend (HTML/Blockly/Phaser)
Option 1: Using Live Server (VSCode)

Open the project folder in VSCode
Right-click on index.html
Select "Open with Live Server"
The app will open at http://localhost:5500 (or similar)

Option 2: Using Python
bashpython3 -m http.server 5500
Then open your browser to http://localhost:5500
Option 3: Using Node.js http-server
bashnpx http-server -p 5500
B. Backend (ChatGPT Integration Server)
In a separate terminal, run the Node.js server for AI command processing:
bashnpm start
Or:
bashnode server.js
The backend server will start on port 3000 (or as configured) and handle:

Natural language command processing
ChatGPT API integration
Block generation from text commands


🔧 Configuration
ChatGPT API Setup

Create a .env file in the root directory:

bashtouch .env

Add your OpenAI API key:

envOPENAI_API_KEY=your_api_key_here
PORT=3000
