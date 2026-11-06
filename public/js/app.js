// ===== State =====
let selectedCandidate = null;
let hasVoted = false;
let voteChart = null;

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
  // Simple hash
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36) + '_' + signals.screens + '_' + signals.cores;
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
      document.getElementById('voting-area').style.display = 'none';
      document.getElementById('voted-notice').style.display = 'block';
      document.getElementById('voted-candidate').textContent = data.votedFor;
    }
  } catch (err) {
    console.error('Error checking status:', err);
  }
}

async function submitVote() {
  if (!selectedCandidate) return;
  
  // Show confirmation modal
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
      document.getElementById('voting-area').style.display = 'none';
      document.getElementById('voted-notice').style.display = 'block';
      document.getElementById('voted-candidate').textContent = selectedCandidate;
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
  
  // Update UI
  document.querySelectorAll('.candidate-card').forEach(card => {
    card.classList.remove('selected');
  });
  document.querySelector(`.candidate-card[data-candidate="${num}"]`).classList.add('selected');
  
  // Enable vote button
  const btn = document.getElementById('vote-btn');
  btn.disabled = false;
  btn.textContent = `Pilih Calon ${num}`;
}

// ===== Page Navigation =====
function showPage(page) {
  // Hide all pages
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(`page-${page}`).classList.add('active');
  
  // Update nav links
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.remove('active');
    if (link.dataset.page === page) link.classList.add('active');
  });
  
  // Close mobile menu
  document.querySelector('.nav-links').classList.remove('show');
  
  // Load page data
  if (page === 'results') loadResults();
  if (page === 'transparency') loadTransparency();
  
  // Scroll to top
  window.scrollTo(0, 0);
}

function toggleMenu() {
  document.querySelector('.nav-links').classList.toggle('show');
}

// ===== Results =====
async function loadResults() {
  try {
    const res = await fetch('/api/results');
    const data = await res.json();
    
    renderChart(data);
    renderDetails(data);
  } catch (err) {
    console.error('Error loading results:', err);
  }
}

function renderChart(data) {
  const ctx = document.getElementById('voteChart').getContext('2d');
  
  const colors = {
    '1': '#2563eb',
    '2': '#16a34a',
    '3': '#dc2626',
    '4': '#9333ea'
  };
  
  const labels = Object.keys(data.candidates).map(k => `Calon ${k}`);
  const values = Object.values(data.candidates).map(c => c.votes);
  const bgColors = Object.keys(data.candidates).map(k => colors[k]);
  
  if (voteChart) {
    voteChart.data.labels = labels;
    voteChart.data.datasets[0].data = values;
    voteChart.data.datasets[0].backgroundColor = bgColors;
    voteChart.update();
  } else {
    voteChart = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: labels,
        datasets: [{
          data: values,
          backgroundColor: bgColors,
          borderColor: '#fff',
          borderWidth: 3,
          hoverBorderWidth: 4,
          hoverOffset: 10
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              padding: 20,
              font: { size: 13, weight: '600' }
            }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const candidate = data.candidates[Object.keys(data.candidates)[context.dataIndex]];
                return `${context.label}: ${context.raw} suara (${candidate.percentage}%)`;
              }
            }
          }
        },
        animation: {
          animateScale: true,
          animateRotate: true
        }
      }
    });
  }
}

function renderDetails(data) {
  const container = document.getElementById('results-details');
  const colors = {
    '1': '#2563eb',
    '2': '#16a34a',
    '3': '#dc2626',
    '4': '#9333ea'
  };
  
  let html = '';
  for (const [num, info] of Object.entries(data.candidates)) {
    html += `
      <div class="result-item">
        <div class="result-color" style="background: ${colors[num]};"></div>
        <div class="result-info">
          <div class="result-name">Calon ${num}</div>
          <div class="result-votes">${info.votes} suara</div>
          <div class="result-bar">
            <div class="result-bar-fill" style="width: ${info.percentage}%; background: ${colors[num]};"></div>
          </div>
        </div>
        <div class="result-percentage" style="color: ${colors[num]};">${info.percentage}%</div>
      </div>
    `;
  }
  
  html += `
    <div class="result-item" style="background: #f7fafc; justify-content: center;">
      <div class="result-info" style="text-align: center;">
        <div class="result-votes" style="font-size: 1.1rem; font-weight: 600;">
          Total Suara: <strong>${data.total}</strong>
        </div>
      </div>
    </div>
  `;
  
  container.innerHTML = html;
}

// ===== Transparency =====
async function loadTransparency() {
  try {
    const res = await fetch('/api/transparency');
    const data = await res.json();
    
    // Tech details
    document.getElementById('tech-details').innerHTML = `
      <p><strong>Metode:</strong> ${data.system.method}</p>
      <p><strong>Hash:</strong> ${data.system.hash}</p>
      <p><strong>Data Tersimpan:</strong> ${data.system.storedData}</p>
      <p><strong>Data Pribadi:</strong> ${data.system.personalData}</p>
    `;
    
    // System stats
    document.getElementById('system-stats').innerHTML = `
      <div class="stat-item">
        <div class="stat-value">${data.totalDevices}</div>
        <div class="stat-label">Perangkat Terdaftar</div>
      </div>
      <div class="stat-item">
        <div class="stat-value">${data.totalVotes}</div>
        <div class="stat-label">Total Suara</div>
      </div>
    `;
  } catch (err) {
    console.error('Error loading transparency:', err);
  }
}

// ===== Init =====
document.addEventListener('DOMContentLoaded', () => {
  checkVoteStatus();
});

// Close modal on outside click
document.getElementById('modal').addEventListener('click', (e) => {
  if (e.target === document.getElementById('modal')) {
    closeModal();
  }
});

// Escape key closes modal
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
});
