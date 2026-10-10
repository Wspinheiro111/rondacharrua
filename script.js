document.documentElement.classList.add('has-js');

const WHATSAPP_NUMBER = '5554996893919';
const header = document.querySelector('.site-header');
const toggle = document.querySelector('.menu-toggle');
const menu = document.querySelector('.menu');
const hero = document.querySelector('.hero');
const motto = document.querySelector('.motto');
const mottoWords = [...document.querySelectorAll('[data-highlight] span')];
const whatsappFloat = document.querySelector('.whatsapp-float');
const footer = document.querySelector('.site-footer');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = window.matchMedia('(pointer: fine)').matches;

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));

/* Efeitos ligados ao scroll — um único rAF por frame */
function updateScrollEffects() {
  const scrollY = window.scrollY;
  const vh = window.innerHeight;
  header?.classList.toggle('scrolled', scrollY > 30);

  const docHeight = document.documentElement.scrollHeight - vh;
  document.documentElement.style.setProperty('--page-progress', docHeight > 0 ? clamp(scrollY / docHeight).toFixed(4) : '0');

  if (whatsappFloat && footer) {
    whatsappFloat.classList.toggle('near-footer', footer.getBoundingClientRect().top < vh - 40);
  }

  if (reduceMotion) return;

  if (hero) {
    const progress = clamp(scrollY / Math.max(hero.offsetHeight, 1));
    hero.style.setProperty('--hero-progress', progress.toFixed(3));
    hero.style.setProperty('--hero-scale', (1.05 + progress * 0.1).toFixed(3));
    hero.style.setProperty('--hero-scroll-y', `${(progress * 70).toFixed(1)}px`);
    hero.style.setProperty('--hero-copy-y', `${(progress * -34).toFixed(1)}px`);
    hero.style.setProperty('--hero-copy-opacity', String(clamp(1 - progress * 1.05, 0.18, 1)));
  }

  document.querySelectorAll('.gallery figure').forEach((figure) => {
    const rect = figure.getBoundingClientRect();
    if (rect.bottom < -120 || rect.top > vh + 120) return;
    const progress = clamp((vh - rect.top) / (vh + rect.height));
    figure.style.setProperty('--gallery-y', `${((progress - 0.5) * 36).toFixed(1)}px`);
  });

  // Lema: acende uma palavra por vez conforme a seção sticky avança
  if (motto && mottoWords.length) {
    const rect = motto.getBoundingClientRect();
    const total = Math.max(rect.height - vh, 1);
    const progress = clamp(-rect.top / total);
    const lit = Math.round(clamp(progress * 1.25) * mottoWords.length);
    mottoWords.forEach((word, index) => word.classList.toggle('lit', index < lit));
  }
}

let scrollTicking = false;
const requestUpdate = () => {
  if (scrollTicking) return;
  scrollTicking = true;
  requestAnimationFrame(() => {
    updateScrollEffects();
    scrollTicking = false;
  });
};
window.addEventListener('scroll', requestUpdate, { passive: true });
window.addEventListener('resize', requestUpdate, { passive: true });
updateScrollEffects();

/* Menu mobile: fecha com Esc, clique fora e ao escolher um link */
function setMenu(open, { returnFocus = false } = {}) {
  if (!menu || !toggle) return;
  menu.classList.toggle('open', open);
  toggle.setAttribute('aria-expanded', String(open));
  toggle.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
  if (!open && returnFocus) toggle.focus();
}
toggle?.addEventListener('click', () => setMenu(!menu.classList.contains('open')));
menu?.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => setMenu(false)));
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && menu?.classList.contains('open')) setMenu(false, { returnFocus: true });
});
document.addEventListener('click', (event) => {
  if (menu?.classList.contains('open') && !menu.contains(event.target) && !toggle.contains(event.target)) setMenu(false);
});

/* Link ativo na navegação conforme a seção visível */
const navLinks = [...document.querySelectorAll('.menu a[href^="#"]')];
const sectionById = new Map(navLinks.map((a) => [a.getAttribute('href').slice(1), document.getElementById(a.getAttribute('href').slice(1))]));
if ('IntersectionObserver' in window) {
  const spy = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      navLinks.forEach((a) => {
        const active = a.getAttribute('href') === `#${entry.target.id}`;
        a.classList.toggle('active', active);
        if (active) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
      });
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  sectionById.forEach((section) => section && spy.observe(section));
}

/* Reveal on scroll */
if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('visible');
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -3% 0px' });
  document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));
} else {
  document.querySelectorAll('.reveal').forEach((el) => el.classList.add('visible'));
}

/* Parallax discreto do hero com o ponteiro (somente mouse) */
if (!reduceMotion && hero && finePointer) {
  hero.addEventListener('pointermove', (event) => {
    const rect = hero.getBoundingClientRect();
    hero.style.setProperty('--hero-pan-x', `${(((event.clientX - rect.left) / rect.width - 0.5) * -14).toFixed(1)}px`);
    hero.style.setProperty('--hero-pan-y', `${(((event.clientY - rect.top) / rect.height - 0.5) * -9).toFixed(1)}px`);
  }, { passive: true });
  hero.addEventListener('pointerleave', () => {
    hero.style.setProperty('--hero-pan-x', '0px');
    hero.style.setProperty('--hero-pan-y', '0px');
  });
}

/* Contadores das conquistas */
if ('IntersectionObserver' in window && !reduceMotion) {
  const statsObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      statsObserver.unobserve(el);
      const match = el.textContent.trim().match(/^(\d+)(.*)$/);
      if (!match) return;
      const target = Number(match[1]);
      const suffix = match[2];
      const start = performance.now();
      const step = (now) => {
        const t = clamp((now - start) / 950);
        el.textContent = `${Math.round(target * (1 - Math.pow(1 - t, 3)))}${suffix}`;
        if (t < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }, { threshold: 0.7 });
  document.querySelectorAll('[data-count]').forEach((el) => statsObserver.observe(el));
}

/* Formulário: valida, abre o WhatsApp e oferece link caso o navegador bloqueie a nova aba */
const form = document.querySelector('#contact-form');
const status = document.querySelector('#form-status');
const rules = {
  nome: (v) => (v.length < 2 ? 'Informe seu nome.' : ''),
  telefone: (v) => (v.replace(/\D/g, '').length < 10 ? 'Informe um telefone com DDD, por exemplo (54) 90000-0000.' : ''),
  email: (v) => (v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? 'Esse e-mail parece incompleto.' : ''),
  assunto: (v) => (v ? '' : 'Escolha um assunto.'),
  mensagem: (v) => (v.length < 5 ? 'Escreva uma mensagem curta.' : ''),
};

function validateField(name) {
  const field = form.elements[name];
  const error = document.getElementById(`${name}-erro`);
  const message = rules[name](String(field.value || '').trim());
  error.textContent = message;
  if (message) field.setAttribute('aria-invalid', 'true'); else field.removeAttribute('aria-invalid');
  return message;
}

if (form && status) {
  Object.keys(rules).forEach((name) => {
    form.elements[name].addEventListener('blur', () => validateField(name));
    form.elements[name].addEventListener('input', () => {
      if (form.elements[name].getAttribute('aria-invalid')) validateField(name);
    });
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    status.textContent = '';
    const firstInvalid = Object.keys(rules).filter((name) => validateField(name))[0];
    if (firstInvalid) {
      form.elements[firstInvalid].focus();
      status.textContent = 'Revise os campos destacados.';
      return;
    }

    const data = new FormData(form);
    const get = (key) => String(data.get(key) || '').trim();
    const text = `Olá! Vim pelo site do CTG Ronda Charrua.\n\nNome: ${get('nome')}\nTelefone: ${get('telefone')}\nE-mail: ${get('email') || 'não informado'}\nAssunto: ${get('assunto')}\n\nMensagem: ${get('mensagem')}`;
    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
    const opened = window.open(url, '_blank', 'noopener');

    status.textContent = '';
    if (opened === null) {
      status.append('Seu navegador bloqueou a nova aba. ');
      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener';
      link.textContent = 'Toque aqui para abrir o WhatsApp.';
      status.append(link);
    } else {
      status.textContent = 'Abrindo o WhatsApp com sua mensagem pronta…';
    }
  });
}

/* RevealImage (React + Framer Motion) é carregado sob demanda, pouco antes
   da primeira imagem entrar na tela, para não pesar no carregamento inicial. */
const revealMounts = document.querySelectorAll('[data-reveal-image]');
if (revealMounts.length && 'IntersectionObserver' in window) {
  let revealLoaded = false;
  const revealObserver = new IntersectionObserver((entries) => {
    if (revealLoaded || !entries.some((entry) => entry.isIntersecting)) return;
    revealLoaded = true;
    revealObserver.disconnect();
    import('./assets/js/reveal-image.js').catch(() => {
      // Sem o módulo, as imagens estáticas de fallback continuam visíveis.
    });
  }, { rootMargin: '900px 0px' });
  revealMounts.forEach((el) => revealObserver.observe(el));
}
