document.documentElement.classList.add('has-js');

const header = document.querySelector('.site-header');
const toggle = document.querySelector('.menu-toggle');
const menu = document.querySelector('.menu');
const hero = document.querySelector('.hero');
const heroMedia = document.querySelector('.hero-media');
const heroCopy = document.querySelector('.hero-copy');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));

function updateScrollEffects() {
  const scrollY = window.scrollY;
  header?.classList.toggle('scrolled', scrollY > 30);

  if (!reduceMotion && hero) {
    const heroHeight = Math.max(hero.offsetHeight, 1);
    const progress = clamp(scrollY / heroHeight);
    hero.style.setProperty('--hero-progress', progress.toFixed(3));
    hero.style.setProperty('--hero-scale', (1.05 + progress * 0.12).toFixed(3));
    hero.style.setProperty('--hero-scroll-y', `${progress * 74}px`);
    hero.style.setProperty('--hero-copy-y', `${progress * -34}px`);
    hero.style.setProperty('--hero-copy-scale', (1 - progress * 0.025).toFixed(3));
    hero.style.setProperty('--hero-copy-opacity', String(clamp(1 - progress * 1.05, .18, 1)));
  }

  if (!reduceMotion) {
    const vh = window.innerHeight;
    document.querySelectorAll('.gallery figure').forEach((figure) => {
      const rect = figure.getBoundingClientRect();
      if (rect.bottom < -120 || rect.top > vh + 120) return;
      const progress = clamp((vh - rect.top) / (vh + rect.height));
      const y = (progress - .5) * 44;
      figure.style.setProperty('--gallery-y', `${y.toFixed(1)}px`);
    });

    const activityImage = document.querySelector('.activity-image');
    if (activityImage) {
      const rect = activityImage.getBoundingClientRect();
      const progress = clamp((vh - rect.top) / (vh + rect.height));
      activityImage.style.setProperty('--activity-y', `${((progress - .5) * 26).toFixed(1)}px`);
    }
  }
}

let scrollTicking = false;
window.addEventListener('scroll', () => {
  if (!scrollTicking) {
    requestAnimationFrame(() => {
      updateScrollEffects();
      scrollTicking = false;
    });
    scrollTicking = true;
  }
}, { passive: true });
window.addEventListener('resize', updateScrollEffects, { passive: true });
updateScrollEffects();

toggle?.addEventListener('click', () => {
  const open = menu.classList.toggle('open');
  toggle.setAttribute('aria-expanded', String(open));
});
menu?.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => {
  menu.classList.remove('open');
  toggle?.setAttribute('aria-expanded', 'false');
}));

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      observer.unobserve(entry.target);
    }
  });
}, { threshold: .12, rootMargin: '0px 0px -3% 0px' });
document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));

if (!reduceMotion && heroMedia && window.matchMedia('(pointer:fine)').matches) {
  hero.addEventListener('pointermove', (event) => {
    const rect = hero.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width - .5) * -14;
    const y = ((event.clientY - rect.top) / rect.height - .5) * -9;
    hero.style.setProperty('--hero-pan-x', `${x.toFixed(1)}px`);
    hero.style.setProperty('--hero-pan-y', `${y.toFixed(1)}px`);
  }, { passive: true });
  hero.addEventListener('pointerleave', () => {
    hero.style.setProperty('--hero-pan-x', '0px');
    hero.style.setProperty('--hero-pan-y', '0px');
  });
}

const activityImage = document.querySelector('.activity-image');
if (!reduceMotion && activityImage && window.matchMedia('(pointer:fine)').matches) {
  activityImage.addEventListener('pointermove', (event) => {
    const rect = activityImage.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width - .5;
    const py = (event.clientY - rect.top) / rect.height - .5;
    activityImage.style.setProperty('--tilt-y', `${(px * 5).toFixed(2)}deg`);
    activityImage.style.setProperty('--tilt-x', `${(py * -4).toFixed(2)}deg`);
  }, { passive: true });
  activityImage.addEventListener('pointerleave', () => {
    activityImage.style.setProperty('--tilt-y', '0deg');
    activityImage.style.setProperty('--tilt-x', '0deg');
  });
}

const statsObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting || reduceMotion) return;
    const el = entry.target;
    const raw = el.textContent.trim();
    const match = raw.match(/^(\d+)(.*)$/);
    if (!match) return;
    const target = Number(match[1]);
    const suffix = match[2];
    const start = performance.now();
    const duration = 950;
    const animate = (now) => {
      const t = clamp((now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = `${Math.round(target * eased)}${suffix}`;
      if (t < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
    statsObserver.unobserve(el);
  });
}, { threshold: .7 });
document.querySelectorAll('.big-stats strong').forEach((el) => statsObserver.observe(el));

const form = document.querySelector('#contact-form');
const status = document.querySelector('#form-status');
form?.addEventListener('submit', (event) => {
  event.preventDefault();
  const data = new FormData(form);
  const nome = String(data.get('nome') || '').trim();
  const telefone = String(data.get('telefone') || '').trim();
  const email = String(data.get('email') || '').trim();
  const assunto = String(data.get('assunto') || '').trim();
  const mensagem = String(data.get('mensagem') || '').trim();
  const text = `Olá! Vim pelo site do CTG Ronda Charrua.\n\nNome: ${nome}\nTelefone: ${telefone}\nE-mail: ${email || 'não informado'}\nAssunto: ${assunto}\n\nMensagem: ${mensagem}`;
  const url = `https://wa.me/5554996893919?text=${encodeURIComponent(text)}`;
  status.textContent = 'Abrindo o WhatsApp com sua mensagem pronta…';
  window.open(url, '_blank', 'noopener');
});
