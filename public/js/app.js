let selectedCandidate = null;
let hasVoted = false;
let voteChart = null;

/* ===== FINGERPRINT ===== */
function fp() {
  const s = {
    ua: navigator.userAgent,
    lang: navigator.language,
    screens: screen.width + 'x' + screen.height,
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
function toast(msg) {
  const t = document.getElementById('toast');
  const m = document.getElementById('toast-msg');
  if (m) m.textContent = msg;
  if (t) {
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3000);
  }
}

/* ===== CHECK STATUS ===== */
async function checkStatus() {
  try {
    const r = await fetch('/api/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fingerprint: fp() })
    });
    const d = await r.json();
    if (d.hasVoted) {
      hasVoted = true;
      showVoted(d.votedFor);
    }
  } catch (e) { console.warn(e); }
}

function showVoted(v) {
  document.querySelectorAll('.candidate-card').forEach(c => {
    c.style.pointerEvents = 'none';
    c.style.opacity = '0.7';
  });
  const b = document.getElementById('vote-btn');
  if (b) b.style.display = 'none';
  const n = document.getElementById('voted-notice');
  if (n) n.style.display = 'block';
  const vc = document.getElementById('voted-candidate');
  if (vc && v) vc.textContent = v;
}

/* ===== CANDIDATE SELECT ===== */
function selectCandidate(num) {
  if (hasVoted) { toast('Anda sudah menggunakan hak suara!'); return; }
  selectedCandidate = num;
  document.querySelectorAll('.candidate-card').forEach(c => c.classList.remove('selected'));
  const card = document.querySelector('[data-candidate="' + num + '"]');
  if (card) card.classList.add('selected');
  const b = document.getElementById('vote-btn');
  if (b) {
    b.disabled = false;
    b.textContent = '✅ Pilih Calon ' + String(num).padStart(2, '0');
  }
}

/* ===== VOTE ===== */
function submitVote() {
  if (!selectedCandidate) { toast('Pilih kandidat terlebih dahulu!'); return; }
  const mc = document.getElementById('modal-candidate');
  if (mc) mc.textContent = selectedCandidate;
  const m = document.getElementById('modal');
  if (m) m.classList.add('show');
}

async function confirmVote() {
  closeModal();
  if (!selectedCandidate) return;
  try {
    const r = await fetch('/api/vote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ candidate: selectedCandidate.toString(), fingerprint: fp() })
    });
    const d = await r.json();
    if (d.success) {
      hasVoted = true;
      showVoted(selectedCandidate);
      toast('Suara tercatat untuk Calon ' + String(selectedCandidate).padStart(2, '0') + '!');
      loadPolling();
    } else {
      if (d.error && d.error.includes('sudah')) {
        hasVoted = true;
        showVoted(d.votedFor);
        toast('Anda sudah voting sebelumnya.');
      } else {
        alert(d.error || 'Terjadi kesalahan');
      }
    }
  } catch (e) {
    alert('Gagal mengirim suara.');
    console.error(e);
  }
}

function closeModal() {
  const m = document.getElementById('modal');
  if (m) m.classList.remove('show');
}

/* ===== ASPIRASI ===== */
function openAspModal() {
  const m = document.getElementById('asp-modal');
  if (m) m.classList.add('show');
}

function closeAspModal() {
  const m = document.getElementById('asp-modal');
  if (m) m.classList.remove('show');
}

async function sendAsp() {
  const cat = document.getElementById('asp-cat');
  const msg = document.getElementById('asp-msg');
  if (!cat || !msg) { closeAspModal(); return; }
  const c = cat.value;
  const m = msg.value.trim();
  if (!m || m.length < 5) { alert('Pesan minimal 5 karakter.'); return; }
  try {
    const r = await fetch('/api/aspirasi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category: c, message: m })
    });
    const d = await r.json();
    if (d.success) {
      closeAspModal();
      msg.value = '';
      toast('Aspirasi berhasil dikirim!');
    } else {
      alert(d.error || 'Gagal.');
    }
  } catch (e) {
    alert('Gagal mengirim aspirasi.');
  }
}

/* ===== POLLING ===== */
const cinfo = {
  '1': { name: 'Budi Santoso', color: '#22c55e' },
  '2': { name: 'Siti Rahmawati', color: '#3b82f6' },
  '3': { name: 'Ahmad Fauzi', color: '#f59e0b' },
  '4': { name: 'Dewi Lestari', color: '#8b5cf6' }
};

async function loadPolling() {
  try {
    const r = await fetch('/api/results');
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const d = await r.json();
    renderPolling(d);
    renderChart(d);
  } catch (e) { console.error(e); }
}

function renderPolling(d) {
  const totalVoters = 1248;
  const pct = ((d.total / totalVoters) * 100).toFixed(1).replace('.', ',');
  const cc = document.getElementById('chart-center-pct');
  if (cc) cc.textContent = pct + '%';
  const pt = document.getElementById('polling-total-val');
  if (pt) pt.textContent = d.total;

  const list = document.getElementById('polling-list');
  if (!list) return;
  let h = '';
  for (const [n, info] of Object.entries(d.candidates)) {
    const c = cinfo[n];
    h += '<div>' +
      '<div class="pl-item">' +
        '<div class="pl-dot" style="background:' + c.color + '"></div>' +
        '<div class="pl-name">' + c.name + '</div>' +
        '<div class="pl-votes">' + info.votes + ' suara</div>' +
        '<div class="pl-pct" style="color:' + c.color + '">' + info.percentage + '%</div>' +
      '</div>' +
      '<div class="pl-bar"><div class="pl-bar-fill" style="width:' + info.percentage + '%;background:' + c.color + '"></div></div>' +
    '</div>';
  }
  list.innerHTML = h;
}

function renderChart(d) {
  const canvas = document.getElementById('voteChart');
  if (!canvas) return;

  if (typeof Chart === 'undefined') {
    console.warn('Chart.js not loaded');
    renderFallback(d);
    return;
  }

  const labels = Object.keys(d.candidates).map(k => 'Calon ' + k);
  const values = Object.keys(d.candidates).map(k => d.candidates[k].votes);
  const colors = Object.keys(d.candidates).map(k => cinfo[k].color);

  if (voteChart) {
    voteChart.data.labels = labels;
    voteChart.data.datasets[0].data = values;
    voteChart.data.datasets[0].backgroundColor = colors;
    voteChart.update('active');
  } else {
    try {
      canvas.style.display = 'block';
      canvas.style.width = '220px';
      canvas.style.height = '220px';
      voteChart = new Chart(canvas, {
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
          responsive: false,
          maintainAspectRatio: false,
          cutout: '60%',
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: function(ctx) {
                  const k = Object.keys(d.candidates)[ctx.dataIndex];
                  return cinfo[k].name + ': ' + ctx.raw + ' (' + d.candidates[k].percentage + '%)';
                }
              }
            }
          },
          animation: { animateScale: true, animateRotate: true }
        }
      });
    } catch (e) {
      console.error('Chart error:', e);
      renderFallback(d);
    }
  }
}

function renderFallback(d) {
  const area = document.querySelector('.chart-area');
  if (!area) return;
  const canvas = document.getElementById('voteChart');
  if (canvas) canvas.style.display = 'none';
  let fb = area.querySelector('.fb-chart');
  if (!fb) {
    fb = document.createElement('div');
    fb.className = 'fb-chart';
    fb.style.cssText = 'position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:10px;';
    area.appendChild(fb);
  }
  let h = '';
  for (const [n, info] of Object.entries(d.candidates)) {
    const c = cinfo[n];
    h += '<div style="display:flex;align-items:center;gap:5px;width:100%;">' +
      '<div style="width:10px;height:10px;border-radius:3px;background:' + c.color + ';flex-shrink:0;"></div>' +
      '<div style="flex:1;font-size:0.7rem;font-weight:600;">' + c.name.split(' ')[0] + '</div>' +
      '<div style="font-size:0.78rem;font-weight:800;color:' + c.color + ';">' + info.percentage + '%</div>' +
    '</div>';
  }
  fb.innerHTML = h;
}

/* ===== INIT ===== */
document.addEventListener('DOMContentLoaded', () => {
  checkStatus();
  loadPolling();
});

document.getElementById('modal')?.addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });
document.getElementById('asp-modal')?.addEventListener('click', e => { if (e.target.id === 'asp-modal') closeAspModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeModal(); closeAspModal(); } });
