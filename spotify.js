const axios = require('axios');
const qs = require('querystring');
const Token = require('./models/Token');

let accessToken, refreshToken, expiresAt;

function getLoginURL() {
  const scope = [
    'user-read-playback-state',
    'user-modify-playback-state',
    'user-read-currently-playing',
    'user-top-read',
    'user-read-private',
  ].join(' ');

  return `https://accounts.spotify.com/authorize?${qs.stringify({
    response_type: 'code',
    client_id: process.env.SPOTIFY_CLIENT_ID,
    scope,
    redirect_uri: process.env.SPOTIFY_REDIRECT_URI,
  })}`;
}

async function exchangeCode(code) {
  const res = await axios.post(
    'https://accounts.spotify.com/api/token',
    qs.stringify({
      grant_type: 'authorization_code',
      code,
      redirect_uri: process.env.SPOTIFY_REDIRECT_URI,
    }),
    {
      headers: {
        Authorization:
          'Basic ' +
          Buffer.from(process.env.SPOTIFY_CLIENT_ID + ':' + process.env.SPOTIFY_CLIENT_SECRET).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    },
  );

  accessToken = res.data.access_token;
  refreshToken = res.data.refresh_token;
  expiresAt = Date.now() + res.data.expires_in * 1000;

  await Token.deleteMany({});
  await Token.create({ refreshToken });
}

async function refreshAccessToken() {
  const res = await axios.post(
    'https://accounts.spotify.com/api/token',
    qs.stringify({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
    {
      headers: {
        Authorization:
          'Basic ' +
          Buffer.from(process.env.SPOTIFY_CLIENT_ID + ':' + process.env.SPOTIFY_CLIENT_SECRET).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    },
  );

  accessToken = res.data.access_token;
  expiresAt = Date.now() + res.data.expires_in * 1000;
}

async function loadTokenFromDB() {
  const tokenDoc = await Token.findOne();
  if (!tokenDoc) return false;

  refreshToken = tokenDoc.refreshToken;
  await refreshAccessToken();
  return true;
}

async function api(method, url, data = null) {
  if (!accessToken || Date.now() > expiresAt - 60000) {
    await refreshAccessToken();
  }

  return axios({
    method,
    url: 'https://api.spotify.com/v1' + url,
    data,
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

module.exports = { getLoginURL, exchangeCode, api, loadTokenFromDB };
