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
      const va = document.getElementById('voting-area');
      // Hide candidates and vote button
      document.querySelectorAll('.candidate-card').forEach(c => c.style.pointerEvents = 'none');
      document.getElementById('vote-btn').style.display = 'none';
      document.getElementById('voted-notice').style.display = 'block';
      document.getElementById('voted-candidate').textContent = data.votedFor;
    }
  } catch (e) { console.error(e); }
}

function selectCandidate(num) {
  if (hasVoted) return;
  selectedCandidate = num;
  document.querySelectorAll('.candidate-card').forEach(c => c.classList.remove('selected'));
  document.querySelector(`[data-candidate="${num}"]`).classList.add('selected');
  const btn = document.getElementById('vote-btn');
  btn.disabled = false;
  btn.innerHTML = '<i class="fas fa-check-circle"></i> Pilih Calon ' + String(num).padStart(2, '0');
}

function submitVote() {
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
      document.querySelectorAll('.candidate-card').forEach(c => c.style.pointerEvents = 'none');
      document.getElementById('vote-btn').style.display = 'none';
      document.getElementById('voted-notice').style.display = 'block';
      document.getElementById('voted-candidate').textContent = selectedCandidate;
      showToast('Suara Anda telah tercatat!');
      loadPolling();
    } else {
      alert(data.error || 'Terjadi kesalahan');
    }
  } catch (e) {
    alert('Gagal mengirim suara.');
  }
}

function closeModal() {
  document.getElementById('modal').classList.remove('show');
}

function showAspirasiModal() {
  document.getElementById('aspirasi-modal').classList.add('show');
}

function closeAspirasiModal() {
  document.getElementById('aspirasi-modal').classList.remove('show');
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
      loadPolling();
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
    const data = await res.json();
    renderChart(data);
    renderPollingList(data);
  } catch (e) { console.error(e); }
}

function renderChart(data) {
  const totalVoters = 1248;
  const pct = ((data.total / totalVoters) * 100).toFixed(1);
  document.getElementById('chart-percent').textContent = pct + '%';
  document.getElementById('polling-total').textContent = data.total;
  document.getElementById('stat-votes').textContent = data.total;
  document.getElementById('stat-progress').style.width = pct + '%';
  document.getElementById('stat-participation').textContent = '(' + pct.replace('.', ',') + '%)';

  const ctx = document.getElementById('voteChart');
  const colors = Object.keys(data.candidates).map(k => candidateInfo[k].color);
  const labels = Object.keys(data.candidates).map(k => 'Calon ' + candidateInfo[k].num);
  const values = Object.values(data.candidates).map(c => c.votes);

  if (voteChart) {
    voteChart.data.datasets[0].data = values;
    voteChart.update();
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
        cutout: '62%',
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => {
                const k = Object.keys(data.candidates)[ctx.dataIndex];
                const info = candidateInfo[k];
                return info.name + ': ' + ctx.raw + ' suara (' + data.candidates[k].percentage + '%)';
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
  let html = '';
  for (const [num, info] of Object.entries(data.candidates)) {
    const c = candidateInfo[num];
    html += `
      <div>
        <div class="polling-item">
          <div class="polling-dot" style="background:${c.color}"></div>
          <div class="polling-name">${c.name}</div>
          <div class="polling-votes">${info.votes} suara</div>
          <div class="polling-pct" style="color:${c.color}">${info.percentage}%</div>
        </div>
        <div class="polling-bar"><div class="polling-bar-fill" style="width:${info.percentage}%;background:${c.color}"></div></div>
      </div>`;
  }
  container.innerHTML = html;
}

// Init
document.addEventListener('DOMContentLoaded', () => {
  checkVoteStatus();
  loadPolling();
});

// Modal close on outside click
document.getElementById('modal').addEventListener('click', e => {
  if (e.target === document.getElementById('modal')) closeModal();
});
document.getElementById('aspirasi-modal').addEventListener('click', e => {
  if (e.target === document.getElementById('aspirasi-modal')) closeAspirasiModal();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeModal(); closeAspirasiModal(); }
});
