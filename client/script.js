const API_URL = "http://127.0.0.1:8000"; // Backend porti
let selectedPlateId = null;
let isStaff = false;
let countdownTimer;
// Elementlarni olish
const loginSection = document.getElementById("login-section");
const header = document.getElementById("header");
const registerSection = document.getElementById("register-section");
const authSection = document.getElementById("auth-section");
const platesSection = document.getElementById("plates-section");
const plateDetail = document.getElementById("plate-detail");
const loginForm = document.getElementById("login-form");
const registerForm = document.getElementById("register-form");
const logoutButton = document.getElementById("logout-button");
const platesList = document.getElementById("plates-list");
const bidForm = document.getElementById("bid-form"); // Bid qo‘yish formasi
const loginError = document.getElementById("login-error");
const registerError = document.getElementById("register-error");
const bidMessage = document.getElementById("bid-message");
const searchInput = document.getElementById("search-input");
const searchButton = document.getElementById("search-button");
const showLogin = document.getElementById("show-login");
const showRegister = document.getElementById("show-register");
const staffSection = document.getElementById("staff-section");
const createPlateForm = document.getElementById("create-plate-form");
const createPlateError = document.getElementById("create-plate-error");
const staffActions = document.getElementById("staff-actions");
const updatePlateForm = document.getElementById("update-plate-form");
const deletePlateButton = document.getElementById("delete-plate-button");
const staffActionError = document.getElementById("staff-action-error");

// Tokenni boshqarish
function getToken() {
  return localStorage.getItem("token");
}

function setToken(token) {
  localStorage.setItem("token", token);
}

function clearToken() {
  localStorage.removeItem("token");
}

// API so‘rovlari uchun umumiy funksiya
async function apiRequest(endpoint, method = "GET", data = null) {
  const token = getToken();
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const response = await fetch(`${API_URL}${endpoint}`, {
    method,
    headers,
    body: data ? JSON.stringify(data) : null,
  });

  if (response.status === 401) {
    clearToken();
    location.reload(); // Token muddati tugaganda avtomatik chiqish
    return;
  }

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "So‘rovda xato yuz berdi");
  }
  return response.json();
}

// Foydalanuvchi ma’lumotlarini olish va staff statusini aniqlash
async function getUserInfo() {
  try {
    const user = await apiRequest("/users/me");
    isStaff = user.is_staff || false;
    return user;
  } catch {
    isStaff = false;
    return null;
  }
}

// Login jarayoni
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const username = e.target.username.value;
  const password = e.target.password.value;

  try {
    const formData = new URLSearchParams({ username, password, grant_type: "password" });

    const response = await fetch(`${API_URL}/login/`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData,
    });

    if (!response.ok) throw new Error("Login xatosi");

    const data = await response.json();
    setToken(data.access_token);
    loginError.textContent = "";
    await getUserInfo();
    authSection.style.display = "none";
    platesSection.style.display = "grid";
    logoutButton.style.display = "block";
    header.style.display = "flex";
    if (isStaff) staffSection.style.display = "block";
    loadPlates();
  } catch (err) {
    loginError.textContent = err.message || "Foydalanuvchi nomi yoki parol xato";
  }
});

// Logout funksiyasi
logoutButton.addEventListener("click", () => {
  if (confirm("Tizimdan chiqishni xohlaysizmi?")) {
    clearToken();
    location.reload();
  }
});

// Plitalarni yuklash (qidiruv bilan)
async function loadPlates(query = "") {
  try {
    const url = query ? `/plates/search/?plate_number__contains=${encodeURIComponent(query)}` : "/plates/search/";
    console.log("API so‘rovi URL:", url);

    const plates = await apiRequest(url);
    console.log("Backenddan kelgan natijalar:", plates);

    const plateData = Array.isArray(plates) ? plates : plates.results || [];

    platesList.innerHTML = "";

    if (!plateData || plateData.length === 0) {
      platesList.innerHTML = "<p>Hech qanday mos avtoraqam topilmadi.</p>";
      return;
    }

    plateData.forEach((plate) => {
      const div = document.createElement("div");
      div.className = "plate-card";
      div.innerHTML = `
        <div class="plate-image">${plate.plate_number}</div>
        <p>№ ${plate.id}</p>
        <p>Muddati ${plate.deadline}</p>
        <p>Joriy narx: ${plate.highest_bid || 0} so'm</p>
        <button class="detail-btn">Batafsil</button>
      `;
      div.querySelector(".detail-btn").addEventListener("click", () => showPlateDetail(plate.id));
      platesList.appendChild(div);
    });
  } catch (err) {
    console.error("Qidiruvda xato:", err);
    platesList.innerHTML = "<p>Ma'lumotlarni yuklashda xato yuz berdi.</p>";
  }
}
if (!searchButton || !searchInput) {
    console.error("Qidiruv elementlari topilmadi!");
  } else {
    searchButton.addEventListener("click", () => {
      const query = searchInput.value.trim();
      console.log("Qidiruv so‘zi:", query);
      loadPlates(query);
    });
  }
  
// Plita detallarini ko‘rsatish
async function showPlateDetail(id) {
  selectedPlateId = id;
  
  try {
    // Clear any existing timer first to prevent overlapping countdown calculations
    if (countdownTimer) {
      clearInterval(countdownTimer);
    }
    
    const plate = await apiRequest(`/plates/${id}/`);
    document.getElementById("plate-title").textContent = plate.plate_number;
    document.getElementById("plate-description").textContent = plate.description || "Ta'rif mavjud emas";
    
    // Countdown elementini olish yoki yaratish
    const countdownElement = document.getElementById("plate-countdown") || document.createElement("div");
    countdownElement.id = "plate-countdown";
    countdownElement.style.fontSize = "18px";
    countdownElement.style.fontWeight = "bold";
    countdownElement.style.color = "red";
    document.getElementById("plate-deadline").innerHTML = "";
    document.getElementById("plate-deadline").appendChild(countdownElement);
    
    // Taymerni boshlash
    startCountdown(plate.deadline);
    
    const bidsList = document.getElementById("bids-list");
    bidsList.innerHTML = "";
    plate.bids.forEach((bid) => {
      const li = document.createElement("li");
      li.textContent = `${bid.amount} so'm - Foydalanuvchi: ${bid.user_id} - ${new Date(bid.created_at).toLocaleString()}`;
      bidsList.appendChild(li);
    });
    
    platesSection.style.display = "none";
    plateDetail.style.display = "block";
    
    if (isStaff) {
      staffActions.style.display = "block";
      document.getElementById("update-plate-number").value = plate.plate_number;
      document.getElementById("update-plate-description").value = plate.description || "";
      document.getElementById("update-plate-deadline").value = new Date(plate.deadline).toISOString().slice(0, 16);
    } else {
      staffActions.style.display = "none";
    }
    bidMessage.textContent = "";
  } catch (err) {
    console.error("Avtoraqam ma'lumotlarini yuklashda xato:", err);
  }
}

// Start countdown function
function startCountdown(deadline) {
  // Deadline ni to'g'ri formatda olish
  const deadlineDate = new Date(deadline);
  
  function updateCountdown() {
    const now = new Date().getTime();
    const timeLeft = deadlineDate.getTime() - now;
    
    if (timeLeft <= 0) {
      document.getElementById("plate-countdown").innerHTML = "<h2>Muddati tugadi</h2>";
      clearInterval(countdownTimer);
      return;
    }
    
    const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
    const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
    
    // HTML da mavjud bo'lgan elementlarga qiymatlarni yozamiz
    document.getElementById("days").textContent = String(days).padStart(2, '0');
    document.getElementById("hours").textContent = String(hours).padStart(2, '0');
    document.getElementById("minutes").textContent = String(minutes).padStart(2, '0');
    document.getElementById("seconds").textContent = String(seconds).padStart(2, '0');
  }
  
  updateCountdown();
  // Store the timer in the global variable instead of local variable
  countdownTimer = setInterval(updateCountdown, 1000);
}

// Bid qo‘yish
bidForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!getToken()) {
    bidMessage.textContent = "Iltimos, avval tizimga kiring!";
    return;
  }

  const amount = e.target["bid-amount"].value;
  if (!amount || amount <= 0) {
    bidMessage.textContent = "Iltimos, haqiqiy miqdor kiriting!";
    return;
  }

  try {
    await apiRequest("/bids/", "POST", {
      amount: parseFloat(amount),
      plate_id: selectedPlateId,
    });
    bidMessage.textContent = "Taklif muvaffaqiyatli qo‘yildi!";
    bidMessage.className = "success";
    e.target["bid-amount"].value = "";
    showPlateDetail(selectedPlateId);
  } catch (err) {
    bidMessage.textContent = err.message || "Taklif qo‘yishda xato";
    bidMessage.className = "error";
  }
});

// Plita yaratish
createPlateForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!isStaff) return (createPlateError.textContent = "Sizda bu amalni bajarish huquqi yo‘q!");

  try {
    await apiRequest("/plates/", "POST", {
      plate_number: e.target["plate-number"].value,
      description: e.target["plate-description"].value,
      deadline: e.target["plate-deadline"].value,
    });
    createPlateError.textContent = "avtoraqam muvaffaqiyatli qo‘shildi!";
    createPlateForm.reset();
    loadPlates();
  } catch (err) {
    createPlateError.textContent = err.message || "avtoraqam qo‘shishda xato";
  }
});

// Plita yangilash
updatePlateForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!isStaff) return (staffActionError.textContent = "Sizda bu amalni bajarish huquqi yo‘q!");

  try {
    await apiRequest(`/plates/${selectedPlateId}/`, "PUT", {
      plate_number: e.target["update-plate-number"].value,
      description: e.target["update-plate-description"].value,
      deadline: e.target["update-plate-deadline"].value,
    });
    showPlateDetail(selectedPlateId);
  } catch (err) {
    staffActionError.textContent = err.message || "avtoraqam yangilashda xato";
  }
});

// Plita o‘chirish
deletePlateButton.addEventListener("click", async () => {
  if (!isStaff || !confirm("avtoraqamni o‘chirishni xohlaysizmi?")) return;

  try {
    await apiRequest(`/plates/${selectedPlateId}/`, "DELETE");
    plateDetail.style.display = "none";
    platesSection.style.display = "grid";
    loadPlates();
  } catch (err) {
    staffActionError.textContent = err.message || "Avtoraqam o‘chirishda xato";
  }
});

// Orqaga qaytish
document.getElementById("back-to-list").addEventListener("click", () => {
  plateDetail.style.display = "none";
  platesSection.style.display = "grid";
  loadPlates();
});
// Ro‘yxatdan o‘tish sahifasiga o‘tish
showRegister.addEventListener("click", () => {
    loginSection.style.display = "none";
    registerSection.style.display = "block";
  });
  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
  
    const username = e.target.username.value;
    const email = e.target.email.value;
    const password = e.target.password.value;
  
    try {
      console.log("Ro‘yxatdan o‘tish so‘rovi yuborilmoqda..."); // 🔍 Tekshirish
      const response = await apiRequest("/users/", "POST", { username, email, password });
  
      console.log("Server javobi:", response); // 🔍 Tekshirish
      registerError.textContent = "Ro‘yxatdan o‘tish muvaffaqiyatli!";
      registerError.className = "success";
  
      setTimeout(() => {
        registerSection.style.display = "none";
        loginSection.style.display = "block";
      }, 2000);
    } catch (err) {
      console.error("Xato:", err);  
      registerError.textContent = err.message || "Ro‘yxatdan o‘tishda xatolik!";
      registerError.className = "error";
    }
  });
  
showLogin.addEventListener("click", () => {
    registerSection.style.display = "none";
    loginSection.style.display = "block";
  });  
(async function initApp() {
  if (getToken()) {
    await getUserInfo();
    authSection.style.display = "none";
    platesSection.style.display = "grid";
    logoutButton.style.display = "block";
    if (isStaff) staffSection.style.display = "block";
    loadPlates();
  } else {
    authSection.style.display = "block";
  }
})();