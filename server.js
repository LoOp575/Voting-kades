const express = require('express');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Secret untuk hash fingerprint - gunakan value tetap agar persist antar restart
const FINGERPRINT_SECRET = process.env.FP_SECRET || 'pilkades-2026-maju-jaya-secret-key-v1';

// Path file data
const DATA_DIR = path.join(__dirname, 'data');
const VOTES_FILE = path.join(DATA_DIR, 'votes.json');
const DEVICES_FILE = path.join(DATA_DIR, 'devices.json');
const ASPIRASI_FILE = path.join(DATA_DIR, 'aspirasi.json');

// Buat folder data jika belum ada
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Inisialisasi file data
function loadVotes() {
  if (fs.existsSync(VOTES_FILE)) {
    return JSON.parse(fs.readFileSync(VOTES_FILE, 'utf8'));
  }
  return { '1': 286, '2': 256, '3': 214, '4': 136 };
}

function loadDevices() {
  if (fs.existsSync(DEVICES_FILE)) {
    return JSON.parse(fs.readFileSync(DEVICES_FILE, 'utf8'));
  }
  return {};
}

function loadAspirasi() {
  if (fs.existsSync(ASPIRASI_FILE)) {
    return JSON.parse(fs.readFileSync(ASPIRASI_FILE, 'utf8'));
  }
  return [
    { name: 'Anonim', category: 'saran', message: 'Mohon perbaikan jalan di dusun Sukamaju.', date: '29 Nov 2026' },
    { name: 'Anonim', category: 'kritik', message: 'Semoga program UMKM desa segera direalisasikan.', date: '28 Nov 2026' }
  ];
}

function saveVotes(votes) {
  fs.writeFileSync(VOTES_FILE, JSON.stringify(votes, null, 2));
}

function saveDevices(devices) {
  fs.writeFileSync(DEVICES_FILE, JSON.stringify(devices, null, 2));
}

function saveAspirasi(aspirasi) {
  fs.writeFileSync(ASPIRASI_FILE, JSON.stringify(aspirasi, null, 2));
}

// Inisialisasi data
if (!fs.existsSync(VOTES_FILE)) saveVotes(loadVotes());
if (!fs.existsSync(DEVICES_FILE)) saveDevices(loadDevices());
if (!fs.existsSync(ASPIRASI_FILE)) saveAspirasi(loadAspirasi());

app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Generate device ID dari cookie + fingerprint
function getDeviceId(req) {
  const fingerprint = req.body.fingerprint || '';
  const cookieId = req.cookies._voting_device;
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
  res.json({ hasVoted, votedFor: devices[deviceId] || null });
});

// File lock untuk mencegah race condition
let voteLock = null;

// Submit vote
app.post('/api/vote', (req, res) => {
  const { candidate } = req.body;
  
  if (!['1', '2', '3', '4'].includes(candidate)) {
    return res.status(400).json({ error: 'Kandidat tidak valid' });
  }
  
  // Jika ada vote lain sedang diproses, tolak sementara
  if (voteLock) {
    return res.status(429).json({ error: 'Mohon tunggu sebentar, coba lagi.' });
  }
  
  voteLock = true;
  
  try {
    const devices = loadDevices();
    const deviceId = getDeviceId(req);
    
    if (devices[deviceId] !== undefined) {
      voteLock = null;
      return res.status(403).json({ 
        error: 'Perangkat ini sudah menggunakan hak suara',
        votedFor: devices[deviceId]
      });
    }
    
    const deviceCookie = crypto.randomBytes(16).toString('hex');
    res.cookie('_voting_device', deviceCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 365 * 24 * 60 * 60 * 1000,
      path: '/'
    });
    
    const fingerprint = req.body.fingerprint || '';
    const raw = `${deviceCookie}|${fingerprint}`;
    const newDeviceId = crypto
      .createHash('sha256')
      .update(raw + FINGERPRINT_SECRET)
      .digest('hex');
    
    const votes = loadVotes();
    votes[candidate] = (votes[candidate] || 0) + 1;
    saveVotes(votes);
    
    devices[newDeviceId] = candidate;
    saveDevices(devices);
    
    voteLock = null;
    
    res.json({ 
      success: true, 
      message: 'Terima kasih! Suara Anda telah tercatat.',
      votedFor: candidate
    });
  } catch (err) {
    voteLock = null;
    console.error('Vote error:', err);
    res.status(500).json({ error: 'Terjadi kesalahan server.' });
  }
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

// Aspirasi
app.get('/api/aspirasi', (req, res) => {
  const aspirasi = loadAspirasi();
  res.json(aspirasi);
});

app.post('/api/aspirasi', (req, res) => {
  const { category, message } = req.body;
  
  if (!['saran', 'kritik', 'dukungan'].includes(category)) {
    return res.status(400).json({ error: 'Kategori tidak valid' });
  }
  
  if (!message || message.trim().length < 5) {
    return res.status(400).json({ error: 'Pesan terlalu pendek' });
  }
  
  if (message.length > 500) {
    return res.status(400).json({ error: 'Pesan terlalu panjang' });
  }
  
  const aspirasi = loadAspirasi();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const now = new Date();
  const dateStr = `${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
  
  aspirasi.unshift({
    name: 'Anonim',
    category,
    message: message.trim(),
    date: dateStr
  });
  
  saveAspirasi(aspirasi);
  res.json({ success: true });
});

// Transparansi
app.get('/api/transparency', (req, res) => {
  const devices = loadDevices();
  const votes = loadVotes();
  const aspirasi = loadAspirasi();
  const totalVotes = Object.values(votes).reduce((a, b) => a + b, 0);
  const totalVoters = 1248;
  
  res.json({
    totalDevices: Object.keys(devices).length,
    totalVotes,
    totalAspirasi: aspirasi.length,
    participation: ((totalVotes / totalVoters) * 100).toFixed(1),
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
