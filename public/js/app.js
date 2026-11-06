// ===== State =====
let selectedCandidate = null;
let hasVoted = false;
let voteChart = null;
let aspirasiData = [
  { name: 'Anonim', category: 'saran', message: 'Mohon perbaikan jalan di dusun Sukamaju.', date: '29 Nov 2026' },
  { name: 'Anonim', category: 'kritik', message: 'Semoga program UMKM desa segera direalisasikan.', date: '28 Nov 2026' }
];

// ===== Fingerprint =====
function generateFingerprint() {
  const signals = {
    ua: navigator.userAgent,
    lang: navigator.language,
    platform: navigator.platform,
    screens: `${screen.width}x${screen.height}`,
    colorDepth: screen.colorDepth,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    touch: navigator.maxTouchPoints,
    cores: navigator.hardwareConcurrency || 0,
    memory: navigator.deviceMemory || 0,
    plugins: Array.from(navigator.plugins || []).map(p => p.name).join(','),
    dnt: navigator.doNotTrack || '0'
  };
  
  const str = JSON.stringify(signals);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36) + '_' + signals.screens + '_' + signals.cores;
}

// ===== Toast Notification =====
function showToast(message) {
  const toast = document.getElementById('toast');
  document.getElementById('toast-message').textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

// ===== API Calls =====
async function checkVoteStatus() {
  try {
    const res = await fetch('/api/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fingerprint: generateFingerprint() })
    });
    const data = await res.json();
    
    if (data.hasVoted) {
      hasVoted = true;
      const votingArea = document.getElementById('voting-area');
      const votedNotice = document.getElementById('voted-notice');
      if (votingArea) votingArea.style.display = 'none';
      if (votedNotice) votedNotice.style.display = 'block';
      const votedCandidate = document.getElementById('voted-candidate');
      if (votedCandidate) votedCandidate.textContent = data.votedFor;
      
      // Update settings page
      const votingStatus = document.getElementById('voting-status');
      if (votingStatus) votingStatus.textContent = `Sudah memilih Calon ${data.votedFor} ✓`;
    }
  } catch (err) {
    console.error('Error checking status:', err);
  }
}

async function submitVote() {
  if (!selectedCandidate) return;
  document.getElementById('modal-candidate').textContent = selectedCandidate;
  document.getElementById('modal').classList.add('show');
}

async function confirmVote() {
  closeModal();
  
  try {
    const res = await fetch('/api/vote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        candidate: selectedCandidate.toString(),
        fingerprint: generateFingerprint()
      })
    });
    const data = await res.json();
    
    if (data.success) {
      hasVoted = true;
      const votingArea = document.getElementById('voting-area');
      const votedNotice = document.getElementById('voted-notice');
      if (votingArea) votingArea.style.display = 'none';
      if (votedNotice) votedNotice.style.display = 'block';
      const votedCandidate = document.getElementById('voted-candidate');
      if (votedCandidate) votedCandidate.textContent = selectedCandidate;
      showToast('Suara Anda telah tercatat!');
    } else {
      alert(data.error || 'Terjadi kesalahan');
    }
  } catch (err) {
    alert('Gagal mengirim suara. Silakan coba lagi.');
    console.error('Vote error:', err);
  }
}

function closeModal() {
  document.getElementById('modal').classList.remove('show');
}

// ===== Candidate Selection =====
function selectCandidate(num) {
  if (hasVoted) return;
  
  selectedCandidate = num;
  
  // Update all candidate cards
  document.querySelectorAll('.candidate-profile-card, .candidate-full-card').forEach(card => {
    card.classList.remove('selected');
  });
  document.querySelectorAll(`[data-candidate="${num}"]`).forEach(card => {
    card.classList.add('selected');
  });
  
  // Enable vote button
  const btn = document.getElementById('vote-btn');
  if (btn) {
    btn.disabled = false;
    btn.innerHTML = `<i class="fas fa-check-circle"></i> Pilih Calon ${String(num).padStart(2, '0')}`;
  }
}

function focusCandidate(num) {
  setTimeout(() => {
    const card = document.querySelector(`.candidate-full-card[data-candidate="${num}"]`);
    if (card) {
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      selectCandidate(num);
    }
  }, 100);
}

// ===== Page Navigation =====
function showPage(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const targetPage = document.getElementById(`page-${page}`);
  if (targetPage) targetPage.classList.add('active');
  
  document.querySelectorAll('.sidebar-link').forEach(link => {
    link.classList.remove('active');
    if (link.dataset.page === page) link.classList.add('active');
  });
  
  if (page === 'polling') loadPolling();
  if (page === 'informasi') loadInfo();
  if (page === 'aspirasi') loadAspirasi();
  
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ===== Polling / Results =====
async function loadPolling() {
  try {
    const res = await fetch('/api/results');
    const data = await res.json();
    renderPollingChart(data);
    renderPollingDetails(data);
  } catch (err) {
    console.error('Error loading polling:', err);
  }
}

const candidateInfo = {
  '1': { name: 'Budi Santoso', color: '#22c55e', num: '01' },
  '2': { name: 'Siti Rahmawati', color: '#3b82f6', num: '02' },
  '3': { name: 'Ahmad Fauzi', color: '#f59e0b', num: '03' },
  '4': { name: 'Dewi Lestari', color: '#8b5cf6', num: '04' }
};

function renderPollingChart(data) {
  const ctx = document.getElementById('voteChart');
  if (!ctx) return;
  
  const totalVoters = 1248;
  const participation = totalVoters > 0 ? ((data.total / totalVoters) * 100).toFixed(1) : 0;
  document.getElementById('chart-percent').textContent = `${participation}%`;
  
  const colors = Object.keys(data.candidates).map(k => candidateInfo[k].color);
  const labels = Object.keys(data.candidates).map(k => `Calon ${candidateInfo[k].num}`);
  const values = Object.values(data.candidates).map(c => c.votes);
  
  if (voteChart) {
    voteChart.data.datasets[0].data = values;
    voteChart.update();
  } else {
    voteChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: values,
          backgroundColor: colors,
          borderColor: '#fff',
          borderWidth: 4,
          hoverOffset: 10
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        cutout: '65%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: { padding: 15, font: { size: 12, weight: '600' }, usePointStyle: true }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const key = Object.keys(data.candidates)[context.dataIndex];
                const info = candidateInfo[key];
                return `${info.name}: ${context.raw} suara (${data.candidates[key].percentage}%)`;
              }
            }
          }
        },
        animation: { animateScale: true, animateRotate: true }
      }
    });
  }
}

function renderPollingDetails(data) {
  const container = document.getElementById('polling-details');
  if (!container) return;
  
  let html = '';
  for (const [num, info] of Object.entries(data.candidates)) {
    const cand = candidateInfo[num];
    html += `
      <div class="polling-detail-item" style="border-left-color: ${cand.color};">
        <div class="polling-detail-header">
          <div class="polling-detail-name">
            <span class="polling-detail-num" style="background: ${cand.color};">${cand.num}</span>
            ${cand.name}
          </div>
          <div class="polling-detail-percent" style="color: ${cand.color};">${info.percentage}%</div>
        </div>
        <div class="polling-detail-votes">${info.votes} suara</div>
        <div class="polling-bar">
          <div class="polling-bar-fill" style="width: ${info.percentage}%; background: ${cand.color};"></div>
        </div>
      </div>
    `;
  }
  container.innerHTML = html;
  
  const totalEl = document.getElementById('polling-total-value');
  if (totalEl) totalEl.textContent = data.total;
}

// ===== Aspirasi =====
function loadAspirasi() {
  const container = document.getElementById('aspirasi-full-list');
  if (!container) return;
  
  let html = '';
  aspirasiData.forEach(item => {
    const tagClass = item.category;
    const tagLabel = item.category.charAt(0).toUpperCase() + item.category.slice(1);
    const icon = item.category === 'saran' ? '💡' : item.category === 'kritik' ? '⚠️' : '👍';
    
    html += `
      <div class="aspiration-item">
        <div class="aspiration-avatar"><i class="fas fa-user"></i></div>
        <div class="aspiration-content">
          <p>${item.message}</p>
          <span class="aspiration-tag ${tagClass}">${icon} ${tagLabel}</span>
          <span class="aspiration-date">${item.date}</span>
        </div>
      </div>
    `;
  });
  container.innerHTML = html;
}

function submitAspirasi(e) {
  e.preventDefault();
  const category = document.getElementById('aspirasi-category').value;
  const message = document.getElementById('aspirasi-message').value;
  
  if (!message.trim()) return;
  
  const now = new Date();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const dateStr = `${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
  
  aspirasiData.unshift({ name: 'Anonim', category, message, date: dateStr });
  
  document.getElementById('aspirasi-message').value = '';
  document.getElementById('aspirasi-category').value = 'saran';
  
  loadAspirasi();
  showToast('Aspirasi berhasil dikirim!');
  
  // Update home aspirasi list
  updateHomeAspirasi();
}

function updateHomeAspirasi() {
  const homeList = document.getElementById('aspiration-list');
  if (!homeList) return;
  
  let html = '';
  aspirasiData.slice(0, 2).forEach(item => {
    const tagClass = item.category;
    const tagLabel = item.category.charAt(0).toUpperCase() + item.category.slice(1);
    html += `
      <div class="aspiration-item">
        <div class="aspiration-avatar"><i class="fas fa-user"></i></div>
        <div class="aspiration-content">
          <p>${item.message}</p>
          <span class="aspiration-tag ${tagClass}">${tagLabel}</span>
          <span class="aspiration-date">${item.date}</span>
        </div>
      </div>
    `;
  });
  homeList.innerHTML = html;
}

// ===== Info Page =====
async function loadInfo() {
  try {
    const res = await fetch('/api/transparency');
    const data = await res.json();
    
    const techDetails = document.getElementById('tech-details');
    if (techDetails) {
      techDetails.innerHTML = `
        <p><strong>Metode:</strong> ${data.system.method}</p>
        <p><strong>Hash:</strong> ${data.system.hash}</p>
        <p><strong>Data Tersimpan:</strong> ${data.system.storedData}</p>
        <p><strong>Data Pribadi:</strong> ${data.system.personalData}</p>
      `;
    }
    
    const systemStats = document.getElementById('system-stats');
    if (systemStats) {
      systemStats.innerHTML = `
        <div class="stat-item-full">
          <div class="stat-value">${data.totalDevices}</div>
          <div class="stat-label">Perangkat Terdaftar</div>
        </div>
        <div class="stat-item-full">
          <div class="stat-value">${data.totalVotes}</div>
          <div class="stat-label">Total Suara</div>
        </div>
      `;
    }
  } catch (err) {
    console.error('Error loading info:', err);
  }
}

// ===== Init =====
document.addEventListener('DOMContentLoaded', () => {
  checkVoteStatus();
});

// Close modal on outside click
const modal = document.getElementById('modal');
if (modal) {
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
});
