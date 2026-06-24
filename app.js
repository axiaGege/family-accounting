// ===== 密码验证（明文对比，稳定可靠） =====
(function() {
    var loginModal = document.getElementById('loginModal');
    var loginInput = document.getElementById('loginPassword');
    var loginError = document.getElementById('loginError');

    if (localStorage.getItem('pw_logged_in') === 'true') {
        loginModal.classList.remove('active');
        if (typeof initApp === 'function') { initApp(); }
        return;
    }

    loginModal.classList.add('active');

    window.checkPassword = function() {
        var input = loginInput.value.trim();
        if (input === '520118') {
            localStorage.setItem('pw_logged_in', 'true');
            loginModal.classList.remove('active');
            if (typeof initApp === 'function') { initApp(); }
        } else {
            loginError.style.display = 'block';
            loginError.textContent = '密码错误，请重试';
            loginInput.value = '';
            loginInput.focus();
            setTimeout(function() { loginError.style.display = 'none'; }, 2000);
        }
    };

    loginInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            checkPassword();
        }
    });

    var loginBtn = document.querySelector('#loginModal .btn-primary');
    if (loginBtn) { loginBtn.onclick = function() { checkPassword(); }; }
    loginInput.focus();
})();

// ===== 应用核心代码 =====
var records = [];
var brands = [];
var currentMode = 'piece';
var selectedTime = '早上';
var selectedBrand = '';
var currentMonth = new Date();
var currentWeekStart = getMonday(new Date());
var editingId = null;
var addBtnLocked = false;

function migrateBrands(raw) {
    if (!Array.isArray(raw)) return [{name:'品牌A'},{name:'品牌B'},{name:'品牌C'}];
    return raw.map(function(b) {
        if (typeof b === 'string') return {name: b};
        if (b && typeof b === 'object' && b.name) return b;
        return null;
    }).filter(function(x){return x;});
}

function migrateRecords(raw) {
    if (!Array.isArray(raw)) return [];
    return raw.map(function(r) {
        if (r && !r.mode) r.mode = 'piece';
        if (r.mode === 'rest' && !r.hours) r.hours = 4;
        // 兼容旧版时段名
        if (r.time === '早') r.time = '早上';
        if (r.time === '中') r.time = '下午';
        if (r.time === '晚') r.time = '晚上';
        return r;
    });
}

function loadData() {
    try {
        var rawR = JSON.parse(localStorage.getItem('pw_records') || '[]');
        var rawB = JSON.parse(localStorage.getItem('pw_brands') || '[]');
        records = migrateRecords(rawR);
        brands = migrateBrands(rawB);
    } catch (e) {
        records = [];
        brands = [{name:'品牌A'},{name:'品牌B'},{name:'品牌C'}];
    }
}

function saveData() {
    localStorage.setItem('pw_records', JSON.stringify(records));
    localStorage.setItem('pw_brands', JSON.stringify(brands));
}

function getBrandObj(name) {
    for (var i = 0; i < brands.length; i++) {
        if (brands[i].name === name) return brands[i];
    }
    var obj = {name: name};
    brands.push(obj);
    return obj;
}

function today() { return new Date().toISOString().split('T')[0]; }

function getMonday(d) {
    var day = d.getDay();
    var diff = d.getDate() - day + (day === 0 ? -6 : 1);
    var mon = new Date(d);
    mon.setDate(diff);
    mon.setHours(0,0,0,0);
    return mon;
}

function formatDate(d) { return d.toISOString().split('T')[0]; }

function weekdayName(i) { return ['一','二','三','四','五','六','日'][i]; }

function escapeHtml(s) {
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
}

function showToast(msg, type) {
    var t = document.getElementById('toast');
    t.textContent = msg;
    t.className = 'toast ' + (type || 'success') + ' show';
    setTimeout(function() { t.className = 'toast'; }, 2200);
}

function switchMode(mode) {
    currentMode = mode;
    document.getElementById('modePieceBtn').classList.toggle('active', mode === 'piece');
    document.getElementById('modeHourBtn').classList.toggle('active', mode === 'hour');
    document.getElementById('modeRestBtn').classList.toggle('active', mode === 'rest');
    document.getElementById('pieceFields').classList.toggle('hidden', mode !== 'piece');
    document.getElementById('hourFields').classList.toggle('hidden', mode !== 'hour');
    document.getElementById('restFields').classList.toggle('hidden', mode !== 'rest');
}

window.setRestHours = function(h) {
    document.getElementById('restHoursInput').value = h;
};

function initApp() {
    loadData();
    if (brands.length === 0) {
        brands = [{name:'品牌A'},{name:'品牌B'},{name:'品牌C'}];
    }
    var dateInput = document.getElementById('recordDateInput');
    if (dateInput) dateInput.value = today();
    renderAll();

    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('time-pill') && !e.target.closest('#editTimePills')) {
            var pills = document.querySelectorAll('.time-pills:not(#editTimePills) .time-pill');
            for (var i = 0; i < pills.length; i++) pills[i].classList.remove('active');
            e.target.classList.add('active');
            selectedTime = e.target.getAttribute('data-time');
        }
        if (e.target.classList.contains('time-pill') && e.target.closest('#editTimePills')) {
            var pills2 = document.querySelectorAll('#editTimePills .time-pill');
            for (var i = 0; i < pills2.length; i++) pills2[i].classList.remove('active');
            e.target.classList.add('active');
        }
    });

    document.addEventListener('change', function(e) {
        if (e.target.id === 'recordDateInput') {
            renderTodayRecords();
            if (e.target.value === today()) {
                updateHomeStats();
            } else {
                updateDateStats(e.target.value);
            }
        }
    });
}

function renderAll() {
    updateDate();
    renderBrandChips();
    renderTodayRecords();
    updateHomeStats();
    renderBrandManageList();
}

function updateDate() {
    var d = new Date();
    var week = ['日','一','二','三','四','五','六'];
    document.getElementById('currentDate').textContent =
        d.getFullYear() + '年' + (d.getMonth()+1) + '月' + d.getDate() + '日 周' + week[d.getDay()];
}

function switchPage(page, btn) {
    var pages = document.querySelectorAll('.page');
    for (var i = 0; i < pages.length; i++) pages[i].classList.remove('active');
    var tabs = document.querySelectorAll('.tab-btn');
    for (var i = 0; i < tabs.length; i++) tabs[i].classList.remove('active');
    document.getElementById('page-' + page).classList.add('active');
    btn.classList.add('active');
    if (page === 'stats') { renderMonthStats(); renderWeekStats(); }
    if (page === 'settings') renderBrandManageList();
}

function renderBrandChips() {
    var c = document.getElementById('brandChips');
    c.innerHTML = '';
    var freq = {};
    records.forEach(function(r) { if (r.mode !== 'hour' && r.mode !== 'rest') freq[r.brand] = (freq[r.brand]||0) + r.quantity; });
    var sorted = brands.slice();
    sorted.sort(function(a,b) { return (freq[b.name]||0) - (freq[a.name]||0); });
    sorted.forEach(function(b) {
        var name = b.name;
        var el = document.createElement('div');
        el.className = 'brand-chip' + (selectedBrand === name ? ' active' : '');
        el.textContent = name;
        el.onclick = function(n) { return function() {
            selectedBrand = (selectedBrand === n) ? '' : n;
            document.getElementById('brandInput').value = '';
            renderBrandChips();
        }; }(name);
        c.appendChild(el);
    });
}

window.addRecord = function() {
    if (addBtnLocked) return;
    var dateVal = document.getElementById('recordDateInput').value;
    if (!dateVal) { showToast('请选择日期','error'); return; }

    if (currentMode === 'piece') {
        var inputVal = document.getElementById('brandInput').value.trim();
        var brand = inputVal || selectedBrand;
        var qtyRaw = document.getElementById('qtyInput').value;
        var qty = parseInt(qtyRaw);
        if (!brand) { showToast('请选择或输入品牌','error'); return; }
        if (!qtyRaw || qty <= 0 || qty > 99999) { showToast('请输入有效数量','error'); return; }
        getBrandObj(brand);
        records.push({ id:Date.now(), date:dateVal, time:selectedTime, brand:brand, quantity:qty, mode:'piece', edited:false });
        showToast('计件记录已添加');
        document.getElementById('qtyInput').value = '';
        document.getElementById('brandInput').value = '';
    } else if (currentMode === 'hour') {
        var hoursRaw = document.getElementById('hoursInput').value;
        var note = document.getElementById('hourNoteInput').value.trim();
        var hours = parseFloat(hoursRaw);
        if (!hoursRaw || hours <= 0 || hours > 24) { showToast('请输入有效工时','error'); return; }
        records.push({ id:Date.now(), date:dateVal, time:selectedTime, mode:'hour', hours:hours, note:note, edited:false });
        showToast('计时记录已添加（' + hours + 'h）');
        document.getElementById('hoursInput').value = '';
        document.getElementById('hourNoteInput').value = '';
    } else if (currentMode === 'rest') {
        var restHoursRaw = document.getElementById('restHoursInput').value;
        var restNote = document.getElementById('restNoteInput').value.trim();
        var restHours = parseFloat(restHoursRaw);
        if (!restHoursRaw || restHours <= 0 || restHours > 24) { showToast('请输入有效休息时长','error'); return; }
        records.push({ id:Date.now(), date:dateVal, time:selectedTime, mode:'rest', hours:restHours, note:restNote, edited:false });
        showToast('休息记录已添加（' + restHours + 'h）');
        document.getElementById('restHoursInput').value = '';
        document.getElementById('restNoteInput').value = '';
    }

    saveData();
    addBtnLocked = true;
    setTimeout(function() { addBtnLocked = false; }, 500);
    renderAll();
};

function renderTodayRecords() {
    var dateVal = document.getElementById('recordDateInput').value || today();
    var label = dateVal === today() ? '今日记录' : (dateVal + ' 记录');
    document.getElementById('recordListTitle').textContent = label;

    var list = records.filter(function(r) { return r.date === dateVal; });
    var order = {'早上':0, '下午':1, '晚上':2};
    list.sort(function(a,b) {
        return (order[a.time]!=null?order[a.time]:9) - (order[b.time]!=null?order[b.time]:9) || b.id - a.id;
    });

    var el = document.getElementById('todayRecordList');
    if (list.length === 0) {
        el.innerHTML = '<div class="empty"><div class="empty-icon">📋</div><div>' + label + '暂无记录</div></div>';
        return;
    }
    el.innerHTML = '';
    list.forEach(function(r) {
        var isHour = r.mode === 'hour';
        var isRest = r.mode === 'rest';
        var qtyText = '', brandText = '', qtyClass = 'piece';
        if (isRest) {
            qtyText = r.hours + 'h';
            brandText = '🛌 休息' + (r.note ? ' · ' + r.note : '');
            qtyClass = 'rest';
        } else if (isHour) {
            qtyText = r.hours + 'h';
            brandText = '⏱️ 计时' + (r.note ? ' · ' + r.note : '');
            qtyClass = 'hour';
        } else {
            qtyText = r.quantity + '件';
            brandText = r.brand;
            qtyClass = 'piece';
        }
        var tc = r.time === '早上' ? 'morning' : r.time === '下午' ? 'noon' : 'evening';
        var row = document.createElement('div');
        row.className = 'record-row';
        row.innerHTML =
            '<div class="record-time-badge ' + tc + '">' + escapeHtml(r.time) + '</div>' +
            '<div class="record-center">' +
                '<div class="record-brand-name">' + escapeHtml(brandText) + '</div>' +
                '<div class="record-time-text">' + r.date + (r.edited ? ' *' : '') + '</div>' +
                '<span class="record-mode-tag ' + (isRest ? 'rest' : (isHour ? 'hour' : 'piece')) + '">' + (isRest ? '休息' : (isHour ? '计时' : '计件')) + '</span>' +
            '</div>' +
            '<div class="record-qty-area">' +
                '<div class="record-qty ' + qtyClass + '">' + qtyText + '</div>' +
            '</div>' +
            '<div class="record-actions">' +
                '<button class="record-action-btn" onclick="event.stopPropagation();editRecord(' + r.id + ')">✏</button>' +
                '<button class="record-action-btn" onclick="event.stopPropagation();deleteRecord(' + r.id + ')">✕</button>' +
            '</div>';
        row.onclick = function(rid) { return function() { editRecord(rid); }; }(r.id);
        el.appendChild(row);
    });
}

function deleteRecord(id) {
    if (!confirm('确定删除此记录？')) return;
    records = records.filter(function(r) { return r.id !== id; });
    saveData(); renderAll(); showToast('已删除');
}

function editRecord(id) {
    var r = null;
    for (var i = 0; i < records.length; i++) { if (records[i].id === id) { r = records[i]; break; } }
    if (!r) return;
    editingId = id;
    var isHour = r.mode === 'hour';
    var isRest = r.mode === 'rest';
    var modeLabel = isRest ? '休息模式' : (isHour ? '计时模式' : '计件模式');
    document.getElementById('editModeLabel').textContent = modeLabel;

    var pills = document.querySelectorAll('#editTimePills .time-pill');
    for (var i = 0; i < pills.length; i++) {
        pills[i].classList.toggle('active', pills[i].getAttribute('data-time') === r.time);
    }

    document.getElementById('editPieceField').classList.toggle('hidden', isHour || isRest);
    document.getElementById('editQtyField').classList.toggle('hidden', isHour || isRest);
    document.getElementById('editHoursField').classList.toggle('hidden', !(isHour || isRest));
    document.getElementById('editNoteField').classList.toggle('hidden', !(isHour || isRest));

    var hoursLabel = document.querySelector('#editHoursField .modal-field-label');
    if (hoursLabel) hoursLabel.textContent = isRest ? '休息时长（小时）' : '工时（小时）';

    if (isHour || isRest) {
        document.getElementById('editHours').value = r.hours || '';
        document.getElementById('editNote').value = r.note || '';
    } else {
        document.getElementById('editBrand').value = r.brand || '';
        document.getElementById('editQty').value = r.quantity || '';
    }
    showModal('editModal');
}

function saveEdit() {
    var r = null;
    for (var i = 0; i < records.length; i++) { if (records[i].id === editingId) { r = records[i]; break; } }
    if (!r) return;
    var isHour = r.mode === 'hour';
    var isRest = r.mode === 'rest';
    var activePill = document.querySelector('#editTimePills .time-pill.active');
    var newTime = activePill ? activePill.getAttribute('data-time') : r.time;

    if (isHour || isRest) {
        var hours = parseFloat(document.getElementById('editHours').value);
        var note = document.getElementById('editNote').value.trim();
        if (!hours || hours <= 0) { showToast('请输入有效时长','error'); return; }
        r.hours = hours; r.note = note;
    } else {
        var brand = document.getElementById('editBrand').value.trim();
        var qty = parseInt(document.getElementById('editQty').value);
        if (!brand) { showToast('请输入品牌','error'); return; }
        if (!qty || qty <= 0) { showToast('请输入有效数量','error'); return; }
        getBrandObj(brand);
        r.brand = brand; r.quantity = qty;
    }
    r.time = newTime;
    r.edited = true;
    saveData(); hideModal('editModal'); renderAll(); showToast('已更新');
}

function updateHomeStats() {
    var todayStr = today();
    var todayRecords = records.filter(function(r) { return r.date === todayStr; });

    var pieceToday = todayRecords.filter(function(r) { return r.mode === 'piece'; });
    var hourToday = todayRecords.filter(function(r) { return r.mode === 'hour'; });
    var restToday = todayRecords.filter(function(r) { return r.mode === 'rest'; });

    var todayPieceQty = 0;
    pieceToday.forEach(function(r) { todayPieceQty += r.quantity; });
    var todayHours = 0;
    hourToday.forEach(function(r) { todayHours += (r.hours || 0); });
    var todayRest = 0;
    restToday.forEach(function(r) { todayRest += (r.hours || 0); });

    document.getElementById('headerPieceQty').textContent = todayPieceQty + '件';
    document.getElementById('headerPieceSub').textContent = pieceToday.length > 0 ? pieceToday.length + '条记录' : '';
    document.getElementById('headerHours').textContent = todayHours.toFixed(1) + 'h';
    document.getElementById('headerHourSub').textContent = hourToday.length > 0 ? hourToday.length + '次计时' : '';
    document.getElementById('headerRest').textContent = todayRest.toFixed(1) + 'h';
    document.getElementById('headerRestSub').textContent = restToday.length > 0 ? restToday.length + '次休息' : '';

    var m = 0, n = 0, e = 0;
    pieceToday.forEach(function(r) {
        if (r.time === '早上') m += r.quantity;
        else if (r.time === '下午') n += r.quantity;
        else if (r.time === '晚上') e += r.quantity;
    });
    document.getElementById('todayMorning').textContent = m;
    document.getElementById('todayNoon').textContent = n;
    document.getElementById('todayEvening').textContent = e;

    updateStreak();
}

function updateDateStats(dateStr) {
    var dateRecords = records.filter(function(r) { return r.date === dateStr; });
    var pieceR = dateRecords.filter(function(r) { return r.mode === 'piece'; });
    var hourR = dateRecords.filter(function(r) { return r.mode === 'hour'; });
    var restR = dateRecords.filter(function(r) { return r.mode === 'rest'; });
    var totalQty = 0;
    pieceR.forEach(function(r) { totalQty += r.quantity; });
    var totalHours = 0;
    hourR.forEach(function(r) { totalHours += (r.hours || 0); });
    var totalRest = 0;
    restR.forEach(function(r) { totalRest += (r.hours || 0); });

    document.getElementById('headerPieceQty').textContent = totalQty + '件';
    document.getElementById('headerPieceSub').textContent = pieceR.length > 0 ? pieceR.length + '条记录' : '';
    document.getElementById('headerHours').textContent = totalHours.toFixed(1) + 'h';
    document.getElementById('headerHourSub').textContent = hourR.length > 0 ? hourR.length + '次计时' : '';
    document.getElementById('headerRest').textContent = totalRest.toFixed(1) + 'h';
    document.getElementById('headerRestSub').textContent = restR.length > 0 ? restR.length + '次休息' : '';

    var m = 0, n = 0, e = 0;
    pieceR.forEach(function(r) {
        if (r.time === '早上') m += r.quantity;
        else if (r.time === '下午') n += r.quantity;
        else if (r.time === '晚上') e += r.quantity;
    });
    document.getElementById('todayMorning').textContent = m;
    document.getElementById('todayNoon').textContent = n;
    document.getElementById('todayEvening').textContent = e;
}

function updateStreak() {
    if (records.length === 0) { document.getElementById('streakBadge').textContent = '0天'; return; }
    var dates = {};
    records.forEach(function(r) { dates[r.date] = true; });
    var streak = 0;
    var d = new Date(); d.setHours(0,0,0,0);
    var check = new Date(d);
    if (!dates[formatDate(check)]) check.setDate(check.getDate() - 1);
    for (var i = 0; i < 400; i++) {
        if (dates[formatDate(check)]) { streak++; check.setDate(check.getDate() - 1); }
        else break;
    }
    document.getElementById('streakBadge').textContent = streak + '天';
}

function switchStatsTab(tab, btn) {
    var tabs = document.querySelectorAll('.stats-tab');
    for (var i = 0; i < tabs.length; i++) tabs[i].classList.remove('active');
    btn.classList.add('active');
    document.getElementById('statsMonthView').classList.toggle('hidden', tab !== 'month');
    document.getElementById('statsWeekView').classList.toggle('hidden', tab !== 'week');
    if (tab === 'month') renderMonthStats();
    else renderWeekStats();
}

function changeMonth(delta) {
    currentMonth.setMonth(currentMonth.getMonth() + delta);
    renderMonthStats();
}

function renderMonthStats() {
    var ym = currentMonth.toISOString().slice(0,7);
    document.getElementById('monthText').textContent = currentMonth.getFullYear() + '年' + (currentMonth.getMonth()+1) + '月';
    var mr = records.filter(function(r) { return r.date.indexOf(ym) === 0; });
    var days = {};
    mr.forEach(function(r) { days[r.date] = true; });
    var dayList = Object.keys(days).sort();
    var workDays = dayList.length;

    var pieceR = mr.filter(function(r) { return r.mode === 'piece'; });
    var hourR = mr.filter(function(r) { return r.mode === 'hour'; });
    var restR = mr.filter(function(r) { return r.mode === 'rest'; });
    var totalQty = 0;
    pieceR.forEach(function(r) { totalQty += r.quantity; });
    var totalHours = 0;
    hourR.forEach(function(r) { totalHours += (r.hours || 0); });
    var totalRest = 0;
    restR.forEach(function(r) { totalRest += (r.hours || 0); });
    var restDays = 0;
    var restDates = {};
    restR.forEach(function(r) { restDates[r.date] = true; });
    restDays = Object.keys(restDates).length;

    var daySums = {};
    pieceR.forEach(function(r) { daySums[r.date] = (daySums[r.date]||0) + r.quantity; });
    var maxDay = 0, minDay = 0;
    var sumVals = [];
    for (var k in daySums) sumVals.push(daySums[k]);
    if (sumVals.length > 0) { maxDay = Math.max.apply(null, sumVals); minDay = Math.min.apply(null, sumVals); }

    var brandQty = {};
    pieceR.forEach(function(r) {
        brandQty[r.brand] = (brandQty[r.brand]||0) + r.quantity;
    });
    var sortedBrands = Object.entries(brandQty).sort(function(a,b){return b[1]-a[1];});
    var maxBrandQty = sortedBrands.length > 0 ? sortedBrands[0][1] : 0;

    var last7 = [];
    for (var i = 6; i >= 0; i--) {
        var d2 = new Date(); d2.setDate(d2.getDate() - i);
        var key = formatDate(d2);
        var qty = 0;
        pieceR.filter(function(r){return r.date===key;}).forEach(function(r){qty+=r.quantity;});
        var hrs = 0;
        hourR.filter(function(r){return r.date===key;}).forEach(function(r){hrs+=(r.hours||0);});
        var rest = 0;
        restR.filter(function(r){return r.date===key;}).forEach(function(r){rest+=(r.hours||0);});
        last7.push({ date:key, label:(d2.getMonth()+1)+'/'+d2.getDate(), qty:qty, hours:hrs, rest:rest });
    }
    var max7 = 1;
    last7.forEach(function(x) { if(x.qty>max7) max7=x.qty; });

    var html = '';

    html += '<div class="overview-grid">' +
        '<div class="ov-card gradient"><div class="ov-label">📦 计件总件数</div><div class="ov-value">' + totalQty + '</div><div class="ov-sub">' + pieceR.length + '条记录</div></div>' +
        '<div class="ov-card orange"><div class="ov-label">⏱️ 计时总工时</div><div class="ov-value">' + totalHours.toFixed(1) + 'h</div><div class="ov-sub">' + hourR.length + '次计时</div></div>' +
        '<div class="ov-card pink"><div class="ov-label">🛌 休息总时长</div><div class="ov-value">' + totalRest.toFixed(1) + 'h</div><div class="ov-sub">' + restDays + '天 · ' + restR.length + '次</div></div>' +
        '</div>';

    html += '<div class="sec-title">最近7天</div><div class="chart-card">';
    last7.forEach(function(x) {
        var pct = Math.round(x.qty / max7 * 100);
        if (pct < 3) pct = 3;
        var isToday = x.date === today();
        var extra = '';
        if (x.hours > 0) extra += ' ⏱️' + x.hours.toFixed(1) + 'h';
        if (x.rest > 0) extra += ' 🛌' + x.rest.toFixed(1) + 'h';
        html += '<div class="bar-row"><div class="bar-label">' + x.label + '</div><div class="bar-track"><div class="bar-fill' + (isToday?' today':'') + '" style="width:' + pct + '%"></div></div><div class="bar-val">' + x.qty + '件' + extra + '</div></div>';
    });
    html += '</div>';

    if (sortedBrands.length > 0) {
        html += '<div class="sec-title">🏷️ 品牌排名</div>';
        var rCls = ['rank-gold','rank-silver','rank-bronze'];
        sortedBrands.forEach(function(item, idx) {
            var b = item[0], q = item[1];
            var pct = totalQty > 0 ? Math.round(q / totalQty * 100) : 0;
            var bpct = maxBrandQty > 0 ? Math.round(q / maxBrandQty * 100) : 0;
            var rc = rCls[idx] || 'rank-normal';
            html += '<div class="brand-pct-item">' +
                '<div class="brand-pct-rank ' + rc + '">' + (idx+1) + '</div>' +
                '<div class="brand-pct-info"><div class="brand-pct-name">' + escapeHtml(b) + '</div><div class="brand-pct-bar-bg"><div class="brand-pct-bar-fill" style="width:' + bpct + '%"></div></div></div>' +
                '<div class="brand-pct-right"><div class="brand-pct-qty">' + q + '件</div></div>' +
                '</div>';
        });
    }

    var timeRecords = hourR.concat(restR);
    if (timeRecords.length > 0) {
        html += '<div class="sec-title">⏱️ 计时 & 休息记录</div><div class="card" style="margin-bottom:18px">';
        var totalTime = 0, totalRest2 = 0;
        hourR.forEach(function(r) { totalTime += (r.hours||0); });
        restR.forEach(function(r) { totalRest2 += (r.hours||0); });
        html += '<div style="padding:14px"><div style="font-size:13px;color:var(--gray-400);margin-bottom:6px">计时总工时 / 休息总时长</div><div style="font-size:24px;font-weight:800;color:#D97706;">' + totalTime.toFixed(1) + 'h</div><div style="font-size:18px;font-weight:700;color:#9D174D;">🛌 ' + totalRest2.toFixed(1) + 'h</div><div style="font-size:12px;color:var(--gray-400);margin-top:4px">' + timeRecords.length + '条记录</div></div>';
        var timeByDate = {};
        timeRecords.forEach(function(r) {
            if (!timeByDate[r.date]) timeByDate[r.date] = [];
            timeByDate[r.date].push(r);
        });
        Object.keys(timeByDate).sort().forEach(function(date) {
            var list = timeByDate[date];
            var sumTime = 0, sumRest = 0;
            list.forEach(function(r) {
                if (r.mode === 'hour') { sumTime += (r.hours||0); }
                else { sumRest += (r.hours||0); }
            });
            var times = list.map(function(r){return r.time;}).join('、');
            var label = '';
            if (sumTime > 0) label += '⏱️' + sumTime.toFixed(1) + 'h';
            if (sumRest > 0) label += (label ? ' ' : '') + '🛌' + sumRest.toFixed(1) + 'h';
            html += '<div class="time-stat-row">' +
                '<div><div class="time-stat-date">' + date.slice(5) + '</div><div class="time-stat-detail">' + list.length + '次 · ' + times + '</div></div>' +
                '<div class="time-stat-val ' + (sumTime > 0 ? 'hour' : 'rest') + '">' + label + '</div></div>';
        });
        html += '</div>';
    }

    html += '<div class="sec-title">📋 每日明细</div>';
    if (dayList.length === 0) {
        html += '<div class="empty"><div class="empty-icon">📋</div><div>本月暂无记录</div></div>';
    } else {
        dayList.reverse().forEach(function(date) {
            var dr = mr.filter(function(r) { return r.date === date; });
            var pi = dr.filter(function(r) { return r.mode === 'piece'; });
            var hi = dr.filter(function(r) { return r.mode === 'hour'; });
            var ri = dr.filter(function(r) { return r.mode === 'rest'; });
            var dt = 0;
            pi.forEach(function(r) { dt += r.quantity; });
            var dh = 0;
            hi.forEach(function(r) { dh += (r.hours||0); });
            var dr2 = 0;
            ri.forEach(function(r) { dr2 += (r.hours||0); });
            var bb = {};
            pi.forEach(function(r) { bb[r.brand] = (bb[r.brand]||0) + r.quantity; });
            var tb = {'早上':0,'下午':0,'晚上':0};
            pi.forEach(function(r) { if (tb[r.time]!==undefined) tb[r.time] += r.quantity; });
            var wd = ['日','一','二','三','四','五','六'][new Date(date).getDay()];
            var isT = date === today();
            var rows = '';
            Object.entries(bb).forEach(function(item) {
                var b = item[0], q = item[1];
                rows += '<div class="day-brand-row"><span class="day-brand-row-name">' + escapeHtml(b) + '</span><span class="day-brand-row-right"><span class="day-brand-row-qty">' + q + '件</span></span></div>';
            });
            hi.forEach(function(r) {
                rows += '<div class="day-brand-row"><span class="day-brand-row-name">⏱️ 计时' + (r.note?' · '+escapeHtml(r.note):'') + '</span><span class="day-brand-row-right"><span class="day-brand-row-qty" style="color:#D97706;">' + r.hours + 'h</span></span></div>';
            });
            ri.forEach(function(r) {
                rows += '<div class="day-brand-row"><span class="day-brand-row-name">🛌 休息' + (r.note?' · '+escapeHtml(r.note):'') + '</span><span class="day-brand-row-right"><span class="day-brand-row-qty" style="color:#9D174D;">' + r.hours + 'h</span></span></div>';
            });
            var totalLabel = dt + '件';
            if (dh > 0) totalLabel += ' + ⏱️' + dh.toFixed(1) + 'h';
            if (dr2 > 0) totalLabel += ' + 🛌' + dr2.toFixed(1) + 'h';
            html += '<div class="day-card">' +
                '<div class="day-card-head"><div><div class="day-card-date">' + date.slice(5) + '<span class="day-card-week"> 周' + wd + (isT?' · 今天':'') + '</span></div></div>' +
                '<div class="day-card-total">' + totalLabel + '</div></div>' +
                '<div class="day-card-body"><div class="day-time-cols">' +
                    '<div class="day-time-col"><div class="day-time-col-label">🌅 早上</div><div class="day-time-col-val">' + tb['早上'] + '</div></div>' +
                    '<div class="day-time-col"><div class="day-time-col-label">☀️ 下午</div><div class="day-time-col-val">' + tb['下午'] + '</div></div>' +
                    '<div class="day-time-col"><div class="day-time-col-label">🌙 晚上</div><div class="day-time-col-val">' + tb['晚上'] + '</div></div>' +
                '</div><div class="day-brand-rows">' + rows + '</div></div></div>';
        });
    }
    document.getElementById('monthStatsContent').innerHTML = html;
}

function changeWeek(delta) {
    currentWeekStart.setDate(currentWeekStart.getDate() + delta * 7);
    renderWeekStats();
}

function renderWeekStats() {
    var we = new Date(currentWeekStart); we.setDate(we.getDate() + 6);
    document.getElementById('weekText').textContent = (currentWeekStart.getMonth()+1) + '/' + currentWeekStart.getDate() + ' - ' + (we.getMonth()+1) + '/' + we.getDate();
    var wd = [];
    for (var i = 0; i < 7; i++) { var d2 = new Date(currentWeekStart); d2.setDate(d2.getDate() + i); wd.push(formatDate(d2)); }
    var wr = records.filter(function(r) { return wd.indexOf(r.date) >= 0; });
    var pieceW = wr.filter(function(r) { return r.mode === 'piece'; });
    var hourW = wr.filter(function(r) { return r.mode === 'hour'; });
    var restW = wr.filter(function(r) { return r.mode === 'rest'; });
    var totalQty = 0;
    pieceW.forEach(function(r) { totalQty += r.quantity; });
    var totalHours = 0;
    hourW.forEach(function(r) { totalHours += (r.hours||0); });
    var totalRest = 0;
    restW.forEach(function(r) { totalRest += (r.hours||0); });
    var maxQty = 0;
    wd.forEach(function(d) {
        var q = 0;
        pieceW.filter(function(r){return r.date===d;}).forEach(function(r){q+=r.quantity;});
        if (q > maxQty) maxQty = q;
    });
    if (maxQty < 1) maxQty = 1;

    var workDays = {};
    wr.forEach(function(r) { workDays[r.date] = true; });
    var workDaysCount = Object.keys(workDays).length;
    var restDays = {};
    restW.forEach(function(r) { restDays[r.date] = true; });
    var restDaysCount = Object.keys(restDays).length;

    var html = '';
    html += '<div class="overview-grid">' +
        '<div class="ov-card gradient"><div class="ov-label">📦 计件</div><div class="ov-value">' + totalQty + '件</div><div class="ov-sub">' + pieceW.length + '条记录</div></div>' +
        '<div class="ov-card orange"><div class="ov-label">⏱️ 计时</div><div class="ov-value">' + totalHours.toFixed(1) + 'h</div><div class="ov-sub">' + hourW.length + '次</div></div>' +
        '<div class="ov-card pink"><div class="ov-label">🛌 休息</div><div class="ov-value">' + totalRest.toFixed(1) + 'h</div><div class="ov-sub">' + restDaysCount + '天 · ' + restW.length + '次</div></div>' +
        '</div>';

    html += '<div class="sec-title">本周每日</div><div class="chart-card"><div class="week-chart">';
    var todayStr = today();
    wd.forEach(function(d) {
        var qty = 0;
        pieceW.filter(function(r){return r.date===d;}).forEach(function(r){qty+=r.quantity;});
        var hrs = 0;
        hourW.filter(function(r){return r.date===d;}).forEach(function(r){hrs+=(r.hours||0);});
        var rest = 0;
        restW.filter(function(r){return r.date===d;}).forEach(function(r){rest+=(r.hours||0);});
        var h = Math.round(qty / maxQty * 90) + 8;
        var isT = d === todayStr;
        var extra = '';
        if (hrs > 0) extra += '<br><span style="color:#D97706;font-size:10px;">⏱️' + hrs.toFixed(1) + 'h</span>';
        if (rest > 0) extra += '<br><span style="color:#9D174D;font-size:10px;">🛌' + rest.toFixed(1) + 'h</span>';
        html += '<div class="week-bar-col"><div class="week-bar-val">' + (qty>0?qty:'') + extra + '</div><div class="week-bar' + (isT?' today':'') + '" style="height:' + h + 'px"></div><div class="week-bar-label">周' + weekdayName(new Date(d).getDay()-1) + '</div></div>';
    });
    html += '</div></div>';

    var bS = {};
    pieceW.forEach(function(r) { bS[r.brand] = (bS[r.brand]||0) + r.quantity; });
    var sB = Object.entries(bS).sort(function(a,b){return b[1]-a[1];});
    if (sB.length > 0) {
        html += '<div class="sec-title">🏷️ 品牌排名</div>';
        var rC = ['rank-gold','rank-silver','rank-bronze'];
        sB.forEach(function(item, idx) {
            var b = item[0], q = item[1];
            var pct = totalQty>0 ? Math.round(q/totalQty*100) : 0;
            html += '<div class="brand-pct-item"><div class="brand-pct-rank '+(rC[idx]||'rank-normal')+'">'+(idx+1)+'</div><div class="brand-pct-info"><div class="brand-pct-name">'+escapeHtml(b)+'</div></div><div class="brand-pct-right"><div class="brand-pct-qty">'+q+'件</div></div></div>';
        });
    }

    var timeRecords = hourW.concat(restW);
    if (timeRecords.length > 0) {
        html += '<div class="sec-title">⏱️ 计时 & 休息记录</div><div class="card" style="margin-bottom:18px">';
        var totalTime2 = 0, totalRest2 = 0;
        hourW.forEach(function(r) { totalTime2 += (r.hours||0); });
        restW.forEach(function(r) { totalRest2 += (r.hours||0); });
        html += '<div style="padding:14px"><div style="font-size:13px;color:var(--gray-400);margin-bottom:6px">计时总工时 / 休息总时长</div><div style="font-size:24px;font-weight:800;color:#D97706;">' + totalTime2.toFixed(1) + 'h</div><div style="font-size:18px;font-weight:700;color:#9D174D;">🛌 ' + totalRest2.toFixed(1) + 'h</div><div style="font-size:12px;color:var(--gray-400);margin-top:4px">' + timeRecords.length + '条记录</div></div>';
        var hByDate = {};
        timeRecords.forEach(function(r) {
            if (!hByDate[r.date]) hByDate[r.date] = [];
            hByDate[r.date].push(r);
        });
        Object.keys(hByDate).sort().forEach(function(date) {
            var list = hByDate[date];
            var sumTime = 0, sumRest = 0;
            list.forEach(function(r) {
                if (r.mode === 'hour') { sumTime += (r.hours||0); }
                else { sumRest += (r.hours||0); }
            });
            var times = list.map(function(r){return r.time;}).join('、');
            var label = '';
            if (sumTime > 0) label += '⏱️' + sumTime.toFixed(1) + 'h';
            if (sumRest > 0) label += (label ? ' ' : '') + '🛌' + sumRest.toFixed(1) + 'h';
            html += '<div class="time-stat-row">' +
                '<div><div class="time-stat-date">' + date.slice(5) + '</div><div class="time-stat-detail">' + list.length + '次 · ' + times + '</div></div>' +
                '<div class="time-stat-val ' + (sumTime > 0 ? 'hour' : 'rest') + '">' + label + '</div></div>';
        });
        html += '</div>';
    }

    document.getElementById('weekStatsContent').innerHTML = html;
}

function renderBrandManageList() {
    var el = document.getElementById('brandManageList');
    el.innerHTML = '';
    brands.forEach(function(b, i) {
        var d = document.createElement('div');
        d.className = 'brand-manage-item';
        d.innerHTML =
            '<div class="brand-manage-info"><div class="brand-manage-name">' + escapeHtml(b.name) + '</div></div>' +
            '<div class="brand-manage-actions">' +
                '<button class="btn-sm btn-red" onclick="deleteBrand(' + i + ')">删除</button>' +
            '</div>';
        el.appendChild(d);
    });
}

function addNewBrand() {
    var name = document.getElementById('newBrandInput').value.trim();
    if (!name) { showToast('请输入品牌名称','error'); return; }
    var exists = false;
    for (var i = 0; i < brands.length; i++) { if (brands[i].name === name) { exists = true; break; } }
    if (exists) { showToast('品牌已存在','error'); return; }
    brands.push({ name: name });
    saveData();
    hideModal('brandModal');
    document.getElementById('newBrandInput').value = '';
    renderAll(); showToast('品牌已添加');
}

function deleteBrand(i) {
    if (!confirm('确定删除品牌“' + brands[i].name + '”？相关记录不会被删除。')) return;
    brands.splice(i, 1);
    saveData(); renderAll(); showToast('已删除');
}

function exportCSV() {
    if (records.length === 0) { showToast('暂无数据可导出','error'); return; }
    var csv = '日期,时段,模式,品牌,件数,工时/休息时长,备注\n';
    records.sort(function(a,b){return a.date.localeCompare(b.date);});
    records.forEach(function(r) {
        var isHour = r.mode === 'hour';
        var isRest = r.mode === 'rest';
        var brandStr = (isHour || isRest) ? '' : '"'+r.brand.replace(/"/g,'""')+'"';
        var noteStr = '"'+(r.note||'').replace(/"/g,'""')+'"';
        var modeLabel = isRest ? '休息' : (isHour ? '计时' : '计件');
        var val = '';
        if (isRest || isHour) val = r.hours || '';
        else val = r.quantity || '';
        csv += r.date + ',' + r.time + ',' + modeLabel + ',' +
            brandStr + ',' +
            val + ',' +
            noteStr + '\n';
    });
    var blob = new Blob(['\uFEFF' + csv], {type:'text/csv;charset=utf-8'});
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = '记账数据_' + today() + '.csv';
    a.click();
    showToast('CSV已导出');
}

function importData() { document.getElementById('fileInput').click(); }
function handleImport(e) {
    var f = e.target.files[0]; if (!f) return;
    var reader = new FileReader();
    reader.onload = function(ev) {
        try {
            var d = JSON.parse(ev.target.result);
            if (!confirm('导入将覆盖当前数据，确定？')) return;
            records = migrateRecords(Array.isArray(d.records) ? d.records : []);
            brands = migrateBrands(d.brands || []);
            saveData(); renderAll(); showToast('导入成功');
        } catch(err) { showToast('文件格式错误','error'); }
    };
    reader.readAsText(f); e.target.value = '';
}

function clearData() {
    if (!confirm('确定清除所有数据？不可恢复！')) return;
    if (!confirm('再次确认清除？')) return;
    records = []; brands = [{name:'品牌A'},{name:'品牌B'},{name:'品牌C'}];
    saveData(); renderAll(); showToast('已清除');
}

function showModal(id) { document.getElementById(id).classList.add('active'); }
function hideModal(id) { document.getElementById(id).classList.remove('active'); }