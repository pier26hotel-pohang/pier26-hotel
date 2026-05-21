/* ═══════════════════════════════════════════
   PIER26 — Admin Dashboard JS
═══════════════════════════════════════════ */

let adminPw = '';
let currentCustomerId = null;

// ── 로그인 ──────────────────────────────────
function doLogin() {
  const pw = document.getElementById('login-pw').value;
  if (!pw) return;
  adminPw = pw;
  fetch('/api/admin/stats', { headers: { 'x-admin-password': pw } })
    .then(r => {
      if (r.status === 401) {
        document.getElementById('login-err').textContent = '비밀번호가 올바르지 않습니다.';
        adminPw = '';
      } else {
        document.getElementById('login-screen').style.display = 'none';
        initDashboard();
      }
    })
    .catch(() => { document.getElementById('login-err').textContent = '서버에 연결할 수 없습니다.'; });
}
document.getElementById('login-pw').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });

function logout() { adminPw = ''; location.reload(); }

// ── 네비게이션 ───────────────────────────────
function navTo(page) {
  document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.page === page));
  document.querySelectorAll('.page').forEach(p => p.classList.toggle('active', p.id === 'page-' + page));
  const titles = { dashboard: '대시보드', inquiries: '문의 목록', customers: '고객 관리', vendit: 'Vendit 연동' };
  document.getElementById('page-title').textContent = titles[page] || page;
  if (page === 'inquiries') loadInquiries();
  if (page === 'customers') loadCustomers();
}
document.querySelectorAll('.nav-item').forEach(n => {
  n.addEventListener('click', () => navTo(n.dataset.page));
});

// ── API helper ──────────────────────────────
async function api(url, opts = {}) {
  const res = await fetch(url, {
    ...opts,
    headers: { 'x-admin-password': adminPw, 'Content-Type': 'application/json', ...(opts.headers || {}) },
    body: opts.body ? (typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body)) : undefined,
  });
  return res.json();
}

// ── 초기화 ──────────────────────────────────
function initDashboard() {
  loadStats();
  loadDashboardInquiries();
  updateClock();
  setInterval(updateClock, 1000);
}

function updateClock() {
  document.getElementById('current-time').textContent =
    new Date().toLocaleString('ko-KR', { year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' });
}

// ── 통계 ────────────────────────────────────
async function loadStats() {
  const data = await api('/api/admin/stats');
  document.getElementById('s-customers').textContent = (data.totalCustomers || 0).toLocaleString();
  document.getElementById('s-inquiries').textContent = (data.totalInquiries || 0).toLocaleString();
  document.getElementById('s-visits').textContent = (data.totalVisits || 0).toLocaleString();
  document.getElementById('s-pending').textContent = (data.pendingInquiries || 0).toLocaleString();
}

// ── 대시보드 최근 문의 ───────────────────────
async function loadDashboardInquiries() {
  const data = await api('/api/admin/inquiries?limit=8');
  renderInquiriesTable(data, 'dashboard-inquiries', true);
}

// ── 문의 전체 목록 ───────────────────────────
async function loadInquiries() {
  document.getElementById('inquiries-table').innerHTML = '<div class="loading">로딩 중...</div>';
  const data = await api('/api/admin/inquiries?limit=100');
  renderInquiriesTable(data, 'inquiries-table', false);
}

function renderInquiriesTable(data, containerId, compact) {
  const el = document.getElementById(containerId);
  if (!data || data.length === 0) {
    el.innerHTML = '<div class="empty"><div class="empty-icon">💬</div>문의가 없습니다.</div>';
    return;
  }
  const typeMap = { reservation: '예약', party: '파티룸', business: '비즈니스', general: '기타' };
  el.innerHTML = `<table>
    <thead><tr>
      <th>날짜</th><th>이름</th><th>연락처</th>
      ${compact ? '' : '<th>유형</th><th>내용</th>'}
      <th>상태</th><th>처리</th>
    </tr></thead>
    <tbody>
    ${data.map(i => `<tr>
      <td style="white-space:nowrap;font-size:0.78rem">${fmtDate(i.created_at)}</td>
      <td><strong>${esc(i.name)}</strong>${i.cid ? ` <a href="#" onclick="openCustomer(${i.cid})" style="font-size:0.75rem;color:#1E3A6E">상세</a>` : ''}</td>
      <td><a href="tel:${esc(i.phone)}">${esc(i.phone)}</a></td>
      ${compact ? '' : `<td>${typeMap[i.inquiry_type] || i.inquiry_type}</td><td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(i.message)}">${esc(i.message)}</td>`}
      <td><span class="badge badge-${i.status === 'done' ? 'done' : i.status === 'cancel' ? 'cancel' : 'pending'}">${i.status === 'done' ? '처리완료' : i.status === 'cancel' ? '취소' : '대기중'}</span></td>
      <td>
        <button class="btn btn-sm btn-gold" onclick="setInquiryStatus(${i.id},'done',this)">완료</button>
        <button class="btn btn-sm btn-outline" onclick="setInquiryStatus(${i.id},'cancel',this)" style="margin-left:4px">취소</button>
      </td>
    </tr>`).join('')}
    </tbody>
  </table>`;
}

async function setInquiryStatus(id, status, btn) {
  btn.disabled = true;
  await api(`/api/admin/inquiries/${id}/status`, { method: 'PATCH', body: { status } });
  showToast('상태가 업데이트되었습니다.');
  loadStats();
  if (document.getElementById('page-dashboard').classList.contains('active')) loadDashboardInquiries();
  if (document.getElementById('page-inquiries').classList.contains('active')) loadInquiries();
}

// ── 고객 목록 ────────────────────────────────
async function loadCustomers() {
  const search = document.getElementById('customer-search')?.value || '';
  document.getElementById('customers-table').innerHTML = '<div class="loading">로딩 중...</div>';
  const data = await api(`/api/admin/customers?search=${encodeURIComponent(search)}`);
  const el = document.getElementById('customers-table');
  if (!data || data.length === 0) {
    el.innerHTML = '<div class="empty"><div class="empty-icon">👥</div>고객이 없습니다.</div>';
    return;
  }
  el.innerHTML = `<table>
    <thead><tr><th>이름</th><th>연락처</th><th>방문횟수</th><th>마지막 방문</th><th>메모</th><th>상세</th></tr></thead>
    <tbody>
    ${data.map(c => `<tr>
      <td><strong>${esc(c.name)}</strong></td>
      <td><a href="tel:${esc(c.phone)}">${esc(c.phone)}</a></td>
      <td><span class="visit-count ${c.visit_count >= 3 ? 'high' : ''}">${c.visit_count || 0}</span></td>
      <td style="font-size:0.82rem">${c.last_visit ? fmtDate(c.last_visit) : '-'}</td>
      <td style="font-size:0.82rem;color:#888;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(c.memo || '')}</td>
      <td><button class="btn btn-sm btn-primary" onclick="openCustomer(${c.id})">상세보기</button></td>
    </tr>`).join('')}
    </tbody>
  </table>`;
}

document.getElementById('customer-search')?.addEventListener('keydown', e => { if (e.key === 'Enter') loadCustomers(); });

// ── 고객 상세 모달 ───────────────────────────
async function openCustomer(id) {
  currentCustomerId = id;
  const c = await api(`/api/admin/customers/${id}`);
  if (!c) return;
  document.getElementById('modal-customer-name').textContent = `${c.name} 고객 상세`;
  document.getElementById('modal-customer-body').innerHTML = `
    <div class="customer-meta">
      <div class="meta-item"><label>이름</label><strong>${esc(c.name)}</strong></div>
      <div class="meta-item"><label>연락처</label><strong><a href="tel:${esc(c.phone)}">${esc(c.phone)}</a></strong></div>
      <div class="meta-item"><label>방문 횟수</label><strong>${c.visits.length}회</strong></div>
    </div>
    ${c.email ? `<p style="font-size:0.85rem;color:#666;margin-bottom:16px">📧 ${esc(c.email)}</p>` : ''}
    <div class="form-group">
      <label>Vendit 고객 ID (연동용)</label>
      <input type="text" id="edit-vendit-id" value="${esc(c.vendit_id || '')}" placeholder="Vendit ID" />
    </div>
    <div class="form-group">
      <label>메모</label>
      <textarea id="edit-memo" rows="3" placeholder="고객 특이사항, 선호사항 등">${esc(c.memo || '')}</textarea>
    </div>
    <hr style="border:none;border-top:1px solid #eee;margin:20px 0" />
    <h4 style="font-size:0.9rem;font-weight:700;margin-bottom:14px">방문 이력 (${c.visits.length}회)</h4>
    <div class="timeline">
      ${c.visits.length === 0 ? '<p style="color:#888;font-size:0.85rem">방문 기록 없음</p>' :
        c.visits.map(v => `<div class="timeline-item">
          <div class="ti-date">${fmtDate(v.created_at)}</div>
          <div class="ti-title">${esc(v.room_type || '객실 미상')} · ${v.guests || 1}명</div>
          <div class="ti-desc">
            ${v.check_in ? `체크인: ${v.check_in}` : ''}
            ${v.check_out ? ` ~ ${v.check_out}` : ''}
            · ${esc(v.source || 'direct')}
            ${v.memo ? `<br>${esc(v.memo)}` : ''}
          </div>
        </div>`).join('')
      }
    </div>
    <hr style="border:none;border-top:1px solid #eee;margin:20px 0" />
    <h4 style="font-size:0.9rem;font-weight:700;margin-bottom:14px">문의 이력 (${c.inquiries.length}건)</h4>
    ${c.inquiries.length === 0 ? '<p style="color:#888;font-size:0.85rem">문의 이력 없음</p>' :
      c.inquiries.map(i => `<div style="background:#f8f9fa;border-radius:6px;padding:12px 16px;margin-bottom:10px;font-size:0.85rem">
        <div style="color:#888;font-size:0.75rem;margin-bottom:4px">${fmtDate(i.created_at)}</div>
        <div>${esc(i.message)}</div>
      </div>`).join('')
    }
  `;
  openModal('customer-modal');
}

async function saveCustomerMemo() {
  if (!currentCustomerId) return;
  const memo = document.getElementById('edit-memo').value;
  const venditId = document.getElementById('edit-vendit-id').value;
  await api(`/api/admin/customers/${currentCustomerId}`, { method: 'PATCH', body: { memo, venditId } });
  showToast('저장되었습니다.');
  loadCustomers();
}

// ── 방문 기록 모달 ───────────────────────────
function openVisitModal() {
  const today = new Date().toISOString().slice(0, 10);
  document.getElementById('v-checkin').value = today;
  document.getElementById('v-checkout').value = today;
  openModal('visit-modal');
}

async function saveVisit() {
  if (!currentCustomerId) return;
  const data = {
    checkIn: document.getElementById('v-checkin').value,
    checkOut: document.getElementById('v-checkout').value,
    roomType: document.getElementById('v-roomtype').value,
    guests: document.getElementById('v-guests').value,
    source: document.getElementById('v-source').value,
    memo: document.getElementById('v-memo').value,
  };
  await api(`/api/admin/customers/${currentCustomerId}/visits`, { method: 'POST', body: data });
  showToast('방문 기록이 추가되었습니다.');
  closeModal('visit-modal');
  openCustomer(currentCustomerId);
  loadStats();
}

// ── Vendit 동기화 ────────────────────────────
async function syncVendit() {
  const el = document.getElementById('vendit-result');
  el.innerHTML = '<p style="color:#1E3A6E">🔄 동기화 중...</p>';
  const result = await api('/api/admin/vendit/sync');
  el.innerHTML = `<div style="background:${result.success ? '#d4edda' : '#fff3cd'};border-radius:8px;padding:16px;font-size:0.9rem">
    ${result.success ? '✅' : '⚠️'} ${result.message}
  </div>`;
}

// ── 모달 ─────────────────────────────────────
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
document.querySelectorAll('.modal-backdrop').forEach(m => {
  m.addEventListener('click', e => { if (e.target === m) m.classList.remove('open'); });
});

// ── Toast ─────────────────────────────────────
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2800);
}

// ── Helpers ──────────────────────────────────
function fmtDate(str) {
  if (!str) return '-';
  return new Date(str).toLocaleString('ko-KR', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' });
}
function esc(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
