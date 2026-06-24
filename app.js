
(function() {
    'use strict';
    
    // 数据存储
    var brands = [];
    var records = [];
    var currentTab = 'home';
    var selectedBrandId = null;
    var selectedType = 'timer';
    var timerInterval = null;
    var timerSeconds = 0;
    var counterQty = 1;
    
    // 工具函数
    function uid() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
    }
    
    function formatDate(date) {
        var d = new Date(date);
        return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    }
    
    function pad(n) {
        return n < 10 ? '0' + n : '' + n;
    }
    
    function formatTime(seconds) {
        var h = pad(Math.floor(seconds / 3600));
        var m = pad(Math.floor((seconds % 3600) / 60));
        var s = pad(seconds % 60);
        return h + ':' + m + ':' + s;
    }
    
    function formatDuration(seconds) {
        var h = Math.floor(seconds / 3600);
        var m = Math.floor((seconds % 3600) / 60);
        var s = Math.floor(seconds % 60);
        if (h > 0) return h + '小时' + m + '分钟';
        if (m > 0) return m + '分钟' + s + '秒';
        return s + '秒';
    }
    
    function getToday() {
        var now = new Date();
        return formatDate(now);
    }
    
    function getTodayRecords() {
        var today = getToday();
        return records.filter(function(r) {
            return formatDate(r.startTime) === today;
        });
    }
    
    // 数据持久化
    function loadData() {
        try {
            var b = localStorage.getItem('family_accounting_brands');
            var r = localStorage.getItem('family_accounting_records');
            if (b) brands = JSON.parse(b);
            if (r) records = JSON.parse(r);
        } catch (e) {
            console.error('Load data error:', e);
        }
    }
    
    function saveData() {
        try {
            localStorage.setItem('family_accounting_brands', JSON.stringify(brands));
            localStorage.setItem('family_accounting_records', JSON.stringify(records));
        } catch (e) {
            console.error('Save data error:', e);
        }
    }
    
    // 页面导航
    window.switchTab = function(tab) {
        currentTab = tab;
        document.querySelectorAll('.nav-item').forEach(function(item) {
            item.classList.remove('active');
        });
        document.getElementById('tab-' + tab).classList.add('active');
        
        if (tab === 'home') renderHome();
        if (tab === 'stats') renderStats();
        if (tab === 'records') renderRecords();
        if (tab === 'brands') renderBrands();
    };
    
    // 首页渲染
    function renderHome() {
        var todayRecords = getTodayRecords();
        var totalQty = 0;
        var totalDuration = 0;
        
        for (var i = 0; i < todayRecords.length; i++) {
            totalQty += todayRecords[i].quantity || 0;
            totalDuration += todayRecords[i].duration || 0;
        }
        
        document.getElementById('today-records').textContent = todayRecords.length;
        document.getElementById('today-qty').textContent = totalQty;
        document.getElementById('today-duration').textContent = formatDuration(totalDuration);
        
        // 渲染今日记录
        var recordsList = document.getElementById('today-records');
        if (todayRecords.length === 0) {
            recordsList.innerHTML = '<div class="empty-state"><div class="empty-icon">📝</div><p>今日暂无记录</p><p class="empty-hint">点击上方按钮开始记录</p></div>';
        } else {
            var html = '';
            for (var i = 0; i < todayRecords.length; i++) {
                var r = todayRecords[i];
                html += '<div class="record-item">';
                html += '<div class="record-icon ' + (r.type === 'timer' ? 'timer' : 'counter') + '">' + (r.type === 'timer' ? '⏱️' : '📦') + '</div>';
                html += '<div class="record-info"><div class="record-brand">' + r.brandName + '</div>';
                html += '<div class="record-detail">' + (r.type === 'timer' ? '计时' : '计件 ×' + r.quantity) + '</div></div>';
                html += '<div class="record-meta"><div class="record-value">' + (r.type === 'timer' ? formatDuration(r.duration) : r.quantity + '件') + '</div>';
                html += '<div class="record-time">' + formatDate(r.startTime) + '</div></div></div>';
            }
            recordsList.innerHTML = html;
        }
    }
    
    // 新建记录
    window.openNewRecord = function(type) {
        selectedType = type;
        counterQty = 1;
        document.getElementById('qty-value').textContent = '1';
        document.getElementById('record-brand').innerHTML = '';
        
        // 填充品牌选择
        for (var i = 0; i < brands.length; i++) {
            var option = document.createElement('option');
            option.value = brands[i].id;
            option.textContent = brands[i].name;
            document.getElementById('record-brand').appendChild(option);
        }
        
        // 显示模态框
        document.getElementById('new-record-modal').classList.add('show');
        
        // 设置类型
        selectType(type);
    };
    
    window.selectType = function(type) {
        selectedType = type;
        document.querySelectorAll('.type-btn').forEach(function(btn) {
            btn.classList.remove('active');
        });
        event.target.classList.add('active');
        
        document.getElementById('timer-fields').style.display = type === 'timer' ? 'block' : 'none';
        document.getElementById('counter-fields').style.display = type === 'counter' ? 'block' : 'none';
    };
    
    // 计时器功能
    window.startTimer = function() {
        timerSeconds = 0;
        timerInterval = setInterval(function() {
            timerSeconds++;
            document.getElementById('timer-display').textContent = formatTime(timerSeconds);
        }, 1000);
        
        document.querySelector('.timer-btn.start').style.display = 'none';
        document.querySelector('.timer-btn.stop').style.display = 'block';
    };
    
    window.stopTimer = function() {
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
        
        document.querySelector('.timer-btn.start').style.display = 'block';
        document.querySelector('.timer-btn.stop').style.display = 'none';
    };
    
    // 计件功能
    window.changeQty = function(delta) {
        counterQty = Math.max(1, counterQty + delta);
        document.getElementById('qty-value').textContent = counterQty;
    };
    
    // 保存记录
    window.saveRecord = function() {
        var brandId = document.getElementById('record-brand').value;
        var brand = brands.find(function(b) { return b.id === brandId; });
        
        if (!brand) {
            alert('请选择品牌');
            return;
        }
        
        var record = {
            id: uid(),
            brandId: brand.id,
            brandName: brand.name,
            type: selectedType,
            quantity: selectedType === 'counter' ? counterQty : 1,
            startTime: new Date().getTime() / 1000,
            endTime: new Date().getTime() / 1000,
            duration: selectedType === 'timer' ? timerSeconds : 0,
            notes: document.getElementById('record-note').value
        };
        
        records.unshift(record);
        saveData();
        closeModal('new-record-modal');
        renderHome();
    };
    
    // 关闭模态框
    window.closeModal = function(modalId) {
        document.getElementById(modalId).classList.remove('show');
    };
    
    // 统计页面
    function renderStats() {
        // 这里可以添加统计图表
        document.getElementById('stats-content').innerHTML = '<div class="empty-state"><div class="empty-icon">📊</div><p>统计功能开发中</p></div>';
    }
    
    // 记录页面
    function renderRecords() {
        var recordsList = document.getElementById('records-list');
        if (records.length === 0) {
            recordsList.innerHTML = '<div class="empty-state"><div class="empty-icon">📋</div><p>暂无记录</p></div>';
        } else {
            var html = '';
            for (var i = 0; i < records.length; i++) {
                var r = records[i];
                html += '<div class="record-item">';
                html += '<div class="record-icon ' + (r.type === 'timer' ? 'timer' : 'counter') + '">' + (r.type === 'timer' ? '⏱️' : '📦') + '</div>';
                html += '<div class="record-info"><div class="record-brand">' + r.brandName + '</div>';
                html += '<div class="record-detail">' + (r.type === 'timer' ? '计时' : '计件 ×' + r.quantity) + '</div></div>';
                html += '<div class="record-meta"><div class="record-value">' + (r.type === 'timer' ? formatDuration(r.duration) : r.quantity + '件') + '</div>';
                html += '<div class="record-time">' + formatDate(r.startTime) + '</div></div></div>';
            }
            recordsList.innerHTML = html;
        }
    }
    
    // 品牌管理
    function renderBrands() {
        var brandsList = document.getElementById('brands-list');
        if (brands.length === 0) {
            brandsList.innerHTML = '<div class="empty-state"><div class="empty-icon">🏷️</div><p>暂无品牌</p><button class="btn primary" onclick="addBrand()">添加品牌</button></div>';
        } else {
            var html = '';
            for (var i = 0; i < brands.length; i++) {
                html += '<div class="brand-item">';
                html += '<div class="brand-name">' + brands[i].name + '</div>';
                html += '<div class="brand-actions"><button onclick="editBrand('' + brands[i].id + '')">编辑</button><button onclick="deleteBrand('' + brands[i].id + '')">删除</button></div>';
                html += '</div>';
            }
            brandsList.innerHTML = html;
        }
    }
    
    window.addBrand = function() {
        var name = prompt('请输入品牌名称：');
        if (name) {
            brands.push({
                id: uid(),
                name: name
            });
            saveData();
            renderBrands();
        }
    };
    
    window.editBrand = function(id) {
        var brand = brands.find(function(b) { return b.id === id; });
        if (brand) {
            var newName = prompt('请输入新品牌名称：', brand.name);
            if (newName) {
                brand.name = newName;
                saveData();
                renderBrands();
            }
        }
    };
    
    window.deleteBrand = function(id) {
        if (confirm('确定删除此品牌？')) {
            brands = brands.filter(function(b) { return b.id !== id; });
            saveData();
            renderBrands();
        }
    };
    
    // 初始化
    loadData();
    renderHome();
    
    // 设置当前日期
    var now = new Date();
    var options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
    document.getElementById('current-date').textContent = now.toLocaleDateString('zh-CN', options);
    
})();
