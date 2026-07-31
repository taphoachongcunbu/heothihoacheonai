/* =========================================
   0. TOAST NOTIFICATION
   ========================================= */
function showToast(message) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerText = message;
    container.appendChild(toast);
    setTimeout(() => { toast.remove(); }, 3000);
}

/* =========================================
   1. CẤU HÌNH FIREBASE
   ========================================= */
const firebaseConfig = {
    apiKey: "AIzaSyDXQZRfGNQ0-_NUPWqxOmjCxWq51T3b3qI",
    authDomain: "healthyhoacheonai.firebaseapp.com",
    projectId: "healthyhoacheonai",
    storageBucket: "healthyhoacheonai.firebasestorage.app",
    messagingSenderId: "707815568295",
    appId: "1:707815568295:web:fc6faeb9e79dc2b6ad7c82"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const provider = new firebase.auth.GoogleAuthProvider();
const authStatusEl = document.getElementById('auth-status');

function setupAuthListeners() {
    const btnLogin = document.getElementById('btn-login');
    if (btnLogin) btnLogin.addEventListener('click', () => { auth.signInWithPopup(provider).catch(err => showToast("Lỗi: " + err.message)); });
    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) btnLogout.addEventListener('click', () => { auth.signOut(); });
}
auth.onAuthStateChanged(user => {
    if (user) {
        authStatusEl.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                <img src="${user.photoURL}" style="width: 32px; height: 32px; border-radius: 50%;">
                <span style="font-weight: 700; font-size: 14px;">${user.displayName}</span>
            </div>
            <button id="btn-logout" class="btn-secondary" style="width: 100%; padding: 6px;">Đăng xuất</button>
        `;
    } else {
        authStatusEl.innerHTML = `<button id="btn-login" class="btn-secondary" style="width: 100%;">Đăng nhập</button>`;
    }
    setupAuthListeners();
});

/* =========================================
   2. HỒ SƠ & TÍNH TOÁN CHỈ SỐ
   ========================================= */
let userProfile = JSON.parse(localStorage.getItem('helnai_user_profile')) || null;
const userModal = document.getElementById('user-modal');

document.getElementById('btn-settings').addEventListener('click', () => {
    if(userProfile) {
        ['weight','height','age','gender','activity','goal'].forEach(id => {
            document.getElementById(id).value = userProfile[id];
        });
    }
    userModal.classList.add('active');
});

if (!userProfile) userModal.classList.add('active');
else calculateAndDisplayStats();

document.getElementById('health-form').addEventListener('submit', (e) => {
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
    showToast("Đã lưu hồ sơ sức khỏe!");
});

function calculateAndDisplayStats() {
    if (!userProfile) return;
    const h = userProfile.height / 100;
    const bmi = (userProfile.weight / (h * h)).toFixed(1);
    document.getElementById('stat-bmi').innerText = bmi;
    document.getElementById('stat-bmi-text').innerText = bmi < 18.5 ? "Gầy" : (bmi >= 25 ? "Thừa cân" : "Bình thường");

    let bmr = (10 * userProfile.weight) + (6.25 * userProfile.height) - (5 * userProfile.age) + (userProfile.gender === 'male' ? 5 : -161);
    document.getElementById('stat-bmr').innerText = Math.round(bmr) + " kcal";

    const tdee = bmr * userProfile.activity;
    document.getElementById('stat-tdee').innerText = Math.round(tdee) + " kcal";

    let targetCalo = tdee + (userProfile.goal === 'lose' ? -300 : (userProfile.goal === 'gain' ? 300 : 0));
    document.getElementById('stat-target-calo').innerText = Math.round(targetCalo) + " kcal";
    document.getElementById('target-calo-display').innerText = Math.round(targetCalo);
    
    document.getElementById('water-target').innerText = Math.round(userProfile.weight * 35);
    updateWaterUI();
    updateFoodUI();
}

/* =========================================
   3. MENU & THEME
   ========================================= */
const navBtns = document.querySelectorAll('.nav-btn');
const tabContents = document.querySelectorAll('.tab-content');
navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        navBtns.forEach(b => b.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(btn.dataset.target).classList.add('active');
    });
});

document.getElementById('btn-theme').addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
});

/* =========================================
   4. GIẤC NGỦ
   ========================================= */
let sleepLogs = JSON.parse(localStorage.getItem('helnai_sleep_logs')) || [];
let lastSleepResult = null;

document.getElementById('btn-calc-sleep').addEventListener('click', () => {
    const sTime = document.getElementById('sleep-time').value;
    const wTime = document.getElementById('wake-time').value;
    const stTime = document.getElementById('streak-target-time').value;
    if (!sTime || !wTime) return;

    let [sH, sM] = sTime.split(':').map(Number);
    let [wH, wM] = wTime.split(':').map(Number);
    let [stH, stM] = stTime.split(':').map(Number);

    let sDate = new Date(2000, 0, 1, sH, sM);
    let wDate = new Date(2000, 0, (wH < sH || (wH === sH && wM <= sM) ? 2 : 1), wH, wM);
    let diff = (wDate - sDate) / 60000;
    
    let isStreak = (sH < stH) || (sH === stH && sM <= stM);
    
    lastSleepResult = {
        id: Date.now(),
        date: new Date().toLocaleDateString('vi-VN', {day:'2-digit', month:'2-digit'}),
        duration: `${Math.floor(diff/60)}h ${diff%60}m`,
        cycles: (diff / 90).toFixed(1),
        isStreak: isStreak
    };

    document.getElementById('sleep-result').innerHTML = `
        <p>Tổng thời gian: <b>${lastSleepResult.duration}</b> (${lastSleepResult.cycles} chu kỳ)</p>
        <p>${isStreak ? "🔥 Bạn đã đạt mục tiêu ngủ sớm!" : "Hôm nay thức hơi khuya nha, ngày mai cố ngủ sớm hơn nhé! 💜"}</p>
    `;
    document.getElementById('btn-log-sleep').style.display = 'block';
});

document.getElementById('btn-log-sleep').addEventListener('click', () => {
    if (lastSleepResult) {
        sleepLogs.unshift(lastSleepResult);
        localStorage.setItem('helnai_sleep_logs', JSON.stringify(sleepLogs));
        renderSleep();
        showToast("Đã lưu nhật ký giấc ngủ!");
        document.getElementById('btn-log-sleep').style.display = 'none';
    }
});

window.deleteSleep = function(id) {
    sleepLogs = sleepLogs.filter(log => log.id !== id);
    localStorage.setItem('helnai_sleep_logs', JSON.stringify(sleepLogs));
    renderSleep();
    showToast("Đã xóa nhật ký!");
}

function renderSleep() {
    const historyEl = document.getElementById('sleep-history');
    historyEl.innerHTML = sleepLogs.map(log => `
        <div class="history-item">
            <div class="history-item-info">
                <strong>${log.date} ${log.isStreak ? "🔥" : ""}</strong>
                <span>${log.duration} (${log.cycles} chu kỳ)</span>
            </div>
            <button class="btn-delete" onclick="deleteSleep(${log.id})">Xóa</button>
        </div>
    `).join('');

    const calendarEl = document.getElementById('sleep-streak-calendar');
    let recent7 = sleepLogs.slice(0, 7).reverse();
    calendarEl.innerHTML = recent7.map(log => `
        <div class="streak-day">
            <span>${log.date}</span>
            <div class="fire">${log.isStreak ? "🔥" : "💤"}</div>
        </div>
    `).join('');
}
renderSleep();

/* =========================================
   5. UỐNG NƯỚC
   ========================================= */
let waterLogs = JSON.parse(localStorage.getItem('helnai_water_logs')) || [];

document.getElementById('btn-add-water').addEventListener('click', () => {
    const type = document.getElementById('water-type').value;
    const amount = parseInt(document.getElementById('water-custom-amount').value);
    if (!amount || amount <= 0) { showToast("Nhập số ml hợp lệ nha!"); return; }

    waterLogs.unshift({
        id: Date.now(), type: type, amount: amount,
        time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
    });
    localStorage.setItem('helnai_water_logs', JSON.stringify(waterLogs));
    document.getElementById('water-custom-amount').value = '';
    updateWaterUI();
    showToast("Đã ghi nhận nước!");
});

window.deleteWater = function(id) {
    waterLogs = waterLogs.filter(log => log.id !== id);
    localStorage.setItem('helnai_water_logs', JSON.stringify(waterLogs));
    updateWaterUI();
}

function updateWaterUI() {
    const target = parseInt(document.getElementById('water-target').innerText) || 2000;
    let totalWater = 0; let nonWater = 0;
    
    waterLogs.forEach(log => {
        totalWater += log.amount;
        if(log.type !== "Nước lọc") nonWater += log.amount;
    });

    document.getElementById('water-current').innerText = totalWater;
    let pct = Math.min((totalWater / target) * 100, 100);
    document.getElementById('water-circle').style.background = `conic-gradient(var(--primary) ${pct}%, var(--border) 0%)`;

    document.getElementById('water-streak-msg').innerText = totalWater >= target ? "🎉 Tuyệt! Bạn đã uống đủ nước hôm nay." : "";
    
    const warnEl = document.getElementById('water-warning');
    if (nonWater > 500) {
        warnEl.innerText = `⚠️ Nhắc nhở: Bạn đang nạp khá nhiều thức uống khác (${nonWater}ml). Hãy ưu tiên nước lọc nhé!`;
        warnEl.style.display = 'block';
    } else { warnEl.style.display = 'none'; }

    document.getElementById('water-log-list').innerHTML = waterLogs.map(log => `
        <li class="history-item">
            <div class="history-item-info">
                <strong>${log.type} (+${log.amount}ml)</strong>
                <span style="font-size:12px; color:var(--text-sub)">Lúc ${log.time}</span>
            </div>
            <button class="btn-delete" onclick="deleteWater(${log.id})">Xóa</button>
        </li>
    `).join('');
}
updateWaterUI();

/* =========================================
   6. ĂN UỐNG & AI CALO MOCKUP
   ========================================= */
let foodLogs = JSON.parse(localStorage.getItem('helnai_food_logs')) || [];

// Hệ thống ước lượng dinh dưỡng "pha ke" (Mock API)
function estimateNutrition(name) {
    let lowerName = name.toLowerCase();
    let cal = 150 + Math.floor(Math.random()*100); 
    let p = 5, c = 20, f = 5, fb = 1;

    if (lowerName.includes('bò') || lowerName.includes('gà') || lowerName.includes('thịt') || lowerName.includes('trứng')) {
        p += 15; cal += 100;
    }
    if (lowerName.includes('cơm') || lowerName.includes('phở') || lowerName.includes('bún') || lowerName.includes('mì')) {
        c += 30; cal += 150;
    }
    if (lowerName.includes('rau') || lowerName.includes('salad') || lowerName.includes('chuối') || lowerName.includes('táo')) {
        fb += 5; cal -= 50;
    }
    if (lowerName.includes('trà sữa') || lowerName.includes('bánh')) {
        c += 40; f += 10; cal += 200;
    }
    return { cal, p, c, f, fb };
}

document.getElementById('btn-add-food').addEventListener('click', () => {
    const name = document.getElementById('food-input').value;
    if (!name.trim()) return;

    let nut = estimateNutrition(name);
    foodLogs.unshift({
        id: Date.now(), name: name,
        cal: nut.cal, p: nut.p, c: nut.c, f: nut.f, fb: nut.fb
    });
    localStorage.setItem('helnai_food_logs', JSON.stringify(foodLogs));
    document.getElementById('food-input').value = "";
    updateFoodUI();
    showToast(`Đã thêm ${name}!`);
});

window.deleteFood = function(id) {
    foodLogs = foodLogs.filter(log => log.id !== id);
    localStorage.setItem('helnai_food_logs', JSON.stringify(foodLogs));
    updateFoodUI();
}

function updateFoodUI() {
    const target = parseInt(document.getElementById('target-calo-display').innerText) || 2000;
    let tCal=0, tP=0, tC=0, tF=0, tFb=0;
    
    foodLogs.forEach(log => {
        tCal+=log.cal; tP+=log.p; tC+=log.c; tF+=log.f; tFb+=log.fb;
    });

    document.getElementById('food-current').innerText = tCal;
    document.getElementById('macro-pro').innerText = tP;
    document.getElementById('macro-carb').innerText = tC;
    document.getElementById('macro-fat').innerText = tF;
    document.getElementById('macro-fiber').innerText = tFb;

    let pct = Math.min((tCal / target) * 100, 100);
    // Đổi màu vòng tròn nếu vượt target
    let circleColor = tCal > target ? "var(--danger)" : "var(--primary)";
    document.getElementById('food-circle').style.background = `conic-gradient(${circleColor} ${pct}%, var(--border) 0%)`;

    if (tCal > target) {
        document.getElementById('food-streak-msg').innerHTML = `<span style="color:var(--danger)">⚠️ Đã vượt mục tiêu Calo hôm nay!</span>`;
    } else if (tCal > target * 0.8) {
        document.getElementById('food-streak-msg').innerText = "✅ Sắp đạt mục tiêu Calo (Streak an toàn)";
    } else {
        document.getElementById('food-streak-msg').innerText = "";
    }

    let advice = "";
    if (tP < 50) advice += "Cần bổ sung thêm đạm (Thịt/Cá/Trứng). ";
    if (tFb < 15) advice += "Đang thiếu chất xơ (Ăn thêm rau xanh/trái cây nhé).";
    document.getElementById('food-advice').innerText = advice || "Dinh dưỡng đang khá cân bằng!";

    document.getElementById('food-list').innerHTML = foodLogs.map(log => `
        <li class="history-item">
            <div class="history-item-info">
                <strong>${log.name} (${log.cal} kcal)</strong>
                <span style="font-size:12px; color:var(--text-sub)">Đ: ${log.p}g | B: ${log.c}g | Béo: ${log.f}g | Xơ: ${log.fb}g</span>
            </div>
            <button class="btn-delete" onclick="deleteFood(${log.id})">Xóa</button>
        </li>
    `).join('');
}
updateFoodUI();
