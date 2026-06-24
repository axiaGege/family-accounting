// ================================================================
//  数据层 - IndexedDB
// ================================================================
let db;
const DB_NAME = 'WorkDB';
const STORE_WORK = 'workList';
const STORE_BRAND = 'brandList';

function initDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 2);
    req.onupgradeneeded = e => {
      const d = e.target.result;
      if (!d.objectStoreNames.contains(STORE_WORK)) {
        d.createObjectStore(STORE_WORK, { keyPath: 'id', autoIncrement: true });
      }
      if (!d.objectStoreNames.contains(STORE_BRAND)) {
        const bs = d.createObjectStore(STORE_BRAND, { keyPath: 'id', autoIncrement: true });
        bs.createIndex('name', 'name', { unique: true });
      }
    };
    req.onsuccess = e => { db = e.target.result; resolve(db); };
    req.onerror = e => reject(e);
  });
}

function dbAdd(store, data) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, 'readwrite');
    const req = t.objectStore(store).add(data);
    req.onsuccess = e => resolve(e.target.result);
    req.onerror = e => reject(e);
  });
}
function dbPut(store, data) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, 'readwrite');
    const req = t.objectStore(store).put(data);
    req.onsuccess = () => resolve();
    req.onerror = e => reject(e);
  });
}
function dbDel(store, id) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, 'readwrite');
    const req = t.objectStore(store).delete(id);
    req.onsuccess = () => resolve();
    req.onerror = e => reject(e);
  });
}
function dbGetAll(store) {
  return new Promise((resolve, reject) => {
    const arr = [];
    const t = db.transaction(store, 'readonly');
    const req = t.objectStore(store).openCursor();
    req.onsuccess = e => {
      const cur = e.target.result;
      if (cur) { arr.push(cur.value); cur.continue(); } else resolve(arr);
    };
    req.onerror = e => reject(e);
  });
}

// ================================================================
//  全局状态
// ================================================================
let brandList = [];
let currentDate = new Date();
let editingId = null;
let selectedType = 'piece';
let selectedShift = '早班';
let chartInstance = null;

// DOM 引用
const $ = id => document.getElementById(id);
const currentDateSpan = $('currentDate');
const prevDayBtn = $('prevDay');
const nextDayBtn = $('nextDay');
const headerSummary = $('headerSummary');
const todayDate = $('todayDate');
const todaySummary = $('todaySummary');
const recordList = $('recordList');

const modal = $('addModal');
const modalTitle = $('modalTitle');
const brandSelect = $('brandSelect');
const typeToggle = $('typeToggle');
const quantityLabel = $('quantityLabel');
const quantityInput = $('quantityInput');
const shiftSelector = $('shiftSelector');
const workDate = $('workDate');
const noteInput = $('noteInput');
const saveBtn = $('saveRecordBtn');
const deleteBtn = $('deleteRecordBtn');
const showAddBtn = $('showAddBtn');
const timerBtn = $('timerBtn');

const timerOverlay = $('timerOverlay');
const timerDisplay = $('timerDisplay');
const timerStartPause = $('timerStartPause');
const timerStop = $('timerStop');
const timerClose = $('timerClose');

const statPeriodBtns = document.querySelectorAll('.stat-period button');
const statsContainer = $('statsContainer');
const statsOverview = $('statsOverview');
const statChartCanvas = $('statChart');

const brandListDom = $('brandList');
const newBrandInput = $('newBrandInput');
const addBrandBtn = $('addBrandBtn');
const exportBtn = $('exportBtn');
const importBtn = $('importBtn');
const fileInput = $('fileInput');
const clearBtn = $('clearBtn');

// ================================================================
//  工具函数
// ================================================================
function formatDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2,'0');
  const day = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}
function formatDateDisplay(d) {
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return '今天';
  const yesterday = new Date(today); yesterday.setDate(today.getDate()-1);
  if (d.toDateString() === yesterday.toDateString()) return '昨天';
  return `${d.getMonth()+1}月${d.getDate()}日`;
}
function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h${m}m`;
  return `${m}m`;
}
function formatTimeShort(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}
function getDayStart(d) {
  const copy = new Date(d);
  copy.setHours(0,0,0,0);
  return copy.getTime();
}
function getDayEnd(d) {
  const copy = new Date(d);
  copy.setHours(23,59,59,999);
  return copy.getTime();
}
function getWeekStart(d) {
  const copy = new Date(d);
  const day = copy.getDay() || 7;
  copy.setDate(copy.getDate() - day + 1);
  copy.setHours(0,0,0,0);
  return copy;
}
function getMonthStart(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function getDayOfWeek(d) {
  const weekdays = ['日','一','二','三','四','五','六'];
  return '周' + weekdays[d.getDay()];
}

// ================================================================
//  品牌管理
// ================================================================
async function loadBrands() {
  brandList = await dbGetAll(STORE_BRAND);
  if (brandList.length === 0) {
    await dbAdd(STORE_BRAND, { name: 'A品牌' });
    await dbAdd(STORE_BRAND, { name: 'B品牌' });
    await dbAdd(STORE_BRAND, { name: 'C品牌' });
    brandList = await dbGetAll(STORE_BRAND);
  }
}
function renderBrandSelect() {
  brandSelect.innerHTML = '';
  if (brandList.length === 0) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = '请添加品牌';
    brandSelect.appendChild(opt);
    return;
  }
  brandList.forEach(b => {
    const opt = document.createElement('option');
    opt.value = b.name;
    opt.textContent = b.name;
    brandSelect.appendChild(opt);
  });
  brandSelect.value = brandList[0].name;
}
function renderBrandList() {
  brandListDom.innerHTML = '';
  brandList.forEach(b => {
    const tag = document.createElement('span');
    tag.className = 'brand-tag';
    tag.innerHTML = `${b.name} <span class="del-btn" data-id="${b.id}">✕</span>`;
    brandListDom.appendChild(tag);
  });
  brandListDom.querySelectorAll('.del-btn').forEach(btn => {
    const delHandler = async (e) => {
      e.stopPropagation();
      const id = Number(btn.dataset.id);
      if (brandList.length <= 1) { alert('至少保留一个品牌'); return; }
      const brandName = btn.parentElement.textContent.trim().replace('✕', '');
      const all = await dbGetAll(STORE_WORK);
      const used = all.some(r => r.brand === brandName);
      if (used && !confirm(`品牌“${brandName}”已有记录，删除后记录将显示为“未命名”，确定？`)) return;
      if (!used && !confirm(`确定删除品牌“${brandName}”？`)) return;
      await dbDel(STORE_BRAND, id);
      await loadBrands();
      renderBrandSelect();
      renderBrandList();
      refreshAll();
    };
    btn.addEventListener('click', delHandler);
    btn.addEventListener('touchstart', delHandler);
  });
}
async function addBrand() {
  const name = newBrandInput.value.trim();
  if (!name) { alert('请输入品牌名'); return; }
  if (brandList.some(b => b.name === name)) { alert('品牌已存在'); return; }
  await dbAdd(STORE_BRAND, { name });
  newBrandInput.value = '';
  await loadBrands();
  renderBrandSelect();
  renderBrandList();
  refreshAll();
}
addBrandBtn.addEventListener('click', addBrand);
newBrandInput.addEventListener('keyup', e => { if (e.key === 'Enter') addBrand(); });

// ================================================================
//  核心渲染 - 首页
// ================================================================
async function renderHome() {
  const dateStr = formatDate(currentDate);
  todayDate.textContent = dateStr;
  const all = await dbGetAll(STORE_WORK);
  const dayRecords = all.filter(r => r.date === dateStr);

  const shifts = { '早班': { piece: 0, time: 0 }, '中班': { piece: 0, time: 0 }, '晚班': { piece: 0, time: 0 } };
  dayRecords.forEach(r => {
    const s = shifts[r.shift];
    if (s) {
      if (r.type === 'piece') s.piece += r.quantity;
      else s.time += r.duration;
    }
  });
  let sumHtml = '';
  for (const [shift, data] of Object.entries(shifts)) {
    sumHtml += `<div class="stat-item"><b>${shift}</b>：计件 ${data.piece} 件 · 计时 ${data.time.toFixed(2)} 小时</div>`;
  }
  todaySummary.innerHTML = sumHtml || '<div class="empty-state">今日暂无记录</div>';

  const totalPiece = dayRecords.filter(r => r.type === 'piece').reduce((s, r) => s + r.quantity, 0);
  const totalTime = dayRecords.filter(r => r.type === 'time').reduce((s, r) => s + r.duration, 0);
  headerSummary.textContent = `今日 ${totalPiece}件 · ${totalTime.toFixed(2)}h`;
  currentDateSpan.textContent = formatDateDisplay(currentDate);

  if (dayRecords.length === 0) {
    recordList.innerHTML = '<div class="empty-state"><div class="big-icon">📋</div>暂无记录</div>';
  } else {
    const sorted = [...dayRecords].sort((a,b) => b.id - a.id);
    let html = '';
    sorted.forEach(r => {
      const brand = r.brand || '未命名';
      const typeLabel = r.type === 'piece' ? '计件' : '计时';
      const value = r.type === 'piece' ? `${r.quantity}件` : `${r.duration.toFixed(2)}h`;
      const cls = r.type === 'piece' ? 'piece' : 'time';
      html += `
        <div class="record-item" data-id="${r.id}">
          <div class="left">
            <span class="brand-badge">${brand}</span>
            <div class="info">
              <div class="type-label">${typeLabel}</div>
              <div class="meta">${r.shift}${r.remark ? ' · '+r.remark : ''}</div>
            </div>
          </div>
          <div class="right"><span class="${cls}">${value}</span></div>
        </div>
      `;
    });
    recordList.innerHTML = html;

    recordList.querySelectorAll('.record-item').forEach(el => {
      const id = Number(el.dataset.id);
      el.addEventListener('click', () => openEditModal(id));
      let startX = 0;
      el.addEventListener('touchstart', e => { startX = e.touches[0].clientX; });
      el.addEventListener('touchend', async e => {
        const endX = e.changedTouches[0].clientX;
        if (startX - endX > 60) {
          if (confirm('删除此记录？')) {
            await dbDel(STORE_WORK, id);
            refreshAll();
          }
        }
      });
    });
  }
}

// ================================================================
//  统计页
// ================================================================
let currentStatPeriod = 'week';

async function renderStats() {
  const now = new Date();
  let startDate, endDate;
  if (currentStatPeriod === 'week') {
    startDate = getWeekStart(now);
    endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 6);
  } else {
    startDate = getMonthStart(now);
    endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 1);
    endDate.setDate(0);
  }
  const sStr = formatDate(startDate);
  const eStr = formatDate(endDate);
  const all = await dbGetAll(STORE_WORK);
  const periodRecords = all.filter(r => r.date >= sStr && r.date <= eStr);

  if (periodRecords.length === 0) {
    statsContainer.innerHTML = '<div class="stat-empty">该周期暂无记录</div>';
    statsOverview.style.display = 'none';
    if (chartInstance) { chartInstance.destroy(); chartInstance = null; }
    return;
  }

  const dayMap = {};
  periodRecords.forEach(r => {
    if (!dayMap[r.date]) dayMap[r.date] = { date: r.date, records: [], piece: 0, time: 0 };
    dayMap[r.date].records.push(r);
    if (r.type === 'piece') dayMap[r.date].piece += r.quantity;
    else dayMap[r.date].time += r.duration;
  });
  const sortedKeys = Object.keys(dayMap).sort();
  let html = '';
  sortedKeys.forEach(key => {
    const data = dayMap[key];
    const d = new Date(key + 'T00:00:00');
    const display = `${d.getMonth()+1}月${d.getDate()}日`;
    const weekday = getDayOfWeek(d);
    let detailHtml = '';
    const sortedRecs = data.records.sort((a,b) => b.id - a.id);
    sortedRecs.forEach(r => {
      const brand = r.brand || '未命名';
      const typeLabel = r.type === 'piece' ? '计件' : '计时';
      const value = r.type === 'piece' ? `${r.quantity}件` : `${r.duration.toFixed(2)}h`;
      const cls = r.type === 'piece' ? 'piece' : 'time';
      detailHtml += `
        <div class="record-item" data-id="${r.id}" style="margin-bottom:6px;">
          <div class="left">
            <span class="brand-badge">${brand}</span>
            <div class="info">
              <div class="type-label">${typeLabel}</div>
              <div class="meta">${r.shift}${r.remark ? ' · '+r.remark : ''}</div>
            </div>
          </div>
          <div class="right"><span class="${cls}">${value}</span></div>
        </div>
      `;
    });
    html += `
      <div class="stat-day-card" data-date="${key}">
        <div class="stat-day-header">
          <div class="date-label">${display} <span class="weekday">${weekday}</span></div>
          <div class="day-totals">
            <span class="piece">${data.piece}件</span> · 
            <span class="time">${data.time.toFixed(2)}h</span>
            <span class="text-muted" style="font-size:12px;margin-left:6px;">(${data.records.length}条)</span>
            <span class="arrow">▼</span>
          </div>
        </div>
        <div class="stat-day-detail">${detailHtml}</div>
      </div>
    `;
  });
  statsContainer.innerHTML = html;

  statsContainer.querySelectorAll('.stat-day-card').forEach(card => {
    const header = card.querySelector('.stat-day-header');
    const detail = card.querySelector('.stat-day-detail');
    const arrow = header.querySelector('.arrow');
    header.addEventListener('click', function(e) {
      if (e.target.closest('.record-item')) return;
      const isOpen = detail.classList.toggle('open');
      arrow.classList.toggle('open', isOpen);
    });
    detail.querySelectorAll('.record-item').forEach(item => {
      const id = Number(item.dataset.id);
      item.addEventListener('click', () => openEditModal(id));
      let startX = 0;
      item.addEventListener('touchstart', e => { startX = e.touches[0].clientX; });
      item.addEventListener('touchend', async e => {
        const endX = e.changedTouches[0].clientX;
        if (startX - endX > 60) {
          if (confirm('删除此记录？')) {
            await dbDel(STORE_WORK, id);
            refreshAll();
          }
        }
      });
    });
  });

  const totalPiece = periodRecords.filter(r => r.type === 'piece').reduce((s, r) => s + r.quantity, 0);
  const totalTime = periodRecords.filter(r => r.type === 'time').reduce((s, r) => s + r.duration, 0);
  statsOverview.style.display = 'flex';
  statsOverview.innerHTML = `
    <div class="item"><div class="num">${periodRecords.length}</div><div class="label">记录数</div></div>
    <div class="item"><div class="num" style="color:#007aff;">${totalPiece}</div><div class="label">计件总数</div></div>
    <div class="item"><div class="num" style="color:#e67e22;">${totalTime.toFixed(2)}h</div><div class="label">计时总长</div></div>
  `;

  const brandMap = {};
  brandList.forEach(b => brandMap[b.name] = { piece: 0, time: 0 });
  periodRecords.forEach(r => {
    const b = brandMap[r.brand];
    if (b) {
      if (r.type === 'piece') b.piece += r.quantity;
      else b.time += r.duration;
    }
  });
  const labels = Object.keys(brandMap);
  const pieceData = labels.map(k => brandMap[k].piece);
  const timeData = labels.map(k => brandMap[k].time);

  if (chartInstance) chartInstance.destroy();
  const ctx = statChartCanvas.getContext('2d');
  chartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: '计件总数', data: pieceData, backgroundColor: 'rgba(0,122,255,0.7)', borderRadius: 4 },
        { label: '计时总时(h)', data: timeData, backgroundColor: 'rgba(230,126,34,0.7)', borderRadius: 4 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: true, position: 'top' } },
      scales: { y: { beginAtZero: true } }
    }
  });
}

// ================================================================
//  模态框逻辑
// ================================================================
async function openEditModal(id) {
  const all = await dbGetAll(STORE_WORK);
  const rec = all.find(r => r.id === id);
  if (!rec) return;
  editingId = id;
  modalTitle.textContent = '✏️ 编辑记录';
  deleteBtn.style.display = 'block';

  await loadBrands();
  renderBrandSelect();
  brandSelect.value = rec.brand || brandList[0]?.name || '';
  selectedType = rec.type;
  typeToggle.querySelectorAll('button').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.type === selectedType);
  });
  toggleQuantityLabel();
  if (rec.type === 'piece') quantityInput.value = rec.quantity;
  else quantityInput.value = rec.duration.toFixed(2);
  selectedShift = rec.shift || '早班';
  shiftSelector.querySelectorAll('button').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.shift === selectedShift);
  });
  workDate.value = rec.date;
  noteInput.value = rec.remark || '';
  modal.classList.add('show');
  document.getElementById('bottomNav').classList.add('hidden');
  setTimeout(() => quantityInput.focus(), 300);
}

function openAddModal() {
  editingId = null;
  modalTitle.textContent = '✏️ 新增记录';
  deleteBtn.style.display = 'none';
  if (brandList.length > 0) {
    renderBrandSelect();
    brandSelect.value = brandList[0].name;
  } else {
    loadBrands().then(() => {
      renderBrandSelect();
      brandSelect.value = brandList[0]?.name || '';
    });
  }
  selectedType = 'piece';
  typeToggle.querySelectorAll('button').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.type === selectedType);
  });
  toggleQuantityLabel();
  quantityInput.value = '';
  selectedShift = '早班';
  shiftSelector.querySelectorAll('button').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.shift === selectedShift);
  });
  workDate.value = formatDate(currentDate);
  noteInput.value = '';
  modal.classList.add('show');
  document.getElementById('bottomNav').classList.add('hidden');
  setTimeout(() => quantityInput.focus(), 300);
}

function closeModal() {
  modal.classList.remove('show');
  document.getElementById('bottomNav').classList.remove('hidden');
  editingId = null;
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; timerRunning = false; timerBtn.textContent = '⏱️'; }
}

function toggleQuantityLabel() {
  if (selectedType === 'piece') {
    quantityLabel.textContent = '数量';
    quantityInput.placeholder = '0';
  } else {
    quantityLabel.textContent = '时长（小时）';
    quantityInput.placeholder = '0.0';
  }
}

typeToggle.addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn || btn.dataset.type === selectedType) return;
  selectedType = btn.dataset.type;
  typeToggle.querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.type === selectedType));
  toggleQuantityLabel();
  quantityInput.value = '';
});

shiftSelector.addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  shiftSelector.querySelectorAll('button').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  selectedShift = btn.dataset.shift;
});

saveBtn.addEventListener('click', async () => {
  try {
    if (brandList.length === 0) {
      await loadBrands();
      renderBrandSelect();
    }
    const brand = brandSelect.value;
    if (!brand) { alert('请选择一个品牌'); return; }
    const rawVal = quantityInput.value.trim();
    if (!rawVal || isNaN(rawVal) || parseFloat(rawVal) <= 0) {
      alert('请输入有效的正数');
      return;
    }
    const val = parseFloat(rawVal);
    const date = workDate.value;
    if (!date) { alert('请选择日期'); return; }
    const shift = selectedShift;
    const remark = noteInput.value.trim();

    const record = { brand, type: selectedType, shift, date, remark };
    if (selectedType === 'piece') record.quantity = val;
    else record.duration = val;

    if (editingId) {
      record.id = editingId;
      await dbPut(STORE_WORK, record);
    } else {
      await dbAdd(STORE_WORK, record);
    }
    closeModal();
    refreshAll();
    alert('保存成功！');
  } catch (err) {
    alert('保存失败：' + err.message);
  }
});

deleteBtn.addEventListener('click', async () => {
  if (!editingId) return;
  if (confirm('确定删除此记录？')) {
    await dbDel(STORE_WORK, editingId);
    closeModal();
    refreshAll();
  }
});

// ================================================================
//  计时器
// ================================================================
let timerSeconds = 0;
let timerInterval = null;
let timerRunning = false;

timerBtn.addEventListener('click', () => {
  timerSeconds = 0;
  timerDisplay.textContent = '00:00';
  timerStartPause.textContent = '▶';
  timerRunning = false;
  timerOverlay.classList.add('show');
});

timerStartPause.addEventListener('click', () => {
  if (!timerRunning) {
    timerRunning = true;
    timerStartPause.textContent = '⏸';
    timerInterval = setInterval(() => {
      timerSeconds++;
      timerDisplay.textContent = formatTimeShort(timerSeconds);
    }, 1000);
  } else {
    timerRunning = false;
    timerStartPause.textContent = '▶';
    clearInterval(timerInterval);
    timerInterval = null;
  }
});

timerStop.addEventListener('click', () => {
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
  timerRunning = false;
  timerStartPause.textContent = '▶';
  const hours = timerSeconds / 3600;
  if (hours > 0) {
    quantityInput.value = hours.toFixed(2);
  } else {
    alert('计时至少1秒才可保存');
  }
  timerOverlay.classList.remove('show');
});

timerClose.addEventListener('click', () => {
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
  timerRunning = false;
  timerOverlay.classList.remove('show');
});

// ================================================================
//  日期导航
// ================================================================
prevDayBtn.addEventListener('click', () => {
  currentDate.setDate(currentDate.getDate() - 1);
  refreshAll();
});
nextDayBtn.addEventListener('click', () => {
  const today = new Date();
  const next = new Date(currentDate);
  next.setDate(next.getDate() + 1);
  if (next > today) { alert('不能查看未来日期'); return; }
  currentDate = next;
  refreshAll();
});

// ================================================================
//  导航切换
// ================================================================
document.querySelectorAll('.nav-item[data-page]').forEach(btn => {
  btn.addEventListener('click', function() {
    const page = this.dataset.page;
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-' + page).classList.add('active');
    document.querySelectorAll('.nav-item[data-page]').forEach(b => b.classList.remove('active'));
    this.classList.add('active');
    if (page === 'stats') renderStats();
    if (page === 'home') renderHome();
  });
});

// ================================================================
//  统计周期切换
// ================================================================
statPeriodBtns.forEach(btn => {
  btn.addEventListener('click', function() {
    statPeriodBtns.forEach(b => b.classList.remove('active'));
    this.classList.add('active');
    currentStatPeriod = this.dataset.period;
    renderStats();
  });
});

// ================================================================
//  设置 - 导入导出清除
// ================================================================
exportBtn.addEventListener('click', async () => {
  const records = await dbGetAll(STORE_WORK);
  const brands = await dbGetAll(STORE_BRAND);
  const data = { records, brands };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `工作记录_${formatDate(new Date())}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

importBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', function(e) {
  const file = this.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (ev) => {
    try {
      const data = JSON.parse(ev.target.result);
      if (!data.records || !data.brands) { alert('文件格式不正确'); return; }
      if (!confirm('导入将覆盖当前所有数据，确认？')) return;
      const allWork = await dbGetAll(STORE_WORK);
      for (const r of allWork) await dbDel(STORE_WORK, r.id);
      const allBrand = await dbGetAll(STORE_BRAND);
      for (const b of allBrand) await dbDel(STORE_BRAND, b.id);
      for (const r of data.records) {
        await dbAdd(STORE_WORK, r);
      }
      for (const b of data.brands) {
        await dbAdd(STORE_BRAND, b);
      }
      await loadBrands();
      renderBrandSelect();
      renderBrandList();
      refreshAll();
      alert('导入成功！');
    } catch (err) { alert('文件解析失败：' + err.message); }
  };
  reader.readAsText(file);
  this.value = '';
});

clearBtn.addEventListener('click', async () => {
  if (!confirm('⚠️ 确定清除所有数据吗？不可恢复！')) return;
  const allWork = await dbGetAll(STORE_WORK);
  for (const r of allWork) await dbDel(STORE_WORK, r.id);
  const allBrand = await dbGetAll(STORE_BRAND);
  for (const b of allBrand) await dbDel(STORE_BRAND, b.id);
  await dbAdd(STORE_BRAND, { name: 'A品牌' });
  await dbAdd(STORE_BRAND, { name: 'B品牌' });
  await dbAdd(STORE_BRAND, { name: 'C品牌' });
  await loadBrands();
  renderBrandSelect();
  renderBrandList();
  refreshAll();
  alert('已清除');
});

// ================================================================
//  iOS 键盘处理
// ================================================================
const bottomNav = document.getElementById('bottomNav');
document.querySelectorAll('input, select').forEach(el => {
  el.addEventListener('focus', () => bottomNav.classList.add('hidden'));
  el.addEventListener('blur', () => {
    setTimeout(() => {
      if (!modal.classList.contains('show') && !timerOverlay.classList.contains('show')) {
        bottomNav.classList.remove('hidden');
      }
    }, 200);
  });
});

modal.addEventListener('click', function(e) {
  if (e.target === this) closeModal();
});
timerOverlay.addEventListener('click', function(e) {
  if (e.target === this) {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
    timerRunning = false;
    timerOverlay.classList.remove('show');
  }
});

showAddBtn.addEventListener('click', openAddModal);

// ================================================================
//  刷新全部
// ================================================================
function refreshAll() {
  renderHome();
  if (document.getElementById('page-stats').classList.contains('active')) renderStats();
}

// ================================================================
//  启动
// ================================================================
(async function init() {
  await initDB();
  await loadBrands();
  renderBrandSelect();
  renderBrandList();
  const works = await dbGetAll(STORE_WORK);
  if (works.length === 0) {
    const today = formatDate(new Date());
    await dbAdd(STORE_WORK, { date: today, shift: '早班', brand: 'A品牌', type: 'piece', quantity: 5, remark: '上午' });
    await dbAdd(STORE_WORK, { date: today, shift: '中班', brand: 'B品牌', type: 'time', duration: 2.5, remark: '下午' });
  }
  renderHome();
  document.querySelector('.nav-item[data-page="stats"]').addEventListener('click', renderStats);
})();
