document.documentElement.classList.add('has-js');

const WHATSAPP_NUMBER = '5554996893919';
const header = document.querySelector('.site-header');
const toggle = document.querySelector('.menu-toggle');
const menu = document.querySelector('.menu');
const hero = document.querySelector('.hero');
const whatsappFloat = document.querySelector('.whatsapp-float');
const footer = document.querySelector('.site-footer');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
/* Palavras que acendem com o scroll: o lema já vem com <span>s; os parágrafos
   da história são divididos em palavras aqui, só quando há movimento. */
function splitWords(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach((node) => {
    const parts = node.nodeValue.split(/(\s+)/).filter(Boolean);
    if (parts.length < 2 && !parts[0]?.trim()) return;
    const frag = document.createDocumentFragment();
    parts.forEach((part) => {
      if (!part.trim()) { frag.append(part); return; }
      const span = document.createElement('span');
      span.textContent = part;
      frag.append(span);
    });
    node.replaceWith(frag);
  });
}
if (!reduceMotion) {
  document.querySelectorAll('[data-scroll-text] p').forEach((p) => { splitWords(p); p.setAttribute('data-highlight', ''); });
}
const highlightGroups = [...document.querySelectorAll('[data-highlight]')].map((el) => ({ el, words: [...el.querySelectorAll('span')] }));
const themedSections = [...document.querySelectorAll('main [data-theme]')];
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

  // Fundo da página segue a seção que passou da metade da tela
  let theme = 'light';
  themedSections.forEach((section) => { if (section.getBoundingClientRect().top <= vh * 0.55) theme = section.dataset.theme; });
  if (document.body.dataset.theme !== theme) document.body.dataset.theme = theme;

  if (reduceMotion) return;

  if (hero) {
    const progress = clamp(scrollY / Math.max(hero.offsetHeight, 1));
    hero.style.setProperty('--hero-progress', progress.toFixed(3));
    hero.style.setProperty('--hero-scale', (1.05 + progress * 0.1).toFixed(3));
    hero.style.setProperty('--hero-scroll-y', `${(progress * 70).toFixed(1)}px`);
    hero.style.setProperty('--hero-copy-y', `${(progress * -34).toFixed(1)}px`);
    hero.style.setProperty('--hero-copy-opacity', String(clamp(1 - progress * 1.05, 0.18, 1)));
  }

  // Lema e história: uma palavra acende por vez conforme o bloco sobe na tela
  highlightGroups.forEach(({ el, words }) => {
    const rect = el.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > vh) return;
    const progress = clamp((vh * 0.88 - rect.top) / (vh * 0.5));
    const lit = Math.round(progress * words.length);
    words.forEach((word, index) => word.classList.toggle('lit', index < lit));
  });
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

/* Vídeo de fundo: Invernada Adulta dançando, via YouTube sem som.
   Só carrega depois da página pronta, nunca com movimento reduzido ou economia
   de dados, e pausa fora da tela. Se o YouTube falhar, a foto continua no lugar. */
const bgVideos = document.querySelectorAll('[data-yt]');
const connection = navigator.connection;
const lowData = connection && (connection.saveData || /(^|-)2g$/.test(connection.effectiveType || ''));
const soundIcon = (on) => {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  const paths = ['M11 5 6 9H2v6h4l5 4z', ...(on ? ['M15.5 8.5a5 5 0 0 1 0 7', 'M19 5a10 10 0 0 1 0 14'] : ['m22 9-6 6', 'm16 9 6 6'])];
  paths.forEach((d) => {
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', d);
    svg.append(path);
  });
  return svg;
};
if (bgVideos.length && !reduceMotion && !lowData) {
  const startVideos = () => bgVideos.forEach((box) => {
    const id = box.dataset.yt;
    const frame = document.createElement('iframe');
    const params = new URLSearchParams({ autoplay: 1, mute: 1, loop: 1, playlist: id, controls: 0, playsinline: 1, rel: 0, disablekb: 1, iv_load_policy: 3, fs: 0, enablejsapi: 1, origin: location.origin });
    frame.src = `https://www.youtube-nocookie.com/embed/${id}?${params}`;
    frame.title = box.dataset.ytTitle || 'Vídeo de fundo';
    frame.allow = 'autoplay; encrypted-media; picture-in-picture';
    frame.tabIndex = -1;
    frame.setAttribute('aria-hidden', 'true');
    const ytOrigin = new URL(frame.src).origin;
    const command = (func, args = []) => frame.contentWindow?.postMessage(JSON.stringify({ event: 'command', func, args }), ytOrigin);

    // Botão de som (igual ao do Aldeia): o vídeo começa mudo, exigência dos
    // navegadores, e o visitante liga o som quando quiser.
    const sound = document.createElement('button');
    sound.type = 'button';
    sound.className = 'sound-toggle';
    sound.hidden = true;
    const setSound = (on) => {
      sound.setAttribute('aria-pressed', String(on));
      sound.setAttribute('aria-label', on ? 'Desligar o som do vídeo' : 'Ligar o som do vídeo');
      sound.replaceChildren(soundIcon(on), Object.assign(document.createElement('span'), { textContent: on ? 'Som ligado' : 'Ligar som' }));
    };
    setSound(false);
    sound.addEventListener('click', () => {
      const on = sound.getAttribute('aria-pressed') !== 'true';
      if (on) {
        command('unMute');
        command('setVolume', [100]);
        command('playVideo');
      } else {
        command('mute');
      }
      setSound(on);
    });
    (box.closest('section') || box.parentElement).append(sound);
    // Se o botão sumir sob o menu ao rolar, o som desliga: o visitante nunca
    // fica com áudio tocando sem ter como desligar.
    if ('IntersectionObserver' in window) {
      const headerH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 88;
      new IntersectionObserver(([entry]) => {
        if (!entry.isIntersecting && sound.getAttribute('aria-pressed') === 'true') {
          command('mute');
          setSound(false);
        }
      }, { rootMargin: `-${headerH}px 0px 0px 0px` }).observe(sound);
    }

    // O vídeo e o botão só aparecem quando o player avisa que está tocando.
    window.addEventListener('message', (event) => {
      if (event.origin !== ytOrigin || event.source !== frame.contentWindow) return;
      let data;
      try { data = JSON.parse(event.data); } catch { return; }
      if (data?.info?.playerState === 1) {
        box.classList.add('is-on');
        sound.hidden = false;
      }
    });
    frame.addEventListener('load', () => frame.contentWindow?.postMessage(JSON.stringify({ event: 'listening', id, channel: 'widget' }), ytOrigin), { once: true });
    box.append(frame);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([entry]) => command(entry.isIntersecting ? 'playVideo' : 'pauseVideo')).observe(box);
    }
  });
  const later = () => ('requestIdleCallback' in window ? requestIdleCallback(startVideos, { timeout: 3000 }) : setTimeout(startVideos, 1500));
  if (document.readyState === 'complete') later();
  else window.addEventListener('load', later, { once: true });
}

/* Cortina de abertura: sobe depois que o brasão apareceu e não volta na mesma sessão */
const curtain = document.querySelector('.curtain');
if (curtain && document.documentElement.classList.contains('show-curtain')) {
  const finish = () => {
    curtain.classList.add('is-gone');
    try { sessionStorage.setItem('ronda-curtain', '1'); } catch { /* armazenamento indisponível */ }
  };
  curtain.addEventListener('transitionend', finish, { once: true });
  setTimeout(() => curtain.classList.add('is-up'), 1350);
  setTimeout(finish, 2800);
}

/* Galeria: botões rolam o carrossel (scroll-snap) */
const track = document.getElementById('track');
document.querySelectorAll('[data-slide]').forEach((button) => {
  button.addEventListener('click', () => {
    if (!track) return;
    track.scrollBy({ left: Number(button.dataset.slide) * track.clientWidth, behavior: reduceMotion ? 'auto' : 'smooth' });
  });
});
track?.addEventListener('keydown', (event) => {
  if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
  event.preventDefault();
  track.scrollBy({ left: (event.key === 'ArrowRight' ? 1 : -1) * track.clientWidth, behavior: reduceMotion ? 'auto' : 'smooth' });
});

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
    // Sem a feature 'noopener': ela faz window.open devolver null mesmo com a aba aberta.
    const opened = window.open(url, '_blank');
    if (opened) opened.opener = null;

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
