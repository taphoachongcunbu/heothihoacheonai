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

// Quản lý Ngày chọn & Tuần xem
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
            monthNum: (d.getMonth() + 1).toString().padStart(2, '0') // Thêm hiển thị Tháng
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
                            <strong>${d.dateNum}</strong>
                            <div class="date-month">Th${d.monthNum}</div>
                            <div class="streak-icon">${icon}</div>
                        </button>
                    `;
                }).join('')}
            </div>
            <button type="button" class="cal-nav-btn" onclick="changeWeek(1)" title="Tuần sau">❯</button>
            <button type="button" class="cal-today-btn" onclick="goToToday()">Hôm nay</button>
        `;
    });
}

window.changeWeek = function(direction) {
    currentWeekOffset += direction;
    renderDateBars();
};

window.goToToday = function() {
    currentWeekOffset = 0;
    selectedDate = new Date().toISOString().split('T')[0];
    renderDateBars();
    renderSleep();
    updateWaterUI();
    updateFoodUI();
    renderWorkout();
};

window.selectDate = function(dateStr) {
    selectedDate = dateStr;
    renderDateBars();
    renderSleep();
    updateWaterUI();
    updateFoodUI();
    renderWorkout();
};

/* =========================================
   2. FIREBASE AUTH
   ========================================= */
let auth = null, provider = null;

try {
    const firebaseConfig = {
        apiKey: "AIzaSyDXQZRfGNQ0-_NUPWqxOmjCxWq51T3b3qI",
        authDomain: "healthyhoacheonai.firebaseapp.com",
        projectId: "healthyhoacheonai",
        storageBucket: "healthyhoacheonai.firebasestorage.app",
        messagingSenderId: "707815568295",
        appId: "1:707815568295:web:fc6faeb9e79dc2b6ad7c82"
    };

    if (typeof firebase !== 'undefined') {
        firebase.initializeApp(firebaseConfig);
        auth = firebase.auth();
        provider = new firebase.auth.GoogleAuthProvider();

        auth.onAuthStateChanged(user => {
            const authStatusEl = document.getElementById('auth-status');
            if (user) {
                authStatusEl.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <img src="${user.photoURL}" style="width: 28px; height: 28px; border-radius: 50%;">
                        <span style="font-weight: 700; font-size: 13px;">${user.displayName}</span>
                    </div>
                    <button type="button" onclick="logoutGoogle()" class="btn-secondary" style="padding: 4px 8px; font-size:12px;">Đăng xuất</button>
                `;
            } else {
                authStatusEl.innerHTML = `<button type="button" onclick="loginGoogle()" class="btn-secondary" style="width: 100%;"><i class='bx bxl-google'></i> Đăng nhập</button>`;
            }
        });
    }
} catch (e) { console.log("Firebase Load Info:", e); }

window.loginGoogle = function() {
    if(auth && provider) auth.signInWithPopup(provider).catch(err => showToast("Lỗi: " + err.message));
    else showToast("Đang ở chế độ trải nghiệm!");
};

window.logoutGoogle = function() { if(auth) auth.signOut(); };

/* =========================================
   3. HỒ SƠ SỨC KHỎE
   ========================================= */
let userProfile = JSON.parse(localStorage.getItem('helnai_user_profile')) || null;
const userModal = document.getElementById('user-modal');

window.openSettingsModal = function() {
    if (userProfile) {
        document.getElementById('weight').value = userProfile.weight || '';
        document.getElementById('height').value = userProfile.height || '';
        document.getElementById('age').value = userProfile.age || '';
        document.getElementById('gender').value = userProfile.gender || 'female';
        document.getElementById('activity').value = userProfile.activity || '1.2';
        document.getElementById('goal').value = userProfile.goal || 'maintain';
    }
    userModal.classList.add('active');
};

window.saveHealthForm = function(e) {
    e.preventDefault();
    userProfile = {
        weight: parseFloat(document.getElementById('weight').value),
        height: parseFloat(document.getElementById('height').value),
        age: parseInt(document.getElementById('age').value),
        gender: document.getElementById('gender').value,
        activity: parseFloat(document.getElementById('activity').value),
        goal: document.getElementById('goal').value
    };
    localStorage.setItem('helnai_user_profile', JSON.stringify(userProfile));
    userModal.classList.remove('active');
    calculateAndDisplayStats();
    renderDateBars();
    showToast("Đã lưu hồ sơ sức khỏe! 🌸");
};

function calculateAndDisplayStats() {
    if (!userProfile) return;
    const h = userProfile.height / 100;
    const bmi = (userProfile.weight / (h * h)).toFixed(1);
    document.getElementById('stat-bmi').innerText = bmi;
    document.getElementById('stat-bmi-text').innerText = bmi < 18.5 ? "Gầy" : (bmi >= 25 ? "Thừa cân" : "Bình thường");

    let bmr = Math.round((10 * userProfile.weight) + (6.25 * userProfile.height) - (5 * userProfile.age) + (userProfile.gender === 'male' ? 5 : -161));
    document.getElementById('stat-bmr').innerText = bmr + " kcal";

    const tdee = Math.round(bmr * userProfile.activity);
    document.getElementById('stat-tdee').innerText = tdee + " kcal";

    let targetCalo = tdee;
    let goalText = "Duy trì vóc dáng";
    if (userProfile.goal === 'lose') {
        targetCalo = tdee - 350;
        goalText = `Gợi ý nạp ~${targetCalo} kcal để giảm cân`;
    } else if (userProfile.goal === 'gain') {
        targetCalo = tdee + 350;
        goalText = `Gợi ý nạp ~${targetCalo} kcal để tăng cơ`;
    }
    
    document.getElementById('stat-target-calo').innerText = targetCalo + " kcal";
    document.getElementById('stat-goal-desc').innerText = goalText;
    document.getElementById('target-calo-display').innerText = targetCalo;
    document.getElementById('water-target').innerText = Math.round(userProfile.weight * 35);
    
    updateWaterUI();
    updateFoodUI();
}

/* =========================================
   4. GIẤC NGỦ & TÍNH CHU KỲ (REM/MỆT)
   ========================================= */
let sleepLogs = JSON.parse(localStorage.getItem('helnai_sleep_logs')) || {};
let lastSleepResult = null;

function formatTime(dateObj) {
    let hours = dateObj.getHours().toString().padStart(2, '0');
    let minutes = dateObj.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
}

window.calculateSleep = function() {
    const sTime = document.getElementById('sleep-time').value;
    const wTime = document.getElementById('wake-time').value;
    const stTime = document.getElementById('streak-target-time').value;
    if (!sTime || !wTime) { showToast("Nhập đủ giờ đi ngủ và thức!"); return; }

    let [sH, sM] = sTime.split(':').map(Number);
    let [wH, wM] = wTime.split(':').map(Number);
    let [stH, stM] = stTime.split(':').map(Number);

    let sDate = new Date(2000, 0, 1, sH, sM);
    let wDate = new Date(2000, 0, (wH < sH || (wH === sH && wM <= sM) ? 2 : 1), wH, wM);
    let diffMinutes = (wDate - sDate) / 60000;
    
    let cycles = (diffMinutes / 90).toFixed(1);
    let cycleRemainder = diffMinutes % 90;
    let fatigueAnalysis = "";
    
    if (cycleRemainder <= 15 || cycleRemainder >= 75) {
        fatigueAnalysis = "🟢 <b>Tỉnh táo!</b> Bạn thức dậy đúng giao điểm giữa các chu kỳ (ngủ nông). Cơ thể sẽ sảng khoái, không mệt mỏi.";
    } else {
        fatigueAnalysis = "🔴 <b>Dễ bị mệt mỏi!</b> Giờ báo thức này cắt ngang chu kỳ ngủ sâu (Non-REM/REM). Bạn có thể thấy lờ đờ, đau đầu khi dậy.";
    }

    let suggestedBedTimes = [];
    [6, 5, 4].forEach(cNum => {
        let suggestedDate = new Date(wDate.getTime() - (cNum * 90 * 60000));
        suggestedBedTimes.push(formatTime(suggestedDate));
    });

    let isStreak = (sH < stH) || (sH === stH && sM <= stM);

    lastSleepResult = {
        id: Date.now(),
        duration: `${Math.floor(diffMinutes/60)}h ${diffMinutes%60}m`,
        cycles: cycles,
        isStreak: isStreak,
        fatigueMsg: fatigueAnalysis
    };

    document.getElementById('sleep-result').innerHTML = `
        <p>Thời gian ngủ: <b>${lastSleepResult.duration}</b> (${cycles} chu kỳ)</p>
        <p>${fatigueAnalysis}</p>
        <p style="margin-top:8px;">💡 <b>Gợi ý:</b> Để dậy lúc <b>${wTime}</b> không mệt, nên ngủ lúc: <b>${suggestedBedTimes.join(' | ')}</b></p>
        <p style="margin-top:5px;">Streak ngủ sớm: ${isStreak ? "🔥 Đạt Streak!" : "😴 Chưa đạt giờ mục tiêu"}</p>
    `;
    document.getElementById('btn-log-sleep').style.display = 'block';
};

window.saveSleepLog = function() {
    if (lastSleepResult) {
        sleepLogs[selectedDate] = lastSleepResult;
        localStorage.setItem('helnai_sleep_logs', JSON.stringify(sleepLogs));
        renderSleep();
        renderDateBars();
        showToast("Đã lưu giấc ngủ cho ngày " + selectedDate);
        document.getElementById('btn-log-sleep').style.display = 'none';
    }
};

window.deleteSleep = function() {
    delete sleepLogs[selectedDate];
    localStorage.setItem('helnai_sleep_logs', JSON.stringify(sleepLogs));
    renderSleep();
    renderDateBars();
    showToast("Đã xóa nhật ký giấc ngủ!");
};

function renderSleep() {
    const historyEl = document.getElementById('sleep-history');
    if (!historyEl) return;
    const log = sleepLogs[selectedDate];
    if (log) {
        historyEl.innerHTML = `
            <div class="history-item">
                <div class="history-item-info">
                    <strong>Ngày ${selectedDate} ${log.isStreak ? "🔥 Streak" : "😴"}</strong>
                    <span>Thời gian: ${log.duration} (${log.cycles} chu kỳ)</span>
                </div>
                <button type="button" class="btn-delete" onclick="deleteSleep()">Xóa</button>
            </div>
        `;
    } else {
        historyEl.innerHTML = `<p class="suggestion">Chưa có dữ liệu giấc ngủ cho ngày này.</p>`;
    }
}

/* =========================================
   5. UỐNG NƯỚC
   ========================================= */
let waterLogs = JSON.parse(localStorage.getItem('helnai_water_logs')) || {};

window.addWater = function() {
    const type = document.getElementById('water-type').value;
    const amount = parseInt(document.getElementById('water-custom-amount').value);
    if (!amount || amount <= 0) { showToast("Nhập số ml hợp lệ nha!"); return; }

    if (!waterLogs[selectedDate]) waterLogs[selectedDate] = [];
    waterLogs[selectedDate].unshift({
        id: Date.now(), type: type, amount: amount,
        time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
    });

    localStorage.setItem('helnai_water_logs', JSON.stringify(waterLogs));
    document.getElementById('water-custom-amount').value = '';
    updateWaterUI();
    renderDateBars();
    showToast("Đã thêm nước!");
};

window.deleteWater = function(id) {
    if (waterLogs[selectedDate]) {
        waterLogs[selectedDate] = waterLogs[selectedDate].filter(log => log.id !== id);
        localStorage.setItem('helnai_water_logs', JSON.stringify(waterLogs));
        updateWaterUI();
        renderDateBars();
        showToast("Đã xóa!");
    }
};

function updateWaterUI() {
    const target = parseInt(document.getElementById('water-target').innerText) || 2000;
    const logs = waterLogs[selectedDate] || [];
    let totalWater = 0; let nonWater = 0;
    
    logs.forEach(log => {
        totalWater += log.amount;
        if (log.type !== "Nước lọc") nonWater += log.amount;
    });

    document.getElementById('water-current').innerText = totalWater;
    let pct = Math.min((totalWater / target) * 100, 100);
    document.getElementById('water-circle').style.background = `conic-gradient(var(--primary) ${pct}%, var(--border) 0%)`;
    
    const streakMsg = document.getElementById('water-streak-msg');
    if (totalWater >= target) {
        streakMsg.innerHTML = "🔥 Đã đạt Streak Uống Nước Đủ Hôm Nay!";
    } else {
        streakMsg.innerText = "";
    }
    
    const warnEl = document.getElementById('water-warning');
    if (nonWater > 500) {
        warnEl.innerText = `⚠️ Nhắc nhở: Bạn đang nạp (${nonWater}ml) thức uống khác. Hãy ưu tiên nước lọc nhé!`;
        warnEl.style.display = 'block';
    } else { warnEl.style.display = 'none'; }

    document.getElementById('water-log-list').innerHTML = logs.map(log => `
        <li class="history-item">
            <div class="history-item-info">
                <strong>${log.type} (+${log.amount}ml)</strong>
                <span style="font-size:12px; color:var(--text-sub)">Lúc ${log.time}</span>
            </div>
            <button type="button" class="btn-delete" onclick="deleteWater(${log.id})">Xóa</button>
        </li>
    `).join('');
}

/* =========================================
   6. ĂN UỐNG & BỘ NÃO GEMINI AI THẬT (FIXED ENDPOINT)
   ========================================= */
const GEMINI_API_KEY = "AIzaSyBuceM7Qc0Jjhmm3orIo5p2G9ubM886FkU";

let foodLogs = JSON.parse(localStorage.getItem('helnai_food_logs')) || {};
let customFoodDatabase = JSON.parse(localStorage.getItem('helnai_custom_foods')) || {};

// Hàm gọi Gemini API phân tích calo thực tế
async function fetchNutritionFromGemini(foodQuery) {
    let lowerName = foodQuery.toLowerCase().trim();

    // 1. Kiểm tra bộ nhớ cá nhân nếu đã từng sửa món này
    if (customFoodDatabase[lowerName]) {
        return customFoodDatabase[lowerName];
    }

    // 2. Gọi Gemini API (Endpoint chuẩn gemini-1.5-flash)
    if (GEMINI_API_KEY) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
        
        const promptText = `Bạn là chuyên gia dinh dưỡng Việt Nam. Hãy phân tích và tính toán dinh dưỡng thực tế cho món ăn: "${foodQuery}".
Chỉ trả về DUY NHẤT một chuỗi JSON chuẩn (Không bọc trong markdown, không thêm bất kỳ lời giải thích nào) theo đúng định dạng này:
{"cal": số_kcal, "p": số_g_đạm, "c": số_g_tinh_bột, "f": số_g_chất_béo, "fb": số_g_chất_xơ}

Ví dụ mẫu:
Matcha sữa 700ml -> {"cal": 450, "p": 6, "c": 65, "f": 14, "fb": 0}`;

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: promptText }] }]
                })
            });

            if (response.ok) {
                const data = await response.json();
                let rawText = data.candidates[0].content.parts[0].text.trim();
                
                // Xử lý sạch văn bản loại bỏ markdown code block nếu AI vô tình trả về
                rawText = rawText.replace(/```json/gi, '').replace(/

// KHỞI CHẠY KHỔI ĐẦU
renderDateBars();
if (!userProfile) {
    userModal.classList.add('active');
} else {
    userModal.classList.remove('active');
    calculateAndDisplayStats();
}
renderSleep();
updateWaterUI();
updateFoodUI();
renderWorkout();
