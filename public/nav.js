// Verificación de seguridad
const token = localStorage.getItem('token');
if (!token) {
    window.location.href = '/login.html';
}

function renderNav(activePage) {
    const navContainer = document.getElementById('mainNav');
    if (!navContainer) return;

    let html = '';
    
    // Botón de Regreso Universal al Hub
    if (activePage !== 'index.html') {
        html += `<a href="index.html" style="background:rgba(255,255,255,0.2); margin-right:10px;">⬅️ Volver al Hub</a>`;
    }

    // Enlaces del menú
    const links = [
        { name: '🏠 Inicio', url: 'index.html' },
        { name: '👥 Front Desk', url: 'guests.html' },
        { name: '🛏️ Habitaciones', url: 'rooms.html' },
        { name: '📦 Inventario', url: 'inventory.html' },
        { name: '💰 Contabilidad', url: 'accounting.html' },
        { name: '💳 Facturación', url: 'billing.html' },
        { name: '📈 Reportes', url: 'reports.html' }
    ];

    links.forEach(item => {
        if (item.url === 'index.html' && activePage !== 'index.html') return; // No repetir inicio si ya hay botón volver
        const isActive = item.url === activePage ? 'active' : '';
        html += `<a href="${item.url}" class="${isActive}">${item.name}</a>`;
    });
    
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