'use strict';
/* Estudio: presentaciones propias con textos e imágenes que se mueven y se agrandan libremente.
   Usa el estado, las utilidades y el escenario de app.js; este archivo solo declara funciones,
   así que puede cargarse antes que app.js. */

/* ───────────── Diseño en el escenario (consola, proyector y OBS) ───────────── */
function renderStageDesign(stage, design) {
  const layer = stage.querySelector('.stage-design');
  stage.classList.toggle('has-design', !!design);
  if (!design) {
    if (layer.firstChild || layer.getAttribute('style')) { layer.replaceChildren(); layer.removeAttribute('style'); }
    return;
  }
  const bgUrl = design.bgMedia ? resolveMedia(design.bgMedia) : null;
  // Solo se reconstruye si cambió: así las animaciones de entrada no se repiten en cada repintado.
  const urls = design.elements.filter((e) => e.type === 'image').map((e) => resolveMedia(e.media) || '');
  const sig = JSON.stringify([design, bgUrl, urls]);
  if (layer.dataset.sig === sig) return;
  layer.dataset.sig = sig;
  layer.style.backgroundColor = design.bg || '';
  layer.style.backgroundImage = bgUrl ? `url("${bgUrl}")` : '';
  layer.replaceChildren(...design.elements.map(designNode));
}

const ELEMENT_ANIMS = [['none', 'Ninguna'], ['fade', 'Aparecer'], ['rise', 'Subir'], ['zoom', 'Acercar'],
  ['left', 'Desde la izquierda'], ['right', 'Desde la derecha'], ['blur', 'Enfocar']];

function designNode(el) {
  const node = document.createElement('div');
  node.className = `d-el d-${el.type}`;
  node.dataset.el = el.id;
  Object.assign(node.style, { left: `${el.x}%`, top: `${el.y}%`, width: `${el.w}%`, height: `${el.h}%` });
  if (el.anim && el.anim !== 'none') {
    node.dataset.anim = el.anim;
    node.style.setProperty('--d-delay', `${el.delay || 0}s`);
  }
  if (el.type === 'image') {
    node.style.opacity = el.opacity ?? 1;
    node.style.borderRadius = `calc(${el.radius || 0} * 0.09259cqh)`;
    const url = resolveMedia(el.media);
    if (url) {
      const img = document.createElement('img');
      img.src = url;
      img.alt = '';
      img.draggable = false;
      img.style.objectFit = el.fit || 'cover';
      node.append(img);
    }
  } else {
    node.style.setProperty('--d-size', el.size);
    node.style.color = el.color;
    node.style.fontWeight = el.weight;
    node.style.textAlign = el.align;
    node.style.fontFamily = fontStack(el.font);
    node.classList.toggle('shadow', !!el.shadow);
    const span = document.createElement('span');
    span.textContent = el.text;
    node.append(span);
  }
  return node;
}

/* ───────────── Modelo ───────────── */
const TEXT_SWATCHES = ['#ffffff', '#f3e9d2', '#ffd479', '#9fd3ff', '#ff8fab', '#1d1d1f'];

function newTextElement(extra = {}) {
  return { id: uid(), type: 'text', x: 10, y: 38, w: 80, h: 24, text: 'Escribe aquí', size: 96, color: '#ffffff', weight: 700, align: 'center', font: 'system', shadow: true, ...extra };
}

function newDesignSlide() {
  return { id: uid(), bg: null, bgMedia: null, elements: [newTextElement()] };
}

function makeDeckItem(deck) {
  return {
    kind: 'deck', deck,
    title: deck.name,
    sub: `Presentación · ${plural(deck.slides.length, 'diapositiva', 'diapositivas')}`,
    slides: deck.slides.map((s, i) => ({
      label: `Diapositiva ${i + 1}`, text: '', ref: '', design: s,
      anim: { transition: s.transition || deck.transition || null, speed: deck.speed || null },
    })),
  };
}

function persistDecks() {
  if (!store.set(KEY.decks, state.decks)) toast('No se pudo guardar la presentación: el almacenamiento del navegador está lleno.');
}

function deckMediaIds(deck) {
  return deck.slides.flatMap((s) => [s.bgMedia, ...s.elements.filter((e) => e.type === 'image').map((e) => e.media)]).filter(Boolean);
}

function miniStage(container, design) {
  const st = createStage();
  st.classList.add('mini');
  container.replaceChildren(st);
  paintStage(st, { look: state.live.look, slide: { text: '', ref: '', design }, silent: true }, false);
}

async function createDeck() {
  const name = await askText({ title: 'Nueva presentación', label: 'Nombre', placeholder: 'Anuncios del domingo, Bautismos…' });
  if (!name) return;
  const deck = { id: uid(), name, slides: [newDesignSlide()] };
  state.decks.unshift(deck);
  persistDecks();
  state.query.media = '';
  if (state.tab !== 'media') setTab('media'); else renderLibBody();
  loadItem(makeDeckItem(deck));
  openStudio(deck, 0);
}

function deleteDeck(deck) {
  const idx = state.decks.indexOf(deck);
  if (idx < 0) return;
  state.decks.splice(idx, 1);
  persistDecks();
  clearItemIf((it) => it.deck === deck);
  renderLibBody();
  toast(`«${deck.name}» eliminada`, { label: 'Deshacer', fn: () => { state.decks.splice(idx, 0, deck); persistDecks(); renderLibBody(); } });
}

function refreshDeckItem(deck, index = state.previewIndex) {
  if (state.item?.kind !== 'deck' || state.item.deck !== deck) return;
  state.item = makeDeckItem(deck);
  state.previewIndex = clamp(index, 0, state.item.slides.length - 1);
  renderStrip();
  update(false);
}

/* ───────────── Pestaña Estudio ───────────── */
function studioHtml() {
  const q = norm(state.query.media);
  const match = (name) => !q || norm(name).includes(q);
  if (!state.decks.length && !state.media.length && !state.texts.length) {
    return emptyHtml('sparkles', 'Crea tus propias diapositivas',
      'Arma una presentación con textos e imágenes que puedes mover y agrandar, o sube imágenes y videos para proyectarlos tal cual.',
      `<button class="btn accent block" type="button" data-action="new-deck">${icon('sparkles')}Nueva presentación</button>
       <button class="btn block" type="button" data-action="pick-image">${icon('image')}Subir imagen</button>
       <button class="btn block" type="button" data-action="pick-video">${icon('play')}Subir video</button>
       <button class="btn block" type="button" data-action="pick-audio">${icon('music')}Subir audio</button>`);
  }
  const current = state.item && (state.item.deck || state.item.media || state.item.text);
  const row = (id, kind, thumb, title, sub, ic) => `
    <div class="media-row${current?.id === id || state.audio?.id === id ? ' is-current' : ''}">
      <button class="media-open" type="button" data-open-${kind}="${esc(id)}">
        <span class="media-thumb"${kind === 'deck' ? ` data-deck-thumb="${esc(id)}"` : ''}${thumb ? ` style="background-image:url('${thumb}')"` : ''}>${thumb || kind === 'deck' ? '' : icon(ic)}</span>
        <span class="row-main"><span class="row-title">${esc(title)}</span><span class="row-sub">${esc(sub)}</span></span>
      </button>
      <button class="icon-btn" type="button" data-del-${kind}="${esc(id)}" aria-label="Eliminar ${esc(title)}" title="Eliminar">${icon('trash')}</button>
    </div>`;
  const group = (title, list, fn) => (list.length ? `<div class="lib-group">${title}<span>${list.length}</span></div>${list.map(fn).join('')}` : '');
  const decks = state.decks.filter((d) => match(d.name));
  const texts = state.texts.filter((t) => match(t.title));
  const images = state.media.filter((m) => m.kind === 'image' && match(m.name));
  const videos = state.media.filter((m) => m.kind === 'video' && match(m.name));
  const audios = state.media.filter((m) => m.kind === 'audio' && match(m.name));
  const html = group('Presentaciones', decks, (d) => row(d.id, 'deck', '', d.name, plural(d.slides.length, 'diapositiva', 'diapositivas'), 'sparkles'))
    + (!q ? `<button class="row add-row" type="button" data-action="new-deck"><span class="coll-icon">${icon('plus')}</span><span class="row-title">Nueva presentación</span></button>` : '')
    + group('Textos', texts, (t) => row(t.id, 'text', '', t.title, plural(t.slides.length, 'diapositiva', 'diapositivas'), 'text'))
    + group('Imágenes', images, (m) => row(m.id, 'media', m.thumb, m.name, fmtBytes(m.size), 'image'))
    + group('Videos', videos, (m) => row(m.id, 'media', m.thumb, m.name, fmtBytes(m.size), 'play'))
    + group('Audios', audios, (m) => row(m.id, 'audio', '', m.name, `${state.audio === m ? 'Sonando · ' : ''}${fmtBytes(m.size)}`, 'music'));
  return html.trim() ? html : emptyHtml('search', `Nada coincide con «${state.query.media.trim()}»`, 'Prueba con otro nombre.');
}

function hydrateDeckThumbs() {
  $$('[data-deck-thumb]').forEach((el) => {
    const deck = state.decks.find((d) => d.id === el.dataset.deckThumb);
    if (deck?.slides[0]) miniStage(el, deck.slides[0]);
  });
}

/* ───────────── Editor de diapositivas ───────────── */
const studio = { deck: null, index: 0, sel: null, stage: null, drag: null, frame: 0, saveTimer: 0, dragSlide: null };

const studioSlide = () => studio.deck.slides[studio.index];
const studioEl = (id) => studioSlide()?.elements.find((e) => e.id === id) || null;

function openStudio(deck, index = 0) {
  studio.deck = deck;
  studio.index = clamp(index, 0, deck.slides.length - 1);
  studio.sel = null;
  if (!studio.stage) {
    studio.stage = createStage();
    $('#studioCanvas').prepend(studio.stage);
  }
  $('#studioName').value = deck.name;
  renderStudio();
  $('#studio').showModal();
}

function renderStudio() {
  renderStudioSlides();
  renderStudioCanvas();
  renderStudioInspector();
}

function renderStudioSlides() {
  const list = $('#studioSlides');
  list.innerHTML = `${studio.deck.slides.map((s, i) => `
    <div class="ss-item${i === studio.index ? ' is-current' : ''}" draggable="true" data-ss="${i}">
      <span class="ss-num">${i + 1}</span>
      <button class="ss-thumb" type="button" data-ss-open="${i}" aria-label="Diapositiva ${i + 1}"></button>
      <span class="ss-tools">
        <button class="icon-btn" type="button" data-ss-dup="${i}" aria-label="Duplicar diapositiva ${i + 1}" title="Duplicar">${icon('copy')}</button>
        ${studio.deck.slides.length > 1 ? `<button class="icon-btn" type="button" data-ss-del="${i}" aria-label="Eliminar diapositiva ${i + 1}" title="Eliminar">${icon('trash')}</button>` : ''}
      </span>
    </div>`).join('')}
    <button class="ss-add" type="button" data-studio="add-slide">${icon('plus')}Nueva diapositiva</button>`;
  $$('.ss-thumb', list).forEach((el) => miniStage(el, studio.deck.slides[Number(el.dataset.ssOpen)]));
}

function refreshStudioThumb(i) {
  const el = $(`#studioSlides [data-ss-open="${i}"]`);
  if (el) miniStage(el, studio.deck.slides[i]);
}

const studioSlideView = () => ({
  text: '', ref: '', design: studioSlide(),
  anim: { transition: studioSlide().transition || studio.deck.transition || null, speed: studio.deck.speed || null },
});

function paintStudioStage() {
  paintStage(studio.stage, { look: state.live.look, slide: studioSlideView(), silent: true }, false);
}

// Vuelve a reproducir la entrada de la diapositiva (transición y animaciones de sus elementos) en el lienzo.
function playStudioAnim() {
  studio.stage.dataset.key = '';
  paintStage(studio.stage, { look: state.live.look, slide: studioSlideView(), silent: true }, true);
}

const optionsHtml = (list, value) => list.map(([v, label]) => `<option value="${v}"${v === value ? ' selected' : ''}>${esc(label)}</option>`).join('');
const fmtSeconds = (v) => `${Number(v).toFixed(1).replace('.', ',')} s`;

function elementAnimHtml(el) {
  const anim = el.anim || 'none';
  return `
    <p class="sub-title">Animación de entrada</p>
    <span class="select-wrap"><select data-prop="anim" aria-label="Animación de entrada">${optionsHtml(ELEMENT_ANIMS, anim)}</select>${icon('chevronRight')}</span>
    <div class="ctl"${anim === 'none' ? ' hidden' : ''}><div class="ctl-label"><span>Retraso</span><span class="val" id="studioDelayVal">${fmtSeconds(el.delay || 0)}</span></div>
      <input type="range" data-prop="delay" min="0" max="3" step="0.1" value="${el.delay || 0}" aria-label="Retraso de la animación">
    </div>
    ${anim === 'none' ? '' : `<button class="btn block" type="button" data-studio="play-anim">${icon('play')}Probar animación</button>`}`;
}

function slideAnimHtml(slide) {
  const deck = studio.deck;
  const speed = deck.speed || state.live.look.trSpeed;
  return `
    <p class="sub-title">Transición</p>
    <div class="ctl"><div class="ctl-label">Al llegar a esta diapositiva</div>
      <span class="select-wrap"><select data-slide-prop="transition" aria-label="Transición de esta diapositiva">${optionsHtml([['', 'Como toda la presentación'], ...TRANSITIONS], slide.transition || '')}</select>${icon('chevronRight')}</span>
    </div>
    <p class="sub-title">Toda la presentación</p>
    <div class="ctl"><div class="ctl-label">Transición</div>
      <span class="select-wrap"><select data-deck-prop="transition" aria-label="Transición de la presentación">${optionsHtml([['', 'Como en Apariencia'], ...TRANSITIONS], deck.transition || '')}</select>${icon('chevronRight')}</span>
    </div>
    <div class="ctl"><div class="ctl-label"><span>Duración de la transición</span><span class="val" id="deckSpeedVal">${deck.speed ? fmtSeconds(speed) : `Como en Apariencia (${fmtSeconds(speed)})`}</span></div>
      <input type="range" data-deck-prop="speed" min="0.2" max="2" step="0.05" value="${speed}" aria-label="Velocidad de la animación">
    </div>
    ${deck.speed ? `<button class="link-inline" type="button" data-studio="speed-reset">Usar la duración de Apariencia</button>` : ''}
    <button class="btn block" type="button" data-studio="play-anim">${icon('play')}Probar la entrada</button>`;
}

function renderStudioCanvas(guides = {}) {
  paintStudioStage();
  renderOverlay(guides);
  $('#studioCounter').textContent = `Diapositiva ${studio.index + 1} de ${studio.deck.slides.length}`;
}

function renderOverlay(guides = {}) {
  const ov = $('#studioOverlay');
  ov.innerHTML = studioSlide().elements.map((el) => `
    <div class="ov-box${el.id === studio.sel ? ' sel' : ''}${el.type === 'text' ? ' is-text' : ''}" data-box="${el.id}"
      style="left:${el.x}%;top:${el.y}%;width:${el.w}%;height:${el.h}%">
      ${el.id === studio.sel ? ['nw', 'ne', 'sw', 'se'].map((h) => `<span class="ov-handle ${h}" data-handle="${h}"></span>`).join('') : ''}
    </div>`).join('')
    + (guides.v ? '<div class="ov-guide v"></div>' : '')
    + (guides.h ? '<div class="ov-guide h"></div>' : '');
}

function moveBoxes() {
  for (const el of studioSlide().elements) {
    const box = $(`#studioOverlay [data-box="${el.id}"]`);
    if (box) Object.assign(box.style, { left: `${el.x}%`, top: `${el.y}%`, width: `${el.w}%`, height: `${el.h}%` });
  }
}

function swatchRow(attr, value, { same = false } = {}) {
  const list = attr === 'data-slide-bg' ? PALETTES.bg.map((c) => c.value) : TEXT_SWATCHES;
  const custom = list.includes(value) || (same && !value) ? '' : value;
  return `<div class="swatches">
    ${same ? `<button class="swatch same" type="button" ${attr}="" aria-pressed="${!value}" title="Usar el fondo de Apariencia" aria-label="Usar el fondo de Apariencia">=</button>` : ''}
    ${list.map((c) => `<button class="swatch" type="button" style="--sw:${c}" ${attr}="${c}" aria-pressed="${c === value}" aria-label="${c}"></button>`).join('')}
    <label class="swatch custom" title="Otro color" aria-pressed="${!!custom}"><input type="color" ${attr === 'data-slide-bg' ? 'data-slide-prop="bg"' : 'data-prop="color"'} value="${/^#[0-9a-f]{6}$/i.test(value || '') ? value : '#ffffff'}" aria-label="Elegir otro color"></label>
  </div>`;
}

function segmentedHtml(prop, value, options) {
  return `<div class="segmented">${options.map(([v, label]) => `<button type="button" data-prop-set="${prop}" data-value="${v}" aria-pressed="${String(value) === String(v)}"${label.startsWith('<') ? ` aria-label="${v}"` : ''}>${label}</button>`).join('')}</div>`;
}

const paintRange = (r) => r.style.setProperty('--p', `${((r.value - r.min) / (r.max - r.min)) * 100}%`);

function renderStudioInspector() {
  const box = $('#studioInspector');
  requestAnimationFrame(() => $$('input[type="range"]', box).forEach(paintRange));
  const el = studioEl(studio.sel);
  const actions = `
    <div class="btn-grid">
      <button class="btn" type="button" data-studio="front">${icon('front')}Al frente</button>
      <button class="btn" type="button" data-studio="back">${icon('back')}Atrás</button>
      <button class="btn" type="button" data-studio="duplicate">${icon('copy')}Duplicar</button>
      <button class="btn danger" type="button" data-studio="delete">${icon('trash')}Eliminar</button>
    </div>
    <div class="btn-grid">
      <button class="btn" type="button" data-studio="center-h">Centrar horizontal</button>
      <button class="btn" type="button" data-studio="center-v">Centrar vertical</button>
    </div>`;
  if (el?.type === 'text') {
    box.innerHTML = `
      <h3 class="si-title">Texto</h3>
      <textarea id="studioText" class="si-text" data-prop="text" rows="4" aria-label="Texto">${esc(el.text)}</textarea>
      <div class="ctl"><div class="ctl-label">Tipo de letra</div>
        <span class="select-wrap"><select data-prop="font" aria-label="Tipo de letra">${FONTS.map((f) => `<option value="${f.id}"${f.id === el.font ? ' selected' : ''}>${esc(f.name)}</option>`).join('')}</select>${icon('chevronRight')}</span>
      </div>
      <div class="ctl"><div class="ctl-label"><span>Tamaño</span><span class="val" id="studioSizeVal">${el.size} px</span></div>
        <input type="range" data-prop="size" min="12" max="260" step="2" value="${el.size}" aria-label="Tamaño">
      </div>
      <div class="ctl"><div class="ctl-label">Grosor</div>${segmentedHtml('weight', el.weight, [[400, 'Normal'], [600, 'Media'], [800, 'Negrita']])}</div>
      <div class="ctl"><div class="ctl-label">Alineación</div>${segmentedHtml('align', el.align, [['left', icon('alignLeft')], ['center', icon('alignCenter')], ['right', icon('alignRight')]])}</div>
      <div class="ctl"><div class="ctl-label">Color</div>${swatchRow('data-color-set', el.color)}</div>
      <label class="switch-row"><span>Sombra</span><span class="switch"><input type="checkbox" data-prop="shadow" role="switch"${el.shadow ? ' checked' : ''}></span></label>
      ${elementAnimHtml(el)}
      ${actions}`;
  } else if (el?.type === 'image') {
    box.innerHTML = `
      <h3 class="si-title">Imagen</h3>
      <div class="ctl"><div class="ctl-label">Ajuste</div>${segmentedHtml('fit', el.fit, [['cover', 'Recortar'], ['contain', 'Completa']])}</div>
      <div class="ctl"><div class="ctl-label"><span>Opacidad</span><span class="val">${Math.round((el.opacity ?? 1) * 100)} %</span></div>
        <input type="range" data-prop="opacity" min="0.05" max="1" step="0.05" value="${el.opacity ?? 1}" aria-label="Opacidad">
      </div>
      <div class="ctl"><div class="ctl-label"><span>Esquinas redondeadas</span><span class="val">${el.radius || 0}</span></div>
        <input type="range" data-prop="radius" min="0" max="120" step="2" value="${el.radius || 0}" aria-label="Esquinas redondeadas">
      </div>
      <button class="btn block" type="button" data-studio="fill">Llenar toda la diapositiva</button>
      ${elementAnimHtml(el)}
      ${actions}`;
  } else {
    const slide = studioSlide();
    const files = state.media.filter((m) => m.kind === 'image');
    box.innerHTML = `
      <h3 class="si-title">Diapositiva ${studio.index + 1}</h3>
      <div class="ctl"><div class="ctl-label">Color de fondo</div>${swatchRow('data-slide-bg', slide.bg, { same: true })}</div>
      ${slide.bgMedia ? `<button class="btn block" type="button" data-studio="bg-clear">${icon('trash')}Quitar la imagen de fondo</button>` : ''}
      <p class="sub-title">Imágenes</p>
      <div class="studio-files">
        <button class="sf-add" type="button" data-studio="add-image">${icon('upload')}<span>Subir</span></button>
        ${files.map((m) => `
          <div class="sf-item" draggable="true" data-file="${esc(m.id)}" title="${esc(m.name)}">
            <button class="sf-thumb" type="button" data-file-add="${esc(m.id)}" style="background-image:url('${m.thumb}')" aria-label="Añadir ${esc(m.name)}"></button>
            <button class="sf-bg" type="button" data-file-bg="${esc(m.id)}">Fondo</button>
          </div>`).join('')}
      </div>
      <p class="hint">Haz clic en una imagen para añadirla, o arrástrala a la diapositiva. También puedes soltar imágenes desde tu computadora. «Fondo» la pone detrás de todo.</p>
      ${slideAnimHtml(slide)}`;
  }
}

function studioCommit() {
  clearTimeout(studio.saveTimer);
  studio.saveTimer = setTimeout(flushStudio, 200);
  refreshStudioThumb(studio.index);
}

function flushStudio() {
  clearTimeout(studio.saveTimer);
  if (!studio.deck) return;
  persistDecks();
  refreshDeckItem(studio.deck);
  if (state.tab === 'media') renderLibBody();
}

function selectElement(id) {
  studio.sel = id;
  renderOverlay();
  renderStudioInspector();
}

function addStudioText() {
  const el = newTextElement({ y: 38 + (studioSlide().elements.length % 4) * 6 });
  studioSlide().elements.push(el);
  studio.sel = el.id;
  renderStudioCanvas();
  renderStudioInspector();
  studioCommit();
  $('#studioText')?.select();
}

async function addStudioImage(id, cx = 50, cy = 50) {
  let aspect = 16 / 9;
  try {
    const bmp = await createImageBitmap(await idb.get(id, 'media'));
    aspect = bmp.width / bmp.height;
    bmp.close();
  } catch { /* se queda en 16:9 */ }
  const ratio = ratioNumber(state.live.look.ratio);
  let w = 40;
  let h = (w * ratio) / aspect;
  if (h > 70) { h = 70; w = (h * aspect) / ratio; }
  const el = { id: uid(), type: 'image', x: cx - w / 2, y: cy - h / 2, w, h, media: id, fit: 'cover', opacity: 1, radius: 0 };
  studioSlide().elements.push(el);
  studio.sel = el.id;
  uploadMedia(id);
  renderStudioCanvas();
  renderStudioInspector();
  studioCommit();
}

async function addStudioFiles(files, cx = 50, cy = 50) {
  let offset = 0;
  for (const file of files) {
    if (!file.type.startsWith('image/')) { toast(`«${file.name}» no es una imagen.`); continue; }
    const meta = await storeMediaFile(file, 'image');
    if (meta) { await addStudioImage(meta.id, cx + offset, cy + offset); offset += 4; }
  }
  persistMedia();
  if (state.tab === 'media') renderLibBody();
}

function studioAction(action) {
  const slide = studioSlide();
  const el = studioEl(studio.sel);
  const idx = el ? slide.elements.indexOf(el) : -1;
  switch (action) {
    case 'add-text': addStudioText(); return;
    case 'add-image': $('#studioFile').click(); return;
    case 'add-slide': {
      studio.deck.slides.splice(studio.index + 1, 0, newDesignSlide());
      studio.index += 1;
      studio.sel = null;
      renderStudio();
      studioCommit();
      return;
    }
    case 'bg-clear': slide.bgMedia = null; break;
    case 'delete': if (el) { slide.elements.splice(idx, 1); studio.sel = null; } break;
    case 'duplicate': if (el) { const copy = { ...el, id: uid(), x: el.x + 3, y: el.y + 3 }; slide.elements.push(copy); studio.sel = copy.id; } break;
    case 'front': if (el) { slide.elements.splice(idx, 1); slide.elements.push(el); } break;
    case 'back': if (el) { slide.elements.splice(idx, 1); slide.elements.unshift(el); } break;
    case 'center-h': if (el) el.x = 50 - el.w / 2; break;
    case 'center-v': if (el) el.y = 50 - el.h / 2; break;
    case 'fill': if (el) Object.assign(el, { x: 0, y: 0, w: 100, h: 100, radius: 0 }); break;
    case 'play-anim': playStudioAnim(); return;
    case 'speed-reset': studio.deck.speed = null; renderStudioInspector(); studioCommit(); return;
    case 'close': $('#studio').close(); return;
    default: return;
  }
  renderStudioCanvas();
  renderStudioInspector();
  studioCommit();
}

function moveSlide(from, to) {
  const slides = studio.deck.slides;
  if (from === to || from < 0 || to < 0 || from >= slides.length || to > slides.length) return;
  const [s] = slides.splice(from, 1);
  slides.splice(to > from ? to - 1 : to, 0, s);
  studio.index = slides.indexOf(s);
  renderStudio();
  studioCommit();
}

// Mover y redimensionar con el puntero, 1:1; se ajusta a las guías del centro.
function studioPointer() {
  const ov = $('#studioOverlay');
  ov.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const boxEl = e.target.closest('[data-box]');
    if (!boxEl) { if (studio.sel) selectElement(null); return; }
    const el = studioEl(boxEl.dataset.box);
    if (!el) return;
    e.preventDefault();
    if (studio.sel !== el.id) selectElement(el.id);
    const r = ov.getBoundingClientRect();
    studio.drag = {
      el, mode: e.target.closest('[data-handle]')?.dataset.handle || 'move',
      x0: e.clientX, y0: e.clientY, start: { ...el }, W: r.width, H: r.height,
      ratioPx: (el.w * r.width) / (el.h * r.height), moved: false,
    };
    capture(ov, e.pointerId);
  });
  ov.addEventListener('pointermove', (e) => {
    const d = studio.drag;
    if (!d) return;
    const dx = ((e.clientX - d.x0) / d.W) * 100;
    const dy = ((e.clientY - d.y0) / d.H) * 100;
    if (!d.moved && Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < 3) return;
    d.moved = true;
    const { el, start } = d;
    const guides = {};
    if (d.mode === 'move') {
      el.x = start.x + dx;
      el.y = start.y + dy;
      if (Math.abs(el.x + el.w / 2 - 50) < 1.2) { el.x = 50 - el.w / 2; guides.v = true; }
      if (Math.abs(el.y + el.h / 2 - 50) < 1.6) { el.y = 50 - el.h / 2; guides.h = true; }
    } else {
      const left = d.mode.includes('w');
      const top = d.mode.includes('n');
      let w = Math.max(2, start.w + (left ? -dx : dx));
      let h = Math.max(2, start.h + (top ? -dy : dy));
      if (el.type === 'image' && !e.shiftKey) h = (w * d.W) / d.ratioPx / d.H;
      el.w = w;
      el.h = h;
      el.x = left ? start.x + start.w - w : start.x;
      el.y = top ? start.y + start.h - h : start.y;
    }
    if (studio.frame) return;
    studio.frame = requestAnimationFrame(() => {
      studio.frame = 0;
      paintStudioStage();
      moveBoxes();
      $$('#studioOverlay .ov-guide').forEach((g) => g.remove());
      if (guides.v) $('#studioOverlay').insertAdjacentHTML('beforeend', '<div class="ov-guide v"></div>');
      if (guides.h) $('#studioOverlay').insertAdjacentHTML('beforeend', '<div class="ov-guide h"></div>');
    });
  });
  const end = () => {
    const d = studio.drag;
    studio.drag = null;
    if (!d) return;
    $$('#studioOverlay .ov-guide').forEach((g) => g.remove());
    if (d.moved) studioCommit();
  };
  ov.addEventListener('pointerup', end);
  ov.addEventListener('pointercancel', end);
  ov.addEventListener('dblclick', (e) => {
    const el = studioEl(e.target.closest('[data-box]')?.dataset.box);
    if (el?.type === 'text') { const t = $('#studioText'); t?.focus(); t?.select(); }
  });
}

function bindStudio() {
  const dlg = $('#studio');
  studioPointer();

  $('#studioName').addEventListener('input', (e) => {
    studio.deck.name = e.target.value.trim() || 'Sin nombre';
    studioCommit();
  });
  dlg.addEventListener('click', (e) => {
    const b = e.target.closest('[data-studio]');
    if (b) studioAction(b.dataset.studio);
  });
  $('#studioFile').addEventListener('change', async (e) => {
    const files = [...e.target.files];
    e.target.value = '';
    if (files.length) await addStudioFiles(files);
  });
  dlg.addEventListener('close', () => {
    flushStudio();
    if (state.item?.kind === 'deck' && state.item.deck === studio.deck) { state.previewIndex = studio.index; update(false); }
    if (state.tab === 'media') renderLibBody();
    studio.deck = null;
  });

  // Lista de diapositivas: abrir, duplicar, eliminar y reordenar arrastrando.
  const list = $('#studioSlides');
  list.addEventListener('click', (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    const d = t.dataset;
    if (d.ssOpen != null) { studio.index = Number(d.ssOpen); studio.sel = null; renderStudio(); }
    else if (d.ssDup != null) {
      const i = Number(d.ssDup);
      const copy = JSON.parse(JSON.stringify(studio.deck.slides[i]));
      copy.id = uid();
      copy.elements.forEach((el) => { el.id = uid(); });
      studio.deck.slides.splice(i + 1, 0, copy);
      studio.index = i + 1;
      renderStudio();
      studioCommit();
    } else if (d.ssDel != null && studio.deck.slides.length > 1) {
      const i = Number(d.ssDel);
      const [removed] = studio.deck.slides.splice(i, 1);
      studio.index = clamp(studio.index > i ? studio.index - 1 : studio.index, 0, studio.deck.slides.length - 1);
      studio.sel = null;
      renderStudio();
      studioCommit();
      toast('Diapositiva eliminada', {
        label: 'Deshacer',
        fn: () => { studio.deck?.slides.splice(i, 0, removed); if (studio.deck) { studio.index = i; renderStudio(); studioCommit(); } },
      });
    }
  });
  list.addEventListener('dragstart', (e) => {
    const item = e.target.closest('[data-ss]');
    if (!item) return;
    studio.dragSlide = Number(item.dataset.ss);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/x-eb-slide', String(studio.dragSlide));
    item.classList.add('dragging');
  });
  list.addEventListener('dragover', (e) => {
    if (studio.dragSlide == null) return;
    e.preventDefault();
    const item = e.target.closest('[data-ss]');
    $$('.ss-item', list).forEach((x) => x.classList.remove('drop-before', 'drop-after'));
    if (!item) return;
    const r = item.getBoundingClientRect();
    item.classList.add(e.clientY < r.top + r.height / 2 ? 'drop-before' : 'drop-after');
  });
  list.addEventListener('drop', (e) => {
    if (studio.dragSlide == null) return;
    e.preventDefault();
    const item = e.target.closest('[data-ss]');
    let to = studio.deck.slides.length;
    if (item) { const r = item.getBoundingClientRect(); to = Number(item.dataset.ss) + (e.clientY < r.top + r.height / 2 ? 0 : 1); }
    const from = studio.dragSlide;
    studio.dragSlide = null;
    moveSlide(from, to);
  });
  list.addEventListener('dragend', () => {
    studio.dragSlide = null;
    $$('.ss-item', list).forEach((x) => x.classList.remove('dragging', 'drop-before', 'drop-after'));
  });

  // Panel derecho: propiedades del elemento o de la diapositiva.
  const insp = $('#studioInspector');
  insp.addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset.slideProp) {
      studioSlide()[t.dataset.slideProp] = t.value;
      if (t.dataset.slideProp === 'transition') playStudioAnim(); else paintStudioStage();
      studioCommit();
      return;
    }
    if (t.dataset.deckProp) {
      const k = t.dataset.deckProp;
      studio.deck[k] = t.type === 'range' ? Number(t.value) : t.value || null;
      if (t.type === 'range') { paintRange(t); $('#deckSpeedVal').textContent = fmtSeconds(studio.deck.speed); }
      else playStudioAnim();
      studioCommit();
      return;
    }
    const el = studioEl(studio.sel);
    const prop = t.dataset.prop;
    if (!el || !prop) return;
    el[prop] = t.type === 'checkbox' ? t.checked : t.type === 'range' ? Number(t.value) : t.value;
    if (t.type === 'range') paintRange(t);
    if (prop === 'size') $('#studioSizeVal').textContent = `${el.size} px`;
    if (prop === 'delay') $('#studioDelayVal').textContent = fmtSeconds(el.delay);
    if (prop === 'anim') { renderStudioInspector(); paintStudioStage(); playStudioAnim(); studioCommit(); return; }
    const val = t.closest('.ctl')?.querySelector('.val');
    if (val && prop === 'opacity') val.textContent = `${Math.round(el.opacity * 100)} %`;
    if (val && prop === 'radius') val.textContent = el.radius;
    paintStudioStage();
    studioCommit();
  });
  insp.addEventListener('click', (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    const d = t.dataset;
    const el = studioEl(studio.sel);
    if (d.propSet && el) { el[d.propSet] = /^\d+$/.test(d.value) ? Number(d.value) : d.value; }
    else if (d.colorSet != null && el) { el.color = d.colorSet; }
    else if (d.slideBg != null) { studioSlide().bg = d.slideBg || null; }
    else if (d.fileAdd) { addStudioImage(d.fileAdd); return; }
    else if (d.fileBg) { studioSlide().bgMedia = d.fileBg; uploadMedia(d.fileBg); }
    else return;
    renderStudioCanvas();
    renderStudioInspector();
    studioCommit();
  });
  insp.addEventListener('dragstart', (e) => {
    const f = e.target.closest('[data-file]');
    if (!f) return;
    e.dataTransfer.setData('text/x-eb-media', f.dataset.file);
    e.dataTransfer.effectAllowed = 'copy';
  });

  // Soltar imágenes (de Archivos o del ordenador) en la diapositiva.
  const wrap = $('#studioCanvasWrap');
  const accepts = (e) => [...e.dataTransfer.types].some((t) => t === 'Files' || t === 'text/x-eb-media');
  wrap.addEventListener('dragover', (e) => { if (!accepts(e)) return; e.preventDefault(); wrap.classList.add('drop'); });
  wrap.addEventListener('dragleave', (e) => { if (!wrap.contains(e.relatedTarget)) wrap.classList.remove('drop'); });
  wrap.addEventListener('drop', async (e) => {
    if (!accepts(e)) return;
    e.preventDefault();
    wrap.classList.remove('drop');
    const r = studio.stage.getBoundingClientRect();
    const cx = clamp(((e.clientX - r.left) / r.width) * 100, 0, 100);
    const cy = clamp(((e.clientY - r.top) / r.height) * 100, 0, 100);
    const id = e.dataTransfer.getData('text/x-eb-media');
    if (id) await addStudioImage(id, cx, cy);
    else await addStudioFiles([...e.dataTransfer.files], cx, cy);
  });

  // Teclado: borrar, mover con flechas y duplicar.
  dlg.addEventListener('keydown', (e) => {
    if (e.target.closest('input, textarea, select')) return;
    const el = studioEl(studio.sel);
    if (!el) return;
    const stepPct = e.shiftKey ? 5 : 0.5;
    const moves = { ArrowLeft: [-stepPct, 0], ArrowRight: [stepPct, 0], ArrowUp: [0, -stepPct], ArrowDown: [0, stepPct] };
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); studioAction('delete'); }
    else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'd') { e.preventDefault(); studioAction('duplicate'); }
    else if (moves[e.key]) {
      e.preventDefault();
      el.x += moves[e.key][0];
      el.y += moves[e.key][1];
      paintStudioStage();
      moveBoxes();
      studioCommit();
    }
  });
}
