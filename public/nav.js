// Verificación de seguridad global
const token = localStorage.getItem('token');
if (!token) {
    window.location.href = '/login.html';
}

function renderNav(activePage) {
    const navContainer = document.getElementById('mainNav');
    if (!navContainer) return;

    let html = '';
    
    // 1. BOTÓN DE REGRESO UNIVERSAL AL HUB
    if (activePage !== 'index.html') {
        html += `<a href="index.html" class="back-btn">⬅️ Volver al Hub</a>`;
    }

    // 2. Menú de Navegación (Solo si NO estamos en el Hub para no redundar)
    if (activePage !== 'index.html') {
        html += `
            <a href="index.html">🏠 Inicio</a>
            <a href="guests.html">👥 Front Desk</a>
            <a href="rooms.html">🛏️ Habitaciones</a>
            <a href="inventory.html">📦 Inventario</a>
            <a href="accounting.html">💰 Contabilidad</a>
            <a href="billing.html">💳 Facturación</a>
            <a href="reports.html">📈 Reportes</a>
        `;
    } else {
        // Si estamos en el Hub, mostramos los enlaces normales
        html += `
            <a href="guests.html">👥 Front Desk</a>
            <a href="rooms.html">🛏️ Habitaciones</a>
            <a href="inventory.html">📦 Inventario</a>
            <a href="accounting.html">💰 Contabilidad</a>
            <a href="billing.html">💳 Facturación</a>
            <a href="reports.html">📈 Reportes</a>
        `;
    }
    
    // 3. Utilidades
    html += `
        <button class="theme-toggle" onclick="toggleTheme()">🌙</button>
        <a href="#" onclick="cerrarSesion()">🚪 Salir</a>
    `;
    
    navContainer.innerHTML = html;
}

function toggleTheme() {
    document.body.classList.toggle('dark-mode');
    localStorage.setItem('theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light');
    const btn = document.querySelector('.theme-toggle');
    if(btn) btn.textContent = document.body.classList.contains('dark-mode') ? '☀️' : '🌙';
}

if (localStorage.getItem('theme') === 'dark') document.body.classList.add('dark-mode');

function cerrarSesion() { 
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login.html';
}