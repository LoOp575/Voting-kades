const express = require('express');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Secret untuk hash fingerprint
const FINGERPRINT_SECRET = crypto.randomBytes(32).toString('hex');

// Path file data votes
const DATA_DIR = path.join(__dirname, 'data');
const VOTES_FILE = path.join(DATA_DIR, 'votes.json');
const DEVICES_FILE = path.join(DATA_DIR, 'devices.json');

// Buat folder data jika belum ada
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Inisialisasi file data
function loadVotes() {
  if (fs.existsSync(VOTES_FILE)) {
    return JSON.parse(fs.readFileSync(VOTES_FILE, 'utf8'));
  }
  return { '1': 0, '2': 0, '3': 0, '4': 0 };
}

function loadDevices() {
  if (fs.existsSync(DEVICES_FILE)) {
    return JSON.parse(fs.readFileSync(DEVICES_FILE, 'utf8'));
  }
  return {};
}

function saveVotes(votes) {
  fs.writeFileSync(VOTES_FILE, JSON.stringify(votes, null, 2));
}

function saveDevices(devices) {
  fs.writeFileSync(DEVICES_FILE, JSON.stringify(devices, null, 2));
}

// Inisialisasi data
if (!fs.existsSync(VOTES_FILE)) saveVotes(loadVotes());
if (!fs.existsSync(DEVICES_FILE)) saveDevices(loadDevices());

app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Generate device ID dari cookie + fingerprint
function getDeviceId(req) {
  const fingerprint = req.body.fingerprint || '';
  const cookieId = req.cookies._voting_device;
  
  // Hash kombinasi cookie + fingerprint
  const raw = `${cookieId || 'none'}|${fingerprint}`;
  return crypto
    .createHash('sha256')
    .update(raw + FINGERPRINT_SECRET)
    .digest('hex');
}

// Check apakah perangkat sudah voting
app.post('/api/check', (req, res) => {
  const devices = loadDevices();
  const deviceId = getDeviceId(req);
  
  const hasVoted = devices[deviceId] !== undefined;
  
  res.json({
    hasVoted,
    votedFor: devices[deviceId] || null
  });
});

// Submit vote
app.post('/api/vote', (req, res) => {
  const { candidate } = req.body;
  
  // Validasi kandidat
  if (!['1', '2', '3', '4'].includes(candidate)) {
    return res.status(400).json({ error: 'Kandidat tidak valid' });
  }
  
  const devices = loadDevices();
  const deviceId = getDeviceId(req);
  
  // Cek apakah sudah voting
  if (devices[deviceId] !== undefined) {
    return res.status(403).json({ 
      error: 'Perangkat ini sudah menggunakan hak suara',
      votedFor: devices[deviceId]
    });
  }
  
  // Set cookie device
  const deviceCookie = crypto.randomBytes(16).toString('hex');
  res.cookie('_voting_device', deviceCookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 365 * 24 * 60 * 60 * 1000, // 1 tahun
    path: '/'
  });
  
  // Re-hash device ID dengan cookie baru
  const fingerprint = req.body.fingerprint || '';
  const raw = `${deviceCookie}|${fingerprint}`;
  const newDeviceId = crypto
    .createHash('sha256')
    .update(raw + FINGERPRINT_SECRET)
    .digest('hex');
  
  // Simpan vote
  const votes = loadVotes();
  votes[candidate] = (votes[candidate] || 0) + 1;
  saveVotes(votes);
  
  // Tandai perangkat sudah voting
  devices[newDeviceId] = candidate;
  saveDevices(devices);
  
  res.json({ 
    success: true, 
    message: 'Terima kasih! Suara Anda telah tercatat.',
    votedFor: candidate
  });
});

// Get hasil voting
app.get('/api/results', (req, res) => {
  const votes = loadVotes();
  const total = Object.values(votes).reduce((a, b) => a + b, 0);
  
  const results = {
    candidates: {
      '1': { votes: votes['1'], percentage: total > 0 ? ((votes['1'] / total) * 100).toFixed(1) : 0 },
      '2': { votes: votes['2'], percentage: total > 0 ? ((votes['2'] / total) * 100).toFixed(1) : 0 },
      '3': { votes: votes['3'], percentage: total > 0 ? ((votes['3'] / total) * 100).toFixed(1) : 0 },
      '4': { votes: votes['4'], percentage: total > 0 ? ((votes['4'] / total) * 100).toFixed(1) : 0 }
    },
    total
  };
  
  res.json(results);
});

// Transparansi - info sistem
app.get('/api/transparency', (req, res) => {
  const devices = loadDevices();
  res.json({
    totalDevices: Object.keys(devices).length,
    totalVotes: Object.values(loadVotes()).reduce((a, b) => a + b, 0),
    system: {
      method: 'Cookie aman (HTTP-only, Secure, SameSite=Strict) + Fingerprint browser',
      hash: 'SHA-256 dengan secret server-side',
      storedData: 'Hanya hash perangkat (tidak ada data pribadi)',
      personalData: 'Nama, NIK, nomor HP, dan alamat IP TIDAK pernah diminta atau disimpan'
    }
  });
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🗳️  Server Voting Kades berjalan di port ${PORT}`);
});
