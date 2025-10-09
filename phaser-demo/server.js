const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 8080;

// Serve everything inside "server"
app.use(express.static(path.join(__dirname, 'server')));

// Default route sends index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'server', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Phaser game running at http://127.0.0.1:${PORT}`);
});
