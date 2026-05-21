require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');
const {
  saveInquiry, markSmsSent, getCustomers, getCustomerDetail, updateCustomer,
  addVisit, deleteVisit, setInquiryStatus, getRecentInquiries, getStats,
} = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// 정적 파일 (홈페이지)
app.use(express.static(path.join(__dirname, 'public')));
// 사진 파일 서빙
app.use('/pictures', express.static(path.join(__dirname, 'pictures')));

// 문의 폼 rate limit (스팸 방지)
const inquiryLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  message: { success: false, message: '잠시 후 다시 시도해주세요.' }
});

// ─── SMS 발송 ────────────────────────────────────────────────────────────────
async function sendSms(toPhone, text) {
  try {
    if (!process.env.SOLAPI_API_KEY || !process.env.SOLAPI_API_SECRET) {
      console.log('[SMS 미설정] 발송 내용:', text);
      return false;
    }
    const { SolapiMessageService } = require('solapi');
    const service = new SolapiMessageService(
      process.env.SOLAPI_API_KEY,
      process.env.SOLAPI_API_SECRET
    );
    await service.send({
      to: toPhone,
      from: process.env.SOLAPI_SENDER,
      text,
    });
    return true;
  } catch (err) {
    console.error('[SMS 오류]', err.message);
    return false;
  }
}

// ─── 임시 SMS 디버그 (확인 후 삭제) ─────────────────────────────────────────
app.get('/api/sms-test', async (req, res) => {
  const key = process.env.SOLAPI_API_KEY || '없음';
  const secret = process.env.SOLAPI_API_SECRET ? '설정됨' : '없음';
  const sender = process.env.SOLAPI_SENDER || '없음';
  const notify = process.env.NOTIFY_PHONE || '없음';

  console.log('[SMS-TEST] KEY:', key, 'SECRET:', secret, 'SENDER:', sender);

  const sent = await sendSms(notify, '[PIER26] SMS 디버그 테스트');
  res.json({ key, secret, sender, notify, sent });
});

// ─── 공개 API ────────────────────────────────────────────────────────────────

// 문의 접수
app.post('/api/inquiries', inquiryLimiter, async (req, res) => {
  const { name, phone, email, message, inquiryType } = req.body;
  if (!name || !phone || !message) {
    return res.status(400).json({ success: false, message: '이름, 전화번호, 문의내용을 입력해주세요.' });
  }
  if (!/^01[0-9]{8,9}$/.test(phone.replace(/-/g, ''))) {
    return res.status(400).json({ success: false, message: '올바른 전화번호를 입력해주세요.' });
  }

  try {
    const { inquiryId, customerId } = saveInquiry(name, phone, email, message, inquiryType);

    // 담당자에게 SMS 알림
    const notifyPhone = process.env.NOTIFY_PHONE || '01039809087';
    const smsText = `[PIER26 신규문의]\n이름: ${name}\n연락처: ${phone}\n문의: ${message.slice(0, 50)}${message.length > 50 ? '...' : ''}`;
    const sent = await sendSms(notifyPhone, smsText);
    if (sent) markSmsSent(inquiryId);

    res.json({ success: true, message: '문의가 접수되었습니다. 빠르게 연락드리겠습니다!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: '오류가 발생했습니다. 직접 전화 주세요.' });
  }
});

// ─── 관리자 API (간단한 비밀번호 인증) ──────────────────────────────────────

function adminAuth(req, res, next) {
  const pw = req.headers['x-admin-password'];
  if (pw !== (process.env.ADMIN_PASSWORD || 'pier26admin2024')) {
    return res.status(401).json({ success: false, message: '인증 필요' });
  }
  next();
}

// 통계
app.get('/api/admin/stats', adminAuth, (req, res) => {
  res.json(getStats());
});

// 문의 목록
app.get('/api/admin/inquiries', adminAuth, (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  res.json(getRecentInquiries(limit));
});

// 문의 상태 변경
app.patch('/api/admin/inquiries/:id/status', adminAuth, (req, res) => {
  const { status } = req.body;
  setInquiryStatus(req.params.id, status);
  res.json({ success: true });
});

// 고객 목록
app.get('/api/admin/customers', adminAuth, (req, res) => {
  const { search = '' } = req.query;
  res.json(getCustomers(search));
});

// 고객 상세
app.get('/api/admin/customers/:id', adminAuth, (req, res) => {
  const customer = getCustomerDetail(req.params.id);
  if (!customer) return res.status(404).json({ message: '고객을 찾을 수 없습니다.' });
  res.json(customer);
});

// 고객 메모 수정
app.patch('/api/admin/customers/:id', adminAuth, (req, res) => {
  updateCustomer(req.params.id, req.body);
  res.json({ success: true });
});

// 방문 기록 추가
app.post('/api/admin/customers/:id/visits', adminAuth, (req, res) => {
  const visitId = addVisit(req.params.id, req.body);
  res.json({ success: true, visitId });
});

// 방문 기록 삭제
app.delete('/api/admin/visits/:id', adminAuth, (req, res) => {
  deleteVisit(req.params.id);
  res.json({ success: true });
});

// ─── Vendit PMS 연동 (향후 확장) ─────────────────────────────────────────────
// Vendit API 키 발급 후 아래 엔드포인트들을 구현하세요
app.get('/api/admin/vendit/sync', adminAuth, async (req, res) => {
  if (!process.env.VENDIT_API_KEY) {
    return res.json({ success: false, message: 'Vendit API 키가 설정되지 않았습니다. .env 파일을 확인하세요.' });
  }
  // TODO: Vendit API로 예약 데이터 동기화
  res.json({ success: false, message: 'Vendit API 연동 준비 중입니다. API 문서를 공유해주세요.' });
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`✅ PIER26 서버 실행 중: http://localhost:${PORT}`);
  console.log(`📋 관리자 대시보드: http://localhost:${PORT}/admin.html`);
});
