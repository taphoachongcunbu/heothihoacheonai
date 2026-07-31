/* =========================================
   1. UTILS & DYNAMIC CALENDAR (WITH MONTH)
   ========================================= */
function showToast(message) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerText = message;
    container.appendChild(toast);
    setTimeout(() => { toast.remove(); }, 3000);
}

window.switchTab = function(targetId, btnElement) {
    const navBtns = document.querySelectorAll('.nav-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    navBtns.forEach(b => b.classList.remove('active'));
    tabContents.forEach(c => c.classList.remove('active'));

    if (btnElement) btnElement.classList.add('active');
    
    const targetContent = document.getElementById(targetId);
    if (targetContent) {
        targetContent.classList.add('active');
    }
};

window.toggleDarkMode = function() {
    document.body.classList.toggle('dark-mode');
};

let selectedDate = new Date().toISOString().split('T')[0];
let currentWeekOffset = 0;

function getWeekDays(offset = 0) {
    let days = [];
    let today = new Date();
    today.setDate(today.getDate() + (offset * 7));
    
    for (let i = 6; i >= 0; i--) {
        let d = new Date(today);
        d.setDate(d.getDate() - i);
        days.push({
            full: d.toISOString().split('T')[0],
            dayName: d.toLocaleDateString('vi-VN', { weekday: 'short' }),
            dateNum: d.getDate().toString().padStart(2, '0'),
            monthNum: (d.getMonth() + 1).toString().padStart(2, '0')
        });
    }
    return days;
}

function getStreakIconForDate(module, dateStr) {
    if (module === 'sleep') {
        const log = sleepLogs[dateStr];
        if (!log) return '💤';
        return log.isStreak ? '🔥' : '😴';
    }
    if (module === 'water') {
        const logs = waterLogs[dateStr] || [];
        let target = parseInt(document.getElementById('water-target')?.innerText) || 2000;
        let total = logs.reduce((sum, l) => sum + l.amount, 0);
        return total >= target ? '🔥' : '💧';
    }
    if (module === 'food') {
        const logs = foodLogs[dateStr] || [];
        let tdee = parseInt(document.getElementById('stat-tdee')?.innerText) || 2000;
        let total = logs.reduce((sum, l) => sum + l.cal, 0);
        if (total === 0) return '🍏';
        return total <= tdee ? '🔥' : '⚠️';
    }
    if (module === 'workout') {
        const dayData = workoutLogs[dateStr];
        if (!dayData) return '🏃';
        if (dayData.mode === 'off') return '🛌';
        if (dayData.mode === 'cheat') return '🍕';
        let items = dayData.items || [];
        let hasDone = items.some(i => i.done);
        return hasDone ? '🔥' : '🏃';
    }
    return '';
}

function renderDateBars() {
    const days = getWeekDays(currentWeekOffset);
    const modules = ['sleep', 'water', 'food', 'workout'];
    
    modules.forEach(mod => {
        const wrapper = document.getElementById(`${mod}-date-bar`);
        if (!wrapper) return;
        
        wrapper.innerHTML = `
            <button type="button" class="cal-nav-btn" onclick="changeWeek(-1)" title="Tuần trước">❮</button>
            <div class="date-selector-bar">
                ${days.map(d => {
                    let icon = getStreakIconForDate(mod, d.full);
                    return `
                        <button type="button" class="date-btn ${d.full === selectedDate ? 'active' : ''}" onclick="selectDate('${d.full}')">
                            <span>${d.dayName}</span>
                            <strong
