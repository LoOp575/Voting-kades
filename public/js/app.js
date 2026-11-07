/* ===== STATE ===== */
let selectedCandidate = null;
let hasVoted = false;
let voteChart = null;
let chartReady = false;

/* ===== FINGERPRINT ===== */
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

/* ===== TOAST ===== */
function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) { alert(msg); return; }
  const m = document.getElementById('toast-msg');
  if (m) m.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

/* ===== CHECK VOTE STATUS ===== */
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
      disableVoting(data.votedFor);
    }
  } catch (e) {
    console.warn('Check status error (non-fatal):', e);
  }
}

function disableVoting(votedFor) {
  document.querySelectorAll('.candidate-card').forEach(c => {
    c.style.pointerEvents = 'none';
    c.style.opacity = '0.7';
  });
  const btn = document.getElementById('vote-btn');
  if (btn) btn.style.display = 'none';
  const notice = document.getElementById('voted-notice');
  if (notice) notice.style.display = 'block';
  const vc = document.getElementById('voted-candidate');
  if (vc && votedFor) vc.textContent = votedFor;
}

/* ===== CANDIDATE SELECTION ===== */
function selectCandidate(num) {
  if (hasVoted) {
    showToast('Anda sudah menggunakan hak suara!');
    return;
  }
  selectedCandidate = num;
  document.querySelectorAll('.candidate-card').forEach(c => c.classList.remove('selected'));
  const card = document.querySelector('[data-candidate="' + num + '"]');
  if (card) card.classList.add('selected');
  const btn = document.getElementById('vote-btn');
  if (btn) {
    btn.disabled = false;
    btn.innerHTML = '✅ Pilih Calon ' + String(num).padStart(2, '0');
  }
}

/* ===== VOTE SUBMIT ===== */
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
  if (!selectedCandidate) return;

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
      disableVoting(selectedCandidate);
      showToast('Suara Anda telah tercatat untuk Calon ' + String(selectedCandidate).padStart(2, '0') + '!');
      await loadPolling();
    } else {
      if (data.error === 'Perangkat ini sudah menggunakan hak suara') {
        hasVoted = true;
        disableVoting(data.votedFor);
        showToast('Anda sudah voting sebelumnya.');
      } else {
        alert(data.error || 'Terjadi kesalahan');
      }
    }
  } catch (e) {
    console.error('Vote error:', e);
    alert('Gagal mengirim suara. Periksa koneksi internet Anda.');
  }
}

function closeModal() {
  const m = document.getElementById('modal');
  if (m) m.classList.remove('show');
}

/* ===== ASPIRASI ===== */
function showAspirasiModal() {
  const m = document.getElementById('aspirasi-modal');
  if (m) m.classList.add('show');
}

function closeAspirasiModal() {
  const m = document.getElementById('aspirasi-modal');
  if (m) m.classList.remove('show');
}

async function submitAspirasi() {
  const category = document.getElementById('asp-category');
  const message = document.getElementById('asp-message');
  if (!category || !message) { closeAspirasiModal(); return; }

  const cat = category.value;
  const msg = message.value.trim();

  if (!msg || msg.length < 5) {
    alert('Pesan minimal 5 karakter.');
    return;
  }

  try {
    const res = await fetch('/api/aspirasi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category: cat, message: msg })
    });
    const data = await res.json();
    if (data.success) {
      closeAspirasiModal();
      message.value = '';
      showToast('Aspirasi berhasil dikirim!');
    } else {
      alert(data.error || 'Gagal mengirim aspirasi.');
    }
  } catch (e) {
    alert('Gagal mengirim aspirasi. Periksa koneksi Anda.');
  }
}

/* ===== POLLING DATA ===== */
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
    updateStats(data);
    renderPollingList(data);
    renderChart(data);
  } catch (e) {
    console.error('Load polling error:', e);
  }
}

function updateStats(data) {
  const totalVoters = 1248;
  const pct = ((data.total / totalVoters) * 100).toFixed(1);
  const pctDisplay = pct.replace('.', ',');

  setText('chart-percent', pctDisplay + '%');
  setText('polling-total', data.total);
  setText('stat-votes', data.total);
  setText('stat-participation', '(' + pctDisplay + '%)');

  const el4 = document.getElementById('stat-progress');
  if (el4) el4.style.width = pct + '%';
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
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

/* ===== CHART RENDERING ===== */
function renderChart(data) {
  // Fallback: simple colored bars if Chart.js not available
  const chartWrap = document.querySelector('.polling-chart-wrap');
  if (!chartWrap) return;

  if (typeof Chart === 'undefined') {
    console.warn('Chart.js not available, using fallback bars');
    renderFallbackChart(data);
    return;
  }

  const canvas = document.getElementById('voteChart');
  if (!canvas) {
    console.error('voteChart canvas not found');
    renderFallbackChart(data);
    return;
  }

  try {
    const colors = Object.keys(data.candidates).map(k => candidateInfo[k].color);
    const labels = Object.keys(data.candidates).map(k => 'Calon ' + candidateInfo[k].num);
    const values = Object.values(data.candidates).map(c => c.votes);

    if (voteChart) {
      voteChart.data.labels = labels;
      voteChart.data.datasets[0].data = values;
      voteChart.data.datasets[0].backgroundColor = colors;
      voteChart.update('active');
      chartReady = true;
    } else {
      // Make sure canvas is visible
      canvas.style.display = 'block';
      canvas.style.width = '220px';
      canvas.style.height = '220px';

      voteChart = new Chart(canvas, {
        type: 'doughnut',
        data: {
          labels: labels,
          datasets: [{
            data: values,
            backgroundColor: colors,
            borderColor: '#fff',
            borderWidth: 3,
            hoverOffset: 8
          }]
        },
        options: {
          responsive: false,
          maintainAspectRatio: false,
          cutout: '60%',
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: function(ctx) {
                  const k = Object.keys(data.candidates)[ctx.dataIndex];
                  const info = candidateInfo[k];
                  return info.name + ': ' + ctx.raw + ' suara (' + data.candidates[k].percentage + '%)';
                }
              }
            }
          },
          animation: {
            animateScale: true,
            animateRotate: true,
            duration: 800
          }
        }
      });
      chartReady = true;
      console.log('Chart.js rendered successfully');
    }
  } catch (e) {
    console.error('Chart render error:', e);
    renderFallbackChart(data);
  }
}

function renderFallbackChart(data) {
  // If Chart.js fails, render simple colored bars
  const chartWrap = document.querySelector('.polling-chart-wrap');
  if (!chartWrap) return;

  const canvas = document.getElementById('voteChart');
  if (canvas) canvas.style.display = 'none';

  // Check if fallback already exists
  let fallback = chartWrap.querySelector('.fallback-chart');
  if (!fallback) {
    fallback = document.createElement('div');
    fallback.className = 'fallback-chart';
    fallback.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:8px;padding:10px;';
    chartWrap.appendChild(fallback);
  }

  let html = '<div style="font-size:1.6rem;font-weight:800;color:#15803d;">' + 
    document.getElementById('chart-percent')?.textContent + '</div>';
  html += '<div style="font-size:0.7rem;color:#718096;margin-bottom:8px;">Partisipasi</div>';
  
  for (const [num, info] of Object.entries(data.candidates)) {
    const c = candidateInfo[num];
    html += '<div style="display:flex;align-items:center;gap:6px;width:100%;">' +
      '<div style="width:10px;height:10px;border-radius:3px;background:' + c.color + ';flex-shrink:0;"></div>' +
      '<div style="flex:1;font-size:0.7rem;font-weight:600;">' + c.name.split(' ')[0] + '</div>' +
      '<div style="font-size:0.75rem;font-weight:800;color:' + c.color + ';">' + info.percentage + '%</div>' +
    '</div>';
  }
  fallback.innerHTML = html;
  chartReady = true;
}

/* ===== INIT ===== */
document.addEventListener('DOMContentLoaded', function() {
  console.log('App initialized | Chart.js:', typeof Chart !== 'undefined' ? 'available' : 'NOT available');
  checkVoteStatus();
  loadPolling();
});

/* ===== MODAL CLOSE HANDLERS ===== */
(function() {
  const voteModal = document.getElementById('modal');
  if (voteModal) {
    voteModal.addEventListener('click', function(e) {
      if (e.target === voteModal) closeModal();
    });
  }
  const aspModal = document.getElementById('aspirasi-modal');
  if (aspModal) {
    aspModal.addEventListener('click', function(e) {
      if (e.target === aspModal) closeAspirasiModal();
    });
  }
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') { closeModal(); closeAspirasiModal(); }
  });
})();
