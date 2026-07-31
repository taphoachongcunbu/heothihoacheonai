/* =========================================
   1. CẤU HÌNH FIREBASE & GOOGLE LOGIN 
   ========================================= */
// BÀ CẦN ĐIỀN THÔNG TIN FIREBASE CỦA BÀ VÀO ĐÂY (Sẽ hướng dẫn ở bước sau)
const firebaseConfig = {
  apiKey: "AIzaSyDXQZRfGNQ0-_NUPWqxOmjCxWq51T3b3qI",
  authDomain: "healthyhoacheonai.firebaseapp.com",
  projectId: "healthyhoacheonai",
  storageBucket: "healthyhoacheonai.firebasestorage.app",
  messagingSenderId: "707815568295",
  appId: "1:707815568295:web:fc6faeb9e79dc2b6ad7c82"
};
// Khởi tạo Firebase (chỉ chạy nếu đã có config)
if(firebaseConfig.apiKey !== "YOUT_API_KEY"){
    firebase.initializeApp(firebaseConfig);
    const auth = firebase.auth();
    const provider = new firebase.auth.GoogleAuthProvider();

    // Xử lý Login
    document.getElementById('btn-login').addEventListener('click', () => {
        auth.signInWithPopup(provider).catch(err => console.log(err));
    });

    // Xử lý Logout
    document.getElementById('btn-logout').addEventListener('click', () => {
        auth.signOut();
    });

    // Lắng nghe trạng thái đăng nhập
    auth.onAuthStateChanged(user => {
        if (user) {
            document.getElementById('login-screen').classList.remove('active');
            document.getElementById('app-screen').classList.add('active');
            document.getElementById('user-name').innerText = user.displayName;
            document.getElementById('user-avatar').src = user.photoURL;
        } else {
            document.getElementById('login-screen').classList.add('active');
            document.getElementById('app-screen').classList.remove('active');
        }
    });
} else {
    // CHẾ ĐỘ MOCKUP: Khi bà chưa điền Firebase, nhấn nút login nó sẽ tự vô app luôn để bà test UI.
    document.getElementById('btn-login').addEventListener('click', () => {
        document.getElementById('login-screen').classList.remove('active');
        document.getElementById('app-screen').classList.add('active');
    });
}

/* =========================================
   2. DARK MODE & CHUYỂN TAB 
   ========================================= */
// Dark Mode
const btnTheme = document.getElementById('btn-theme');
btnTheme.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    btnTheme.innerHTML = isDark ? "<i class='bx bx-sun'></i>" : "<i class='bx bx-moon'></i>";
});

// Chuyển Tab Menu
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));
        
        btn.classList.add('active');
        document.getElementById(btn.dataset.target).classList.add('active');
    });
});

/* =========================================
   3. LOGIC GIẤC NGỦ (Tính chu kỳ 90 phút)
   ========================================= */
document.getElementById('btn-calc-sleep').addEventListener('click', () => {
    const sleepTime = document.getElementById('sleep-time').value;
    const wakeTime = document.getElementById('wake-time').value;
    const resultBox = document.getElementById('sleep-result');

    if (!sleepTime || !wakeTime) {
        resultBox.innerHTML = "<i>Vui lòng nhập đủ giờ!</i>";
        return;
    }

    // Chuyển giờ thành phút để tính toán
    let [sH, sM] = sleepTime.split(':').map(Number);
    let [wH, wM] = wakeTime.split(':').map(Number);
    
    let sleepDate = new Date(2000, 0, 1, sH, sM);
    let wakeDate = new Date(2000, 0, (wH < sH ? 2 : 1), wH, wM);
    
    let diffMinutes = (wakeDate - sleepDate) / (1000 * 60);
    let cycles = diffMinutes / 90;

    let score = "";
    if (cycles >= 4 && cycles <= 6 && Number.isInteger(cycles)) {
        score = "🟢 Cực kỳ hoàn hảo! Bạn sẽ thức dậy rất sảng khoái.";
    } else if (Math.abs(cycles - Math.round(cycles)) < 0.2) {
        score = "🟡 Khá ổn! Bạn thức dậy gần với điểm kết thúc chu kỳ.";
    } else {
        score = "🔴 Bạn thức dậy giữa chu kỳ ngủ sâu. Sẽ hơi mệt mỏi đấy!";
    }

    resultBox.innerHTML = `
        <p>Tổng thời gian ngủ: <b>${Math.floor(diffMinutes/60)}h ${diffMinutes%60}m</b></p>
        <p>Số chu kỳ hoàn thành: <b>${cycles.toFixed(1)} chu kỳ</b></p>
        <p>${score}</p>
    `;
});

/* =========================================
   4. LOGIC UỐNG NƯỚC (Vòng tròn)
   ========================================= */
let currentWater = 0;
const targetWater = 2000; // Có thể làm form nhập cho biến này sau

function addWater(amount) {
    currentWater += amount;
    if(currentWater > targetWater) currentWater = targetWater;
    
    document.getElementById('water-current').innerText = currentWater;
    
    // Cập nhật giao diện vòng tròn
    let percentage = (currentWater / targetWater) * 100;
    document.getElementById('water-circle').style.background = `conic-gradient(var(--primary) ${percentage}%, var(--border) 0%)`;
    
    if(currentWater >= targetWater) {
        document.getElementById('water-suggest').innerText = "🎉 Tuyệt vời! Bạn đã đạt đủ nước hôm nay.";
    }
}

/* =========================================
   5. LOGIC ĂN UỐNG & THỂ THAO (Checklist cơ bản)
   ========================================= */
// Ăn uống
let totalCalo = 0;
document.getElementById('btn-add-food').addEventListener('click', () => {
    const foodInput = document.getElementById('food-input');
    if(foodInput.value.trim() !== "") {
        // Tạm thời mock calo là 200/món. Đoạn này sau này ghép API tra cứu calo vào.
        const mockCalo = 200; 
        totalCalo += mockCalo;
        document.getElementById('total-calo').innerText = totalCalo;

        const li = document.createElement('li');
        li.innerHTML = `<span>${foodInput.value}</span> <span>+${mockCalo} kcal</span>`;
        document.getElementById('food-list').prepend(li);
        foodInput.value = "";
    }
});

// Thể thao
document.getElementById('btn-add-workout').addEventListener('click', () => {
    const input = document.getElementById('workout-input');
    if(input.value.trim() !== "") {
        const li = document.createElement('li');
        li.innerHTML = `<span>${input.value}</span> <input type="checkbox">`;
        document.getElementById('workout-list').prepend(li);
        input.value = "";
    }
});
