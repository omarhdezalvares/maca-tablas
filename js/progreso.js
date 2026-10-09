// Progreso de la niña: se guarda en localStorage y, si hay llave, se sincroniza con un JSON en GitHub.
const Progreso = (() => {
  const CLAVE = 'maca-progreso';
  const CLAVE_CONFIG = 'maca-config';
  const DIA = 86400000;
  // Días que espera cada caja antes de volver a preguntar (repetición espaciada tipo Leitner).
  const INTERVALO = [0, 0, 1, 2, 4, 8];
  const RAPIDO_MS = 6000;

  const pad = n => String(n).padStart(2, '0');
  const fecha = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  function vacio() {
    return {
      version: 1, nombre: '', estrellas: 0, cajas: {}, stickers: [],
      racha: { dias: 0, ultimoDia: null }, historial: {}, records: { contrarreloj: 0 },
      actualizado: 0,
    };
  }

  function cargar() {
    try {
      const d = JSON.parse(localStorage.getItem(CLAVE));
      return d ? { ...vacio(), ...d } : vacio();
    } catch { return vacio(); }
  }

  let datos = cargar();

  function guardar() {
    datos.actualizado = Date.now();
    try { localStorage.setItem(CLAVE, JSON.stringify(datos)); } catch {}
  }

  const clave = (a, b) => `${a}x${b}`;
  const hecho = (a, b) => datos.cajas[clave(a, b)] || { caja: 0, ultima: 0, aciertos: 0, fallos: 0 };

  function diasDesde(ts) {
    const a = new Date(ts); a.setHours(0, 0, 0, 0);
    const b = new Date(); b.setHours(0, 0, 0, 0);
    return Math.round((b - a) / DIA);
  }

  const pendiente = h => h.caja > 0 && diasDesde(h.ultima) >= INTERVALO[h.caja];

  // contarCaja=false para preguntas repetidas dentro de la misma ronda (dan estrella pero no suben de caja).
  function registrar(a, b, correcto, ms, contarCaja = true) {
    const h = { ...hecho(a, b) };
    if (correcto) {
      h.aciertos++;
      if (contarCaja) h.caja = ms <= RAPIDO_MS ? Math.min(5, Math.max(1, h.caja) + 1) : Math.max(1, h.caja);
      datos.estrellas++;
    } else {
      h.fallos++;
      h.caja = 1;
    }
    h.ultima = Date.now();
    datos.cajas[clave(a, b)] = h;
    const dia = datos.historial[fecha()] ||= { preguntas: 0, aciertos: 0 };
    dia.preguntas++;
    if (correcto) dia.aciertos++;
    guardar();
  }

  function sumarEstrellas(n) { datos.estrellas += n; guardar(); }

  const tablaDominada = t => [...Array(10)].every((_, i) => hecho(t, i + 1).caja >= 3);
  const dominadasDeTabla = t => [...Array(10)].filter((_, i) => hecho(t, i + 1).caja >= 3).length;

  // Hechos para el repaso del día: primero los pendientes con caja más baja; si faltan, nuevos en orden de tabla.
  function paraRepaso(cuantos = 10) {
    const pendientes = [], nuevos = [];
    for (let a = 1; a <= 10; a++) for (let b = 1; b <= 10; b++) {
      const h = hecho(a, b);
      if (h.caja === 0) nuevos.push({ a, b });
      else if (pendiente(h)) pendientes.push({ a, b, h });
    }
    pendientes.sort((x, y) => x.h.caja - y.h.caja || x.h.ultima - y.h.ultima);
    const lista = pendientes.slice(0, cuantos).map(({ a, b }) => ({ a, b }));
    if (lista.length < cuantos && nuevos.length) {
      const tabla = nuevos[0].a;
      lista.push(...nuevos.filter(n => n.a === tabla).slice(0, cuantos - lista.length));
    }
    return lista;
  }

  const contarPendientes = () => {
    let n = 0;
    for (const h of Object.values(datos.cajas)) if (pendiente(h)) n++;
    return n;
  };

  // Al terminar una ronda: actualiza racha y devuelve los stickers recién ganados.
  function terminarRonda() {
    const hoy = fecha();
    if (datos.racha.ultimoDia !== hoy) {
      const ayer = fecha(new Date(Date.now() - DIA));
      datos.racha.dias = datos.racha.ultimoDia === ayer ? datos.racha.dias + 1 : 1;
      datos.racha.ultimoDia = hoy;
    }
    const nuevos = [];
    for (let t = 1; t <= 10; t++) {
      if (!datos.stickers.includes(t) && tablaDominada(t)) { datos.stickers.push(t); nuevos.push(t); }
    }
    guardar();
    return nuevos;
  }

  function nuevoRecord(puntos) {
    if (puntos <= (datos.records.contrarreloj || 0)) return false;
    datos.records.contrarreloj = puntos;
    guardar();
    return true;
  }

  function reiniciar() {
    const nombre = datos.nombre;
    datos = { ...vacio(), nombre };
    guardar();
  }

  // ---------- Sincronización con GitHub ----------

  function configPorDefecto() {
    const m = location.hostname.match(/^([^.]+)\.github\.io$/);
    const repo = location.pathname.split('/').filter(Boolean)[0] || '';
    return { owner: m ? m[1] : '', repo: m && !repo.includes('.') ? repo : '', branch: 'main', path: 'data/progreso.json', token: '', sonido: true };
  }

  function config() {
    try { return { ...configPorDefecto(), ...JSON.parse(localStorage.getItem(CLAVE_CONFIG) || '{}') }; }
    catch { return configPorDefecto(); }
  }

  function guardarConfig(c) {
    try { localStorage.setItem(CLAVE_CONFIG, JSON.stringify({ ...config(), ...c })); } catch {}
  }

  const puedeSincronizar = () => { const c = config(); return !!(c.token && c.owner && c.repo); };

  function aB64(texto) {
    const bytes = new TextEncoder().encode(texto);
    let s = '';
    for (const b of bytes) s += String.fromCharCode(b);
    return btoa(s);
  }

  const desdeB64 = b64 => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\s/g, '')), c => c.charCodeAt(0)));

  async function github(metodo, cuerpo) {
    const c = config();
    const ruta = c.path.split('/').map(encodeURIComponent).join('/');
    let url = `https://api.github.com/repos/${c.owner}/${c.repo}/contents/${ruta}`;
    if (metodo === 'GET') url += `?ref=${encodeURIComponent(c.branch)}&t=${Date.now()}`;
    return fetch(url, {
      method: metodo,
      cache: 'no-store',
      headers: { Authorization: `Bearer ${c.token}`, Accept: 'application/vnd.github+json' },
      body: cuerpo ? JSON.stringify({ ...cuerpo, branch: c.branch }) : undefined,
    });
  }

  async function leerRemoto() {
    const r = await github('GET');
    if (r.status === 404) return { remoto: null, sha: undefined };
    if (!r.ok) throw new Error(`GitHub respondió ${r.status}`);
    const j = await r.json();
    const texto = desdeB64(j.content || '').trim();
    return { remoto: texto ? JSON.parse(texto) : null, sha: j.sha };
  }

  function mezclar(a, b) {
    const [reciente, viejo] = (a.actualizado || 0) >= (b.actualizado || 0) ? [a, b] : [b, a];
    const r = { ...vacio(), ...JSON.parse(JSON.stringify(reciente)) };
    for (const [k, h] of Object.entries(viejo.cajas || {})) {
      if (!r.cajas[k] || r.cajas[k].ultima < h.ultima) r.cajas[k] = h;
    }
    for (const [d, v] of Object.entries(viejo.historial || {})) {
      if (!r.historial[d] || r.historial[d].preguntas < v.preguntas) r.historial[d] = v;
    }
    r.estrellas = Math.max(a.estrellas || 0, b.estrellas || 0);
    r.stickers = [...new Set([...(a.stickers || []), ...(b.stickers || [])])];
    r.records = { contrarreloj: Math.max(a.records?.contrarreloj || 0, b.records?.contrarreloj || 0) };
    r.nombre = r.nombre || viejo.nombre || '';
    return r;
  }

  let sincronizando = null;

  // Trae lo remoto, lo mezcla con lo local y sube el resultado (si cambió).
  function sincronizar() {
    if (!puedeSincronizar()) return Promise.resolve('sin-config');
    if (sincronizando) return sincronizando;
    sincronizando = (async () => {
      for (let intento = 0; intento < 2; intento++) {
        const { remoto, sha } = await leerRemoto();
        if (remoto) {
          datos = mezclar(datos, remoto);
          try { localStorage.setItem(CLAVE, JSON.stringify(datos)); } catch {}
          if (JSON.stringify(remoto) === JSON.stringify(datos)) return 'ok';
        }
        const r = await github('PUT', {
          message: `Progreso de ${datos.nombre || 'Maca'} - ${fecha()}`,
          content: aB64(JSON.stringify(datos, null, 1)),
          sha,
        });
        if (r.ok) return 'ok';
        if (r.status !== 409 && r.status !== 422) throw new Error(`GitHub respondió ${r.status}`);
      }
      throw new Error('No se pudo guardar, intenta otra vez');
    })().finally(() => { sincronizando = null; });
    return sincronizando;
  }

  return {
    get datos() { return datos; },
    fijarNombre(n) { datos.nombre = n; guardar(); },
    hecho, registrar, sumarEstrellas, tablaDominada, dominadasDeTabla,
    paraRepaso, contarPendientes, terminarRonda, nuevoRecord, reiniciar,
    config, guardarConfig, puedeSincronizar, sincronizar,
  };
})();
