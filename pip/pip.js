/* Pip — the BuddyUp mascot, drawn as original inline SVG (clay-toy look).
   pip({key, pose, text, cls, props}) -> SVG string.
   keys:  classic · hacky · study · active · chill
   poses: stand · wave · sit · jump · sleepy · think · sign · shrug · scratch · peek · head · seat · seat-empty */
(function () {
  const mix = (a, b, t) => {
    const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    const A = p(a), B = p(b);
    return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
  };
  const make = (base, name) => ({ base, name, hi: mix(base, '#ffffff', .42), lo: mix(base, '#1A0000', .2), rim: mix(base, '#1A0000', .3) });

  const PIP = {
    classic: Object.assign(make('#FFF9FE', 'Classic Pip'), { lo: '#DDCAD7', rim: '#D3BFCC', hi: '#FFFFFF' }),
    hacky: make('#7B61FF', 'Hacky Pip'),
    study: make('#F2B53A', 'Study Pip'),
    active: make('#9BD84B', 'Active Pip'),
    chill: make('#FF7A6B', 'Chill Pip'),
  };
  const KEY_BY_CATEGORY = ['hacky', 'study', 'active', 'chill', 'classic'];

  const BODY = 'M100 62 C146 62 164 100 164 144 C164 190 140 216 100 216 C60 216 36 190 36 144 C36 100 54 62 100 62Z';
  const BODY_HEAD = 'M100 62 C146 62 166 96 166 132 C166 170 140 192 100 192 C60 192 34 170 34 132 C34 96 54 62 100 62Z';

  // Shared gradients + soft shadow, injected once.
  function injectDefs() {
    if (document.getElementById('pip-defs')) return;
    const grads = Object.entries(PIP).map(([k, c]) =>
      `<radialGradient id="pg-${k}" cx=".36" cy=".28" r=".95"><stop offset="0" stop-color="${c.hi}"/><stop offset=".5" stop-color="${c.base}"/><stop offset="1" stop-color="${c.lo}"/></radialGradient>`).join('');
    const el = document.createElement('div');
    el.id = 'pip-defs';
    el.setAttribute('aria-hidden', 'true');
    el.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
    el.innerHTML = `<svg width="0" height="0"><defs>${grads}
      <filter id="pip-shadow" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="5" stdDeviation="5" flood-color="#1A0000" flood-opacity=".18"/></filter>
      <clipPath id="pip-peek-clip"><rect x="0" y="0" width="200" height="176"/></clipPath>
    </defs></svg>`;
    document.body.prepend(el);
  }

  const ARMS = {
    down:    ['M44 150 Q22 168 30 194', 'M156 150 Q178 168 170 194'],
    wave:    ['M44 150 Q22 168 30 194', 'M156 150 Q192 142 186 98'],
    up:      ['M44 150 Q8 122 26 80',   'M156 150 Q192 122 174 80'],
    sign:    ['M44 150 Q4 110 30 34',   'M156 150 Q196 110 170 34'],
    shrug:   ['M44 150 Q8 166 12 138',  'M156 150 Q192 166 188 138'],
    think:   ['M44 150 Q22 168 30 194', 'M156 150 Q156 176 126 164'],
    scratch: ['M44 150 Q22 168 30 194', 'M156 150 Q196 112 130 72'],
  };
  const POSE_ARMS = { stand: 'down', wave: 'wave', sit: 'down', jump: 'up', sleepy: 'down', think: 'think', sign: 'sign', shrug: 'shrug', scratch: 'scratch' };

  function pip(o = {}) {
    const key = PIP[o.key] ? o.key : 'classic';
    const pose = o.pose || 'stand';
    const C = PIP[key];
    const g = `url(#pg-${key})`;
    const eyeInk = '#1A0000';
    const limb = (d, w = 22) => `<path d="${d}" fill="none" stroke="${C.rim}" stroke-width="${w + 4}" stroke-linecap="round"/><path d="${d}" fill="none" stroke="${C.base}" stroke-width="${w}" stroke-linecap="round"/>`;
    const blob = (cx, cy, rx, ry, rot = 0) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" transform="rotate(${rot} ${cx} ${cy})" fill="${g}" stroke="${C.rim}" stroke-width="2.5"/>`;
    const cls = ['pip', 'pip-' + pose, o.cls || ''].join(' ').trim();
    const label = o.label || C.name;

    // ---- empty seat: faint outline ----
    if (pose === 'seat-empty') {
      return `<svg class="${cls}" viewBox="24 6 152 224" role="img" aria-label="Empty seat"><path d="${BODY}" fill="rgba(26,0,0,.04)" stroke="rgba(26,0,0,.28)" stroke-width="5" stroke-dasharray="9 9" stroke-linecap="round"/><path d="M100 128 v28 M86 142 h28" stroke="rgba(26,0,0,.25)" stroke-width="6" stroke-linecap="round"/></svg>`;
    }

    const isHead = pose === 'head';
    const full = !['head', 'seat'].includes(pose) && o.props !== false;
    const showProps = o.props !== false && pose !== 'seat';

    // ---- legs ----
    let legs = '';
    if (!isHead && pose !== 'peek') {
      if (pose === 'jump') legs = blob(78, 206, 22, 13, -14) + blob(122, 206, 22, 13, 14);
      else if (pose === 'sit' || pose === 'seat') legs = blob(68, 214, 25, 15, -6) + blob(132, 214, 25, 15, 6);
      else legs = blob(76, 222, 22, 13) + blob(124, 222, 22, 13);
    }

    // ---- face ----
    const ex = pose === 'think' ? 5 : 0, ey = pose === 'think' ? -4 : 0;
    let eyes;
    if (pose === 'sleepy') {
      eyes = `<path d="M68 130 Q80 142 92 130" fill="none" stroke="${eyeInk}" stroke-width="5" stroke-linecap="round"/><path d="M108 130 Q120 142 132 130" fill="none" stroke="${eyeInk}" stroke-width="5" stroke-linecap="round"/>`;
    } else {
      eyes = [80, 120].map((x) => `<ellipse cx="${x + ex}" cy="${128 + ey}" rx="11" ry="15" fill="${eyeInk}"/><circle cx="${x + ex + 4}" cy="${121 + ey}" r="4.2" fill="#fff"/><circle cx="${x + ex - 3}" cy="${134 + ey}" r="2" fill="#fff" opacity=".8"/>`).join('');
    }
    const cheeks = `<ellipse cx="62" cy="150" rx="9" ry="6" fill="#FF8FA3" opacity=".7"/><ellipse cx="138" cy="150" rx="9" ry="6" fill="#FF8FA3" opacity=".7"/>`;
    const mouths = {
      sleepy: `<ellipse cx="100" cy="154" rx="4" ry="4.5" fill="${eyeInk}"/>`,
      think: `<path d="M92 155 L108 153" stroke="${eyeInk}" stroke-width="4" stroke-linecap="round"/>`,
      shrug: `<path d="M89 155 Q94.5 148 100 155 Q105.5 162 111 155" fill="none" stroke="${eyeInk}" stroke-width="4" stroke-linecap="round"/>`,
      scratch: `<path d="M89 155 Q94.5 148 100 155 Q105.5 162 111 155" fill="none" stroke="${eyeInk}" stroke-width="4" stroke-linecap="round"/>`,
      jump: `<path d="M88 148 Q100 176 112 148Z" fill="#7A1C1C" stroke="${eyeInk}" stroke-width="3" stroke-linejoin="round"/>`,
    };
    const mouth = mouths[pose] || `<path d="M90 150 Q100 163 110 150" fill="none" stroke="${eyeInk}" stroke-width="4" stroke-linecap="round"/>`;
    const sheen = `<ellipse cx="78" cy="96" rx="22" ry="11" transform="rotate(-30 78 96)" fill="#fff" opacity=".55"/>`;
    const antenna = `<path d="M100 64 Q95 44 106 28" fill="none" stroke="#3B2A31" stroke-width="5" stroke-linecap="round"/><g class="pip-dot"><circle cx="107" cy="23" r="11" fill="#1A0000"/><circle cx="103" cy="19" r="3.4" fill="#fff" opacity=".7"/></g>`;
    const zzz = pose === 'sleepy' ? `<g font-family="Nunito,sans-serif" font-weight="800" fill="${C.rim}" class="pip-zzz"><text x="150" y="70" font-size="26">Z</text><text x="170" y="48" font-size="19">z</text></g>` : '';

    // ---- props (head layer) ----
    let headProps = '', lowProps = '';
    if (showProps) {
      if (key === 'hacky') {
        headProps = `<path d="M40 122 C38 58 162 58 160 122" fill="none" stroke="#2B2350" stroke-width="8" stroke-linecap="round"/><rect x="30" y="112" width="18" height="32" rx="8" fill="#2B2350"/><rect x="152" y="112" width="18" height="32" rx="8" fill="#2B2350"/><rect x="34" y="118" width="6" height="20" rx="3" fill="#BDB0FF"/><rect x="160" y="118" width="6" height="20" rx="3" fill="#BDB0FF"/>`;
        lowProps = `<g><rect x="62" y="170" width="76" height="44" rx="7" fill="#C9C0FF" stroke="#2B2350" stroke-width="4"/><circle cx="100" cy="192" r="6" fill="#2B2350"/><rect x="54" y="212" width="92" height="6" rx="3" fill="#2B2350"/></g>`;
      } else if (key === 'study') {
        headProps = `<g fill="rgba(255,255,255,.28)" stroke="#3B2A31" stroke-width="4.5"><circle cx="80" cy="128" r="19"/><circle cx="120" cy="128" r="19"/></g><path d="M99 126 H101" stroke="#3B2A31" stroke-width="4.5"/>`;
        lowProps = `<g stroke="#3B2A31" stroke-width="3" stroke-linejoin="round"><rect x="58" y="196" width="84" height="12" rx="3" fill="#2F6DB5"/><rect x="62" y="184" width="76" height="12" rx="3" fill="#E4572E"/><rect x="56" y="172" width="80" height="12" rx="3" fill="#7A4A12"/></g>`;
      } else if (key === 'active') {
        headProps = `<path d="M38 98 Q100 70 162 98 L160 114 Q100 88 40 114Z" fill="#fff" stroke="#E5E5E5" stroke-width="2"/><path d="M42 106 Q100 80 158 106" fill="none" stroke="#D9382B" stroke-width="4"/>`;
        lowProps = `<g transform="rotate(-22 168 194)"><rect x="150" y="190" width="38" height="7" rx="3.5" fill="#444"/><rect x="144" y="180" width="12" height="27" rx="5" fill="#2B2B2B"/><rect x="182" y="180" width="12" height="27" rx="5" fill="#2B2B2B"/></g>`;
      } else if (key === 'chill') {
        headProps = `<g fill="#1A0000"><rect x="56" y="114" width="40" height="28" rx="12"/><rect x="104" y="114" width="40" height="28" rx="12"/><rect x="94" y="120" width="12" height="5"/></g><path d="M62 120 l14 -2" stroke="#fff" stroke-opacity=".55" stroke-width="3" stroke-linecap="round"/><path d="M110 120 l14 -2" stroke="#fff" stroke-opacity=".55" stroke-width="3" stroke-linecap="round"/>`;
        lowProps = `<g transform="rotate(8 170 190)"><path d="M156 168 H186 L182 214 Q171 220 160 214Z" fill="rgba(255,255,255,.85)" stroke="#8B5A3C" stroke-width="3"/><path d="M158 192 H184 L182 214 Q171 220 160 214Z" fill="#C98B5A"/><circle cx="166" cy="206" r="3.4" fill="#2B1A12"/><circle cx="175" cy="209" r="3.4" fill="#2B1A12"/><circle cx="171" cy="200" r="3.4" fill="#2B1A12"/><path d="M174 168 L180 140" stroke="#FF7A6B" stroke-width="4" stroke-linecap="round"/></g>`;
      }
      if (o.extra === 'shield') {
        lowProps += `<g transform="translate(116 160)"><path d="M30 0 L58 10 V36 Q58 58 30 70 Q2 58 2 36 V10Z" fill="#1A0000" stroke="#FFF9FE" stroke-width="4"/><path d="M18 36 l9 9 l17 -19" fill="none" stroke="#9BD84B" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></g>`;
      }
    }

    // ---- arms ----
    let arms = '';
    if (!['head', 'seat', 'peek'].includes(pose)) {
      const set = ARMS[POSE_ARMS[pose] || 'down'];
      arms = limb(set[0]);
      arms += pose === 'wave' ? `<g class="pip-wave-arm">${limb(set[1])}</g>` : limb(set[1]);
    }
    if (pose === 'peek') {
      arms = `<circle cx="64" cy="170" r="15" fill="${C.base}" stroke="${C.rim}" stroke-width="2.5"/><circle cx="136" cy="170" r="15" fill="${C.base}" stroke="${C.rim}" stroke-width="2.5"/>`;
    }

    const bodyPath = isHead ? BODY_HEAD : BODY;
    const body = `<path d="${bodyPath}" fill="${g}" stroke="${C.rim}" stroke-width="2.5"/>${sheen}`;
    const core = `${legs}${showProps ? '' : ''}${body}${antenna}${lowProps}${eyes}${cheeks}${mouth}${headProps}${arms}${zzz}`;
    const lowAfterBody = core;

    // ---- viewBox per pose ----
    if (pose === 'sign') {
      const lines = String(o.text || 'BOT CHAIN').split('|');
      const fs = lines.length > 1 ? 24 : 30;
      const t = lines.map((l, i) => `<text x="120" y="${(lines.length > 1 ? 52 : 70) + i * (fs + 6)}" text-anchor="middle" font-family="Nunito,sans-serif" font-weight="800" font-size="${fs}" fill="#1A0000">${esc(l)}</text>`).join('');
      return `<svg class="${cls}" viewBox="0 0 240 330" role="img" aria-label="${esc(label)} holding a sign"><g filter="url(#pip-shadow)"><g transform="translate(20 90)">${lowAfterBody}</g><rect x="14" y="4" width="212" height="118" rx="16" fill="#fff" stroke="#1A0000" stroke-width="6"/>${t}</g></svg>`;
    }
    if (pose === 'peek') {
      return `<svg class="${cls}" viewBox="0 0 200 190" role="img" aria-label="${esc(label)} peeking"><g clip-path="url(#pip-peek-clip)" filter="url(#pip-shadow)">${core}</g><g>${arms}</g></svg>`;
    }
    if (pose === 'head') {
      return `<svg class="${cls}" viewBox="20 4 160 198" role="img" aria-label="${esc(label)}">${core}</svg>`;
    }
    const vb = pose === 'seat' ? '24 6 152 224' : '0 0 200 240';
    const shadow = ['stand', 'wave', 'sleepy', 'think', 'shrug', 'scratch'].includes(pose) ? `<ellipse cx="100" cy="236" rx="56" ry="7" fill="rgba(26,0,0,.14)"/>` : '';
    return `<svg class="${cls}" viewBox="${vb}" role="img" aria-label="${esc(label)}">${shadow}<g filter="url(#pip-shadow)">${core}</g></svg>`;
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // Replace <span data-pip="hacky:wave:optional text"> placeholders with Pips.
  function hydrate(root = document) {
    root.querySelectorAll('[data-pip]').forEach((el) => {
      const [key, pose, text] = el.dataset.pip.split(':');
      el.innerHTML = pip({ key, pose, text, extra: el.dataset.extra });
      el.removeAttribute('data-pip');
    });
  }

  injectDefs();
  window.Pip = { pip, hydrate, PIP, KEY_BY_CATEGORY, esc };
  document.addEventListener('DOMContentLoaded', () => hydrate());
})();
