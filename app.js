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

    if (targetId === 'overview') renderOverviewReport();
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
        let bmr = parseInt(document.getElementById('stat-bmr')?.innerText) || 1200;
        let total = logs.reduce((sum, l) => sum + l.cal, 0);
        if (total === 0) return '🍏';
        if (total > tdee) return '⚠️';
        if (total < bmr) return '⚠️';
        return '🔥';
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
    renderNap();
    updateWaterUI();
    updateFoodUI();
    renderWorkout();
    renderOverviewReport();
};

window.selectDate = function(dateStr) {
    selectedDate = dateStr;
    renderDateBars();
    renderSleep();
    renderNap();
    updateWaterUI();
    updateFoodUI();
    renderWorkout();
    renderOverviewReport();
};

/* =========================================
   2. HÀM XỬ LÝ DỮ LIỆU CŨ & TRÁNH XUNG ĐỘT
   ========================================= */
function safeLoadData(key) {
    try {
        let data = JSON.parse(localStorage.getItem(key));
        if (Array.isArray(data)) return {};
        return data || {};
    } catch (e) {
        return {};
    }
}

let userProfile = JSON.parse(localStorage.getItem('helnai_user_profile')) || null;
let sleepLogs = safeLoadData('helnai_sleep_logs');
let napLogs = safeLoadData('helnai_nap_logs');
let waterLogs = safeLoadData('helnai_water_logs');
let foodLogs = safeLoadData('helnai_food_logs');
let workoutLogs = safeLoadData('helnai_workout_logs');
let customFoodDatabase = safeLoadData('helnai_custom_foods');
let workoutHistoryDB = safeLoadData('helnai_workout_history');
// Đọc API Key lưu trữ từ LocalStorage nếu có
let storedApiKey = localStorage.getItem('helnai_api_key') || "";

/* =========================================
   3. FIREBASE AUTH + FIRESTORE CLOUD SYNC
   ========================================= */
let auth = null, provider = null, db = null, currentUser = null;

const CLOUD_KEYS = [
    'helnai_user_profile', 'helnai_sleep_logs', 'helnai_nap_logs',
    'helnai_water_logs', 'helnai_food_logs', 'helnai_workout_logs',
    'helnai_custom_foods', 'helnai_workout_history'
];

// Ghi dữ liệu vào localStorage NGAY LẬP TỨC (đồng bộ), sau đó đẩy lên Firestore (bất đồng bộ) nếu đã đăng nhập
async function persist(key, dataObj) {
    localStorage.setItem(key, JSON.stringify(dataObj));
    if (db && currentUser) {
        try {
            await db.collection('users').doc(currentUser.uid)
                .collection('data').doc(key)
                .set({ payload: JSON.stringify(dataObj), updatedAt: Date.now() });
        } catch (e) {
            console.error("Lỗi đồng bộ Cloud:", e);
            showToast("⚠️ Không đồng bộ được lên Cloud, dữ liệu vẫn lưu máy này.");
        }
    }
}

function reloadAllDataFromLocalStorage() {
    userProfile = JSON.parse(localStorage.getItem('helnai_user_profile')) || null;
    sleepLogs = safeLoadData('helnai_sleep_logs');
    napLogs = safeLoadData('helnai_nap_logs');
    waterLogs = safeLoadData('helnai_water_logs');
    foodLogs = safeLoadData('helnai_food_logs');
    workoutLogs = safeLoadData('helnai_workout_logs');
    customFoodDatabase = safeLoadData('helnai_custom_foods');
    workoutHistoryDB = safeLoadData('helnai_workout_history');
}

function renderEverything() {
    const userModal = document.getElementById('user-modal');
    if (!userProfile) {
        if (userModal) userModal.classList.add('active');
    } else {
        if (userModal) userModal.classList.remove('active');
        calculateAndDisplayStats();
    }
    renderDateBars();
    renderSleep();
    renderNap();
    updateWaterUI();
    updateFoodUI();
    renderWorkout();
    renderWorkoutSuggestions();
    renderOverviewReport();
}

// Tải dữ liệu từ Firestore về, GHI ĐÈ localStorage, rồi render lại toàn bộ UI
async function loadFromCloud(uid) {
    if (!db) return;
    showToast("☁️ Đang tải dữ liệu từ Cloud...");
    let foundAny = false;
    for (let key of CLOUD_KEYS) {
        try {
            const doc = await db.collection('users').doc(uid).collection('data').doc(key).get();
            if (doc.exists) {
                foundAny = true;
                localStorage.setItem(key, doc.data().payload);
            }
        } catch (e) {
            console.error("Lỗi tải Cloud:", e);
        }
    }
    reloadAllDataFromLocalStorage();
    renderEverything();
    showToast(foundAny ? "✅ Đã đồng bộ dữ liệu từ Cloud!" : "☁️ Tài khoản mới, chưa có dữ liệu Cloud.");

    // Đẩy toàn bộ dữ liệu local hiện có lên Cloud lần đầu (phòng khi local có mà cloud chưa có)
    if (!foundAny) {
        persist('helnai_user_profile', userProfile);
        persist('helnai_sleep_logs', sleepLogs);
        persist('helnai_nap_logs', napLogs);
        persist('helnai_water_logs', waterLogs);
        persist('helnai_food_logs', foodLogs);
        persist('helnai_workout_logs', workoutLogs);
        persist('helnai_custom_foods', customFoodDatabase);
        persist('helnai_workout_history', workoutHistoryDB);
    }
}

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
        if (firebase.firestore) db = firebase.firestore();

        auth.onAuthStateChanged(user => {
            const authStatusEl = document.getElementById('auth-status');
            currentUser = user || null;

            if (user) {
                authStatusEl.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <img src="${user.photoURL}" style="width: 28px; height: 28px; border-radius: 50%;">
                        <span style="font-weight: 700; font-size: 13px;">${user.displayName}</span>
                    </div>
                    <button type="button" onclick="logoutGoogle()" class="btn-secondary" style="padding: 4px 8px; font-size:12px;">Đăng xuất</button>
                `;
                loadFromCloud(user.uid);
            } else {
                authStatusEl.innerHTML = `<button type="button" onclick="loginGoogle()" class="btn-secondary" style="width: 100%;"><i class='bx bxl-google'></i> Đăng nhập để đồng bộ dữ liệu</button>`;
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
   4. HỒ SƠ SỨC KHỎE
   ========================================= */
window.openSettingsModal = function() {
    const userModal = document.getElementById('user-modal');
    if (userProfile) {
        document.getElementById('weight').value = userProfile.weight || '';
        document.getElementById('height').value = userProfile.height || '';
        document.getElementById('age').value = userProfile.age || '';
        document.getElementById('gender').value = userProfile.gender || 'female';
        document.getElementById('activity').value = userProfile.activity || '1.2';
        document.getElementById('goal').value = userProfile.goal || 'maintain';
    }
    const apiKeyField = document.getElementById('api-key');
    if (apiKeyField) {
        apiKeyField.value = localStorage.getItem('helnai_api_key') || '';
    }
    if (userModal) userModal.classList.add('active');
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
    persist('helnai_user_profile', userProfile);

    // Lưu khóa API cấu hình cá nhân (chỉ lưu local, không cần đồng bộ Cloud)
    const apiKeyVal = document.getElementById('api-key').value.trim();
    localStorage.setItem('helnai_api_key', apiKeyVal);
    storedApiKey = apiKeyVal;

    const userModal = document.getElementById('user-modal');
    if (userModal) userModal.classList.remove('active');

    calculateAndDisplayStats();
    renderDateBars();
    renderOverviewReport();
    showToast("Đã lưu hồ sơ sức khỏe! 🌸");
};

// Mục tiêu đạm/xơ tính theo từng người thay vì số cố định cho tất cả
window.dailyProteinTarget = 50;
window.dailyFiberTarget = 25;

function calculateAndDisplayStats() {
    if (!userProfile) return;
    const h = userProfile.height / 100;
    const bmi = (userProfile.weight / (h * h)).toFixed(1);

    const bmiEl = document.getElementById('stat-bmi');
    if (bmiEl) bmiEl.innerText = bmi;

    const bmiTextEl = document.getElementById('stat-bmi-text');
    if (bmiTextEl) bmiTextEl.innerText = bmi < 18.5 ? "Gầy" : (bmi >= 25 ? "Thừa cân" : "Bình thường");

    let bmr = Math.round((10 * userProfile.weight) + (6.25 * userProfile.height) - (5 * userProfile.age) + (userProfile.gender === 'male' ? 5 : -161));
    const bmrEl = document.getElementById('stat-bmr');
    if (bmrEl) bmrEl.innerText = bmr + " kcal";

    const tdee = Math.round(bmr * userProfile.activity);
    const tdeeEl = document.getElementById('stat-tdee');
    if (tdeeEl) tdeeEl.innerText = tdee + " kcal";

    let targetCalo = tdee;
    let goalText = "Duy trì vóc dáng";
    if (userProfile.goal === 'lose') {
        targetCalo = tdee - 350;
        goalText = `Gợi ý nạp ~${targetCalo} kcal để giảm cân`;
    } else if (userProfile.goal === 'gain') {
        targetCalo = tdee + 350;
        goalText = `Gợi ý nạp ~${targetCalo} kcal để tăng cơ`;
    }

    const statTargetEl = document.getElementById('stat-target-calo');
    if (statTargetEl) statTargetEl.innerText = targetCalo + " kcal";

    const statGoalEl = document.getElementById('stat-goal-desc');
    if (statGoalEl) statGoalEl.innerText = goalText;

    const displayCaloEl = document.getElementById('target-calo-display');
    if (displayCaloEl) displayCaloEl.innerText = targetCalo;

    const waterTargetEl = document.getElementById('water-target');
    if (waterTargetEl) waterTargetEl.innerText = Math.round(userProfile.weight * 35);

    // Mục tiêu đạm: 1.6g/kg (duy trì), 1.8g/kg (giảm cân, giữ cơ khi thiếu hụt calo), 2.0g/kg (tăng cơ)
    let proteinFactor = userProfile.goal === 'lose' ? 1.8 : (userProfile.goal === 'gain' ? 2.0 : 1.6);
    window.dailyProteinTarget = Math.round(userProfile.weight * proteinFactor);
    // Mục tiêu xơ: ~14g cho mỗi 1000 kcal TDEE (khuyến nghị dinh dưỡng phổ biến)
    window.dailyFiberTarget = Math.round((tdee / 1000) * 14);

    const proTargetEl = document.getElementById('macro-pro-target');
    if (proTargetEl) proTargetEl.innerText = window.dailyProteinTarget;
    const fiberTargetEl = document.getElementById('macro-fiber-target');
    if (fiberTargetEl) fiberTargetEl.innerText = window.dailyFiberTarget;

    updateWaterUI();
    updateFoodUI();
}

/* =========================================
   5. GIẤC NGỦ & TÍNH CHU KỲ (REM/MỆT)
   ========================================= */
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

    // FIX LỖI STREAK QUY ĐỔI GIỜ 0H-12H SÁNG THÀNH 24H+ 
    let sH_adj = sH < 12 ? sH + 24 : sH;
    let stH_adj = stH < 12 ? stH + 24 : stH;
    let isStreak = (sH_adj < stH_adj) || (sH_adj === stH_adj && sM <= stM);

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
        persist('helnai_sleep_logs', sleepLogs);
        renderSleep();
        renderDateBars();
        renderOverviewReport();
        showToast("Đã lưu nhật ký giấc ngủ!");
        document.getElementById('btn-log-sleep').style.display = 'none';
    }
};

window.deleteSleep = function() {
    delete sleepLogs[selectedDate];
    persist('helnai_sleep_logs', sleepLogs);
    renderSleep();
    renderDateBars();
    renderOverviewReport();
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

/* ---------- 5B. NGỦ TRƯA (NAP) ---------- */
let lastNapResult = null;

window.calculateNap = function() {
    const sTime = document.getElementById('nap-start-time').value;
    const eTime = document.getElementById('nap-end-time').value;
    if (!sTime || !eTime) { showToast("Nhập đủ giờ bắt đầu và kết thúc ngủ trưa!"); return; }

    let [sH, sM] = sTime.split(':').map(Number);
    let [eH, eM] = eTime.split(':').map(Number);

    let sDate = new Date(2000, 0, 1, sH, sM);
    let eDate = new Date(2000, 0, (eH < sH || (eH === sH && eM <= sM)) ? 2 : 1, eH, eM);
    let diffMinutes = Math.round((eDate - sDate) / 60000);

    let advice = "";
    if (diffMinutes <= 30) {
        advice = "🟢 <b>Power nap lý tưởng!</b> Dưới 30 phút giúp tỉnh táo nhanh, không gây lừ đừ (sleep inertia).";
    } else if (diffMinutes <= 60) {
        advice = "🟡 <b>Hơi dài.</b> 30-60 phút có thể khiến bạn hơi mệt/lờ đờ lúc mới dậy do rơi vào giấc ngủ sâu.";
    } else {
        advice = "🔴 <b>Ngủ trưa quá dài!</b> Trên 60 phút dễ ảnh hưởng tới giấc ngủ tối và gây cảm giác uể oải kéo dài.";
    }

    lastNapResult = { id: Date.now(), duration: diffMinutes, adviceMsg: advice };

    document.getElementById('nap-result').innerHTML = `
        <p>Thời lượng ngủ trưa: <b>${diffMinutes} phút</b></p>
        <p>${advice}</p>
    `;
    document.getElementById('btn-log-nap').style.display = 'block';
};

window.saveNapLog = function() {
    if (lastNapResult) {
        if (!napLogs[selectedDate]) napLogs[selectedDate] = [];
        napLogs[selectedDate].push(lastNapResult);
        persist('helnai_nap_logs', napLogs);
        renderNap();
        renderOverviewReport();
        showToast("Đã lưu giấc ngủ trưa!");
        document.getElementById('btn-log-nap').style.display = 'none';
    }
};

window.deleteNap = function(id) {
    if (napLogs[selectedDate]) {
        napLogs[selectedDate] = napLogs[selectedDate].filter(n => n.id !== id);
        persist('helnai_nap_logs', napLogs);
        renderNap();
        renderOverviewReport();
        showToast("Đã xóa!");
    }
};

function renderNap() {
    const historyEl = document.getElementById('nap-history');
    if (!historyEl) return;
    const logs = napLogs[selectedDate] || [];
    if (logs.length === 0) {
        historyEl.innerHTML = `<p class="suggestion">Chưa có giấc ngủ trưa nào cho ngày này.</p>`;
        return;
    }
    historyEl.innerHTML = logs.map(n => `
        <div class="history-item">
            <div class="history-item-info">
                <strong>Ngủ trưa: ${n.duration} phút</strong>
            </div>
            <button type="button" class="btn-delete" onclick="deleteNap(${n.id})">Xóa</button>
        </div>
    `).join('');
}

/* =========================================
   6. UỐNG NƯỚC
   ========================================= */
window.addWater = function() {
    const type = document.getElementById('water-type').value;
    const amount = parseInt(document.getElementById('water-custom-amount').value);
    if (!amount || amount <= 0) { showToast("Nhập số ml hợp lệ nha!"); return; }

    if (!waterLogs[selectedDate]) waterLogs[selectedDate] = [];
    waterLogs[selectedDate].unshift({
        id: Date.now(), type: type, amount: amount,
        time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
    });

    persist('helnai_water_logs', waterLogs);
    document.getElementById('water-custom-amount').value = '';
    updateWaterUI();
    renderDateBars();
    renderOverviewReport();
    showToast("Đã thêm nước!");
};

window.deleteWater = function(id) {
    if (waterLogs[selectedDate]) {
        waterLogs[selectedDate] = waterLogs[selectedDate].filter(log => log.id !== id);
        persist('helnai_water_logs', waterLogs);
        updateWaterUI();
        renderDateBars();
        renderOverviewReport();
        showToast("Đã xóa!");
    }
};

function updateWaterUI() {
    const targetEl = document.getElementById('water-target');
    if (!targetEl) return;
    const target = parseInt(targetEl.innerText) || 2000;
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
   7. ĂN UỐNG - TÌM KIẾM, SỐ LƯỢNG RÕ RÀNG,
      NHẬP TAY ĐẦY ĐỦ MACRO, MỤC TIÊU THEO TỪNG NGƯỜI
   ========================================= */

const localFallbackDatabase = {
    "phở bò": { cal: 350, p: 20, c: 45, f: 10, fb: 1 },
    "phở gà": { cal: 300, p: 18, c: 45, f: 8, fb: 1 },
    "bún chả": { cal: 450, p: 22, c: 55, f: 15, fb: 2 },
    "bánh mì kẹp thịt": { cal: 400, p: 15, c: 50, f: 15, fb: 2 },
    "bánh mì trứng": { cal: 320, p: 11, c: 40, f: 12, fb: 1 },
    "cơm tấm sườn": { cal: 527, p: 25, c: 70, f: 17, fb: 1 },
    "hủ tiếu": { cal: 380, p: 15, c: 55, f: 10, fb: 1 },
    "trứng luộc": { cal: 72, p: 6, c: 0, f: 5, fb: 0 },
    "ức gà luộc": { cal: 165, p: 31, c: 0, f: 3, fb: 0 },
    "cơm trắng": { cal: 130, p: 2, c: 28, f: 0, fb: 0 }
};

function normalizeFoodName(name) {
    return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

function createCustomModal(title, bodyHTML, confirmText, onConfirm) {
    let existing = document.getElementById('helnai-dynamic-modal');
    if (existing) existing.remove();

    const modalDiv = document.createElement('div');
    modalDiv.id = 'helnai-dynamic-modal';
    modalDiv.className = 'modal active';

    modalDiv.innerHTML = `
        <div class="modal-content glass" style="max-width: 420px; animation: fadeIn 0.3s ease;">
            <h3 style="color: var(--primary); margin-bottom: 12px; font-size: 18px;">${title}</h3>
            <div style="margin-bottom: 20px; color: var(--text-color); font-size: 14px;">
                ${bodyHTML}
            </div>
            <div style="display: flex; gap: 10px; justify-content: flex-end;">
                <button type="button" class="btn-secondary" id="hd-modal-cancel" style="padding: 10px 16px;">Hủy</button>
                <button type="button" class="btn-primary" id="hd-modal-confirm" style="padding: 10px 16px;">${confirmText}</button>
            </div>
        </div>
    `;

    document.body.appendChild(modalDiv);

    const closeModal = () => {
        modalDiv.classList.remove('active');
        setTimeout(() => modalDiv.remove(), 250);
    };

    document.getElementById('hd-modal-confirm').addEventListener('click', () => {
        onConfirm(modalDiv, closeModal);
    });

    document.getElementById('hd-modal-cancel').addEventListener('click', closeModal);
    modalDiv.addEventListener('click', (e) => {
        if (e.target === modalDiv) closeModal();
    });
}

window.changeFoodQty = function(delta) {
    const el = document.getElementById('food-qty');
    if (!el) return;
    let val = parseFloat(el.value) || 1;
    val = Math.max(0.5, Math.round((val + delta * 0.5) * 10) / 10);
    el.value = val;
};

function getFoodQtyMultiplier() {
    const qtyEl = document.getElementById('food-qty');
    let qty = qtyEl ? (parseFloat(qtyEl.value) || 1) : 1;
    if (qty <= 0) qty = 1;
    return qty;
}

function resetFoodQty() {
    const qtyEl = document.getElementById('food-qty');
    if (qtyEl) qtyEl.value = 1;
    const unitEl = document.getElementById('food-unit');
    if (unitEl) unitEl.value = 'unit';
}

async function searchFoodFromAPI(foodQuery) {
    try {
        const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(foodQuery)}&search_simple=1&action=process&json=1&page_size=5`;
        const response = await fetch(url);
        if (!response.ok) return null;

        const data = await response.json();
        if (data && data.products && data.products.length > 0) {
            for (let product of data.products) {
                const nut = product.nutriments;
                if (nut && (nut['energy-kcal_100g'] !== undefined || nut['energy-kcal'] !== undefined)) {
                    return {
                        name: product.product_name_vi || product.product_name || foodQuery,
                        cal: Math.round(nut['energy-kcal_100g'] || nut['energy-kcal'] || 0),
                        p: Math.round(nut['proteins_100g'] || 0),
                        c: Math.round(nut['carbohydrates_100g'] || 0),
                        f: Math.round(nut['fat_100g'] || 0),
                        fb: parseFloat(nut['fiber_100g'] || 0)
                    };
                }
            }
        }
    } catch (error) {
        console.error("Lỗi khi kết nối với API thực phẩm:", error);
    }
    return null;
}

function addFoodToLog(displayName, baseNut, multiplier) {
    let finalCal = Math.round(baseNut.cal * multiplier);
    let finalP = Math.round(baseNut.p * multiplier);
    let finalC = Math.round(baseNut.c * multiplier);
    let finalF = Math.round(baseNut.f * multiplier);
    let finalFb = Math.round((baseNut.fb || 0) * multiplier * 10) / 10;

    foodLogs[selectedDate].unshift({
        id: Date.now(),
        name: displayName,
        cal: finalCal,
        p: finalP,
        c: finalC,
        f: finalF,
        fb: finalFb
    });

    persist('helnai_food_logs', foodLogs);
    updateFoodUI();
    renderDateBars();
    renderOverviewReport();
    showToast(`Đã thêm: ${displayName} (~${finalCal} kcal)!`);
}

window.addFood = async function() {
    const nameInput = document.getElementById('food-input');
    const rawName = nameInput.value.trim();
    if (!rawName) { showToast("Nhập tên món ăn nha!"); return; }

    const multiplier = getFoodQtyMultiplier();
    const lowerName = normalizeFoodName(rawName);
    const displayName = multiplier === 1 ? rawName : `${rawName} x${multiplier}`;

    if (!foodLogs[selectedDate]) foodLogs[selectedDate] = [];

    if (customFoodDatabase[lowerName]) {
        addFoodToLog(displayName, customFoodDatabase[lowerName], multiplier);
        nameInput.value = "";
        resetFoodQty();
        return;
    }

    showToast("🔍 Đang tìm kiếm thông tin dinh dưỡng...");

    let nut = await searchFoodFromAPI(rawName);

    if (!nut && localFallbackDatabase[lowerName]) {
        nut = localFallbackDatabase[lowerName];
    }

    if (nut) {
        addFoodToLog(displayName, nut, multiplier);
        nameInput.value = "";
        resetFoodQty();
    } else {
        createCustomModal(
            "Tự nhập dinh dưỡng ✍️",
            `
            <p style="margin-bottom: 12px; color: var(--text-sub); line-height: 1.4;">
                Hệ thống chưa có dữ liệu của món <b>"${rawName}"</b>. Vui lòng nhập chỉ số cho <b>1 đơn vị/100g</b> (hệ thống sẽ tự nhân với số lượng bạn chọn):
            </p>
            <div class="input-group" style="margin-bottom:10px;">
                <label style="font-weight: 700;">Calo (kcal):</label>
                <input type="number" id="hd-input-calo" placeholder="VD: 150" style="margin-top: 5px; width:100%;" min="0">
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                <div class="input-group">
                    <label style="font-weight: 700;">Đạm (g):</label>
                    <input type="number" id="hd-input-p" placeholder="0" style="margin-top: 5px; width:100%;" min="0">
                </div>
                <div class="input-group">
                    <label style="font-weight: 700;">Tinh bột (g):</label>
                    <input type="number" id="hd-input-c" placeholder="0" style="margin-top: 5px; width:100%;" min="0">
                </div>
                <div class="input-group">
                    <label style="font-weight: 700;">Béo (g):</label>
                    <input type="number" id="hd-input-f" placeholder="0" style="margin-top: 5px; width:100%;" min="0">
                </div>
                <div class="input-group">
                    <label style="font-weight: 700;">Xơ (g):</label>
                    <input type="number" id="hd-input-fb" placeholder="0" style="margin-top: 5px; width:100%;" min="0">
                </div>
            </div>
            <p style="font-size:12px; color:var(--text-sub); margin-top:8px;">*Để trống nếu không rõ, hệ thống sẽ tính 0.</p>
            `,
            "Thêm món",
            (modalElement, closeModal) => {
                const calVal = parseInt(document.getElementById('hd-input-calo').value);
                if (isNaN(calVal) || calVal < 0) {
                    showToast("Vui lòng nhập số calo hợp lệ!");
                    return;
                }

                let baseNut = {
                    cal: calVal,
                    p: parseFloat(document.getElementById('hd-input-p').value) || 0,
                    c: parseFloat(document.getElementById('hd-input-c').value) || 0,
                    f: parseFloat(document.getElementById('hd-input-f').value) || 0,
                    fb: parseFloat(document.getElementById('hd-input-fb').value) || 0
                };

                customFoodDatabase[lowerName] = baseNut;
                persist('helnai_custom_foods', customFoodDatabase);

                addFoodToLog(displayName, baseNut, multiplier);

                nameInput.value = "";
                resetFoodQty();
                closeModal();
            }
        );
    }
};

window.editFoodCalories = function(id, foodName) {
    let currentLogs = foodLogs[selectedDate] || [];
    let item = currentLogs.find(l => l.id === id);
    if (!item) return;

    createCustomModal(
        "Sửa dinh dưỡng ✏️",
        `
        <p style="margin-bottom: 12px; color: var(--text-sub); line-height: 1.4;">
            Sửa chỉ số dinh dưỡng cho món <b>"${foodName}"</b> (chỉ áp dụng cho lần ghi này):
        </p>
        <div class="input-group" style="margin-bottom:10px;">
            <label style="font-weight: 700;">Calo (kcal):</label>
            <input type="number" id="hd-edit-calo" value="${item.cal}" style="margin-top: 5px; width:100%;" min="0">
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
            <div class="input-group">
                <label style="font-weight: 700;">Đạm (g):</label>
                <input type="number" id="hd-edit-p" value="${item.p}" style="margin-top: 5px; width:100%;" min="0">
            </div>
            <div class="input-group">
                <label style="font-weight: 700;">Tinh bột (g):</label>
                <input type="number" id="hd-edit-c" value="${item.c}" style="margin-top: 5px; width:100%;" min="0">
            </div>
            <div class="input-group">
                <label style="font-weight: 700;">Béo (g):</label>
                <input type="number" id="hd-edit-f" value="${item.f}" style="margin-top: 5px; width:100%;" min="0">
            </div>
            <div class="input-group">
                <label style="font-weight: 700;">Xơ (g):</label>
                <input type="number" id="hd-edit-fb" value="${item.fb}" style="margin-top: 5px; width:100%;" min="0">
            </div>
        </div>
        `,
        "Cập nhật",
        (modalElement, closeModal) => {
            const newCal = parseInt(document.getElementById('hd-edit-calo').value);
            if (isNaN(newCal) || newCal < 0) {
                showToast("Số calo không hợp lệ!");
                return;
            }

            item.cal = newCal;
            item.p = parseFloat(document.getElementById('hd-edit-p').value) || 0;
            item.c = parseFloat(document.getElementById('hd-edit-c').value) || 0;
            item.f = parseFloat(document.getElementById('hd-edit-f').value) || 0;
            item.fb = parseFloat(document.getElementById('hd-edit-fb').value) || 0;

            persist('helnai_food_logs', foodLogs);

            updateFoodUI();
            renderOverviewReport();
            showToast("Đã lưu thông tin dinh dưỡng mới!");
            closeModal();
        }
    );
};

window.deleteFood = function(id) {
    if (foodLogs[selectedDate]) {
        foodLogs[selectedDate] = foodLogs[selectedDate].filter(log => log.id !== id);
        persist('helnai_food_logs', foodLogs);
        updateFoodUI();
        renderDateBars();
        renderOverviewReport();
        showToast("Đã xóa món!");
    }
};

/* ---------- QUẢN LÝ MÓN ĂN ĐÃ LƯU ---------- */
window.openFoodDbManager = function() {
    const keys = Object.keys(customFoodDatabase).sort();
    let bodyHTML = keys.length === 0
        ? `<p class="suggestion">Chưa có món ăn tự lưu nào.</p>`
        : `<ul style="list-style:none; padding:0; max-height:320px; overflow-y:auto;">` +
            keys.map(k => {
                const f = customFoodDatabase[k];
                return `
                    <li class="history-item" style="margin-bottom:8px;">
                        <div class="history-item-info">
                            <strong>${k}</strong>
                            <span style="font-size:12px; color:var(--text-sub)">
                                ${f.cal} kcal • Đ:${f.p}g B:${f.c}g Béo:${f.f}g Xơ:${f.fb || 0}g
                            </span>
                        </div>
                        <div style="display:flex; gap:6px;">
                            <button type="button" class="btn-secondary" style="padding:4px 8px; font-size:12px;" onclick="editCustomFoodEntry('${k}')">Sửa</button>
                            <button type="button" class="btn-delete" onclick="deleteCustomFoodEntry('${k}')">Xóa</button>
                        </div>
                    </li>`;
            }).join('') +
          `</ul>`;

    createCustomModal("Món ăn đã lưu 📒", bodyHTML, "Đóng", (m, close) => close());
};

window.editCustomFoodEntry = function(key) {
    const f = customFoodDatabase[key];
    if (!f) return;

    createCustomModal(
        "Sửa món ăn ✏️",
        `
        <div class="input-group" style="margin-bottom:10px;">
            <label style="font-weight: 700;">Tên món</label>
            <input type="text" id="hd-edit-name" value="${key}" style="margin: 5px 0; width:100%;">
        </div>
        <div class="input-group" style="margin-bottom:10px;">
            <label style="font-weight: 700;">Calo (cho 1 đơn vị hoặc 100g)</label>
            <input type="number" id="hd-edit-db-calo" value="${f.cal}" min="0" style="width:100%;">
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
            <div class="input-group">
                <label style="font-weight: 700;">Đạm (g):</label>
                <input type="number" id="hd-edit-db-p" value="${f.p}" style="width:100%;" min="0">
            </div>
            <div class="input-group">
                <label style="font-weight: 700;">Tinh bột (g):</label>
                <input type="number" id="hd-edit-db-c" value="${f.c}" style="width:100%;" min="0">
            </div>
            <div class="input-group">
                <label style="font-weight: 700;">Béo (g):</label>
                <input type="number" id="hd-edit-db-f" value="${f.f}" style="width:100%;" min="0">
            </div>
            <div class="input-group">
                <label style="font-weight: 700;">Xơ (g):</label>
                <input type="number" id="hd-edit-db-fb" value="${f.fb || 0}" style="width:100%;" min="0">
            </div>
        </div>
        `,
        "Lưu",
        (modalElement, closeModal) => {
            const newName = normalizeFoodName(document.getElementById('hd-edit-name').value);
            const newCal = parseInt(document.getElementById('hd-edit-db-calo').value);

            if (!newName) { showToast("Tên món không được để trống!"); return; }
            if (isNaN(newCal) || newCal < 0) { showToast("Số calo không hợp lệ!"); return; }

            if (newName !== key) delete customFoodDatabase[key];

            customFoodDatabase[newName] = {
                cal: newCal,
                p: parseFloat(document.getElementById('hd-edit-db-p').value) || 0,
                c: parseFloat(document.getElementById('hd-edit-db-c').value) || 0,
                f: parseFloat(document.getElementById('hd-edit-db-f').value) || 0,
                fb: parseFloat(document.getElementById('hd-edit-db-fb').value) || 0
            };
            persist('helnai_custom_foods', customFoodDatabase);

            showToast("Đã cập nhật món ăn!");
            closeModal();
            openFoodDbManager();
        }
    );
};

window.deleteCustomFoodEntry = function(key) {
    delete customFoodDatabase[key];
    persist('helnai_custom_foods', customFoodDatabase);
    showToast("Đã xóa món khỏi bộ nhớ!");
    openFoodDbManager();
};

function updateFoodUI() {
    const targetEl = document.getElementById('target-calo-display');
    if (!targetEl) return;
    const target = parseInt(targetEl.innerText) || 2000;
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

    // STREAK có mức tối thiểu: dưới BMR không tính streak (nạp quá ít cũng không tốt)
    const streakMsg = document.getElementById('food-streak-msg');
    if (tCal >= bmr && tCal <= tdee) {
        streakMsg.innerHTML = "🔥 Streak Kiểm Soát Calo Tốt!";
    } else if (tCal > tdee) {
        streakMsg.innerHTML = `<span style="color:var(--danger)">⚠️ Đã vượt mức Calo tối đa!</span>`;
    } else if (tCal > 0 && tCal < bmr) {
        streakMsg.innerHTML = `<span style="color:var(--danger)">⚠️ Nạp quá ít, dưới mức tối thiểu ${bmr} kcal!</span>`;
    } else {
        streakMsg.innerText = "";
    }

    // Lời khuyên đạm/xơ theo mục tiêu CÁ NHÂN (tính theo cân nặng & TDEE), không còn số cố định
    const proteinTarget = window.dailyProteinTarget || 50;
    const fiberTarget = window.dailyFiberTarget || 25;
    let advice = "";
    if (tP < proteinTarget) advice += `Nên thêm đạm (còn thiếu ~${proteinTarget - tP}g). `;
    if (tFb < fiberTarget) advice += `Thêm chất xơ (còn thiếu ~${Math.round(fiberTarget - tFb)}g).`;
    document.getElementById('food-advice').innerText = advice || "Dinh dưỡng khá cân bằng!";

    document.getElementById('food-list').innerHTML = logs.map(log => `
        <li class="history-item" style="cursor: pointer;" title="Bấm vào để sửa số Calo">
            <div class="history-item-info" onclick="editFoodCalories(${log.id}, '${log.name}')">
                <strong>${log.name} (${log.cal} kcal) ✏️</strong>
                <span style="font-size:12px; color:var(--text-sub)">Đ: ${log.p}g | B: ${log.c}g | Béo: ${log.f}g | Xơ: ${log.fb}g</span>
            </div>
            <button type="button" class="btn-delete" onclick="deleteFood(${log.id})">Xóa</button>
        </li>
    `).join('');
}

/* =========================================
   8. THỂ THAO - GỢI Ý BÀI TẬP, NÚT TRẠNG THÁI ACTIVE,
      LOẠI BÀI TẬP TỰ NHẬP
   ========================================= */
window.setWorkoutStatus = function(status) {
    if (!workoutLogs[selectedDate]) workoutLogs[selectedDate] = { mode: 'normal', items: [] };
    workoutLogs[selectedDate].mode = status;
    persist('helnai_workout_logs', workoutLogs);
    renderWorkout();
    renderDateBars();
    renderOverviewReport();
};

function syncWorkoutModeButtons(mode) {
    document.querySelectorAll('.workout-mode-buttons button').forEach(b => {
        b.classList.toggle('active', b.dataset.mode === mode);
    });
}

window.toggleCustomWorkoutType = function() {
    const sel = document.getElementById('workout-type');
    const customInput = document.getElementById('workout-type-custom');
    if (!sel || !customInput) return;
    customInput.style.display = sel.value === 'Khác' ? 'block' : 'none';
    if (sel.value === 'Khác') customInput.focus();
};

function getFinalWorkoutType() {
    const sel = document.getElementById('workout-type');
    if (sel.value === 'Khác') {
        const customVal = document.getElementById('workout-type-custom').value.trim();
        return customVal || 'Khác';
    }
    return sel.value;
}

window.addWorkout = function() {
    const inputEl = document.getElementById('workout-input');
    const text = inputEl.value;
    const duration = parseInt(document.getElementById('workout-duration').value) || 30;
    const type = getFinalWorkoutType();

    if (!text.trim()) { showToast("Nhập tên bài tập nha!"); return; }

    if (!workoutLogs[selectedDate]) workoutLogs[selectedDate] = { mode: 'normal', items: [] };
    if (!workoutLogs[selectedDate].items) workoutLogs[selectedDate].items = [];

    workoutLogs[selectedDate].items.unshift({
        id: Date.now(), text: text, duration: duration, type: type, done: false
    });

    persist('helnai_workout_logs', workoutLogs);

    // Lưu vào lịch sử bài tập để gợi ý lần sau (tần suất càng dùng nhiều càng lên top)
    const key = normalizeFoodName(text);
    const existing = workoutHistoryDB[key];
    workoutHistoryDB[key] = {
        text: text,
        duration: duration,
        type: type,
        count: (existing?.count || 0) + 1
    };
    persist('helnai_workout_history', workoutHistoryDB);
    renderWorkoutSuggestions();

    inputEl.value = "";
    document.getElementById('workout-duration').value = "";
    if (document.getElementById('workout-type-custom')) {
        document.getElementById('workout-type-custom').value = "";
        document.getElementById('workout-type-custom').style.display = 'none';
    }
    document.getElementById('workout-type').value = "Fullbody";

    renderWorkout();
    renderDateBars();
    renderOverviewReport();
    showToast("Đã thêm bài tập!");
};

// Điền nhanh 1 bài tập từ gợi ý vào form
window.fillWorkoutFromSuggestion = function(key) {
    const item = workoutHistoryDB[key];
    if (!item) return;
    document.getElementById('workout-input').value = item.text;
    document.getElementById('workout-duration').value = item.duration;
    const sel = document.getElementById('workout-type');
    const knownTypes = ['Fullbody', 'Leg day', 'Upper body', 'Cardio'];
    if (knownTypes.includes(item.type)) {
        sel.value = item.type;
        document.getElementById('workout-type-custom').style.display = 'none';
    } else {
        sel.value = 'Khác';
        const customInput = document.getElementById('workout-type-custom');
        customInput.style.display = 'block';
        customInput.value = item.type;
    }
};

// Vẽ danh sách gợi ý (top bài tập dùng nhiều nhất) + datalist cho autocomplete
function renderWorkoutSuggestions() {
    const datalistEl = document.getElementById('workout-suggestions');
    const quickPicksEl = document.getElementById('workout-quick-picks');

    const entries = Object.entries(workoutHistoryDB).sort((a, b) => b[1].count - a[1].count);

    if (datalistEl) {
        datalistEl.innerHTML = entries.map(([key, val]) => `<option value="${val.text}"></option>`).join('');
    }

    if (quickPicksEl) {
        const top = entries.slice(0, 6);
        if (top.length === 0) {
            quickPicksEl.innerHTML = `<span style="font-size:12px; color:var(--text-sub);">Chưa có bài tập nào được lưu. Thêm bài tập để lần sau được gợi ý nhanh!</span>`;
        } else {
            quickPicksEl.innerHTML = top.map(([key, val]) => `
                <button type="button" class="chip-btn" onclick="fillWorkoutFromSuggestion('${key}')">
                    ${val.text} <span style="opacity:0.6; font-size:11px;">(${val.duration}p)</span>
                </button>
            `).join('');
        }
    }
}

window.deleteWorkout = function(id) {
    if (workoutLogs[selectedDate] && workoutLogs[selectedDate].items) {
        workoutLogs[selectedDate].items = workoutLogs[selectedDate].items.filter(w => w.id !== id);
        persist('helnai_workout_logs', workoutLogs);
        renderWorkout();
        renderDateBars();
        renderOverviewReport();
    }
};

window.toggleWorkout = function(id) {
    if (workoutLogs[selectedDate] && workoutLogs[selectedDate].items) {
        workoutLogs[selectedDate].items = workoutLogs[selectedDate].items.map(w => w.id === id ? { ...w, done: !w.done } : w);
        persist('helnai_workout_logs', workoutLogs);
        renderWorkout();
        renderDateBars();
        renderOverviewReport();
    }
};

function renderWorkout() {
    const dayData = workoutLogs[selectedDate] || { mode: 'normal', items: [] };
    const statusMsg = document.getElementById('workout-status-msg');
    const items = dayData.items || [];

    syncWorkoutModeButtons(dayData.mode || 'normal');

    let totalMinutes = 0;
    items.forEach(w => { if(w.done) totalMinutes += w.duration; });

    if (dayData.mode === 'off') {
        if(statusMsg) statusMsg.innerText = "🛌 Hôm nay là Ngày Nghỉ (Day Off). Bạn hãy nghỉ ngơi và nạp lại năng lượng thật tốt nha! 🌸";
    } else if (dayData.mode === 'cheat') {
        if(statusMsg) statusMsg.innerText = "🍕 Hôm nay là Cheat Day! Thỏa sức tận hưởng nhưng nhớ đừng ăn quá lố nhen! 😉";
    } else {
        if (totalMinutes > 0) {
            if(statusMsg) statusMsg.innerText = `🔥 Giỏi quá! Hôm nay bạn đã tập luyện được ${totalMinutes} phút. Cố gắng phát huy nhé!`;
        } else {
            if(statusMsg) statusMsg.innerText = "💪 Hôm nay bạn dự định tập bài gì thế?";
        }
    }

    const listEl = document.getElementById('workout-list');
    if (!listEl) return;
    listEl.innerHTML = items.map(w => `
        <li class="history-item ${w.done ? 'workout-done' : ''}">
            <div style="display:flex; align-items:center; gap:10px;">
                <input type="checkbox" ${w.done ? 'checked' : ''} onchange="toggleWorkout(${w.id})">
                <span style="${w.done ? 'text-decoration: line-through; opacity:0.6;' : ''}">[${w.type}] ${w.text} (${w.duration} phút)</span>
            </div>
            <button type="button" class="btn-delete" onclick="deleteWorkout(${w.id})">Xóa</button>
        </li>
    `).join('');
}

/* =========================================
   9. TỔNG QUAN - BÁO CÁO NGÀY
   ========================================= */
function renderOverviewReport() {
    const el = document.getElementById('daily-report-card');
    if (!el) return;

    const dateLabel = selectedDate === new Date().toISOString().split('T')[0] ? "Hôm nay" : selectedDate;

    // Giấc ngủ
    const sleep = sleepLogs[selectedDate];
    const sleepHTML = sleep
        ? `${sleep.duration} (${sleep.cycles} chu kỳ) ${sleep.isStreak ? '🔥' : '😴'}`
        : `<span style="color:var(--text-sub)">Chưa ghi nhận</span>`;

    // Ngủ trưa
    const naps = napLogs[selectedDate] || [];
    const napTotal = naps.reduce((s, n) => s + n.duration, 0);
    const napHTML = naps.length > 0 ? `${napTotal} phút (${naps.length} lần)` : `<span style="color:var(--text-sub)">Không có</span>`;

    // Nước
    const waterTarget = parseInt(document.getElementById('water-target')?.innerText) || 2000;
    const waterLogsToday = waterLogs[selectedDate] || [];
    const waterTotal = waterLogsToday.reduce((s, l) => s + l.amount, 0);
    const waterHTML = `${waterTotal} / ${waterTarget} ml ${waterTotal >= waterTarget ? '🔥' : '💧'}`;

    // Ăn uống
    const bmr = parseInt(document.getElementById('stat-bmr')?.innerText) || 1200;
    const tdee = parseInt(document.getElementById('stat-tdee')?.innerText) || 2000;
    const foodLogsToday = foodLogs[selectedDate] || [];
    const foodTotal = foodLogsToday.reduce((s, l) => s + l.cal, 0);
    let foodStatusIcon = '🍏';
    if (foodTotal > 0) foodStatusIcon = (foodTotal >= bmr && foodTotal <= tdee) ? '🔥' : '⚠️';
    const foodHTML = `${foodTotal} kcal (khoảng ${bmr}-${tdee} kcal) ${foodStatusIcon}`;

    // Vận động
    const workoutDay = workoutLogs[selectedDate];
    let workoutHTML = `<span style="color:var(--text-sub)">Chưa ghi nhận</span>`;
    if (workoutDay) {
        if (workoutDay.mode === 'off') workoutHTML = "🛌 Ngày nghỉ";
        else if (workoutDay.mode === 'cheat') workoutHTML = "🍕 Cheat Day";
        else {
            const items = workoutDay.items || [];
            const doneMin = items.filter(i => i.done).reduce((s, i) => s + i.duration, 0);
            workoutHTML = items.length > 0 ? `${doneMin} phút đã hoàn thành / ${items.length} bài` : `<span style="color:var(--text-sub)">Chưa có bài tập</span>`;
        }
    }

    el.innerHTML = `
        <h3 style="margin-bottom:14px;">Báo cáo ngày: ${dateLabel} 📋</h3>
        <div class="report-row"><span>🌙 Giấc ngủ</span><strong>${sleepHTML}</strong></div>
        <div class="report-row"><span>😴 Ngủ trưa</span><strong>${napHTML}</strong></div>
        <div class="report-row"><span>💧 Nước</span><strong>${waterHTML}</strong></div>
        <div class="report-row"><span>🍏 Ăn uống</span><strong>${foodHTML}</strong></div>
        <div class="report-row"><span>🏃 Vận động</span><strong>${workoutHTML}</strong></div>
    `;
}

/* =========================================
   10. KHỞI CHẠY HỆ THỐNG AN TOÀN
   ========================================= */
document.addEventListener('DOMContentLoaded', () => {
    renderDateBars();

    const userModal = document.getElementById('user-modal');
    if (!userProfile) {
        if (userModal) userModal.classList.add('active');
    } else {
        if (userModal) userModal.classList.remove('active');
        calculateAndDisplayStats();
    }

    renderSleep();
    renderNap();
    updateWaterUI();
    updateFoodUI();
    renderWorkout();
    renderWorkoutSuggestions();
    renderOverviewReport();
});
