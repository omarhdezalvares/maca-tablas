(() => {
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const azar = arr => arr[Math.floor(Math.random() * arr.length)];
  const barajar = arr => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const unoAlDiez = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  // Orden en que conviene "pensar" una multiplicación: primero la tabla más fácil de los dos factores.
  const ORDEN_FACIL = [1, 10, 2, 5, 9, 4, 3, 6, 8, 7];

  let C = null;            // contenido.json
  let ronda = null;        // ronda de preguntas en curso
  let memo = null;         // memorama en curso
  let ultima = null;       // última actividad, para "Otra vez"
  let tablaActual = 1;
  let modoElegir = 'aprender';

  // ---------- Utilidades: navegación, sonido, voz, confeti ----------

  const alMostrar = { inicio: pintarInicio, mapa: pintarMapa, album: pintarAlbum, ajustes: pintarAjustes };

  function ir(id) {
    $$('.pantalla').forEach(p => p.classList.toggle('activa', p.id === id));
    window.scrollTo(0, 0);
    alMostrar[id]?.();
  }

  let audio;
  function sonido(tipo) {
    if (!Progreso.config().sonido) return;
    try {
      audio ||= new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === 'suspended') audio.resume();
      const notas = { bien: [660, 880], mal: [330, 247], fiesta: [523, 659, 784, 1047], carta: [600] }[tipo];
      const t0 = audio.currentTime;
      notas.forEach((f, i) => {
        const o = audio.createOscillator(), g = audio.createGain();
        const t = t0 + i * 0.12;
        o.type = 'sine';
        o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
        o.connect(g).connect(audio.destination);
        o.start(t);
        o.stop(t + 0.3);
      });
    } catch {}
  }

  function hablar(texto) {
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(texto.replace(/×/g, ' por ').replace(/\?/g, ' cuánto '));
      u.lang = 'es-MX';
      u.rate = 0.9;
      speechSynthesis.speak(u);
    } catch {}
  }

  function confeti(cantidad = 24) {
    const emojis = ['⭐', '🌟', '✨', '🎉', '💖', '🌈'];
    for (let i = 0; i < cantidad; i++) {
      const s = document.createElement('span');
      s.className = 'confeti';
      s.textContent = azar(emojis);
      s.style.left = Math.random() * 100 + 'vw';
      s.style.animationDelay = Math.random() * 0.4 + 's';
      s.style.fontSize = 20 + Math.random() * 24 + 'px';
      document.body.appendChild(s);
      setTimeout(() => s.remove(), 2200);
    }
  }

  function avisoSync(texto, error = false) {
    const el = $('#sync-estado');
    el.textContent = texto;
    el.classList.toggle('error', error);
    el.hidden = false;
    clearTimeout(avisoSync.t);
    avisoSync.t = setTimeout(() => { el.hidden = true; }, error ? 4000 : 1800);
  }

  function sincronizarEnSilencio() {
    if (!Progreso.puedeSincronizar()) return;
    avisoSync('☁️ Guardando...');
    Progreso.sincronizar()
      .then(() => avisoSync('☁️ Guardado'))
      .catch(() => avisoSync('⚠️ No se pudo guardar en GitHub (sigue guardado en el iPad)', true));
  }

  // ---------- Mascota ----------

  function etapaMascota(estrellas) {
    const etapas = C.mascota.etapas;
    let i = 0;
    etapas.forEach((e, k) => { if (estrellas >= e.min) i = k; });
    return { actual: etapas[i], siguiente: etapas[i + 1], indice: i };
  }

  // ---------- Inicio ----------

  function rachaVigente() {
    const { dias, ultimoDia } = Progreso.datos.racha;
    if (!ultimoDia) return 0;
    const [y, m, d] = ultimoDia.split('-').map(Number);
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const diff = Math.round((hoy - new Date(y, m - 1, d)) / 86400000);
    return diff <= 1 ? dias : 0;
  }

  function pintarInicio() {
    const d = Progreso.datos;
    $('#saludo').textContent = `¡Hola, ${d.nombre}!`;
    $('#racha').textContent = rachaVigente();
    $('#estrellas').textContent = d.estrellas;
    const { actual, siguiente } = etapaMascota(d.estrellas);
    $('#mascota').textContent = actual.emoji;
    $('#mascota-texto').textContent = actual.texto;
    if (siguiente) {
      $('#mascota-progreso').style.width = ((d.estrellas - actual.min) / (siguiente.min - actual.min)) * 100 + '%';
      $('#mascota-siguiente').textContent = `Faltan ${siguiente.min - d.estrellas} ⭐ para que ${C.mascota.nombre} crezca`;
    } else {
      $('#mascota-progreso').style.width = '100%';
      $('#mascota-siguiente').textContent = `¡${C.mascota.nombre} ya creció por completo!`;
    }
    const pendientes = Progreso.contarPendientes();
    $('#repaso-info').textContent = pendientes ? `${pendientes} por repasar` : '¡Aprende algo nuevo!';
    const record = d.records.contrarreloj || 0;
    $('#record-info').textContent = record ? `Récord: ${record}` : '1 minuto';
    $('#album-info').textContent = `${d.stickers.length} de 10`;
    $('#btn-sonido').textContent = Progreso.config().sonido ? '🔊' : '🔇';
  }

  // ---------- Elegir tabla ----------

  function elegirTabla(modo) {
    modoElegir = modo;
    $('#elegir-titulo').textContent = {
      aprender: '¿Qué tabla quieres aprender?',
      practicar: '¿Qué tabla quieres practicar?',
      memorama: '¿Con qué tabla jugamos?',
    }[modo];
    $('#lista-tablas').innerHTML = unoAlDiez.map(t => {
      const info = C.tablas[t];
      const n = Progreso.dominadasDeTabla(t);
      const sticker = Progreso.datos.stickers.includes(t) ? `<span class="sticker-mini">${info.sticker}</span>` : '';
      return `<button class="boton-tabla" data-tabla="${t}">
        ${sticker}<span class="emoji">${info.emoji}</span>
        <span class="numero">× ${t}</span>
        <span class="barra-progreso"><span style="width:${n * 10}%"></span></span>
      </button>`;
    }).join('');
    ir('elegir-tabla');
  }

  $('#lista-tablas').addEventListener('click', e => {
    const b = e.target.closest('[data-tabla]');
    if (!b) return;
    const t = Number(b.dataset.tabla);
    if (modoElegir === 'aprender') abrirAprender(t);
    else if (modoElegir === 'practicar') iniciarPractica(t);
    else iniciarMemorama(t);
  });

  // ---------- Aprender ----------

  const claveRima = (a, b) => `${Math.min(a, b)}x${Math.max(a, b)}`;

  function dedos(n) {
    let h = '';
    for (let i = 1; i <= 10; i++) h += `<span class="dedo ${i === n ? 'abajo' : i < n ? 'izq' : 'der'}"></span>`;
    return `<div class="dedos-caja">
      <div class="dedos">${h}</div>
      <p class="pequeno">Baja el dedo ${n}: quedan <b class="t-izq">${n - 1}</b> a la izquierda y <b class="t-der">${10 - n}</b> a la derecha → <b>${9 * n}</b></p>
    </div>`;
  }

  function grupos(a, b) {
    const fila = `<div class="fila-puntos">${'<i></i>'.repeat(b)}</div>`;
    return `<div class="grupos"><p class="pequeno">${a} ${a === 1 ? 'fila' : 'filas'} de ${b}</p>${fila.repeat(a)}</div>`;
  }

  function htmlAyuda(a, b) {
    let html = `<div class="detalle-op">${a} × ${b} = <b>${a * b}</b></div>`;
    const rima = C.rimas[claveRima(a, b)];
    if (rima) html += `<p class="rima">🎵 ${esc(rima)}</p>`;
    const f = ORDEN_FACIL.find(x => x === a || x === b);
    const info = C.tablas[f];
    const conmuta = f !== a ? ` Recuerda: ${a} × ${b} es lo mismo que ${b} × ${a}.` : '';
    html += `<p class="consejo">${info.emoji} Tabla del ${f}: ${esc(info.corto)}${conmuta}</p>`;
    if (a === 9 || b === 9) html += dedos(a === 9 ? b : a);
    html += grupos(a, b);
    return html;
  }

  function textoParaLeer(a, b) {
    const rima = C.rimas[claveRima(a, b)];
    return rima ? rima : `${a} por ${b}, ${a * b}`;
  }

  function mostrarDetalle(a, b) {
    $('#modal-contenido').innerHTML = htmlAyuda(a, b) +
      `<button class="boton" id="btn-leer-detalle">🔈 Escuchar</button>`;
    $('#btn-leer-detalle').onclick = () => hablar(textoParaLeer(a, b));
    $('#modal').hidden = false;
  }

  $('#btn-cerrar-modal').onclick = () => { $('#modal').hidden = true; };
  $('#modal').addEventListener('click', e => { if (e.target.id === 'modal') $('#modal').hidden = true; });

  function abrirAprender(t) {
    tablaActual = t;
    const info = C.tablas[t];
    $('#aprender-titulo').textContent = `Tabla del ${t}`;
    $('#truco-emoji').textContent = info.emoji;
    $('#truco-titulo').textContent = info.titulo;
    $('#truco-texto').textContent = info.truco;
    $('#lista-hechos').innerHTML = unoAlDiez.map(b => {
      const caja = Progreso.hecho(t, b).caja;
      const nota = C.rimas[claveRima(t, b)] ? '<span class="nota">🎵</span>' : '';
      return `<button class="hecho c${caja}" data-b="${b}">${t} × ${b} = <b>${t * b}</b>${nota}</button>`;
    }).join('');
    ir('aprender');
  }

  $('#lista-hechos').addEventListener('click', e => {
    const b = e.target.closest('[data-b]');
    if (b) mostrarDetalle(tablaActual, Number(b.dataset.b));
  });
  $('#btn-leer-truco').onclick = () => hablar(`${$('#truco-titulo').textContent}. ${$('#truco-texto').textContent}`);
  $('#btn-practicar-esta').onclick = () => iniciarPractica(tablaActual);

  // ---------- Rondas de preguntas ----------

  function tipoPregunta(a, b) {
    const caja = Progreso.hecho(a, b).caja;
    if (caja <= 1) return 'opciones';
    if (caja <= 3) return 'escribir';
    return Math.random() < 0.4 ? 'huecos' : 'escribir';
  }

  function distractores(a, b) {
    const correcta = a * b;
    const candidatos = [a * (b + 1), a * (b - 1), (a + 1) * b, (a - 1) * b, correcta + 1, correcta - 1, correcta + 10, correcta - 10, a + b];
    const unicos = [...new Set(candidatos.filter(n => n > 0 && n !== correcta))];
    return barajar(unicos).slice(0, 3);
  }

  function nuevaRonda(modo, hechos, extra = {}) {
    ronda = {
      modo, cola: hechos.map(h => ({ ...h, repetida: false })),
      hechas: 0, aciertos: 0, estrellas: 0, actual: null, respuesta: '',
      inicioPregunta: 0, bloqueado: false, terminada: false, ...extra,
    };
    ultima = { modo, tabla: extra.tabla };
    $('#juego-contador').textContent = '⭐ 0';
    $('#juego-progreso').style.width = modo === 'contrarreloj' ? '100%' : '0%';
    $('#juego').classList.toggle('reloj', modo === 'contrarreloj');
    ir('juego');
    siguientePregunta();
  }

  function iniciarPractica(t) {
    tablaActual = t;
    nuevaRonda('practicar', barajar(unoAlDiez.map(b => ({ a: t, b }))), { tabla: t });
  }

  function iniciarRepaso() {
    const hechos = Progreso.paraRepaso(10);
    if (!hechos.length) {
      mostrarResultado({ titulo: '¡Todo repasado! 🎉', texto: 'Ya repasaste todo lo de hoy. ¡Vuelve mañana o practica una tabla!', otraVez: false, jugada: false });
      return;
    }
    nuevaRonda('repaso', barajar(hechos));
  }

  function iniciarContrarreloj() {
    const vistas = unoAlDiez.filter(t => unoAlDiez.some(b => Progreso.hecho(t, b).caja > 0));
    const tablas = vistas.length ? vistas : [1, 2, 5, 10];
    const pool = tablas.flatMap(a => unoAlDiez.map(b => ({ a, b })));
    nuevaRonda('contrarreloj', [], { pool, fin: Date.now() + 60000 });
    ronda.reloj = setInterval(() => {
      const resta = ronda.fin - Date.now();
      $('#juego-progreso').style.width = Math.max(0, resta / 600) + '%';
      if (resta <= 0) terminarContrarreloj();
    }, 100);
  }

  function siguientePregunta() {
    const r = ronda;
    if (!r || r.terminada) return;
    if (r.modo === 'contrarreloj') {
      r.actual = { ...azar(r.pool), repetida: false };
    } else {
      if (!r.cola.length) return terminarRonda();
      r.actual = r.cola.shift();
      $('#juego-progreso').style.width = (r.hechas / (r.hechas + r.cola.length + 1)) * 100 + '%';
    }
    const p = r.actual;
    const { a, b } = p;
    const tipo = r.modo === 'contrarreloj' ? 'escribir' : p.repetida ? 'opciones' : tipoPregunta(a, b);
    // En repaso y contrarreloj a veces se muestra al revés (7 × 3 en lugar de 3 × 7).
    const [x, y] = r.modo !== 'practicar' && Math.random() < 0.5 ? [b, a] : [a, b];
    let html, correcta;
    if (tipo === 'huecos' && Math.random() < 0.5) {
      html = `${x} × <span class="hueco">?</span> = ${a * b}`; correcta = y;
    } else if (tipo === 'huecos') {
      html = `<span class="hueco">?</span> × ${y} = ${a * b}`; correcta = x;
    } else {
      html = `${x} × ${y} = <span class="hueco">?</span>`; correcta = a * b;
    }
    Object.assign(p, { tipo, x, y, correcta });
    r.respuesta = '';
    r.bloqueado = false;
    r.inicioPregunta = Date.now();
    const pregunta = $('#pregunta');
    pregunta.innerHTML = html;
    pregunta.classList.remove('bien', 'mal');

    const conOpciones = tipo === 'opciones';
    $('#opciones').hidden = !conOpciones;
    $('#teclado').hidden = conOpciones;
    if (conOpciones) {
      $('#opciones').innerHTML = barajar([correcta, ...distractores(a, b)])
        .map(n => `<button class="opcion" data-valor="${n}">${n}</button>`).join('');
    }
  }

  function escribirEnHueco() {
    const h = $('#pregunta .hueco');
    if (h) h.textContent = ronda.respuesta || '?';
  }

  function tecla(k) {
    if (!ronda || ronda.bloqueado || ronda.actual?.tipo === 'opciones') return;
    if (k === 'borrar') ronda.respuesta = ronda.respuesta.slice(0, -1);
    else if (k === 'ok') { if (ronda.respuesta) responder(Number(ronda.respuesta)); return; }
    else if (ronda.respuesta.length < 3) ronda.respuesta += k;
    escribirEnHueco();
  }

  function responder(valor, boton) {
    const r = ronda;
    if (!r || r.bloqueado || r.terminada) return;
    const p = r.actual;
    r.bloqueado = true;
    const ok = valor === p.correcta;
    Progreso.registrar(p.a, p.b, ok, Date.now() - r.inicioPregunta, !p.repetida);
    r.hechas++;
    const pregunta = $('#pregunta');
    $$('#opciones .opcion').forEach(o => { if (Number(o.dataset.valor) === p.correcta) o.classList.add('bien'); });

    if (ok) {
      r.aciertos++;
      r.estrellas++;
      sonido('bien');
      pregunta.classList.add('bien');
      $('#juego-contador').textContent = `⭐ ${r.estrellas}`;
      setTimeout(siguientePregunta, r.modo === 'contrarreloj' ? 350 : 800);
      return;
    }

    sonido('mal');
    boton?.classList.add('mal');
    pregunta.classList.add('mal');
    if (r.modo === 'contrarreloj') {
      const h = $('#pregunta .hueco');
      if (h) h.textContent = p.correcta;
      setTimeout(siguientePregunta, 1400);
      return;
    }
    if (!p.repetida) r.cola.push({ a: p.a, b: p.b, repetida: true });
    $('#aviso-animo').textContent = azar(C.animo.fallo);
    $('#aviso-contenido').innerHTML = htmlAyuda(p.a, p.b);
    setTimeout(() => { $('#aviso').hidden = false; }, 500);
  }

  $('#btn-entendido').onclick = () => { $('#aviso').hidden = true; siguientePregunta(); };

  $('#opciones').addEventListener('click', e => {
    const b = e.target.closest('.opcion');
    if (b) responder(Number(b.dataset.valor), b);
  });

  $('#teclado').innerHTML = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'borrar', '0', 'ok']
    .map(k => `<button class="tecla ${k}" data-k="${k}">${{ borrar: '⌫', ok: '✔' }[k] || k}</button>`).join('');
  $('#teclado').addEventListener('click', e => {
    const b = e.target.closest('[data-k]');
    if (b) tecla(b.dataset.k);
  });

  document.addEventListener('keydown', e => {
    if (!$('#juego').classList.contains('activa')) return;
    if (!$('#aviso').hidden) { if (e.key === 'Enter') $('#btn-entendido').click(); return; }
    if (/^[0-9]$/.test(e.key)) tecla(e.key);
    else if (e.key === 'Backspace') tecla('borrar');
    else if (e.key === 'Enter') tecla('ok');
  });

  $('#btn-leer-pregunta').onclick = () => {
    const p = ronda?.actual;
    if (p) hablar($('#pregunta').textContent);
  };

  function cerrarRonda() {
    if (!ronda) return;
    ronda.terminada = true;
    clearInterval(ronda.reloj);
  }

  $('#btn-salir-juego').onclick = () => {
    const habiaRespuestas = ronda?.hechas > 0;
    cerrarRonda();
    ronda = null;
    $('#aviso').hidden = true;
    if (habiaRespuestas) { Progreso.terminarRonda(); sincronizarEnSilencio(); }
    ir('inicio');
  };

  function terminarRonda() {
    const r = ronda;
    cerrarRonda();
    const pct = r.hechas ? r.aciertos / r.hechas : 0;
    mostrarResultado({
      titulo: pct === 1 ? '¡Perfecto! 🌟' : pct >= 0.7 ? '¡Muy bien! 🎉' : '¡Buen trabajo! 💪',
      texto: `Acertaste ${r.aciertos} de ${r.hechas} y ganaste ${r.estrellas} ⭐`,
      ganadas: r.estrellas,
    });
  }

  function terminarContrarreloj() {
    const r = ronda;
    if (!r || r.terminada) return;
    cerrarRonda();
    const record = Progreso.nuevoRecord(r.aciertos);
    mostrarResultado({
      titulo: '⏱️ ¡Tiempo!',
      texto: `Respondiste ${r.aciertos} bien en un minuto.`,
      extra: record ? '<p class="logro">🏅 ¡Nuevo récord!</p>' : `<p class="pequeno">Tu récord: ${Progreso.datos.records.contrarreloj}</p>`,
      ganadas: r.estrellas,
    });
  }

  // ---------- Resultado ----------

  function mostrarResultado({ titulo, texto, extra = '', ganadas = 0, otraVez = true, jugada = true }) {
    const d = Progreso.datos;
    const antes = etapaMascota(d.estrellas - ganadas).indice;
    const nuevos = jugada ? Progreso.terminarRonda() : [];
    const etapa = etapaMascota(d.estrellas);
    let html = extra;
    if (etapa.indice > antes) html += `<p class="logro">${etapa.actual.emoji} ¡${C.mascota.nombre} creció! ${esc(etapa.actual.texto)}</p>`;
    for (const t of nuevos) html += `<p class="logro">${C.tablas[t].sticker} ¡Ganaste el sticker de la tabla del ${t}!</p>`;
    $('#resultado-mascota').textContent = etapa.actual.emoji;
    $('#resultado-titulo').textContent = titulo;
    $('#resultado-texto').textContent = texto;
    $('#resultado-extra').innerHTML = html;
    $('#btn-otra').hidden = !otraVez;
    ir('resultado');
    if (jugada) sincronizarEnSilencio();
    if (ganadas > 0) {
      sonido('fiesta');
      confeti(nuevos.length || etapa.indice > antes ? 50 : 24);
    }
  }

  $('#btn-otra').onclick = () => {
    if (!ultima) return ir('inicio');
    ({
      practicar: () => iniciarPractica(ultima.tabla),
      repaso: iniciarRepaso,
      contrarreloj: iniciarContrarreloj,
      memorama: () => iniciarMemorama(ultima.tabla),
    })[ultima.modo]();
  };

  // ---------- Memorama ----------

  function iniciarMemorama(t) {
    ultima = { modo: 'memorama', tabla: t };
    const bs = barajar(unoAlDiez).slice(0, 6);
    const cartas = barajar(bs.flatMap(b => [{ id: b, txt: `${t} × ${b}` }, { id: b, txt: String(t * b) }]));
    memo = { abiertas: [], parejas: 0, intentos: 0, bloqueado: false };
    $('#memorama-titulo').textContent = `Memorama del ${t}`;
    $('#memorama-intentos').textContent = 'Intentos: 0';
    $('#cartas').innerHTML = cartas.map(c =>
      `<button class="carta" data-id="${c.id}"><span class="frente">${C.tablas[t].emoji}</span><span class="dorso">${c.txt}</span></button>`
    ).join('');
    ir('memorama');
  }

  $('#cartas').addEventListener('click', e => {
    const carta = e.target.closest('.carta');
    if (!carta || !memo || memo.bloqueado || carta.classList.contains('volteada')) return;
    carta.classList.add('volteada');
    sonido('carta');
    memo.abiertas.push(carta);
    if (memo.abiertas.length < 2) return;
    memo.intentos++;
    $('#memorama-intentos').textContent = `Intentos: ${memo.intentos}`;
    const [c1, c2] = memo.abiertas;
    memo.abiertas = [];
    if (c1.dataset.id === c2.dataset.id) {
      c1.classList.add('encontrada');
      c2.classList.add('encontrada');
      sonido('bien');
      if (++memo.parejas === 6) {
        const ganadas = memo.intentos <= 8 ? 5 : memo.intentos <= 12 ? 3 : 2;
        Progreso.sumarEstrellas(ganadas);
        setTimeout(() => mostrarResultado({
          titulo: '¡Encontraste todas! 🃏',
          texto: `Lo lograste en ${memo.intentos} intentos y ganaste ${ganadas} ⭐`,
          ganadas,
        }), 700);
      }
    } else {
      memo.bloqueado = true;
      setTimeout(() => {
        c1.classList.remove('volteada');
        c2.classList.remove('volteada');
        memo.bloqueado = false;
      }, 1000);
    }
  });

  // ---------- Mapa y álbum ----------

  function pintarMapa() {
    let html = '<span class="cab">×</span>' + unoAlDiez.map(b => `<span class="cab">${b}</span>`).join('');
    for (const a of unoAlDiez) {
      html += `<span class="cab">${a}</span>`;
      html += unoAlDiez.map(b => `<button class="celda c${Progreso.hecho(a, b).caja}" data-a="${a}" data-b="${b}">${a * b}</button>`).join('');
    }
    $('#mapa-cuadricula').innerHTML = html;
  }

  $('#mapa-cuadricula').addEventListener('click', e => {
    const c = e.target.closest('.celda');
    if (c) mostrarDetalle(Number(c.dataset.a), Number(c.dataset.b));
  });

  function pintarAlbum() {
    const tiene = Progreso.datos.stickers;
    $('#album-cuadricula').innerHTML = unoAlDiez.map(t => tiene.includes(t)
      ? `<div class="sticker ganado"><span>${C.tablas[t].sticker}</span><small>Tabla del ${t}</small></div>`
      : `<div class="sticker"><span>🔒</span><small>Tabla del ${t} · ${Progreso.dominadasDeTabla(t)}/10</small></div>`
    ).join('');
  }

  // ---------- Ajustes ----------

  const camposCfg = ['owner', 'repo', 'branch', 'path', 'token'];

  function pintarAjustes() {
    const c = Progreso.config();
    $('#cfg-nombre').value = Progreso.datos.nombre;
    camposCfg.forEach(k => { $(`#cfg-${k}`).value = c[k] || ''; });
    $('#cfg-estado').textContent = Progreso.puedeSincronizar() ? 'GitHub configurado ✅' : 'Sin GitHub: solo se guarda en este iPad.';
  }

  $('#btn-guardar-cfg').onclick = async () => {
    const nombre = $('#cfg-nombre').value.trim();
    if (nombre) Progreso.fijarNombre(nombre);
    const nueva = {};
    camposCfg.forEach(k => { nueva[k] = $(`#cfg-${k}`).value.trim(); });
    Progreso.guardarConfig(nueva);
    const estado = $('#cfg-estado');
    if (!Progreso.puedeSincronizar()) { estado.textContent = 'Guardado en este iPad.'; return; }
    estado.textContent = 'Sincronizando con GitHub...';
    try {
      await Progreso.sincronizar();
      estado.textContent = '✅ Progreso guardado en GitHub.';
    } catch (err) {
      estado.textContent = `⚠️ ${err.message}. Revisa usuario, repositorio, rama y llave.`;
    }
  };

  $('#btn-reiniciar').onclick = () => {
    if (!confirm('¿Seguro que quieres borrar todo el progreso? No se puede deshacer.')) return;
    Progreso.reiniciar();
    sincronizarEnSilencio();
    $('#cfg-estado').textContent = 'Progreso borrado.';
  };

  // ---------- Menú y arranque ----------

  document.addEventListener('click', e => {
    const destino = e.target.closest('[data-ir]');
    if (destino) { ir(destino.dataset.ir); return; }
    const accion = e.target.closest('[data-accion]')?.dataset.accion;
    if (!accion) return;
    ({
      repaso: iniciarRepaso,
      aprender: () => elegirTabla('aprender'),
      practicar: () => elegirTabla('practicar'),
      memorama: () => elegirTabla('memorama'),
      contrarreloj: iniciarContrarreloj,
    })[accion]?.();
  });

  $('#btn-sonido').onclick = () => {
    Progreso.guardarConfig({ sonido: !Progreso.config().sonido });
    pintarInicio();
  };

  $('#btn-empezar').onclick = () => {
    const nombre = $('#nombre-input').value.trim();
    if (!nombre) { $('#nombre-input').focus(); return; }
    Progreso.fijarNombre(nombre);
    sonido('fiesta');
    ir('inicio');
  };
  $('#nombre-input').addEventListener('keydown', e => { if (e.key === 'Enter') $('#btn-empezar').click(); });

  async function arrancar() {
    try {
      C = await (await fetch('data/contenido.json', { cache: 'no-cache' })).json();
    } catch {
      document.body.innerHTML = '<p style="padding:2rem;font-size:1.3rem">No se pudo cargar el contenido. Si abriste el archivo directo, usa un servidor local (ver README).</p>';
      return;
    }
    ir(Progreso.datos.nombre ? 'inicio' : 'bienvenida');
    if (Progreso.puedeSincronizar()) {
      Progreso.sincronizar()
        .then(() => {
          if ($('#inicio').classList.contains('activa')) pintarInicio();
          else if ($('#bienvenida').classList.contains('activa') && Progreso.datos.nombre) ir('inicio');
        })
        .catch(() => avisoSync('⚠️ No se pudo leer el progreso de GitHub', true));
    }
  }

  arrancar();
})();
