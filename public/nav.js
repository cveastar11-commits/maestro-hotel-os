// Configuración centralizada del menú
const menuItems = [
    { name: 'Dashboard', url: 'dashboard.html', icon: '📊' },
    { name: 'Ocupación', url: 'guests.html', icon: '👥' },
    { name: 'Habitaciones', url: 'rooms.html', icon: '🛏️' },
    { name: 'Inventario', url: 'inventory.html', icon: '📦' },
    { name: 'Contabilidad', url: 'accounting.html', icon: '💰' },
    { name: 'Facturación', url: 'billing.html', icon: '💳' },
    { name: 'Reportes', url: 'reports.html', icon: '📈' }
];

function renderNav(activePage) {
    // Buscamos el contenedor por ID
    const navContainer = document.getElementById('mainNav');
    if (!navContainer) {
        console.warn('⚠️ No se encontró el contenedor #mainNav. Agregue <div id="mainNav"></div> en su HTML.');
        return;
    }

    let html = '';
    menuItems.forEach(item => {
        const isActive = item.url === activePage ? 'active' : '';
        html += `<a href="${item.url}" class="${isActive}">${item.icon} ${item.name}</a>`;
    });
    
    // Botones fijos al final
    html += `
        <button class="theme-toggle" onclick="toggleTheme()">🌙</button>
        <a href="#" onclick="cerrarSesion()">🚪 Salir</a>
    `;
    
    navContainer.innerHTML = html;
}

// Funciones globales de utilidad
function toggleTheme() {
    document.body.classList.toggle('dark-mode');
    localStorage.setItem('theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light');
    const btn = document.querySelector('.theme-toggle');
    if(btn) btn.textContent = document.body.classList.contains('dark-mode') ? '☀️' : '🌙';
}

if (localStorage.getItem('theme') === 'dark') document.body.classList.add('dark-mode');

function cerrarSesion() { 
    if(confirm('¿Está seguro de cerrar sesión?')) { 
        localStorage.clear(); 
        window.location.href = '/login.html'; 
    } 
}