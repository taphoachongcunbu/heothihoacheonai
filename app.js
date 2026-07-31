/* =========================================
   1. UTILS & DYNAMIC CALENDAR
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

// Lấy ngày hôm nay làm mặc định (YYYY-MM-DD)
let selectedDate = new Date().toISOString().split('T')[0];

// Tự động tính 7 ngày gần nhất dựa trên thời gian thực hệ thống
function getRecent7Days() {
    let days = [];
    for (let i = 6; i >= 0; i--) {
        let d = new Date();
        d.setDate(d.getDate() - i);
        days.push({
            full: d.toISOString().split('T')[0],
            dayName: d.toLocaleDateString('vi-VN', { weekday: 'short' }),
            dateNum: d.getDate()
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
    const days = getRecent7Days();
    const modules = ['sleep', 'water', 'food', 'workout'];
    
    modules.forEach(mod => {
        const bar = document.getElementById(`${mod}-date-bar`);
        if (!bar) return;
        bar.innerHTML = days.map(d => {
            let icon = getStreakIconForDate(mod, d.full);
            return `
                <button type="button" class="date-btn ${d.full === selectedDate ? 'active' : ''}" onclick="selectDate('${d.full}')">
                    <span>${d.dayName}</span>
                    <strong>${d.dateNum}</strong>
                    <div class="streak-icon">${icon}</div>
                </button>
            `;
        }).join('');
    });
}

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
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                        <img src="${user.photoURL}" style="width: 32px; height: 32px; border-radius: 50%;">
                        <span style="font-weight: 700; font-size: 14px;">${user.displayName}</span>
                    </div>
                    <button type="button" onclick="logoutGoogle()" class="btn-secondary" style="width: 100%; padding: 6px;">Đăng xuất</button>
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
   4. GIẤC NGỦ & TÍNH TOÁN CẢM GIÁC MỆT MỎI
   ========================================= */
let sleepLogs = JSON.parse(localStorage.getItem('helnai_sleep_logs')) || {};
let lastSleepResult = null;

// Hàm hỗ trợ format HH:MM
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
    
    // Tính số chu kỳ (mỗi chu kỳ = 90p)
    let rawCycles = diffMinutes / 90;
    let cycles = rawCycles.toFixed(1);
    
    // Đánh giá thức dậy có mệt không (xem có sát chu kỳ 90p không)
    let cycleRemainder = diffMinutes % 90;
    let fatigueAnalysis = "";
    if (cycleRemainder <= 15 || cycleRemainder >= 75) {
        fatigueAnalysis = "🟢 <b>Tỉnh táo!</b> Bạn thức dậy đúng giao điểm giữa các chu kỳ (ngủ nông). Cơ thể sẽ sảng khoái, không mệt mỏi.";
    } else {
        fatigueAnalysis = "🔴 <b>Dễ bị mệt mỏi!</b> Giờ báo thức này cắt ngang chu kỳ ngủ sâu (Non-REM/REM). Bạn có thể thấy lờ đờ, đau đầu khi dậy.";
    }

    // Gợi ý giờ nên ngủ nếu giữ nguyên giờ thức đó
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
        <p>Tổng thời gian: <b>${lastSleepResult.duration}</b> (${cycles} chu kỳ)</p>
        <p>${fatigueAnalysis}</p>
        <p style="margin-top:8px;">💡 <b>Gợi ý:</b> Nếu thức lúc <b>${wTime}</b>, bạn nên đi ngủ vào các khung giờ: <b>${suggestedBedTimes.join(' | ')}</b> để tỉnh táo nhất.</p>
        <p style="margin-top:5px;">Streak ngủ sớm: ${isStreak ? "🔥 Đạt Streak ngủ sớm!" : "😴 Chưa đạt giờ mục tiêu"}</p>
    `;
    document.getElementById('btn-log-sleep').style.display = 'block';
};

window.saveSleepLog = function() {
    if (lastSleepResult) {
        sleepLogs[selectedDate] = lastSleepResult;
        localStorage.setItem('helnai_sleep_logs', JSON.stringify(sleepLogs));
        renderSleep();
        renderDateBars();
        showToast("Đã lưu nhật ký giấc ngủ!");
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
   6. ĂN UỐNG
   ========================================= */
let foodLogs = JSON.parse(localStorage.getItem('helnai_food_logs')) || {};

function estimateNutrition(name) {
    let lowerName = name.toLowerCase().trim();
    let cal = 120, p = 3, c = 15, f = 3, fb = 1;

    if (lowerName.includes('matcha') || lowerName.includes('trà sữa') || lowerName.includes('nước ngọt')) {
        cal = 260; c = 42; f = 8; p = 3; fb = 0;
        if (lowerName.includes('700ml') || lowerName.includes('lớn')) { cal = 420; c = 68; f = 12; p = 5; }
    } else if (lowerName.includes('lê') || lowerName.includes('táo') || lowerName.includes('chuối') || lowerName.includes('trái') || lowerName.includes('quả')) {
        cal = 60; c = 15; f = 0.2; p = 0.5; fb = 3.5;
        if (lowerName.includes('nửa') || lowerName.includes('1/2')) { cal = 35; c = 8; fb = 1.8; }
    } else if (lowerName.includes('sữa chua') || lowerName.includes('yogurt')) {
        cal = 95; c = 12; f = 3; p = 3.5; fb = 0;
        if (lowerName.includes('có đường')) { cal = 125; c = 19; }
    } else if (lowerName.includes('bò') || lowerName.includes('gà') || lowerName.includes('thịt') || lowerName.includes('trứng')) {
        cal = 280; p = 26; c = 2; f = 16; fb = 0;
    } else if (lowerName.includes('cơm') || lowerName.includes('phở') || lowerName.includes('bún') || lowerName.includes('mì')) {
        cal = 450; p = 16; c = 65; f = 11; fb = 2;
    } else if (lowerName.includes('rau') || lowerName.includes('salad')) {
        cal = 50; p = 2; c = 8; f = 1; fb = 4.5;
    }

    let offset = Math.floor(Math.random() * 8) - 4;
    return { cal: Math.max(15, cal + offset), p: Math.round(p), c: Math.round(c), f: Math.round(f), fb: Math.round(fb * 10) / 10 };
}

window.addFood = function() {
    const name = document.getElementById('food-input').value;
    if (!name.trim()) { showToast("Nhập tên món ăn nha!"); return; }

    if (!foodLogs[selectedDate]) foodLogs[selectedDate] = [];
    let nut = estimateNutrition(name);
    foodLogs[selectedDate].unshift({ id: Date.now(), name: name, cal: nut.cal, p: nut.p, c: nut.c, f: nut.f, fb: nut.fb });

    localStorage.setItem('helnai_food_logs', JSON.stringify(foodLogs));
    document.getElementById('food-input').value = "";
    updateFoodUI();
    renderDateBars();
    showToast(`Đã ghi nhận ${name}!`);
};

window.deleteFood = function(id) {
    if (foodLogs[selectedDate]) {
        foodLogs[selectedDate] = foodLogs[selectedDate].filter(log => log.id !== id);
        localStorage.setItem('helnai_food_logs', JSON.stringify(foodLogs));
        updateFoodUI();
        renderDateBars();
        showToast("Đã xóa món!");
    }
};

function updateFoodUI() {
    const target = parseInt(document.getElementById('target-calo-display').innerText) || 2000;
    const bmr = parseInt(document.getElementById('stat-bmr').innerText) || 1200;
    const tdee = parseInt(document.getElementById('stat-tdee').innerText) || 2000;
    
    const logs = foodLogs[selectedDate] || [];
    let tCal=0, tP=0, tC=0, tF=0, tFb=0;
    
    logs.forEach(log => {
        tCal += log.cal; tP += log.p; tC += log.c; tF += log.f; tFb += log.fb;
    });

    document.getElementById('food-current').innerText = tCal;
    document.getElementById('macro-pro').innerText = tP;
    document.getElementById('macro-carb').innerText = tC;
    document.getElementById('macro-fat').innerText = tF;
    document.getElementById('macro-fiber').innerText = Math.round(tFb);

    document.getElementById('food-range-info').innerText = `Tối thiểu: ${bmr} kcal | Tối đa (TDEE): ${tdee} kcal`;

    let pct = Math.min((tCal / target) * 100, 100);
    let circleColor = tCal > tdee ? "var(--danger)" : "var(--primary)";
    document.getElementById('food-circle').style.background = `conic-gradient(${circleColor} ${pct}%, var(--border) 0%)`;

    const streakMsg = document.getElementById('food-streak-msg');
    if (tCal > 0 && tCal <= tdee) {
        streakMsg.innerHTML = "🔥 Streak Kiểm Soát Calo Tốt (Chưa Vượt Mức)!";
    } else if (tCal > tdee) {
        streakMsg.innerHTML = `<span style="color:var(--danger)">⚠️ Đã vượt mức Calo tối đa duy trì!</span>`;
    } else {
        streakMsg.innerText = "";
    }

    let advice = "";
    if (tP < 40) advice += "Nên thêm đạm (Thịt/Cá/Trứng). ";
    if (tFb < 12) advice += "Thêm chất xơ (Rau xanh/Trái cây).";
    document.getElementById('food-advice').innerText = advice || "Dinh dưỡng khá cân bằng!";

    document.getElementById('food-list').innerHTML = logs.map(log => `
        <li class="history-item">
            <div class="history-item-info">
                <strong>${log.name} (${log.cal} kcal)</strong>
                <span style="font-size:12px; color:var(--text-sub)">Đ: ${log.p}g | B: ${log.c}g | Béo: ${log.f}g | Xơ: ${log.fb}g</span>
            </div>
            <button type="button" class="btn-delete" onclick="deleteFood(${log.id})">Xóa</button>
        </li>
    `).join('');
}

/* =========================================
   7. THỂ THAO
   ========================================= */
let workoutLogs = JSON.parse(localStorage.getItem('helnai_workout_logs')) || {};

window.setWorkoutStatus = function(status) {
    if (!workoutLogs[selectedDate]) workoutLogs[selectedDate] = { mode: 'normal', items: [] };
    workoutLogs[selectedDate].mode = status;
    localStorage.setItem('helnai_workout_logs', JSON.stringify(workoutLogs));
    renderWorkout();
    renderDateBars();
};

window.addWorkout = function() {
    const text = document.getElementById('workout-input').value;
    const duration = parseInt(document.getElementById('workout-duration').value) || 30;
    const type = document.getElementById('workout-type').value;
    
    if (!text.trim()) { showToast("Nhập tên bài tập nha!"); return; }

    if (!workoutLogs[selectedDate]) workoutLogs[selectedDate] = { mode: 'normal', items: [] };
    if (!workoutLogs[selectedDate].items) workoutLogs[selectedDate].items = [];

    workoutLogs[selectedDate].items.unshift({
        id: Date.now(), text: text, duration: duration, type: type, done: false
    });

    localStorage.setItem('helnai_workout_logs', JSON.stringify(workoutLogs));
    document.getElementById('workout-input').value = "";
    document.getElementById('workout-duration').value = "";
    renderWorkout();
    renderDateBars();
    showToast("Đã thêm bài tập!");
};

window.deleteWorkout = function(id) {
    if (workoutLogs[selectedDate] && workoutLogs[selectedDate].items) {
        workoutLogs[selectedDate].items = workoutLogs[selectedDate].items.filter(w => w.id !== id);
        localStorage.setItem('helnai_workout_logs', JSON.stringify(workoutLogs));
        renderWorkout();
        renderDateBars();
    }
};

window.toggleWorkout = function(id) {
    if (workoutLogs[selectedDate] && workoutLogs[selectedDate].items) {
        workoutLogs[selectedDate].items = workoutLogs[selectedDate].items.map(w => w.id === id ? { ...w, done: !w.done } : w);
        localStorage.setItem('helnai_workout_logs', JSON.stringify(workoutLogs));
        renderWorkout();
        renderDateBars();
    }
};

function renderWorkout() {
    const dayData = workoutLogs[selectedDate] || { mode: 'normal', items: [] };
    const statusMsg = document.getElementById('workout-status-msg');
    const items = dayData.items || [];
    
    let totalMinutes = 0;
    items.forEach(w => { if(w.done) totalMinutes += w.duration; });

    if (dayData.mode === 'off') {
        statusMsg.innerText = "🛌 Hôm nay là Ngày Nghỉ (Day Off). Bạn hãy nghỉ ngơi và nạp lại năng lượng thật tốt nha! 🌸";
    } else if (dayData.mode === 'cheat') {
        statusMsg.innerText = "🍕 Hôm nay là Cheat Day! Thỏa sức tận hưởng nhưng nhớ đừng ăn quá lố nhen! 😉";
    } else {
        if (totalMinutes > 0) {
            statusMsg.innerText = `🔥 Giỏi quá! Hôm nay bạn đã tập luyện được ${totalMinutes} phút. Cố gắng phát huy nhé!`;
        } else {
            statusMsg.innerText = "💪 Hôm nay bạn dự định tập bài gì thế?";
        }
    }

    const listEl = document.getElementById('workout-list');
    if (!listEl) return;
    listEl.innerHTML = items.map(w => `
        <li class="history-item">
            <div style="display:flex; align-items:center; gap:10px;">
                <input type="checkbox" ${w.done ? 'checked' : ''} onchange="toggleWorkout(${w.id})">
                <span style="${w.done ? 'text-decoration: line-through; opacity:0.6;' : ''}">[${w.type}] ${w.text} (${w.duration} phút)</span>
            </div>
            <button type="button" class="btn-delete" onclick="deleteWorkout(${w.id})">Xóa</button>
        </li>
    `).join('');
}

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
