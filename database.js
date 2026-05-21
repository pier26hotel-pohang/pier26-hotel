const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'pier26-db.json');

function loadDb() {
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  } catch {
    return { customers: [], inquiries: [], visits: [], _seq: { customers: 0, inquiries: 0, visits: 0 } };
  }
}

function saveDb(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

function nextId(data, table) {
  data._seq[table] = (data._seq[table] || 0) + 1;
  return data._seq[table];
}

function now() {
  return new Date().toISOString();
}

// 고객 조회 또는 생성 (전화번호 기준)
function upsertCustomer(name, phone, email = null) {
  const data = loadDb();
  let customer = data.customers.find(c => c.phone === phone);
  if (customer) {
    customer.name = name;
    customer.updated_at = now();
    saveDb(data);
    return customer.id;
  }
  const id = nextId(data, 'customers');
  data.customers.push({ id, name, phone, email, memo: null, vendit_id: null, created_at: now(), updated_at: now() });
  saveDb(data);
  return id;
}

// 문의 저장
function saveInquiry(name, phone, email, message, inquiryType = 'general') {
  const data = loadDb();
  const customerId = upsertCustomer(name, phone, email);
  const id = nextId(data, 'inquiries');
  data.inquiries.push({ id, customer_id: customerId, name, phone, email, message, inquiry_type: inquiryType, status: 'pending', sms_sent: false, created_at: now() });
  saveDb(data);
  return { inquiryId: id, customerId };
}

// SMS 발송 완료 표시
function markSmsSent(inquiryId) {
  const data = loadDb();
  const inq = data.inquiries.find(i => i.id === inquiryId);
  if (inq) { inq.sms_sent = true; saveDb(data); }
}

// 전체 고객 목록 (방문 횟수 포함)
function getCustomers(search = '') {
  const data = loadDb();
  const q = search.toLowerCase();
  return data.customers
    .filter(c => !q || c.name.toLowerCase().includes(q) || c.phone.includes(q))
    .map(c => {
      const visits = data.visits.filter(v => v.customer_id === c.id);
      const lastVisit = visits.length ? visits.sort((a,b) => b.check_in?.localeCompare(a.check_in || '') || 0)[0]?.check_in : null;
      return { ...c, visit_count: visits.length, last_visit: lastVisit };
    })
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

// 고객 상세 (방문 이력 + 문의 이력)
function getCustomerDetail(id) {
  const data = loadDb();
  const customer = data.customers.find(c => c.id === parseInt(id));
  if (!customer) return null;
  return {
    ...customer,
    visits: data.visits.filter(v => v.customer_id === customer.id).sort((a,b) => b.created_at.localeCompare(a.created_at)),
    inquiries: data.inquiries.filter(i => i.customer_id === customer.id).sort((a,b) => b.created_at.localeCompare(a.created_at)),
  };
}

// 고객 정보 수정
function updateCustomer(id, { memo, venditId }) {
  const data = loadDb();
  const c = data.customers.find(c => c.id === parseInt(id));
  if (c) { c.memo = memo; c.vendit_id = venditId; c.updated_at = now(); saveDb(data); }
}

// 방문 기록 추가
function addVisit(customerId, visitData) {
  const data = loadDb();
  const id = nextId(data, 'visits');
  data.visits.push({
    id, customer_id: parseInt(customerId),
    room_type: visitData.roomType, check_in: visitData.checkIn, check_out: visitData.checkOut,
    guests: visitData.guests || 1, memo: visitData.memo, source: visitData.source || 'direct',
    vendit_reservation_id: visitData.venditReservationId || null, created_at: now(),
  });
  saveDb(data);
  return id;
}

// 방문 기록 삭제
function deleteVisit(id) {
  const data = loadDb();
  data.visits = data.visits.filter(v => v.id !== parseInt(id));
  saveDb(data);
}

// 문의 상태 변경
function setInquiryStatus(id, status) {
  const data = loadDb();
  const inq = data.inquiries.find(i => i.id === parseInt(id));
  if (inq) { inq.status = status; saveDb(data); }
}

// 최근 문의 목록
function getRecentInquiries(limit = 50) {
  const data = loadDb();
  return [...data.inquiries]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, limit)
    .map(i => {
      const c = data.customers.find(c => c.phone === i.phone);
      return { ...i, cid: c?.id };
    });
}

// 통계
function getStats() {
  const data = loadDb();
  return {
    totalCustomers: data.customers.length,
    totalInquiries: data.inquiries.length,
    totalVisits: data.visits.length,
    pendingInquiries: data.inquiries.filter(i => i.status === 'pending').length,
  };
}

module.exports = {
  upsertCustomer, saveInquiry, markSmsSent,
  getCustomers, getCustomerDetail, updateCustomer,
  addVisit, deleteVisit, setInquiryStatus,
  getRecentInquiries, getStats,
};
