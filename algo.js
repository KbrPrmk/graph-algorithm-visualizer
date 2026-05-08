// Graf verisi
let nodes   = [];   // { id, x, y, label } 
let edges   = [];   // { id, from, to, weight } 
let nodeIdCounter = 0; // yeni düğüm kimliği üretebilmek için sayaç

// Kullanıcı seçimleri
let mode      = 'node'; // aktif mod     
let algo      = 'dijkstra'; // aktif algoritma 
let directed  = false; // yönlü, yönsüz 
let startNode = null;
let endNode   = null;        

// Kenar çizme takibi
let drawingEdge = false;
let edgeFrom    = null;

// Sürükleme
let draggingNode = null;
let dragOffset   = { x: 0, y: 0 };

// Animasyon 
let animSteps   = []; // algoritmanın ürettiği tüm adımlar
let currentStep = -1; // şu an gösterilen adım indeksi
let animTimer   = null; // setTimeout referansı (iptal etmek için)
let isRunning   = false; // animasyon aktif mi?

const ANIM_SPEED = 600; // Animasyon hızı (ms) sabit 600ms

// Bekleyen kenar (modal açıkken hangi iki düğüm arasında?)
let pendingEdge = null;

// SVG referansları — sık kullanıldığı için üstte cache'lendi
const svg       = document.getElementById('canvas');
const edgeLayer = document.getElementById('edgeLayer');
const nodeLayer = document.getElementById('nodeLayer');
const tempEdge  = document.getElementById('tempEdge');



// SVG YARDIMCILARI

// NODE OLUŞTUR
function renderNode(n) {
  // Yapı: <g id="node-N"> <circle> <text label> <text dist> </g>

  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  g.setAttribute('id', 'node-' + n.id);
  g.style.cursor = 'pointer';

  const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  circle.setAttribute('cx', n.x);
  circle.setAttribute('cy', n.y);
  circle.setAttribute('r', 22);
  circle.setAttribute('class', 'node-circle');
  circle.setAttribute('id', 'circle-' + n.id);

  const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  label.setAttribute('x', n.x);
  label.setAttribute('y', n.y);
  label.setAttribute('class', 'node-label');
  label.textContent = n.label;

  const dist = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  dist.setAttribute('x', n.x);
  dist.setAttribute('y', n.y - 30);
  dist.setAttribute('class', 'node-dist');
  dist.setAttribute('id', 'dist-' + n.id);
  dist.style.display = 'none';

  g.appendChild(circle);
  g.appendChild(label);
  g.appendChild(dist);

  // Tıklama - moda göre farklı davranış
  g.addEventListener('click', (e) => { e.stopPropagation(); onNodeClick(n.id); });
  // Sürükleme
  g.addEventListener('mousedown', (e) => { if (mode === 'move') startDrag(n.id, e); });

  nodeLayer.appendChild(g);
}


// KENAR OLUŞTUR
function renderEdge(edge) {
  // Yapı: <g id="edge-ID"> <line> <rect (bg)> <text (ağırlık)> </g>

  const from = nodes.find(n => n.id === edge.from);
  const to   = nodes.find(n => n.id === edge.to);
  if (!from || !to) return;

  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  g.setAttribute('id', 'edge-' + edge.id);

  // Kenar noktaları 
  const pts = getEdgeEndpoints(from, to, edge); // düğüm kenarından başlar

  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line.setAttribute('x1', pts.x1); line.setAttribute('y1', pts.y1);
  line.setAttribute('x2', pts.x2); line.setAttribute('y2', pts.y2);
  line.setAttribute('class', 'edge-line');
  line.setAttribute('id', 'line-' + edge.id);
  if (directed) line.setAttribute('marker-end', 'url(#arrow-default)');

  // Ağırlık etiketi: kenarın tam ortasında
  const mx = pts.mx;
  const my = pts.my;

  const wbg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  wbg.setAttribute('x', mx - 12); wbg.setAttribute('y', my - 9);
  wbg.setAttribute('width', 24);  wbg.setAttribute('height', 16);
  wbg.setAttribute('rx', 4);
  wbg.setAttribute('class', 'edge-weight-bg');
  wbg.setAttribute('id', 'wbg-' + edge.id);

  const wtext = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  wtext.setAttribute('x', mx); wtext.setAttribute('y', my);
  wtext.setAttribute('class', 'edge-weight');
  wtext.setAttribute('dominant-baseline', 'central');
  wtext.setAttribute('text-anchor', 'middle');
  wtext.setAttribute('id', 'wtext-' + edge.id);
  wtext.textContent = edge.weight;

  // Ağırlık metnine tıklayınca; sil modu ise sil, değilse düzenle
  wtext.addEventListener('click', (e) => {
    e.stopPropagation();
    if (mode === 'delete') {
      deleteEdge(edge.id);
    } else {
      const newW = prompt('Yeni ağırlık:', edge.weight);
      if (newW !== null && !isNaN(parseInt(newW))) {
        edge.weight = parseInt(newW);
        wtext.textContent = edge.weight;
      }
    }
  });

  line.addEventListener('click', (e) => {
    if (mode === 'delete') { e.stopPropagation(); deleteEdge(edge.id); }
  });

  g.appendChild(line);
  g.appendChild(wbg);
  g.appendChild(wtext);
  edgeLayer.insertBefore(g, edgeLayer.firstChild); // kenarlar düğümlerin altında
}

// TAŞIMA İŞLEMİNDEN SONRA GÜNCELLEME İÇİN
function updateNodePosition(n) {
  const circle = document.getElementById('circle-' + n.id);
  const g      = document.getElementById('node-' + n.id);
  if (!g) return;

  const texts = g.querySelectorAll('text');
  circle.setAttribute('cx', n.x); circle.setAttribute('cy', n.y);
  texts[0].setAttribute('x', n.x); texts[0].setAttribute('y', n.y);
  texts[1].setAttribute('x', n.x); texts[1].setAttribute('y', n.y - 30);

  // Bu düğümle ilgili tüm kenarları güncelle
  edges.forEach(edge => {
    if (edge.from === n.id || edge.to === n.id) updateEdgePosition(edge);
  });
}

// TAŞIMADAN SONRA KENARIN YENİDEN ÇİZİLMESİ İÇİN 
function updateEdgePosition(edge) {
  const from  = nodes.find(n => n.id === edge.from);
  const to    = nodes.find(n => n.id === edge.to);
  if (!from || !to) return;

  const pts = getEdgeEndpoints(from, to, edge);
  const line = document.getElementById('line-' + edge.id);
  if (line) {
    line.setAttribute('x1', pts.x1); line.setAttribute('y1', pts.y1);
    line.setAttribute('x2', pts.x2); line.setAttribute('y2', pts.y2);
  }

  const mx = pts.mx;
  const my = pts.my;
  const wbg   = document.getElementById('wbg-'   + edge.id);
  const wtext = document.getElementById('wtext-' + edge.id);
  if (wbg)   { wbg.setAttribute('x', mx - 12); wbg.setAttribute('y', my - 9); }
  if (wtext) { wtext.setAttribute('x', mx);    wtext.setAttribute('y', my); }
}

// GÖRSEL ÇAKIŞMA İÇİN
function getEdgeEndpoints(from, to, edge) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const d = Math.sqrt(dx * dx + dy * dy) || 1;

  const ux = dx / d;
  const uy = dy / d;

  const r = 22;
  const tip = directed ? 26 : 22;

  // Doğruya dik birim vektör
  const px = -uy;
  const py = ux;

  // Karşı yönlü kenar var mı 
  const reverseExists = directed && edges.some(e => e.id !== edge.id && e.from === edge.to && e.to === edge.from);
  
  const offset = reverseExists ? 14 : 0;
  
  const sign = edge.offsetSign || 1;

  const ox = px * offset * sign;
  const oy = py * offset * sign;

  return {
    x1: from.x + ux * r + ox,
    y1: from.y + uy * r + oy,
    x2: to.x - ux * tip + ox,
    y2: to.y - uy * tip + oy,
    mx: (from.x + to.x) / 2 + ox,
    my: (from.y + to.y) / 2 + oy
  };
}

// tüm SVG’yi baştan üretir
function renderAll() {
  edgeLayer.innerHTML = '';
  nodeLayer.innerHTML = '';
  edges.forEach(e => renderEdge(e));
  nodes.forEach(n => renderNode(n));
  applyStartEndClasses();
}

// başlangıç ve bitiş düğümlerine özel sınıf verir.
function applyStartEndClasses() {
  if (startNode !== null) document.getElementById('circle-' + startNode)?.classList.add('start');
  if (endNode   !== null) document.getElementById('circle-' + endNode)?.classList.add('end');
}



// KULLANICI


// Canvas Tıklaması
svg.addEventListener('click', (e) => {
  if (isRunning) return;

  if (e.target === svg) {
    // mode nodeda ise node ekler
    if (mode === 'node') {
      const pt = svgPoint(e);
      addNode(pt.x, pt.y);
    }
    // edge modunda canvas'a tıklamak çizimi iptal eder
    if (mode === 'edge') {
      drawingEdge = false; edgeFrom = null;
      tempEdge.style.display = 'none';
    }
  }
});

// Mouse Hareketi
svg.addEventListener('mousemove', (e) => {
  // kenar çizme modunda ilk düğüm seçildikten sonra takip eden çizgi
  if (mode === 'edge' && drawingEdge && edgeFrom !== null) {
    const pt = svgPoint(e);
    const n  = nodes.find(n => n.id === edgeFrom);
    if (n) {
      tempEdge.setAttribute('x1', n.x);
      tempEdge.setAttribute('y1', n.y);
      tempEdge.setAttribute('x2', pt.x);
      tempEdge.setAttribute('y2', pt.y);
      tempEdge.style.display = 'block';
    }
  }
});


// normal koordinatı svgnin kendi iç koordinat sistemine çevirme 
function svgPoint(e) {
  const rect = svg.getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

// ---- Düğüm Tıklaması
function onNodeClick(id) {
  if (isRunning) return;

  if (mode === 'start') {
    // başlangıç düğümü seçer
    startNode = id;
    renderAll();
    addLog('Başlangıç: ' + getLabel(id), 'new');
    setMode('node');

  } else if (mode === 'end') {
    // bitiş düğümü seçer
    endNode = id;
    renderAll();
    addLog('Bitiş: ' + getLabel(id), 'new');
    setMode('node');

  } else if (mode === 'edge') {
    // köşe çizme
    if (!drawingEdge) {
      // İlk tıklama çizmeye başlamak için
      edgeFrom    = id;
      drawingEdge = true;
    } else {
      // İkinci tıklama kenar oluştur (aynı düğüm ise iptal)
      if (edgeFrom !== id) openWeightModal(edgeFrom, id);
      drawingEdge = false;
      edgeFrom    = null;
      tempEdge.style.display = 'none';
    }
    
    // delete modunda ise node sil
  } else if (mode === 'delete') {
    deleteNode(id);
  }
}

// ---- Düğüm Ekleme
function addNode(x, y) {
  const id    = nodeIdCounter++;
  // etiketle ABC
  const label = String.fromCharCode(65 + (id % 26)) + (id >= 26 ? Math.floor(id / 26) : '');
  nodes.push({ id, x, y, label }); // diziye ekle
  renderNode(nodes[nodes.length - 1]);
  updateStatus(); // durumu güncelle
}

// ---- Düğüm Sil
function deleteNode(id) {
  nodes = nodes.filter(n => n.id !== id);
  // Bu düğüme bağlı tüm kenarları da sil
  edges = edges.filter(e => e.from !== id && e.to !== id);
  if (startNode === id) startNode = null;
  if (endNode   === id) endNode   = null;
  renderAll();
  updateStatus();
}

// ---- Kenar Silme
function deleteEdge(id) {
  // veri dizisinden ve domdan sil
  edges = edges.filter(e => e.id !== id);
  document.getElementById('edge-' + id)?.remove();
  updateStatus();
}


// ---- Ağırlık

function openWeightModal(from, to) {
  // Aynı kenar zaten varsa
  if (edges.find(e => e.from === from && e.to === to)) {
    addLog('Bu kenar zaten mevcut!', 'warn');
    return;
  }
  pendingEdge = { from, to };
  document.getElementById('weightInput').value = 1;
  document.getElementById('weightModal').classList.add('open');
  setTimeout(() => document.getElementById('weightInput').select(), 50);
}

// yeni köşe oluştur
function confirmWeight() {
  const w = parseInt(document.getElementById('weightInput').value) || 1; // varsayılan 1
  if (pendingEdge) {
    const id = `e${pendingEdge.from}-${pendingEdge.to}-${Date.now()}`;
    edges.push({ id, from: pendingEdge.from, to: pendingEdge.to, weight: w });
    renderEdge(edges[edges.length - 1]);
    updateStatus();
    pendingEdge = null;
  }
  document.getElementById('weightModal').classList.remove('open');
}

function cancelWeight() {
  pendingEdge = null;
  document.getElementById('weightModal').classList.remove('open');
}

document.getElementById('weightInput').addEventListener('keydown', e => {
  if (e.key === 'Enter')  confirmWeight();
  if (e.key === 'Escape') cancelWeight();
});

// ---- Sürükleme

function startDrag(id, e) {
  e.preventDefault(); 

  // Eğer move modunda değilse sürükleme başlatma
  if (mode !== 'move') return;

  draggingNode = id;

  const n = nodes.find(n => n.id === id);
  if (!n) return;

  const pt = svgPoint(e);

  // farenin düğüme göre farkını buraya alır
  dragOffset = {
    x: pt.x - n.x,
    y: pt.y - n.y
  };

  svg.style.cursor = 'grabbing';

  const onMove = (ev) => {
    if (draggingNode === null) return;

    const pt2 = svgPoint(ev);
    const nd  = nodes.find(n => n.id === draggingNode);
    if (!nd) return;

    // Yeni konum
    nd.x = pt2.x - dragOffset.x;
    nd.y = pt2.y - dragOffset.y;

    updateNodePosition(nd);
  };

  const onUp = () => {
    draggingNode = null;

    svg.style.cursor = mode === 'move' ? 'grab' : 'crosshair';

    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
  };

  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
}

// ---- Mod Değiştirme
function setMode(m) {
  mode        = m;
  drawingEdge = false;
  edgeFrom    = null;
  tempEdge.style.display = 'none';

  document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('btn-' + m)?.classList.add('active');

  const names = { node:'Düğüm Ekle', edge:'Kenar Çiz', start:'Başlangıç Seç',
                  end:'Bitiş Seç', move:'Taşı', delete:'Sil' };
  document.getElementById('statusMode').textContent = 'Mod: ' + (names[m] || m);

  const cursors = { node:'crosshair', edge:'crosshair', start:'pointer',
                    end:'pointer', move:'grab', delete:'not-allowed' };
  svg.style.cursor = cursors[m] || 'default';
}

// ---- Algoritma Değiştirme
const algoInfoMap = {
  dijkstra: '<strong>Dijkstra</strong><br>Negatif olmayan kenarlarda en kısa yol. Öncelik kuyruğu kullanır.<br><br>Karmaşıklık: <strong>O((V+E) log V)</strong>',
  bellman:  '<strong>Bellman-Ford</strong><br>Negatif kenarlarda çalışır. Negatif döngü tespiti yapar.<br><br>Karmaşıklık: <strong>O(V·E)</strong>',
  prim:     '<strong>Prim</strong><br>Minimum spanning tree (MST). Bir düğümden büyüyerek genişler.<br><br>Karmaşıklık: <strong>O(E log V)</strong>',
  kruskal:  '<strong>Kruskal</strong><br>MST: Kenarları ağırlığa göre sıralar, döngü oluşturmayanı ekler.<br><br>Karmaşıklık: <strong>O(E log E)</strong>'
};

function setAlgo(a, el) {
  algo = a;
  document.querySelectorAll('.algo-tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('algoInfo').innerHTML   = algoInfoMap[a];
  document.getElementById('statusAlgo').innerHTML = `<span>Algoritma: ${el.textContent}</span>`;
  resetVisualization();
}

function toggleDirected() {
  directed = document.getElementById('directedToggle').checked;
  renderAll();
  resetVisualization();
}


// adım adım çizim
function runAlgorithm() {
  if (nodes.length === 0) { addLog('Önce bir graf oluşturun!', 'warn'); return; }
  if ((algo === 'dijkstra' || algo === 'bellman' || algo === 'prim') && startNode === null) {
    addLog('Başlangıç düğümü seçin! (★ modu)', 'warn'); return;
  }

  // eski görselleştirmeyi temizle
  resetVisualization();
  clearLog();

  // adımları üret
  let steps = [];
  if      (algo === 'dijkstra') steps = dijkstraSteps();
  else if (algo === 'bellman')  steps = bellmanFordSteps();
  else if (algo === 'prim')     steps = primSteps();
  else if (algo === 'kruskal')  steps = kruskalSteps();

  if (!steps || steps.length === 0) return;

  animSteps = steps;
  isRunning = true;
  document.getElementById('runBtn').disabled  = true;
  document.getElementById('prevBtn').disabled = false;
  document.getElementById('nextBtn').disabled = false;

  // animasyonu başlat
  const tick = () => {
    if (currentStep < animSteps.length - 1) {
      stepNext();
      animTimer = setTimeout(tick, ANIM_SPEED);
    } else {
      isRunning = false;
      document.getElementById('runBtn').disabled = false;
    }
  };
  animTimer = setTimeout(tick, 300);
}

function stepNext() {
  if (currentStep >= animSteps.length - 1) return;
  currentStep++;
  applyStep(animSteps[currentStep]);
  updateStepCounter();
}

function stepPrev() {
  if (currentStep <= 0) return;
  clearTimeout(animTimer);
  isRunning = false;

  // görselleri sıfırla, baştan currentStep-1'e kadar replay
  currentStep--;
  resetVisualsOnly();
  for (let i = 0; i <= currentStep; i++) applyStep(animSteps[i], true);
  updateStepCounter();
}


function applyStep(step, silent = false) {
  // log ekle
  if (!silent && step.log) addLog(step.log, step.logType || '');

  // Ziyaret edilen düğümü işaretle
  if (step.visitNode !== undefined) {
    document.getElementById('circle-' + step.visitNode)
      ?.classList.replace('current', 'visited') || // önce current'ı kaldır
    document.getElementById('circle-' + step.visitNode)
      ?.classList.add('visited');
  }

  // Aktif düğümü parlat
  if (step.currentNode !== undefined) {
    document.querySelectorAll('.node-circle.current')
      .forEach(c => c.classList.remove('current'));
    document.getElementById('circle-' + step.currentNode)
      ?.classList.add('current');
  }

  // incelenen kenarı mavi yap
  if (step.activeEdge !== undefined) {
    const line = document.getElementById('line-' + step.activeEdge);
    if (line) {
      line.classList.add('active');
      if (directed) line.setAttribute('marker-end', 'url(#arrow-active)');
    }
  }

  // Kenarı pasife al (inceleme bitti)
  if (step.deactivateEdge !== undefined) {
    const line = document.getElementById('line-' + step.deactivateEdge);
    if (line) {
      line.classList.remove('active');
      if (directed) line.setAttribute('marker-end', 'url(#arrow-default)');
    }
  }

  // En kısa yol kenarları yeşil
  if (step.pathEdges) {
    step.pathEdges.forEach(eid => {
      const line = document.getElementById('line-' + eid);
      if (line) {
        line.classList.remove('active');
        line.classList.add('path');
        if (directed) line.setAttribute('marker-end', 'url(#arrow-path)');
      }
    });
  }

  // En kısa yol düğümleri yeşil
  if (step.pathNodes) {
    step.pathNodes.forEach(nid => {
      const c = document.getElementById('circle-' + nid);
      if (c) { c.classList.remove('visited', 'current'); c.classList.add('path'); }
    });
  }

  // MST kenarını işaretle
  if (step.mstEdge !== undefined) {
    const line = document.getElementById('line-' + step.mstEdge);
    if (line) {
      line.classList.remove('active');
      line.classList.add('mst');
      if (directed) line.setAttribute('marker-end', 'url(#arrow-mst)');
    }
  }

  // MST düğümlerini işaretle
  if (step.mstNodes) {
    step.mstNodes.forEach(nid => {
      const c = document.getElementById('circle-' + nid);
      if (c) { c.classList.remove('current'); c.classList.add('mst'); }
    });
  }

  // Düğüm üstündeki mesafeyi güncelle
  if (step.distUpdate) {
    const dt = document.getElementById('dist-' + step.distUpdate.node);
    if (dt) {
      dt.textContent = step.distUpdate.val === Infinity ? '∞' : step.distUpdate.val;
      dt.style.display = 'block';
    }
  }

  // Sağ paneldeki mesafe tablosunu güncelle
  if (step.distances) {
    renderDistTable(step.distances, step.prev, step.visited, step.currentNode);
  }

  // Sonuç bannerını göster
  if (step.result) {
    const banner = document.getElementById('resultBanner');
    banner.innerHTML = step.result;
    banner.classList.add('visible');
  }
}


// Animasyonu tamamen sıfırlar
function resetVisualization() {
  clearTimeout(animTimer);
  isRunning   = false;
  animSteps   = [];
  currentStep = -1;

  document.getElementById('runBtn').disabled  = false;
  document.getElementById('prevBtn').disabled = true;
  document.getElementById('nextBtn').disabled = true;
  document.getElementById('resultBanner').classList.remove('visible');
  document.getElementById('distTableContainer').innerHTML = '';
  document.getElementById('stepCounter').textContent = '—';

  resetVisualsOnly();
  clearLog();
}


// veriye dokunmadan sadece görsel sınıfları sıfırlar
function resetVisualsOnly() {
  document.querySelectorAll('.node-circle').forEach(c =>
    c.classList.remove('visited', 'current', 'path', 'mst', 'start', 'end'));
  document.querySelectorAll('.node-dist').forEach(d => {
    d.style.display = 'none'; d.textContent = '';
  });
  document.querySelectorAll('.edge-line').forEach(l => {
    l.classList.remove('active', 'path', 'mst');
    if (directed) l.setAttribute('marker-end', 'url(#arrow-default)');
    else l.removeAttribute('marker-end');
  });
  document.getElementById('resultBanner').classList.remove('visible');
  document.getElementById('distTableContainer').innerHTML = '';
  applyStartEndClasses();
  clearLog();
}

function clearAll() {
  resetVisualization();
  nodes = []; edges = []; nodeIdCounter = 0;
  startNode = null; endNode = null;
  nodeLayer.innerHTML = ''; edgeLayer.innerHTML = '';
  updateStatus();
}

// ---- Mesafe Tablosu 
function renderDistTable(distances, prev, visited, currentId) {
  const container = document.getElementById('distTableContainer');
  if (!distances || Object.keys(distances).length === 0) { container.innerHTML = ''; return; }

  let html = `<div class="dist-table">
    <div class="dist-table-header"><span>Düğüm</span><span>Mesafe</span><span>Önceki</span></div>`;

  nodes.forEach(n => {
    const d = distances[n.id];
    const p = prev ? prev[n.id] : null;
    const prevLabel = (p !== null && p !== undefined) ? getLabel(p) : '—';
    let cls = '';
    if (n.id === currentId)               cls = 'current';
    else if (visited && visited.has(n.id)) cls = 'visited';
    html += `<div class="dist-row ${cls}">
      <span>${n.label}</span>
      <span>${d === Infinity ? '∞' : d}</span>
      <span>${prevLabel}</span>
    </div>`;
  });

  html += '</div>';
  container.innerHTML = html;
}

// ---- sağ panel Log yeni ekle
function addLog(msg, type = '') {
  const body = document.getElementById('logBody');

  //başlangıç placeholderını kaldır
  const ph = body.querySelector('.log-placeholder');
  if (ph) ph.remove();

  const item = document.createElement('div');
  item.className = 'log-item ' + type;
  item.textContent = msg;
  body.appendChild(item);
  body.scrollTop = body.scrollHeight;
}

// başlangıç placeholderını geri getir
function clearLog() {
  const body = document.getElementById('logBody');
  body.innerHTML = '<div class="log-placeholder">Bir graf oluşturun ve algoritmayı çalıştırın.</div>';
}

// ---- Adım sayacı
function updateStepCounter() {
  document.getElementById('stepCounter').textContent =
    animSteps.length > 0 ? `${currentStep + 1} / ${animSteps.length}` : '—';
}

// ---- Status bar 
function updateStatus() {
  document.getElementById('statusNodes').textContent = nodes.length + ' düğüm';
  document.getElementById('statusEdges').textContent = edges.length + ' kenar';
}

// ----------------- DIJKSTRA -------------
function dijkstraSteps() {
  const steps = [];
  const dist  = {};
  const prev  = {};
  const visited = new Set();

  // başta hepsi sonsuz
  nodes.forEach(n => { dist[n.id] = Infinity; prev[n.id] = null; });
  dist[startNode] = 0;

  steps.push({
    log: `Başlangıç: ${getLabel(startNode)}, mesafe = 0`, logType: 'new',
    currentNode: startNode, distUpdate: { node: startNode, val: 0 },
    distances: { ...dist }, prev: { ...prev }, visited: new Set(visited)
  });

  // basit dizi 
  const pq = [[0, startNode]];

  while (pq.length > 0) {
    // En küçük mesafeli elemanı seç
    pq.sort((a, b) => a[0] - b[0]);
    const [d, u] = pq.shift();

    if (visited.has(u)) continue;
    visited.add(u);

    steps.push({
      log: `${getLabel(u)} işleniyor (mesafe: ${d})`, logType: 'new',
      currentNode: u, visitNode: u,
      distances: { ...dist }, prev: { ...prev }, visited: new Set(visited)
    });

    if (u === endNode) break; // bitiş bulundu

    // Komşuları incele
    getNeighbors(u).forEach(({ to, weight, edgeId }) => {
      if (visited.has(to)) return;

      steps.push({
        log: `  Kenar ${getLabel(u)}→${getLabel(to)} (${weight}) inceleniyor`,
        activeEdge: edgeId,
        distances: { ...dist }, prev: { ...prev }, visited: new Set(visited)
      });

      const newDist = dist[u] + weight;
      if (newDist < dist[to]) {
        dist[to] = newDist;
        prev[to] = u;
        pq.push([newDist, to]);
        steps.push({
          log: `  ✓ ${getLabel(to)} güncellendi → ${newDist}`, logType: 'highlight',
          deactivateEdge: edgeId, distUpdate: { node: to, val: newDist },
          distances: { ...dist }, prev: { ...prev }, visited: new Set(visited)
        });
      } else {
        steps.push({
          log: `  ✗ Güncelleme yok (${newDist} ≥ ${dist[to]})`,
          deactivateEdge: edgeId,
          distances: { ...dist }, prev: { ...prev }, visited: new Set(visited)
        });
      }
    });
  }

  // Yolu geri izle
  buildPathSteps(steps, dist, prev, visited);
  return steps;
}

// ---------- BELLMAN-FORD -----------------
function bellmanFordSteps() {
  const steps = [];
  const dist  = {};
  const prev  = {};
  nodes.forEach(n => { dist[n.id] = Infinity; prev[n.id] = null; });
  dist[startNode] = 0;

  steps.push({
    log: `Başlangıç: ${getLabel(startNode)}, mesafe = 0`, logType: 'new',
    currentNode: startNode, distUpdate: { node: startNode, val: 0 },
    distances: { ...dist }, prev: { ...prev }
  });

  // Yönsüz grafta her kenarı iki yönde de değerlendir
  const allEdges = directed
    ? edges
    : [...edges, ...edges.map(e => ({ ...e, from: e.to, to: e.from, id: e.id + '_r' }))];

  for (let i = 0; i < nodes.length - 1; i++) {
    steps.push({ log: `── İterasyon ${i + 1} ──` });
    let anyUpdate = false;

    allEdges.forEach(edge => {
      if (dist[edge.from] === Infinity) return;
      const realEdge = edges.find(e => e.id === edge.id || e.id === edge.id.replace('_r', ''));
      const newDist  = dist[edge.from] + edge.weight;

      steps.push({
        log: `  Kenar ${getLabel(edge.from)}→${getLabel(edge.to)} inceleniyor`,
        activeEdge: realEdge?.id,
        distances: { ...dist }, prev: { ...prev }
      });

      if (newDist < dist[edge.to]) {
        dist[edge.to] = newDist;
        prev[edge.to] = edge.from;
        anyUpdate = true;
        steps.push({
          log: `  ✓ ${getLabel(edge.to)} → ${newDist}`, logType: 'highlight',
          deactivateEdge: realEdge?.id, distUpdate: { node: edge.to, val: newDist },
          distances: { ...dist }, prev: { ...prev }
        });
      } else {
        steps.push({
          log: `  ✗ Değişiklik yok`,
          deactivateEdge: realEdge?.id,
          distances: { ...dist }, prev: { ...prev }
        });
      }
    });

    // güncelleme yoksa erken bitir
    if (!anyUpdate) {
      steps.push({ log: 'Erken sonlanma: değişiklik yok.', logType: 'highlight' });
      break;
    }
  }

  // Negatif döngü kontrolü
  let negCycle = false;
  allEdges.forEach(edge => {
    if (dist[edge.from] !== Infinity && dist[edge.from] + edge.weight < dist[edge.to])
      negCycle = true;
  });

  if (negCycle) {
    steps.push({
      log: '⚠ Negatif döngü tespit edildi!', logType: 'warn',
      result: '<strong>⚠ Uyarı:</strong><br>Negatif döngü tespit edildi!<br>En kısa yol tanımsız.'
    });
    return steps;
  }

  buildPathSteps(steps, dist, prev, new Set(nodes.map(n => n.id)));
  return steps;
}

// -------- PRIM ------------------
function primSteps() {
  const steps   = [];
  const inMST   = new Set();
  let totalCost = 0;

  inMST.add(startNode);
  steps.push({
    log: `Başlangıç: ${getLabel(startNode)}`, logType: 'new',
    mstNodes: [startNode]
  });

  while (inMST.size < nodes.length) {
    // MST'ye eklenmemiş komşular arasında en düşükü bul
    let minEdge = null, minW = Infinity;

    edges.forEach(edge => {
      // Yönsüz grafta iki yönü de kontrol et
      const candidates = directed
        ? [{ from: edge.from, to: edge.to, w: edge.weight, id: edge.id }]
        : [
            { from: edge.from, to: edge.to, w: edge.weight, id: edge.id },
            { from: edge.to, to: edge.from, w: edge.weight, id: edge.id }
          ];
      candidates.forEach(c => {
        if (inMST.has(c.from) && !inMST.has(c.to) && c.w < minW) {
          minW = c.w; minEdge = c;
        }
      });
    });

    if (!minEdge) {
      steps.push({ log: 'Graf bağlı değil. Erişilebilir düğümler tamamlandı.', logType: 'warn' });
      break;
    }

    steps.push({ log: `  Kenar ${getLabel(minEdge.from)}→${getLabel(minEdge.to)} (${minW}) inceleniyor`, activeEdge: minEdge.id });
    inMST.add(minEdge.to);
    totalCost += minW;

    steps.push({
      log: `✓ ${getLabel(minEdge.to)} MST'ye eklendi (${minW})`, logType: 'highlight',
      mstEdge: minEdge.id, mstNodes: [minEdge.to]
    });
  }

  steps.push({
    log: `MST tamamlandı! Toplam maliyet: ${totalCost}`, logType: 'highlight',
    result: `<strong>MST Tamamlandı</strong><br>Toplam maliyet: <span class="cost">${totalCost}</span>`
  });
  return steps;
}

// --------- KRUSKAL ----------
function kruskalSteps() {
  const steps = [];

  // Union-Find veri yapısı

  // Her düğüm kendi kümesinin temsilcisi olarak başlar.
  const parent = {};
  const rank   = {};
  nodes.forEach(n => { parent[n.id] = n.id; rank[n.id] = 0; });

  function find(x) {
    if (parent[x] !== x) parent[x] = find(parent[x]); // path compression
    return parent[x];
  }

  // iki kümeyi birleştirir
  function union(x, y) {
    const px = find(x), py = find(y);
    if (px === py) return false; // Zaten aynı kümede → döngü oluşur
    // Union by rank
    if (rank[px] < rank[py]) parent[px] = py;
    else if (rank[px] > rank[py]) parent[py] = px;
    else { parent[py] = px; rank[px]++; }
    return true;
  }

  // Kenarları ağırlığa göre küçükten büyüğe sırala
  const sorted = [...edges].sort((a, b) => a.weight - b.weight);

  steps.push({ log: 'Kenarlar ağırlığa göre sıralandı:', logType: 'new' });
  sorted.forEach(e => steps.push({ log: `  ${getLabel(e.from)}—${getLabel(e.to)}: ${e.weight}` }));

  let mstCost  = 0;
  let edgeCnt  = 0;

  sorted.forEach(edge => {
    steps.push({ log: `Kenar ${getLabel(edge.from)}—${getLabel(edge.to)} (${edge.weight}) deneniyor`, activeEdge: edge.id });

    if (union(edge.from, edge.to)) {
      // Döngü oluşturmadı → MST'ye ekle
      mstCost += edge.weight;
      edgeCnt++;
      steps.push({
        log: `✓ Eklendi (döngü yok)`, logType: 'highlight',
        mstEdge: edge.id, mstNodes: [edge.from, edge.to]
      });
      if (edgeCnt === nodes.length - 1)
        steps.push({ log: `MST tamamlandı! (${nodes.length-1} kenar)`, logType: 'highlight' });
    } else {
      // Döngü oluşturdu → atla
      steps.push({ log: `✗ Döngü oluşturur, atlandı`, deactivateEdge: edge.id });
    }
  });

  steps.push({
    log: `Toplam MST maliyeti: ${mstCost}`, logType: 'highlight',
    result: `<strong>MST Tamamlandı</strong><br>Kenar sayısı: ${edgeCnt}<br>Toplam maliyet: <span class="cost">${mstCost}</span>`
  });
  return steps;
}

// ---- Yardımcılar ----

// yeşil path adımlarını steps'e ekler.
function buildPathSteps(steps, dist, prev, visited) {
  if (endNode === null) {
    // Bitiş yok, tüm mesafeleri göster
    const resultStr = nodes.map(n => `${getLabel(n.id)}: ${dist[n.id] === Infinity ? '∞' : dist[n.id]}`).join('<br>');
    steps.push({
      log: 'Tüm düğümler işlendi.', logType: 'highlight',
      distances: {...dist }, prev: {...prev },
      result: `<strong>Mesafeler:</strong><br>${resultStr}`
    });
    return;
  }

  if (dist[endNode] === Infinity) {
    steps.push({
      log: `${getLabel(endNode)} düğümüne ulaşılamadı!`, logType: 'warn',
      result: `<strong>Sonuç:</strong><br>Bitiş düğümüne<br>ulaşılamadı.`
    });
    return;
  }

  // Bitiş'ten geriye doğru yolu izle
  const pathNodes = [], pathEdges = [];
  let cur = endNode;
  while (cur !== null) {
    pathNodes.push(cur);
    if (prev[cur] !== null) {
      const e = findEdgeBetween(prev[cur], cur);
      if (e) pathEdges.push(e.id);
    }
    cur = prev[cur];
  }
  pathNodes.reverse(); pathEdges.reverse();

  steps.push({
    log: `En kısa yol: ${pathNodes.map(getLabel).join(' → ')}`, logType: 'highlight',
    pathNodes, pathEdges,
    distances: { ...dist }, prev: { ...prev }, visited,
    result: `<strong>En Kısa Yol:</strong><br>${pathNodes.map(getLabel).join(' → ')}<br><br>Toplam maliyet: <span class="cost">${dist[endNode]}</span>`
  });
}

function findEdgeBetween(u, v) {
  return edges.find(e =>
    //u'dan v'ye giden kenarı bul
    (e.from === u && e.to === v) ||
    (!directed && e.from === v && e.to === u)
  );
}

// Bir düğümün komşularını döndür  { to, weight, edgeId }
function getNeighbors(nodeId) {
  const result = [];
  edges.forEach(e => {
    if (e.from === nodeId) result.push({ to: e.to,   weight: e.weight, edgeId: e.id });
    if (!directed && e.to === nodeId) result.push({ to: e.from, weight: e.weight, edgeId: e.id });
  });
  return result;
}


// Düğüm id'sinden label döndürür.
function getLabel(id) {
  return nodes.find(n => n.id === id)?.label || '?';
}


function loadPreset(type) {
  clearAll();
  const W = svg.clientWidth  || 800;
  const H = svg.clientHeight || 500;
  const cx = W / 2, cy = H / 2;

  updateStatus();
}


// Preset yükleyici için iç yardımcı — edges'e direkt ekler + çizer.

function addEdge(from, to, weight) {
  const id = `e${from}-${to}-${Date.now()}-${Math.random().toString(36).slice(2,5)}`;
  const reverse = edges.find(e => e.from === to && e.to === from);
  
  let sign = 1;
  if (reverse) sign = -reverse.offsetSign;
  
  edges.push({
    id,
    from,
    to,
    weight,
    offsetSign: sign
  });
}

document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return; // input odaklanmışsa kısayolları engelle
  const map = { n:'node', e:'edge', s:'start', t:'end', m:'move', d:'delete' };
  if (map[e.key]) setMode(map[e.key]);
  if (e.key === 'r') runAlgorithm();
  if (e.key === 'Escape') resetVisualization();
  if (e.key === 'ArrowRight') stepNext();
  if (e.key === 'ArrowLeft')  stepPrev();
});


document.querySelectorAll('.algo-tab').forEach(tab => {
  const tooltip = document.getElementById('algoTooltip');

  tab.addEventListener('mouseenter', () => {
    const a    = tab.getAttribute('data-algo');
    const rect = tab.getBoundingClientRect();

    tooltip.innerHTML = algoInfoMap[a];

    let left = rect.left;
    if (left + 260 > window.innerWidth) left = window.innerWidth - 270;

    tooltip.style.left = left + 'px';
    tooltip.classList.add('visible');
  });

  tab.addEventListener('mouseleave', () => {
    tooltip.classList.remove('visible');
  });
});

addLog('Hoş geldiniz! Canvas\'a tıklayarak düğüm ekleyin.', '');
addLog('Kısayollar: N E S T M D = modlar | R = çalıştır | ← → = adım', '');
