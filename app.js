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
let waterLogs = safeLoadData('helnai_water_logs');
let foodLogs = safeLoadData('helnai_food_logs');
let workoutLogs = safeLoadData('helnai_workout_logs');
let customFoodDatabase = safeLoadData('helnai_custom_foods');
// Đọc API Key lưu trữ từ LocalStorage nếu có
let storedApiKey = localStorage.getItem('helnai_api_key') || "";

/* =========================================
   3. FIREBASE AUTH
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
    localStorage.setItem('helnai_user_profile', JSON.stringify(userProfile));
    
    // Lưu khóa API cấu hình cá nhân
    const apiKeyVal = document.getElementById('api-key').value.trim();
    localStorage.setItem('helnai_api_key', apiKeyVal);
    storedApiKey = apiKeyVal;

    const userModal = document.getElementById('user-modal');
    if (userModal) userModal.classList.remove('active');
    
    calculateAndDisplayStats();
    renderDateBars();
    showToast("Đã lưu hồ sơ sức khỏe! 🌸");
};

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
   7. ĂN UỐNG - TÌM KIẾM, BỘ CHỌN SỐ LƯỢNG RÕ RÀNG
      & QUẢN LÝ MÓN ĂN ĐÃ LƯU (SỬA/XÓA)
   ========================================= */

// Danh sách dự phòng các món ăn Việt Nam nấu thủ công phổ biến
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

// Chuẩn hóa tên món để tránh trùng lặp do khoảng trắng/hoa-thường
function normalizeFoodName(name) {
    return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

// Hàm phụ trợ tạo Modal động bằng JS để giữ nguyên file index.html của bạn
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

/* ---------- BỘ CHỌN SỐ LƯỢNG (thay cho parse từ câu chữ) ---------- */
// Yêu cầu HTML có: #food-qty (input number), #food-unit (select, tùy chọn)
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

// Hàm gọi API tìm kiếm từ Open Food Facts
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

// Hàm đưa sản phẩm đã tính toán hệ số lượng vào nhật ký
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

    localStorage.setItem('helnai_food_logs', JSON.stringify(foodLogs));
    updateFoodUI();
    renderDateBars();
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

    // 1. Kiểm tra bộ nhớ cá nhân
    if (customFoodDatabase[lowerName]) {
        addFoodToLog(displayName, customFoodDatabase[lowerName], multiplier);
        nameInput.value = "";
        resetFoodQty();
        return;
    }

    showToast("🔍 Đang tìm kiếm thông tin dinh dưỡng...");

    // 2. Tìm kiếm qua API
    let nut = await searchFoodFromAPI(rawName);

    // 3. Sử dụng bộ dữ liệu dự phòng cục bộ
    if (!nut && localFallbackDatabase[lowerName]) {
        nut = localFallbackDatabase[lowerName];
    }

    if (nut) {
        addFoodToLog(displayName, nut, multiplier);
        nameInput.value = "";
        resetFoodQty();
    } else {
        // 4. Nếu không tìm thấy, hiện Modal nhập calo thủ công
        createCustomModal(
            "Tự nhập Calo ✍️",
            `
            <p style="margin-bottom: 12px; color: var(--text-sub); line-height: 1.4;">
                Hệ thống chưa có dữ liệu của món <b>"${rawName}"</b>. Vui lòng tự nhập chỉ số calo ước tính cho <b>1 đơn vị/100g</b> (hệ thống sẽ tự nhân với số lượng bạn chọn):
            </p>
            <div class="input-group">
                <label style="font-weight: 700;">Lượng Calo (cho 1 đơn vị hoặc 100g):</label>
                <input type="number" id="hd-input-calo" placeholder="VD: 150" style="margin-top: 5px;" min="0">
            </div>
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
                    p: Math.round(calVal * 0.15 / 4),
                    c: Math.round(calVal * 0.5 / 4),
                    f: Math.round(calVal * 0.35 / 9),
                    fb: 0
                };

                // Lưu lại món ăn tự định nghĩa này vào bộ nhớ (theo tên đã chuẩn hóa)
                customFoodDatabase[lowerName] = baseNut;
                localStorage.setItem('helnai_custom_foods', JSON.stringify(customFoodDatabase));

                addFoodToLog(displayName, baseNut, multiplier);

                nameInput.value = "";
                resetFoodQty();
                closeModal();
            }
        );
    }
};

// Sửa lại lượng Calo của MỘT DÒNG LOG cụ thể trong ngày (không đụng tới bộ nhớ chung)
window.editFoodCalories = function(id, foodName) {
    let currentLogs = foodLogs[selectedDate] || [];
    let item = currentLogs.find(l => l.id === id);
    if (!item) return;

    createCustomModal(
        "Sửa lượng Calo ✏️",
        `
        <p style="margin-bottom: 12px; color: var(--text-sub); line-height: 1.4;">
            Nhập lượng Calo chuẩn mong muốn cho món <b>"${foodName}"</b> (chỉ áp dụng cho lần ghi này):
        </p>
        <div class="input-group">
            <label style="font-weight: 700;">Lượng Calo mới (kcal):</label>
            <input type="number" id="hd-edit-calo" value="${item.cal}" style="margin-top: 5px;" min="0">
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
            item.p = Math.round(newCal * 0.15 / 4);
            item.c = Math.round(newCal * 0.5 / 4);
            item.f = Math.round(newCal * 0.35 / 9);

            localStorage.setItem('helnai_food_logs', JSON.stringify(foodLogs));

            updateFoodUI();
            showToast("Đã lưu số Calo mới cho lần ghi này!");
            closeModal();
        }
    );
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

/* ---------- QUẢN LÝ MÓN ĂN ĐÃ LƯU (customFoodDatabase) ---------- */
// Cho phép xem/sửa/xóa các món đã lưu, độc lập với log theo ngày.
// Gọi window.openFoodDbManager() từ 1 nút trong tab ăn uống, ví dụ:
// <button type="button" onclick="openFoodDbManager()">📒 Món đã lưu</button>

window.openFoodDbManager = function() {
    const keys = Object.keys(customFoodDatabase).sort();
    let bodyHTML = keys.length === 0
        ? `<p class="suggestion">Chưa có món ăn tự lưu nào. Món bạn tự nhập calo sẽ xuất hiện ở đây.</p>`
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
        <div class="input-group">
            <label style="font-weight: 700;">Tên món</label>
            <input type="text" id="hd-edit-name" value="${key}" style="margin: 5px 0 12px; width:100%;">
        </div>
        <div class="input-group">
            <label style="font-weight: 700;">Calo (cho 1 đơn vị hoặc 100g)</label>
            <input type="number" id="hd-edit-db-calo" value="${f.cal}" min="0" style="width:100%;">
        </div>
        `,
        "Lưu",
        (modalElement, closeModal) => {
            const newName = normalizeFoodName(document.getElementById('hd-edit-name').value);
            const newCal = parseInt(document.getElementById('hd-edit-db-calo').value);

            if (!newName) { showToast("Tên món không được để trống!"); return; }
            if (isNaN(newCal) || newCal < 0) { showToast("Số calo không hợp lệ!"); return; }

            // Nếu đổi tên, xóa key cũ trước khi ghi key mới
            if (newName !== key) delete customFoodDatabase[key];

            customFoodDatabase[newName] = {
                cal: newCal,
                p: Math.round(newCal * 0.15 / 4),
                c: Math.round(newCal * 0.5 / 4),
                f: Math.round(newCal * 0.35 / 9),
                fb: f.fb || 0
            };
            localStorage.setItem('helnai_custom_foods', JSON.stringify(customFoodDatabase));

            showToast("Đã cập nhật món ăn!");
            closeModal();
            openFoodDbManager();
        }
    );
};

window.deleteCustomFoodEntry = function(key) {
    delete customFoodDatabase[key];
    localStorage.setItem('helnai_custom_foods', JSON.stringify(customFoodDatabase));
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

    const streakMsg = document.getElementById('food-streak-msg');
    if (tCal > 0 && tCal <= tdee) {
        streakMsg.innerHTML = "🔥 Streak Kiểm Soát Calo Tốt!";
    } else if (tCal > tdee) {
        streakMsg.innerHTML = `<span style="color:var(--danger)">⚠️ Đã vượt mức Calo tối đa!</span>`;
    } else {
        streakMsg.innerText = "";
    }

    let advice = "";
    if (tP < 40) advice += "Nên thêm đạm. ";
    if (tFb < 12) advice += "Thêm chất xơ.";
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
   8. THỂ THAO
   ========================================= */
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
        <li class="history-item">
            <div style="display:flex; align-items:center; gap:10px;">
                <input type="checkbox" ${w.done ? 'checked' : ''} onchange="toggleWorkout(${w.id})">
                <span style="${w.done ? 'text-decoration: line-through; opacity:0.6;' : ''}">[${w.type}] ${w.text} (${w.duration} phút)</span>
            </div>
            <button type="button" class="btn-delete" onclick="deleteWorkout(${w.id})">Xóa</button>
        </li>
    `).join('');
}

/* =========================================
   9. KHỞI CHẠY HỆ THỐNG AN TOÀN
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
    updateWaterUI();
    updateFoodUI();
    renderWorkout();
});
