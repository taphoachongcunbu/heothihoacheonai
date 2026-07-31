/* =========================================
   1. CẤU HÌNH FIREBASE & GOOGLE LOGIN 
   ========================================= */
const firebaseConfig = {
    apiKey: "AIzaSyDXQZRfGNQ0-_NUPWqxOmjCxWq51T3b3qI",
    authDomain: "healthyhoacheonai.firebaseapp.com",
    projectId: "healthyhoacheonai",
    storageBucket: "healthyhoacheonai.firebasestorage.app",
    messagingSenderId: "707815568295",
    appId: "1:707815568295:web:fc6faeb9e79dc2b6ad7c82"
};

// Khởi tạo Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const provider = new firebase.auth.GoogleAuthProvider();

const authStatusEl = document.getElementById('auth-status');

// Xử lý Sự kiện Đăng nhập Google
function setupAuthListeners() {
    const btnLogin = document.getElementById('btn-login');
    if (btnLogin) {
        btnLogin.addEventListener('click', () => {
            auth.signInWithPopup(provider).catch(err => {
                console.error("Lỗi đăng nhập:", err);
                alert("Không thể đăng nhập: " + err.message);
            });
        });
    }

    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
        btnLogout.addEventListener('click', () => {
            auth.signOut();
        });
    }
}

// Lắng nghe trạng thái Đăng nhập / Đăng xuất
auth.onAuthStateChanged(user => {
    if (user) {
        authStatusEl.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                <img src="${user.photoURL}" alt="Avatar" style="width: 32px; height: 32px; border-radius: 50%;">
                <span style="font-weight: 700; font-size: 14px;">${user.displayName}</span>
            </div>
            <button id="btn-logout" class="btn-secondary" style="width: 100%; padding: 6px;"><i class='bx bx-log-out'></i> Đăng xuất</button>
        `;
    } else {
        authStatusEl.innerHTML = `
            <button id="btn-login" class="btn-secondary" style="width: 100%;"><i class='bx bxl-google'></i> Đăng nhập</button>
        `;
    }
    setupAuthListeners();
});

/* =========================================
   2. QUẢN LÝ DỮ LIỆU CÁ NHÂN (PROFILE & CALC)
   ========================================= */
let userProfile = JSON.parse(localStorage.getItem('aura_user_profile')) || null;
let lastSleepResult = null;

const userModal = document.getElementById('user-modal');
const healthForm = document.getElementById('health-form');

// Bật Modal Cài đặt
document.getElementById('btn-settings').addEventListener('click', () => {
    if(userProfile) {
        document.getElementById('weight').value = userProfile.weight;
        document.getElementById('height').value = userProfile.height;
        document.getElementById('age').value = userProfile.age;
        document.getElementById('gender').value = userProfile.gender;
        document.getElementById('activity').value = userProfile.activity;
        document.getElementById('goal').value = userProfile.goal;
    }
    userModal.classList.add('active');
});

// Nếu chưa có dữ liệu -> Bắt buộc nhập Onboarding
if (!userProfile) {
    userModal.classList.add('active');
} else {
    calculateAndDisplayStats();
}

// Lưu thông tin sức khỏe
healthForm.addEventListener('submit', (e) => {
    e.preventDefault();
    userProfile = {
        weight: parseFloat(document.getElementById('weight').value),
        height: parseFloat(document.getElementById('height').value),
        age: parseInt(document.getElementById('age').value),
        gender: document.getElementById('gender').value,
        activity: parseFloat(document.getElementById('activity').value),
        goal: document.getElementById('goal').value
    };
    localStorage.setItem('aura_user_profile', JSON.stringify(userProfile));
    userModal.classList.remove('active');
    calculateAndDisplayStats();
});

// Hàm tính toán các chỉ số BMI, BMR, TDEE
function calculateAndDisplayStats() {
    if (!userProfile) return;

    // 1. Tính BMI
    const hMeter = userProfile.height / 100;
    const bmi = (userProfile.weight / (hMeter * hMeter)).toFixed(1);
    document.getElementById('stat-bmi').innerText = bmi;
    
    let bmiText = "Bình thường";
    if (bmi < 18.5) bmiText = "Gầy";
    else if (bmi >= 25) bmiText = "Thừa cân";
    document.getElementById('stat-bmi-text').innerText = bmiText;

    // 2. Tính BMR (Mifflin-St Jeor)
    let bmr = (10 * userProfile.weight) + (6.25 * userProfile.height) - (5 * userProfile.age);
    bmr += (userProfile.gender === 'male') ? 5 : -161;
    document.getElementById('stat-bmr').innerText = Math.round(bmr) + " kcal";

    // 3. Tính TDEE
    const tdee = bmr * userProfile.activity;
    document.getElementById('stat-tdee').innerText = Math.round(tdee) + " kcal";

    // 4. Target Calo
    let targetCalo = tdee;
    if (userProfile.goal === 'lose') targetCalo -= 300;
    if (userProfile.goal === 'gain') targetCalo += 300;
    
    document.getElementById('stat-target-calo').innerText = Math.round(targetCalo) + " kcal";
    document.getElementById('target-calo-display').innerText = Math.round(targetCalo);

    // 5. Target Nước (35ml/kg)
    const targetWater = Math.round(userProfile.weight * 35);
    document.getElementById('water-target').innerText = targetWater;
}

/* =========================================
   3. NAVIGATION & THEME 
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

// Dark Mode
const btnTheme = document.getElementById('btn-theme');
btnTheme.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    btnTheme.innerHTML = isDark ? "<i class='bx bx-sun'></i>" : "<i class='bx bx-moon'></i>";
});

/* =========================================
   4. GIẤC NGỦ & STREAK & NHẬT KÝ
   ========================================= */
document.getElementById('btn-calc-sleep').addEventListener('click', () => {
    const sleepTime = document.getElementById('sleep-time').value;
    const wakeTime = document.getElementById('wake-time').value;
    const streakTarget = document.getElementById('streak-target-time').value;
    const resultBox = document.getElementById('sleep-result');

    if (!sleepTime || !wakeTime) return;

    let [sH, sM] = sleepTime.split(':').map(Number);
    let [wH, wM] = wakeTime.split(':').map(Number);
    let [stH, stM] = streakTarget.split(':').map(Number);

    let sleepDate = new Date(2000, 0, 1, sH, sM);
    let wakeDate = new Date(2000, 0, (wH < sH || (wH === sH && wM <= sM) ? 2 : 1), wH, wM);
    
    let diffMinutes = (wakeDate - sleepDate) / (1000 * 60);
    let cycles = (diffMinutes / 90).toFixed(1);

    // Kiểm tra Streak
    let isStreak = (sH < stH) || (sH === stH && sM <= stM);

    lastSleepResult = {
        date: new Date().toLocaleDateString('vi-VN'),
        duration: `${Math.floor(diffMinutes/60)}h ${diffMinutes%60}m`,
        cycles: cycles,
        isStreak: isStreak
    };

    resultBox.innerHTML = `
        <p>Tổng thời gian: <b>${lastSleepResult.duration}</b> (${cycles} chu kỳ)</p>
        <p>Streak ngủ sớm: <b>${isStreak ? "🔥 Đạt Streak!" : "❌ Chưa đạt target"}</b></p>
    `;
    document.getElementById('btn-log-sleep').style.display = 'block';
});

// Nhật ký giấc ngủ
let sleepLogs = JSON.parse(localStorage.getItem('aura_sleep_logs')) || [];
const sleepHistoryEl = document.getElementById('sleep-history');

function renderSleepHistory() {
    if (sleepLogs.length === 0) return;
    sleepHistoryEl.innerHTML = sleepLogs.map(log => `
        <div class="history-item">
            <div>
                <strong>${log.date}</strong> - ${log.duration} (${log.cycles} chu kỳ)
            </div>
            <span>${log.isStreak ? "🔥 Streak" : "🌙 Mới"}</span>
        </div>
    `).join('');
}
renderSleepHistory();

document.getElementById('btn-log-sleep').addEventListener('click', () => {
    if (lastSleepResult) {
        sleepLogs.unshift(lastSleepResult);
        localStorage.setItem('aura_sleep_logs', JSON.stringify(sleepLogs));
        renderSleepHistory();
        alert("Đã lưu nhật ký giấc ngủ!");
    }
});

/* =========================================
   5. UỐNG NƯỚC, ĂN UỐNG & THỂ THAO
   ========================================= */
let currentWater = 0;
function addWater(amount) {
    const targetWater = parseInt(document.getElementById('water-target').innerText) || 2000;
    currentWater += amount;
    document.getElementById('water-current').innerText = currentWater;
    
    let percentage = Math.min((currentWater / targetWater) * 100, 100);
    document.getElementById('water-circle').style.background = `conic-gradient(var(--primary) ${percentage}%, var(--border) 0%)`;

    const li = document.createElement('li');
    li.innerHTML = `<span>+${amount}ml</span> <span>${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>`;
    document.getElementById('water-log-list').prepend(li);
}

// Ăn uống
let totalCalo = 0;
document.getElementById('btn-add-food').addEventListener('click', () => {
    const name = document.getElementById('food-input').value;
    const calo = parseInt(document.getElementById('food-calo-input').value) || 150;
    if (name.trim()) {
        totalCalo += calo;
        document.getElementById('total-calo').innerText = totalCalo;
        const li = document.createElement('li');
        li.innerHTML = `<span>${name}</span> <span>${calo} kcal</span>`;
        document.getElementById('food-list').prepend(li);
        document.getElementById('food-input').value = "";
        document.getElementById('food-calo-input').value = "";
    }
});

// Thể thao
document.getElementById('btn-add-workout').addEventListener('click', () => {
    const val = document.getElementById('workout-input').value;
    if (val.trim()) {
        const li = document.createElement('li');
        li.innerHTML = `<span>${val}</span> <input type="checkbox">`;
        document.getElementById('workout-list').prepend(li);
        document.getElementById('workout-input').value = "";
    }
});
