require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');

const { getLoginURL, exchangeCode, loadTokenFromDB } = require('./spotify');
const { djLoop, enableEngine, disableEngine } = require('./engine');

mongoose.connect(process.env.MONGO_URI);
mongoose.connection.once('open', () => console.log('MongoDB connected'));

const app = express();
let djStarted = false;

function startDJ() {
  if (!djStarted) {
    setInterval(djLoop, 10000);
    djStarted = true;
    console.log('🎧 DJ loop started');
  }
}

app.get('/', (req, res) => {
  res.send(`<a href="/login">Login with Spotify</a>`);
});

app.get('/login', (req, res) => {
  res.redirect(getLoginURL());
});

app.get('/callback', async (req, res) => {
  await exchangeCode(req.query.code);
  startDJ();
  res.send('Spotify connected. You will not need to login again.');
});

app.get('/engine/:id', (req, res) => {
  const id = req.params.id;

  if (id === '1') {
    enableEngine();
    res.send('Engine ON');
  } else if (id === '0') {
    disableEngine();
    res.send('Engine OFF');
  } else {
    res.status(400).send('Invalid value. Use /engine/1 or /engine/0');
  }
});

(async () => {
  const ok = await loadTokenFromDB();
  if (ok) {
    console.log('Token loaded from DB. Auto starting DJ...');
    startDJ();
  } else {
    console.log('No token found. Open http://localhost:3000/login');
  }
})();

app.listen(3000, () => {
  console.log('FreshPlay DJ running on http://localhost:3000');
});
