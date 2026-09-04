require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();

const JWT_SECRET = process.env.JWT_SECRET || 'clave_secreta_super_segura_12345';

const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000
});

app.use(cors());
app.use(express.json());
   // PRUEBA DE VIDA DEL SERVIDOR
   app.get('/prueba', (req, res) => {
       res.send('¡EL SERVIDOR DE MAESTRO HOTEL OS ESTÁ VIVO Y RESPONDIENDO!');
   });
// ==========================================
// CONFIGURACIÓN BLINDADA PARA RENDER (LINUX)
// ==========
const publicDir = path.join(__dirname, '..', 'public');

// Servir archivos estáticos (HTML, CSS, JS del frontend)
app.use(express.static(publicDir));

// Rutas explícitas para el Health Check de Render
app.get('/', (req, res) => {
    res.sendFile(path.join(publicDir, 'login.html'));
});

app.get('/login.html', (req, res) => {
    res.sendFile(path.join(publicDir, 'login.html'));
});

app.get('/inventory.html', (req, res) => {
    res.sendFile(path.join(publicDir, 'inventory.html'));
});
// ==========================================
      // Ruta de prueba para verificar que el servidor responde
   app.get('/api/health', (req, res) => {
       res.json({ status: 'ok', message: 'El servidor de Maestro Hotel OS está vivo y respondiendo!' });
   });
   // ... (tu código de middleware)
      app.use(express.static(path.join(__dirname, '..', 'public')));

// ==========================================
// LOGIN
// ==========================================
   app.post('/api/login', async (req, res) => {
       try {
           const { email, password } = req.body;
           const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
           
           if (result.rows.length === 0) {
               return res.status(401).json({ error: 'Credenciales inválidas' });
           }
           
           const user = result.rows[0];
           const validPassword = await bcrypt.compare(password, user.password_hash);
           
           if (!validPassword) {
               return res.status(401).json({ error: 'Credenciales inválidas' });
           }

           // ✅ AQUÍ ESTÁ EL CAMBIO: Incluimos el 'role' en el token y en la respuesta
           const token = jwt.sign(
               { id: user.id, email: user.email, role: user.role }, 
               JWT_SECRET, 
               { expiresIn: '24h' }
           );

           res.json({ 
               message: 'Login exitoso',
               token: token,
               user: {
                   id: user.id,
                   name: user.full_name,
                   email: user.email,
                   role: user.role // ✅ Enviamos el rol al frontend
               }
           });
       } catch (error) {
           console.error('Error en login:', error);
           res.status(500).json({ error: 'Error en el servidor' });
       }
   });

// Middleware de autenticación
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const tokenFromHeader = authHeader && authHeader.split(' ')[1];
  const tokenFromQuery = req.query.token;
  const token = tokenFromHeader || tokenFromQuery;

  if (!token) return res.status(401).json({ error: 'Token no proporcionado' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Token inválido' });
    req.user = user;
    next();
  });
};
// ==========================================
// ESTADÍSTICAS DEL DASHBOARD
// ==========================================
app.get('/api/stats', authenticateToken, async (req, res) => {
  try {
    const totalRooms = await pool.query('SELECT COUNT(*) FROM rooms WHERE is_active = true');
    const availableRooms = await pool.query('SELECT COUNT(*) FROM rooms WHERE status = $1', ['disponible']);
    const occupiedRooms = await pool.query('SELECT COUNT(*) FROM rooms WHERE status = $1', ['ocupada']);
    const totalReservations = await pool.query('SELECT COUNT(*) FROM reservations');
    const totalRevenue = await pool.query('SELECT COALESCE(SUM(paid_amount), 0) as total FROM reservations');
    const totalGuests = await pool.query('SELECT COUNT(*) FROM guests');

    res.json({
      total_rooms: parseInt(totalRooms.rows[0].count),
      available_rooms: parseInt(availableRooms.rows[0].count),
      occupied_rooms: parseInt(occupiedRooms.rows[0].count),
      total_reservations: parseInt(totalReservations.rows[0].count),
      total_revenue: parseFloat(totalRevenue.rows[0].total),
      total_guests: parseInt(totalGuests.rows[0].count)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// CRUD DE HABITACIONES
// ==========================================
app.get('/api/rooms', authenticateToken, async (req, res) => { 
  try { 
    const r = await pool.query('SELECT * FROM rooms ORDER BY room_number'); 
    res.json(r.rows); 
  } catch(e) { 
    res.status(500).json({ error: e.message }); 
  } 
});

app.post('/api/rooms', authenticateToken, async (req, res) => {
  try {
    const { room_number, room_type, capacity, base_price } = req.body;
    const result = await pool.query(
      'INSERT INTO rooms (room_number, room_type, capacity, base_price) VALUES ($1, $2, $3, $4) RETURNING *',
      [room_number, room_type, capacity, base_price]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/rooms/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { room_number, room_type, capacity, base_price, status } = req.body;
    const result = await pool.query(
      'UPDATE rooms SET room_number=$1, room_type=$2, capacity=$3, base_price=$4, status=$5 WHERE id=$6 RETURNING *',
      [room_number, room_type, capacity, base_price, status, id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/rooms/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM rooms WHERE id=$1', [id]);
    res.json({ message: 'Habitación eliminada' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// HUÉSPEDES
// ==========================================
app.get('/api/guests', authenticateToken, async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM guests ORDER BY full_name');
    res.json(r.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/guests', authenticateToken, async (req, res) => {
  try {
    const { document_number, full_name, email, phone } = req.body;
    const result = await pool.query(
      'INSERT INTO guests (document_number, full_name, email, phone) VALUES ($1, $2, $3, $4) RETURNING *',
      [document_number, full_name, email, phone]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// RESERVAS
// ==========================================
app.get('/api/reservations', authenticateToken, async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT r.*, g.full_name as guest_name, rm.room_number 
      FROM reservations r
      LEFT JOIN guests g ON r.guest_id = g.id
      LEFT JOIN rooms rm ON r.room_id = rm.id
      ORDER BY r.check_in_date DESC
    `);
    res.json(r.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/reservations', authenticateToken, async (req, res) => {
app.delete('/api/reservations/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const reservation = await pool.query('SELECT room_id FROM reservations WHERE id=$1', [id]);
    if (reservation.rows.length > 0) {
      await pool.query('UPDATE rooms SET status=$1 WHERE id=$2', ['disponible', reservation.rows[0].room_id]);
    }
    await pool.query('DELETE FROM reservations WHERE id=$1', [id]);
    res.json({ message: 'Reserva eliminada' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.delete('/api/guests/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM guests WHERE id=$1', [id]);
    res.json({ message: 'Huésped eliminado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
  try {
    const { guest_id, room_id, check_in_date, check_out_date, total_amount } = req.body;
    const result = await pool.query(
      'INSERT INTO reservations (guest_id, room_id, check_in_date, check_out_date, total_amount) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [guest_id, room_id, check_in_date, check_out_date, total_amount]
    );
    await pool.query('UPDATE rooms SET status=$1 WHERE id=$2', ['ocupada', room_id]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// ==========================================
// CHECK-IN Y CHECK-OUT
// ==========================================
app.put('/api/reservations/:id/checkin', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('UPDATE reservations SET status=$1 WHERE id=$2', ['checkin', id]);
    const reservation = await pool.query('SELECT room_id FROM reservations WHERE id=$1', [id]);
    if (reservation.rows.length > 0) {
      await pool.query('UPDATE rooms SET status=$1 WHERE id=$2', ['ocupada', reservation.rows[0].room_id]);
    }
    res.json({ message: 'Check-in realizado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/reservations/:id/checkout', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('UPDATE reservations SET status=$1 WHERE id=$2', ['checkout', id]);
    const reservation = await pool.query('SELECT room_id FROM reservations WHERE id=$1', [id]);
    if (reservation.rows.length > 0) {
      await pool.query('UPDATE rooms SET status=$1 WHERE id=$2', ['disponible', reservation.rows[0].room_id]);
    }
    res.json({ message: 'Check-out realizado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
const PDFDocument = require('pdfkit');

// ==========================================
// FACTURACIÓN
// ==========================================
app.get('/api/invoices', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT i.*, r.total_amount, r.check_in_date, r.check_out_date,
             g.full_name as guest_name, g.document_number,
             rm.room_number
      FROM invoices i
      LEFT JOIN reservations r ON i.reservation_id = r.id
      LEFT JOIN guests g ON r.guest_id = g.id
      LEFT JOIN rooms rm ON r.room_id = rm.id
      ORDER BY i.issue_date DESC
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/invoices', authenticateToken, async (req, res) => {
  try {
    const { reservation_id } = req.body;
    const reservation = await pool.query(`
      SELECT r.*, g.full_name as guest_name, g.document_number, rm.room_number
      FROM reservations r
      LEFT JOIN guests g ON r.guest_id = g.id
      LEFT JOIN rooms rm ON r.room_id = rm.id
      WHERE r.id = $1
    `, [reservation_id]);

    if (reservation.rows.length === 0) {
      return res.status(404).json({ error: 'Reserva no encontrada' });
    }

    const r = reservation.rows[0];
    const invoiceNumber = `FAC-${Date.now()}`;
    const tax = parseFloat(r.total_amount) * 0.16;
    const total = parseFloat(r.total_amount) + tax;

    const result = await pool.query(
      `INSERT INTO invoices (invoice_number, reservation_id, subtotal, tax, total, status) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [invoiceNumber, reservation_id, r.total_amount, tax, total, 'pendiente']
    );

    res.status(201).json({
      ...result.rows[0],
      guest_name: r.guest_name,
      document_number: r.document_number,
      room_number: r.room_number,
      check_in_date: r.check_in_date,
      check_out_date: r.check_out_date
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Generar PDF de factura
app.get('/api/invoices/:id/pdf', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const invoice = await pool.query(`
      SELECT i.*, r.total_amount as reservation_total, r.check_in_date, r.check_out_date,
             g.full_name as guest_name, g.document_number, g.email as guest_email, g.phone as guest_phone,
             rm.room_number, rm.room_type
      FROM invoices i
      LEFT JOIN reservations r ON i.reservation_id = r.id
      LEFT JOIN guests g ON r.guest_id = g.id
      LEFT JOIN rooms rm ON r.room_id = rm.id
      WHERE i.id = $1
    `, [id]);

    if (invoice.rows.length === 0) {
      return res.status(404).json({ error: 'Factura no encontrada' });
    }

    const inv = invoice.rows[0];
    const doc = new PDFDocument({ margin: 50 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=factura-${inv.invoice_number}.pdf`);
    doc.pipe(res);

    // Encabezado
    doc.fontSize(24).fillColor('#667eea').text('MAESTRO HOTEL OS', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(12).fillColor('#666').text('Sistema Profesional de Gestión Hotelera', { align: 'center' });
    doc.moveDown();

    // Línea divisoria
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke('#667eea');
    doc.moveDown();

    // Info de factura
    doc.fontSize(14).fillColor('#333').text(`FACTURA: ${inv.invoice_number}`, { continued: true });
    doc.fillColor('#666').text(`    Fecha: ${new Date(inv.issue_date).toLocaleDateString()}`);
    doc.moveDown(0.5);
    doc.fillColor('#333').text(`Estado: ${inv.status.toUpperCase()}`);
    doc.moveDown();

    // Info del huésped
    doc.fontSize(12).fillColor('#667eea').text('DATOS DEL HUÉSPED', { underline: true });
    doc.moveDown(0.3);
    doc.fillColor('#333').fontSize(11);
    doc.text(`Nombre: ${inv.guest_name}`);
    doc.text(`Documento: ${inv.document_number}`);
    if (inv.guest_email) doc.text(`Email: ${inv.guest_email}`);
    if (inv.guest_phone) doc.text(`Teléfono: ${inv.guest_phone}`);
    doc.moveDown();

    // Info de la reserva
    doc.fillColor('#667eea').fontSize(12).text('DETALLES DE LA ESTANCIA', { underline: true });
    doc.moveDown(0.3);
    doc.fillColor('#333').fontSize(11);
    doc.text(`Habitación: ${inv.room_number} (${inv.room_type})`);
    doc.text(`Check-in: ${new Date(inv.check_in_date).toLocaleDateString()}`);
    doc.text(`Check-out: ${new Date(inv.check_out_date).toLocaleDateString()}`);
    doc.moveDown();

    // Totales
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke('#ccc');
    doc.moveDown(0.5);
    doc.fontSize(12);
    doc.text(`Subtotal:                    $${parseFloat(inv.subtotal).toFixed(2)}`, { align: 'right' });
    doc.text(`IVA (16%):                   $${parseFloat(inv.tax).toFixed(2)}`, { align: 'right' });
    doc.moveDown(0.3);
    doc.fontSize(16).fillColor('#667eea').text(`TOTAL: $${parseFloat(inv.total).toFixed(2)}`, { align: 'right' });
    doc.moveDown(2);

    // Pie de página
    doc.fontSize(9).fillColor('#999').text('Gracias por su preferencia', { align: 'center' });
    doc.text('Maestro Hotel OS - Sistema Profesional de Gestión', { align: 'center' });

    doc.end();
  } catch (error) {
    console.error('Error generando PDF:', error);
    res.status(500).json({ error: error.message });
  }
});
// ==========================================
// GESTIÓN DE USUARIOS (Solo Admin)
// ==========================================
const isAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Se requieren permisos de administrador' });
  }
  next();
};

   app.get('/api/users', authenticateToken, async (req, res) => {
     try {
       // Consulta segura que solo usa las columnas que ya tenemos
       const result = await pool.query('SELECT id, email, full_name, role FROM users');
       
       // Agregamos is_active = true por defecto para que el frontend no falle
       const users = result.rows.map(u => ({ ...u, is_active: true }));
       
       res.json(users);
     } catch (error) {
       console.error('Error al obtener usuarios:', error.message);
       res.status(500).json({ error: error.message });
     }
   });
app.post('/api/users', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { email, password, full_name, role } = req.body;
    const password_hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (email, password_hash, full_name, role) VALUES ($1, $2, $3, $4) RETURNING id, email, full_name, role',
      [email, password_hash, full_name, role]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/users/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { email, full_name, role, is_active } = req.body;
    const result = await pool.query(
      'UPDATE users SET email=$1, full_name=$2, role=$3, is_active=$4 WHERE id=$5 RETURNING id, email, full_name, role, is_active',
      [email, full_name, role, is_active, id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/users/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM users WHERE id=$1', [id]);
    res.json({ message: 'Usuario eliminado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// ==========================================
// INVENTARIO
// ==========================================
app.get('/api/inventory', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM inventory ORDER BY product_name');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/inventory', authenticateToken, async (req, res) => {
  try {
    const { product_name, category, quantity, unit, min_stock, cost_per_unit, supplier } = req.body;
    const result = await pool.query(
      'INSERT INTO inventory (product_name, category, quantity, unit, min_stock, cost_per_unit, supplier) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [product_name, category, quantity, unit, min_stock, cost_per_unit, supplier]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/inventory/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { product_name, category, quantity, unit, min_stock, cost_per_unit, supplier } = req.body;
    const result = await pool.query(
      'UPDATE inventory SET product_name=$1, category=$2, quantity=$3, unit=$4, min_stock=$5, cost_per_unit=$6, supplier=$7, last_updated=NOW() WHERE id=$8 RETURNING *',
      [product_name, category, quantity, unit, min_stock, cost_per_unit, supplier, id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/inventory/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM inventory WHERE id=$1', [id]);
    res.json({ message: 'Producto eliminado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// HOUSEKEEPING
// ==========================================
app.get('/api/housekeeping', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT h.*, r.room_number 
      FROM housekeeping_tasks h
      LEFT JOIN rooms r ON h.room_id = r.id
      ORDER BY h.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/housekeeping', authenticateToken, async (req, res) => {
  try {
    const { room_id, task_type, assigned_to, priority, notes } = req.body;
    const result = await pool.query(
      'INSERT INTO housekeeping_tasks (room_id, task_type, assigned_to, priority, notes) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [room_id, task_type, assigned_to, priority, notes]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/housekeeping/:id/complete', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'UPDATE housekeeping_tasks SET status=$1, completed_at=NOW() WHERE id=$2 RETURNING *',
      ['completada', id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/housekeeping/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM housekeeping_tasks WHERE id=$1', [id]);
    res.json({ message: 'Tarea eliminada' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// ==========================================
// CONTROL DE CAJA / FINANZAS
// ==========================================
app.get('/api/transactions', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM transactions ORDER BY date DESC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/transactions', authenticateToken, async (req, res) => {
  try {
    const { type, category, description, amount, payment_method, reference } = req.body;
    const result = await pool.query(
      'INSERT INTO transactions (type, category, description, amount, payment_method, reference, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [type, category, description, amount, payment_method, reference, req.user.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/financial-summary', authenticateToken, async (req, res) => {
  try {
    const income = await pool.query("SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE type = 'ingreso'");
    const expenses = await pool.query("SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE type = 'gasto'");
    const byCategory = await pool.query("SELECT category, SUM(amount) as total FROM transactions GROUP BY category ORDER BY total DESC");
    const byMethod = await pool.query("SELECT payment_method, SUM(amount) as total FROM transactions WHERE type='ingreso' GROUP BY payment_method");
    
    res.json({
      total_income: parseFloat(income.rows[0].total),
      total_expenses: parseFloat(expenses.rows[0].total),
      balance: parseFloat(income.rows[0].total) - parseFloat(expenses.rows[0].total),
      by_category: byCategory.rows,
      by_method: byMethod.rows
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
   
   // Configuración del puerto para Render (usamos 'puerto' para evitar conflictos)
// ==========================================
// SISTEMA CONTABLE - ENDPOINTS
// ==========================================

// 1. Obtener todas las cuentas
app.get('/api/accounts', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM accounts WHERE is_active = true ORDER BY code');
        res.json(result.rows);
    } catch (error) {
        console.error('Error al obtener cuentas:', error);
        res.status(500).json({ error: 'Error al obtener cuentas' });
    }
});

// 2. Crear nueva cuenta
app.post('/api/accounts', authenticateToken, async (req, res) => {
    try {
        const { code, name, type, description } = req.body;
        const result = await pool.query(
            'INSERT INTO accounts (code, name, type, description) VALUES ($1, $2, $3, $4) RETURNING *',
            [code, name, type, description]
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error al crear cuenta:', error);
        res.status(500).json({ error: 'Error al crear cuenta' });
    }
});

// 3. Obtener todos los asientos contables
app.get('/api/journal-entries', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT je.*, 
                   json_agg(json_build_object(
                       'id', jed.id,
                       'account_id', jed.account_id,
                       'account_code', a.code,
                       'account_name', a.name,
                       'description', jed.description,
                       'debit', jed.debit,
                       'credit', jed.credit
                   )) as details
            FROM journal_entries je
            LEFT JOIN journal_entry_details jed ON je.id = jed.journal_entry_id
            LEFT JOIN accounts a ON jed.account_id = a.id
            GROUP BY je.id
            ORDER BY je.entry_date DESC, je.id DESC
        `);
        res.json(result.rows);
    } catch (error) {
        console.error('Error al obtener asientos:', error);
        res.status(500).json({ error: 'Error al obtener asientos' });
    }
});

// 4. Crear asiento contable con partida doble (Transacción segura)
app.post('/api/journal-entries', authenticateToken, async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { entry_date, reference, description, details } = req.body;
        
        let totalDebit = 0;
        let totalCredit = 0;
        details.forEach(d => {
            totalDebit += parseFloat(d.debit) || 0;
            totalCredit += parseFloat(d.credit) || 0;
        });
        
        if (Math.abs(totalDebit - totalCredit) > 0.01) {
            throw new Error('Los débitos deben ser exactamente iguales a los créditos (Partida Doble)');
        }
        
        const entryResult = await client.query(
            'INSERT INTO journal_entries (entry_date, reference, description, total_amount, status) VALUES ($1, $2, $3, $4, $5) RETURNING id',
            [entry_date, reference, description, totalDebit, 'confirmado']
        );
        const entryId = entryResult.rows[0].id;
        
        for (const detail of details) {
            await client.query(
                'INSERT INTO journal_entry_details (journal_entry_id, account_id, description, debit, credit) VALUES ($1, $2, $3, $4, $5)',
                [entryId, detail.account_id, detail.description, detail.debit || 0, detail.credit || 0]
            );
        }
        
        await client.query('COMMIT');
        res.status(201).json({ id: entryId, message: 'Asiento contable creado exitosamente' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error al crear asiento:', error);
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
});

// 5. Balance de Comprobación
app.get('/api/trial-balance', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                a.code, a.name, a.type,
                COALESCE(SUM(jed.debit), 0) as total_debit,
                COALESCE(SUM(jed.credit), 0) as total_credit,
                CASE 
                    WHEN a.type IN ('activo', 'gasto') THEN COALESCE(SUM(jed.debit), 0) - COALESCE(SUM(jed.credit), 0)
                    ELSE COALESCE(SUM(jed.credit), 0) - COALESCE(SUM(jed.debit), 0)
                END as balance
            FROM accounts a
            LEFT JOIN journal_entry_details jed ON a.id = jed.account_id
            LEFT JOIN journal_entries je ON jed.journal_entry_id = je.id AND je.status = 'confirmado'
            WHERE a.is_active = true
            GROUP BY a.id, a.code, a.name, a.type
            ORDER BY a.code
        `);
        res.json(result.rows);
    } catch (error) {
        console.error('Error al obtener balance:', error);
        res.status(500).json({ error: 'Error al obtener balance' });
    }
});

// 6. Estado de Resultados
app.get('/api/income-statement', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                a.type, a.code, a.name,
                CASE 
                    WHEN a.type = 'ingreso' THEN COALESCE(SUM(jed.credit), 0) - COALESCE(SUM(jed.debit), 0)
                    WHEN a.type = 'gasto' THEN COALESCE(SUM(jed.debit), 0) - COALESCE(SUM(jed.credit), 0)
                    ELSE 0
                END as amount
            FROM accounts a
            LEFT JOIN journal_entry_details jed ON a.id = jed.account_id
            LEFT JOIN journal_entries je ON jed.journal_entry_id = je.id AND je.status = 'confirmado'
            WHERE a.is_active = true AND a.type IN ('ingreso', 'gasto')
            GROUP BY a.id, a.type, a.code, a.name
            ORDER BY a.type, a.code
        `);
        
        let totalIncome = 0, totalExpenses = 0;
        result.rows.forEach(row => {
            if (row.type === 'ingreso') totalIncome += parseFloat(row.amount);
            if (row.type === 'gasto') totalExpenses += parseFloat(row.amount);
        });
        
        res.json({ details: result.rows, totalIncome, totalExpenses, netIncome: totalIncome - totalExpenses });
    } catch (error) {
        console.error('Error al obtener estado de resultados:', error);
        res.status(500).json({ error: 'Error al obtener estado de resultados' });
    }
});
// ==========================================
app.listen(process.env.PORT || 3000, '0.0.0.0', () => {
    console.log(`🚀 Servidor corriendo en puerto ${process.env.PORT || 3000}`);
    console.log('📊 Dashboard con estadísticas disponible');
});
    