/* ═══════════════════════════════════════════
   PIER26 — Main JS (Editorial Dark Luxury)
═══════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {

  // ── Nav scroll ──────────────────────────────
  const nav = document.getElementById('nav');
  const backTop = document.getElementById('back-top');

  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    nav.classList.toggle('solid', y > 80);
    backTop.classList.toggle('show', y > 500);
  }, { passive: true });

  backTop?.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

  // ── Mobile nav toggle ───────────────────────
  const toggle = document.getElementById('nav-toggle');
  const links = document.getElementById('nav-links');

  toggle?.addEventListener('click', () => {
    toggle.classList.toggle('open');
    links.classList.toggle('open');
  });
  links?.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => {
      toggle.classList.remove('open');
      links.classList.remove('open');
    });
  });

  // ── Hero slider ─────────────────────────────
  const slides = document.querySelectorAll('.hero-slide');
  const dotsWrap = document.getElementById('hero-dots');
  let cur = 0;

  if (slides.length > 1) {
    slides.forEach((_, i) => {
      const d = document.createElement('div');
      d.className = 'hero-dot' + (i === 0 ? ' active' : '');
      d.addEventListener('click', () => goTo(i));
      dotsWrap?.appendChild(d);
    });

    function goTo(n) {
      slides[cur].classList.remove('active');
      document.querySelectorAll('.hero-dot')[cur]?.classList.remove('active');
      cur = (n + slides.length) % slides.length;
      slides[cur].classList.add('active');
      document.querySelectorAll('.hero-dot')[cur]?.classList.add('active');
    }

    setInterval(() => goTo(cur + 1), 5500);
  }

  // ── Reveal on scroll ────────────────────────
  const revealEls = document.querySelectorAll('.reveal');
  const revealObs = new IntersectionObserver(entries => {
    entries.forEach((e, i) => {
      if (!e.isIntersecting) return;
      // stagger siblings
      const siblings = [...e.target.parentElement.querySelectorAll('.reveal:not(.in)')];
      const idx = siblings.indexOf(e.target);
      setTimeout(() => {
        e.target.classList.add('in');
        revealObs.unobserve(e.target);
      }, Math.min(idx * 80, 300));
    });
  }, { threshold: 0.1 });
  revealEls.forEach(el => revealObs.observe(el));

  // ── Count-up numbers ────────────────────────
  const countEls = document.querySelectorAll('.count-up');
  const countObs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      const el = e.target;
      const target = parseFloat(el.dataset.target);
      const isFloat = target % 1 !== 0;
      const dur = 1600;
      const start = performance.now();

      (function step(now) {
        const p = Math.min((now - start) / dur, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = isFloat
          ? (target * eased).toFixed(1)
          : Math.floor(target * eased).toLocaleString();
        if (p < 1) requestAnimationFrame(step);
        else el.textContent = isFloat ? target.toFixed(1) : target.toLocaleString();
      })(start);

      countObs.unobserve(el);
    });
  }, { threshold: 0.5 });
  countEls.forEach(el => countObs.observe(el));

  // ── Smooth anchor scroll (header offset) ────
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const id = a.getAttribute('href').slice(1);
      const target = document.getElementById(id);
      if (!target) return;
      e.preventDefault();
      const top = target.getBoundingClientRect().top + window.scrollY - 76;
      window.scrollTo({ top, behavior: 'smooth' });
    });
  });

  // ── Phone auto-hyphen ───────────────────────
  document.getElementById('f-phone')?.addEventListener('input', e => {
    let v = e.target.value.replace(/\D/g, '').slice(0, 11);
    if (v.length > 7) v = v.slice(0,3) + '-' + v.slice(3,7) + '-' + v.slice(7);
    else if (v.length > 3) v = v.slice(0,3) + '-' + v.slice(3);
    e.target.value = v;
  });

  // ── Contact form submit ──────────────────────
  const form = document.getElementById('contact-form');
  const successEl = document.getElementById('form-success');
  const submitBtn = document.getElementById('submit-btn');

  form?.addEventListener('submit', async e => {
    e.preventDefault();

    const name = form.name.value.trim();
    const phone = form.phone.value.trim().replace(/-/g, '');
    const email = form.email?.value.trim() || '';
    const message = form.message.value.trim();
    const inquiryType = form.inquiryType.value;

    if (!name || !phone || !message) { toast('이름, 연락처, 문의내용을 입력해주세요.', true); return; }
    if (!/^01[0-9]{8,9}$/.test(phone)) { toast('올바른 전화번호를 입력해주세요.', true); return; }

    submitBtn.disabled = true;
    submitBtn.querySelector('span').textContent = '접수 중...';

    try {
      const res = await fetch('/api/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, email, message, inquiryType }),
      });
      const data = await res.json();
      if (data.success) {
        form.style.display = 'none';
        successEl.style.display = 'block';
      } else {
        toast(data.message || '오류가 발생했습니다. 직접 전화 주세요.', true);
        submitBtn.disabled = false;
        submitBtn.querySelector('span').textContent = '문의 접수하기';
      }
    } catch {
      toast('네트워크 오류입니다. 010-3980-9087로 직접 연락해주세요.', true);
      submitBtn.disabled = false;
      submitBtn.querySelector('span').textContent = '문의 접수하기';
    }
  });

  // ── Toast ────────────────────────────────────
  function toast(msg, isErr = false) {
    const el = document.createElement('div');
    el.style.cssText = `
      position:fixed;top:88px;right:24px;z-index:9999;
      background:${isErr ? '#7a1a1a' : '#1E3A6E'};color:#fff;
      padding:14px 22px;font-size:0.88rem;max-width:300px;
      border-left:3px solid ${isErr ? '#e74c3c' : '#C9A84C'};
      box-shadow:0 8px 32px rgba(0,0,0,0.4);
      animation:toastIn .3s ease;
    `;
    el.textContent = msg;
    document.body.appendChild(el);
    const style = document.createElement('style');
    style.textContent = '@keyframes toastIn{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}';
    document.head.appendChild(style);
    setTimeout(() => { el.style.opacity='0'; el.style.transition='opacity .4s'; setTimeout(()=>el.remove(),400); }, 4000);
  }

});
