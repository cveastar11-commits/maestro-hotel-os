// Verificación de seguridad global
const token = localStorage.getItem('token');
if (!token) {
    window.location.href = '/login.html';
}

// Configuración del menú
const menuItems = [
    { name: 'Inicio', url: 'index.html', icon: '🏠' }, // NUEVO: Volver al Hub
    { name: 'Front Desk', url: 'guests.html', icon: '👥' },
    { name: 'Habitaciones', url: 'rooms.html', icon: '🛏️' },
    { name: 'Inventario', url: 'inventory.html', icon: '📦' },
    { name: 'Contabilidad', url: 'accounting.html', icon: '💰' },
    { name: 'Facturación', url: 'billing.html', icon: '💳' },
    { name: 'Reportes', url: 'reports.html', icon: '📈' }
];

function renderNav(activePage) {
    const navContainer = document.getElementById('mainNav');
    if (!navContainer) return;

    let html = '';
    const menuItems = [
    { name: 'Inicio', url: 'index.html', icon: '🏠' }, // NUEVO: Volver al Hub
    { name: 'Front Desk', url: 'guests.html', icon: '👥' },
    { name: 'Habitaciones', url: 'rooms.html', icon: '🛏️' },
    { name: 'Inventario', url: 'inventory.html', icon: '📦' },
    { name: 'Contabilidad', url: 'accounting.html', icon: '💰' },
    { name: 'Facturación', url: 'billing.html', icon: '💳' },
    { name: 'Reportes', url: 'reports.html', icon: '📈' }
];.forEach(item => {
        const isActive = item.url === activePage ? 'active' : '';
        html += `<a href="${item.url}" class="${isActive}">${item.icon} ${item.name}</a>`;
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