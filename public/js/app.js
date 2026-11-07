let selectedCandidate = null;
let hasVoted = false;
let voteChart = null;

function generateFingerprint() {
  const s = {
    ua: navigator.userAgent,
    lang: navigator.language,
    platform: navigator.platform,
    screens: screen.width + 'x' + screen.height,
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    cores: navigator.hardwareConcurrency || 0
  };
  let h = 0;
  const str = JSON.stringify(s);
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h) + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h).toString(36) + '_' + s.screens + '_' + s.cores;
}

function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  document.getElementById('toast-msg').textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

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
      document.querySelectorAll('.candidate-card').forEach(c => {
        c.style.pointerEvents = 'none';
        c.style.opacity = '0.7';
      });
      const btn = document.getElementById('vote-btn');
      if (btn) btn.style.display = 'none';
      const notice = document.getElementById('voted-notice');
      if (notice) notice.style.display = 'block';
      const vc = document.getElementById('voted-candidate');
      if (vc) vc.textContent = data.votedFor;
    }
  } catch (e) {
    console.error('Check status error:', e);
  }
}

function selectCandidate(num) {
  if (hasVoted) return;
  selectedCandidate = num;
  document.querySelectorAll('.candidate-card').forEach(c => c.classList.remove('selected'));
  const card = document.querySelector(`[data-candidate="${num}"]`);
  if (card) card.classList.add('selected');
  const btn = document.getElementById('vote-btn');
  if (btn) {
    btn.disabled = false;
    btn.innerHTML = '✅ Pilih Calon ' + String(num).padStart(2, '0');
  }
}

function submitVote() {
  if (!selectedCandidate) {
    showToast('Pilih kandidat terlebih dahulu!');
    return;
  }
  const mc = document.getElementById('modal-candidate');
  if (mc) mc.textContent = selectedCandidate;
  const modal = document.getElementById('modal');
  if (modal) modal.classList.add('show');
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
      document.querySelectorAll('.candidate-card').forEach(c => {
        c.style.pointerEvents = 'none';
        c.style.opacity = '0.7';
      });
      const btn = document.getElementById('vote-btn');
      if (btn) btn.style.display = 'none';
      const notice = document.getElementById('voted-notice');
      if (notice) notice.style.display = 'block';
      const vc = document.getElementById('voted-candidate');
      if (vc) vc.textContent = selectedCandidate;
      showToast('Suara Anda telah tercatat!');
      // Reload polling data
      await loadPolling();
    } else {
      alert(data.error || 'Terjadi kesalahan');
    }
  } catch (e) {
    alert('Gagal mengirim suara. Silakan coba lagi.');
    console.error('Vote error:', e);
  }
}

function closeModal() {
  const m = document.getElementById('modal');
  if (m) m.classList.remove('show');
}

function showAspirasiModal() {
  const m = document.getElementById('aspirasi-modal');
  if (m) m.classList.add('show');
}

function closeAspirasiModal() {
  const m = document.getElementById('aspirasi-modal');
  if (m) m.classList.remove('show');
}

async function submitAspirasi() {
  const category = document.getElementById('asp-category').value;
  const message = document.getElementById('asp-message').value.trim();
  if (!message || message.length < 5) {
    alert('Pesan minimal 5 karakter.');
    return;
  }
  try {
    const res = await fetch('/api/aspirasi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category, message })
    });
    const data = await res.json();
    if (data.success) {
      closeAspirasiModal();
      document.getElementById('asp-message').value = '';
      showToast('Aspirasi berhasil dikirim!');
    } else {
      alert(data.error || 'Gagal mengirim aspirasi.');
    }
  } catch (e) {
    alert('Gagal mengirim aspirasi.');
  }
}

const candidateInfo = {
  '1': { name: 'Budi Santoso', color: '#22c55e', num: '01' },
  '2': { name: 'Siti Rahmawati', color: '#3b82f6', num: '02' },
  '3': { name: 'Ahmad Fauzi', color: '#f59e0b', num: '03' },
  '4': { name: 'Dewi Lestari', color: '#8b5cf6', num: '04' }
};

async function loadPolling() {
  try {
    const res = await fetch('/api/results');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    renderChart(data);
    renderPollingList(data);
  } catch (e) {
    console.error('Load polling error:', e);
  }
}

function renderChart(data) {
  const totalVoters = 1248;
  const pct = ((data.total / totalVoters) * 100).toFixed(1);

  const el1 = document.getElementById('chart-percent');
  if (el1) el1.textContent = pct.replace('.', ',') + '%';

  const el2 = document.getElementById('polling-total');
  if (el2) el2.textContent = data.total;

  const el3 = document.getElementById('stat-votes');
  if (el3) el3.textContent = data.total;

  const el4 = document.getElementById('stat-progress');
  if (el4) el4.style.width = pct + '%';

  const el5 = document.getElementById('stat-participation');
  if (el5) el5.textContent = '(' + pct.replace('.', ',') + '%)';

  const ctx = document.getElementById('voteChart');
  if (!ctx) { console.error('voteChart canvas not found'); return; }

  const colors = Object.keys(data.candidates).map(k => candidateInfo[k].color);
  const labels = Object.keys(data.candidates).map(k => 'Calon ' + candidateInfo[k].num);
  const values = Object.values(data.candidates).map(c => c.votes);

  if (typeof Chart === 'undefined') {
    console.error('Chart.js not loaded!');
    return;
  }

  if (voteChart) {
    voteChart.data.labels = labels;
    voteChart.data.datasets[0].data = values;
    voteChart.data.datasets[0].backgroundColor = colors;
    voteChart.update('active');
  } else {
    voteChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: colors,
          borderColor: '#fff',
          borderWidth: 3,
          hoverOffset: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        cutout: '62%',
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx2 => {
                const k = Object.keys(data.candidates)[ctx2.dataIndex];
                const info = candidateInfo[k];
                return info.name + ': ' + ctx2.raw + ' suara (' + data.candidates[k].percentage + '%)';
              }
            }
          }
        },
        animation: { animateScale: true, animateRotate: true }
      }
    });
  }
}

function renderPollingList(data) {
  const container = document.getElementById('polling-list');
  if (!container) return;
  let html = '';
  for (const [num, info] of Object.entries(data.candidates)) {
    const c = candidateInfo[num];
    html += '<div>' +
      '<div class="polling-item">' +
        '<div class="polling-dot" style="background:' + c.color + '"></div>' +
        '<div class="polling-name">' + c.name + '</div>' +
        '<div class="polling-votes">' + info.votes + ' suara</div>' +
        '<div class="polling-pct" style="color:' + c.color + '">' + info.percentage + '%</div>' +
      '</div>' +
      '<div class="polling-bar"><div class="polling-bar-fill" style="width:' + info.percentage + '%;background:' + c.color + '"></div></div>' +
    '</div>';
  }
  container.innerHTML = html;
}

// Init
document.addEventListener('DOMContentLoaded', () => {
  console.log('App initialized, Chart available:', typeof Chart !== 'undefined');
  checkVoteStatus();
  loadPolling();
});

// Modal close handlers
const voteModal = document.getElementById('modal');
if (voteModal) {
  voteModal.addEventListener('click', e => {
    if (e.target === voteModal) closeModal();
  });
}

const aspModal = document.getElementById('aspirasi-modal');
if (aspModal) {
  aspModal.addEventListener('click', e => {
    if (e.target === aspModal) closeAspirasiModal();
  });
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeModal(); closeAspirasiModal(); }
});
