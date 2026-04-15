import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const db = new Database("database.sqlite");

try {
  // Initialize database
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      email TEXT UNIQUE,
      password TEXT,
      role TEXT DEFAULT 'user',
      plan TEXT DEFAULT 'free'
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      type TEXT, -- 'income' or 'expense'
      docType TEXT,
      docNumber TEXT,
      category TEXT,
      amount REAL,
      date TEXT,
      description TEXT,
      image_url TEXT,
      raw_data TEXT,
      payment_method TEXT DEFAULT 'bank',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      docNumber TEXT,
      product_name TEXT,
      category TEXT,
      quantity INTEGER,
      price REAL,
      total REAL,
      date TEXT,
      customer_name TEXT,
      payment_method TEXT DEFAULT 'bank',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  // Migration: Add user_id column if they don't exist
  let recordsInfo = db.prepare("PRAGMA table_info(records)").all() as any[];
  if (!recordsInfo.map(col => col.name).includes('user_id')) {
    db.exec("ALTER TABLE records ADD COLUMN user_id INTEGER");
  }

  let salesInfo = db.prepare("PRAGMA table_info(sales)").all() as any[];
  if (!salesInfo.map(col => col.name).includes('user_id')) {
    db.exec("ALTER TABLE sales ADD COLUMN user_id INTEGER");
  }

  // Migration: Add name and password columns if they don't exist
  const tableInfo = db.prepare("PRAGMA table_info(users)").all() as any[];
  const columns = tableInfo.map(col => col.name);

  if (!columns.includes('name')) {
    db.exec("ALTER TABLE users ADD COLUMN name TEXT");
  }
  if (!columns.includes('password')) {
    db.exec("ALTER TABLE users ADD COLUMN password TEXT");
  }
  if (!columns.includes('phone')) {
    db.exec("ALTER TABLE users ADD COLUMN phone TEXT");
  }
  if (!columns.includes('company_name')) {
    db.exec("ALTER TABLE users ADD COLUMN company_name TEXT");
  }
  if (!columns.includes('ssm_number')) {
    db.exec("ALTER TABLE users ADD COLUMN ssm_number TEXT");
  }
  if (!columns.includes('business_address')) {
    db.exec("ALTER TABLE users ADD COLUMN business_address TEXT");
  }
  if (!columns.includes('tax_id')) {
    db.exec("ALTER TABLE users ADD COLUMN tax_id TEXT");
  }
  if (!columns.includes('financial_year_end')) {
    db.exec("ALTER TABLE users ADD COLUMN financial_year_end TEXT");
  }

  // Migration: Add docType and docNumber columns to records if they don't exist
  recordsInfo = db.prepare("PRAGMA table_info(records)").all() as any[];
  if (!recordsInfo.some(col => col.name === 'docType')) {
    db.exec("ALTER TABLE records ADD COLUMN docType TEXT");
  }
  if (!recordsInfo.some(col => col.name === 'docNumber')) {
    db.exec("ALTER TABLE records ADD COLUMN docNumber TEXT");
  }
  if (!recordsInfo.some(col => col.name === 'sale_id')) {
    db.exec("ALTER TABLE records ADD COLUMN sale_id INTEGER");
  }
  if (!recordsInfo.some(col => col.name === 'origin')) {
    db.exec("ALTER TABLE records ADD COLUMN origin TEXT");
  }
  if (!recordsInfo.some(col => col.name === 'reconciled')) {
    db.exec("ALTER TABLE records ADD COLUMN reconciled INTEGER DEFAULT 0");
  }
  if (!recordsInfo.some(col => col.name === 'payment_method')) {
    db.exec("ALTER TABLE records ADD COLUMN payment_method TEXT DEFAULT 'bank'");
  }

  // Migration: Add docNumber to sales if it doesn't exist
  salesInfo = db.prepare("PRAGMA table_info(sales)").all() as any[];
  if (!salesInfo.some(col => col.name === 'docNumber')) {
    db.exec("ALTER TABLE sales ADD COLUMN docNumber TEXT");
  }
  if (!salesInfo.some(col => col.name === 'category')) {
    db.exec("ALTER TABLE sales ADD COLUMN category TEXT");
  }
  if (!salesInfo.some(col => col.name === 'reconciled')) {
    db.exec("ALTER TABLE sales ADD COLUMN reconciled INTEGER DEFAULT 0");
  }
  if (!salesInfo.some(col => col.name === 'payment_method')) {
    db.exec("ALTER TABLE sales ADD COLUMN payment_method TEXT DEFAULT 'bank'");
  }

  // Migration: Create records for existing sales that don't have a record yet
  const existingSales = db.prepare("SELECT * FROM sales").all() as any[];
  for (const sale of existingSales) {
    const existingRecord = db.prepare("SELECT id FROM records WHERE sale_id = ?").get(sale.id);
    if (!existingRecord) {
      db.prepare(
        "INSERT INTO records (user_id, type, docType, docNumber, category, amount, date, description, sale_id, origin) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      ).run(sale.user_id, 'income', 'Invois Jualan', sale.docNumber, sale.category || 'SALES', sale.total, sale.date, `Jualan: ${sale.product_name} (${sale.quantity} unit)`, sale.id, 'sale');
    }
  }
  console.log("Database migrations completed successfully.");
} catch (err) {
  console.error("Database migration error:", err);
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
  });

  app.use(express.json({ limit: '10mb' }));

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Auth Routes
  app.get("/api/users", (req, res) => {
    const users = db.prepare("SELECT id, name, email, phone, role, company_name FROM users").all();
    res.json(users);
  });

  app.put("/api/users/role", (req, res) => {
    const { id, role } = req.body;
    try {
      db.prepare("UPDATE users SET role = ? WHERE id = ?").run(role, id);
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ error: "Failed to update user role" });
    }
  });

  app.post("/api/users", (req, res) => {
    const { name, email, password, role, company_name } = req.body;
    try {
      const info = db.prepare(
        "INSERT INTO users (name, email, password, role, company_name) VALUES (?, ?, ?, ?, ?)"
      ).run(name, email, password, role || 'user', company_name || '');
      const user = db.prepare("SELECT id, name, email, phone, role, plan, company_name FROM users WHERE id = ?").get(info.lastInsertRowid);
      res.json(user);
    } catch (err) {
      res.status(400).json({ error: "Email already exists or invalid data" });
    }
  });

  app.post("/api/register", (req, res) => {
    const { name, email, phone, password, company_name } = req.body;
    try {
      const info = db.prepare(
        "INSERT INTO users (name, email, phone, password, company_name) VALUES (?, ?, ?, ?, ?)"
      ).run(name, email, phone, password, company_name);
      const user = db.prepare("SELECT id, name, email, phone, role, plan, company_name, ssm_number, business_address, tax_id, financial_year_end FROM users WHERE id = ?").get(info.lastInsertRowid);
      res.json(user);
    } catch (err) {
      res.status(400).json({ error: "Email already exists" });
    }
  });

  app.post("/api/login", (req, res) => {
    const { email, password } = req.body;
    const user = db.prepare("SELECT id, name, email, phone, role, plan, company_name, ssm_number, business_address, tax_id, financial_year_end FROM users WHERE email = ? AND password = ?").get(email, password);
    if (user) {
      res.json(user);
    } else {
      res.status(401).json({ error: "Invalid credentials" });
    }
  });

  app.put("/api/profile", (req, res) => {
    const { id, name, phone, company_name } = req.body;
    try {
      db.prepare(
        "UPDATE users SET name = ?, phone = ?, company_name = ? WHERE id = ?"
      ).run(name, phone, company_name, id);
      const user = db.prepare("SELECT id, name, email, phone, role, plan, company_name, ssm_number, business_address, tax_id, financial_year_end FROM users WHERE id = ?").get(id);
      res.json(user);
    } catch (err) {
      res.status(400).json({ error: "Failed to update profile" });
    }
  });

  app.put("/api/business-settings", (req, res) => {
    const { id, company_name, ssm_number, business_address, tax_id, financial_year_end } = req.body;
    try {
      db.prepare(
        "UPDATE users SET company_name = ?, ssm_number = ?, business_address = ?, tax_id = ?, financial_year_end = ? WHERE id = ?"
      ).run(company_name, ssm_number, business_address, tax_id, financial_year_end, id);
      const user = db.prepare("SELECT id, name, email, phone, role, plan, company_name, ssm_number, business_address, tax_id, financial_year_end FROM users WHERE id = ?").get(id);
      res.json(user);
    } catch (err) {
      res.status(400).json({ error: "Failed to update business settings" });
    }
  });

  app.get("/api/dashboard-data", (req, res) => {
    const userId = req.query.userId;
    const userRole = req.query.role;

    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    try {
      let recordsQuery = "SELECT * FROM records WHERE user_id = ?";
      let salesQuery = "SELECT * FROM sales WHERE user_id = ?";
      let statsQuery = `
        SELECT 
          SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as total_income,
          SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as total_expense
        FROM records
        WHERE user_id = ?
      `;
      let byCategoryQuery = `
        SELECT category, type, SUM(amount) as total
        FROM records
        WHERE user_id = ?
        GROUP BY category, type
      `;
      let salesStatsQuery = `
        SELECT 
          SUM(total) as total_sales,
          COUNT(*) as total_orders,
          SUM(quantity) as total_items
        FROM sales
        WHERE user_id = ?
      `;
      let salesByProductQuery = `
        SELECT product_name, SUM(total) as total, SUM(quantity) as quantity
        FROM sales
        WHERE user_id = ?
        GROUP BY product_name
        ORDER BY total DESC
        LIMIT 5
      `;

      if (userRole === 'upload_only') {
        salesQuery = "SELECT * FROM sales WHERE 1=0";
        salesStatsQuery = "SELECT SUM(0) as total_sales, COUNT(*) as total_orders, SUM(0) as total_items FROM sales WHERE 1=0";
        salesByProductQuery = "SELECT product_name, SUM(0) as total, SUM(0) as quantity FROM sales WHERE 1=0 GROUP BY product_name";
      }

      recordsQuery += " ORDER BY date DESC";
      salesQuery += " ORDER BY date DESC";

      const records = db.prepare(recordsQuery).all(userId);
      const sales = db.prepare(salesQuery).all(userRole === 'upload_only' ? [] : [userId]);
      
      const stats = db.prepare(statsQuery).get(userId);
      const byCategory = db.prepare(byCategoryQuery).all(userId);
      const salesStats = db.prepare(salesStatsQuery).get(userRole === 'upload_only' ? [] : [userId]);
      const salesByProduct = db.prepare(salesByProductQuery).all(userRole === 'upload_only' ? [] : [userId]);

      res.json({
        records,
        sales,
        stats: { ...stats, byCategory },
        salesStats: { ...salesStats, byProduct: salesByProduct }
      });
    } catch (err) {
      console.error('Error in /api/dashboard-data:', err);
      res.status(500).json({ error: "Gagal mengambil data papan pemuka", details: err instanceof Error ? err.message : String(err) });
    }
  });

  // API Records Routes
  app.get("/api/records", (req, res) => {
    const { userId, role } = req.query;
    if (!userId) return res.status(400).json({ error: "userId is required" });
    try {
      let query = "SELECT * FROM records WHERE user_id = ?";
      query += " ORDER BY date DESC";
      const records = db.prepare(query).all(userId);
      res.json(records);
    } catch (err) {
      console.error('Error in /api/records:', err);
      res.status(500).json({ error: "Gagal mengambil rekod", details: err instanceof Error ? err.message : String(err) });
    }
  });

  // Sales Routes
  app.get("/api/sales", (req, res) => {
    const { userId, role } = req.query;
    if (!userId) return res.status(400).json({ error: "userId is required" });
    try {
      if (role === 'upload_only') {
        return res.json([]);
      }

      let query = "SELECT * FROM sales WHERE user_id = ?";
      query += " ORDER BY date DESC";
      const sales = db.prepare(query).all(userId);
      res.json(sales);
    } catch (err) {
      console.error('Error in /api/sales:', err);
      res.status(500).json({ error: "Gagal mengambil jualan", details: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post("/api/sales", (req, res) => {
    const { docNumber, product_name, category, quantity, price, total, date, customer_name, payment_method, userId } = req.body;
    
    const transaction = db.transaction(() => {
      const info = db.prepare(
        "INSERT INTO sales (user_id, docNumber, product_name, category, quantity, price, total, date, customer_name, payment_method) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      ).run(userId, docNumber, product_name, category || 'SALES', quantity, price, total, date, customer_name, payment_method || 'bank');
      
      const saleId = info.lastInsertRowid;
      
      // Also record as income in records table
      db.prepare(
        "INSERT INTO records (user_id, type, docType, docNumber, category, amount, date, description, sale_id, origin, payment_method) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      ).run(userId, 'income', 'Invois Jualan', docNumber, category || 'SALES', total, date, `Jualan: ${product_name} (${quantity} unit)`, saleId, 'sale', payment_method || 'bank');
      
      return saleId;
    });

    try {
      const saleId = transaction();
      res.json({ id: saleId });
    } catch (err) {
      res.status(400).json({ error: "Failed to save sale and record" });
    }
  });

  app.delete("/api/sales/:id", (req, res) => {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: "userId is required" });

    const transaction = db.transaction(() => {
      // Verify ownership
      const sale = db.prepare("SELECT user_id FROM sales WHERE id = ?").get(req.params.id) as any;
      if (!sale || sale.user_id != userId) {
        throw new Error("Unauthorized");
      }

      // Delete from records first (if linked)
      db.prepare("DELETE FROM records WHERE sale_id = ?").run(req.params.id);
      // Delete from sales
      db.prepare("DELETE FROM sales WHERE id = ?").run(req.params.id);
    });

    try {
      transaction();
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Failed to delete sale" });
    }
  });

  app.put("/api/sales/:id", (req, res) => {
    const { docNumber, product_name, category, quantity, price, total, date, customer_name, reconciled, payment_method, userId } = req.body;
    if (!userId) return res.status(400).json({ error: "userId is required" });

    try {
      // Verify ownership
      const sale = db.prepare("SELECT user_id FROM sales WHERE id = ?").get(req.params.id) as any;
      if (!sale || sale.user_id != userId) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      db.prepare(
        "UPDATE sales SET docNumber = ?, product_name = ?, category = ?, quantity = ?, price = ?, total = ?, date = ?, customer_name = ?, reconciled = ?, payment_method = ? WHERE id = ?"
      ).run(docNumber, product_name, category, quantity, price, total, date, customer_name, reconciled ? 1 : 0, payment_method || 'bank', req.params.id);
      
      // Also update linked record if exists
      db.prepare(
        "UPDATE records SET docNumber = ?, category = ?, amount = ?, date = ?, description = ?, reconciled = ?, payment_method = ? WHERE sale_id = ?"
      ).run(docNumber, category, total, date, `Jualan: ${product_name} (${quantity} unit)`, reconciled ? 1 : 0, payment_method || 'bank', req.params.id);
      
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ error: "Failed to update sale" });
    }
  });

  app.get("/api/sales/stats", (req, res) => {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: "userId is required" });
    try {
      const stats = db.prepare(`
        SELECT 
          SUM(total) as total_sales,
          COUNT(*) as total_orders,
          SUM(quantity) as total_items
        FROM sales
        WHERE user_id = ?
      `).get(userId);
      
      const byProduct = db.prepare(`
        SELECT product_name, SUM(total) as total, SUM(quantity) as quantity
        FROM sales
        WHERE user_id = ?
        GROUP BY product_name
        ORDER BY total DESC
        LIMIT 5
      `).all(userId);

      res.json({ ...stats, byProduct });
    } catch (err) {
      console.error('Error in /api/sales/stats:', err);
      res.status(500).json({ error: "Gagal mengambil statistik jualan", details: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post("/api/records", (req, res) => {
    const { type, docType, docNumber, category, amount, date, description, image_url, raw_data, origin, payment_method, userId } = req.body;
    
    if (type === 'income' && origin !== 'sale') {
      const transaction = db.transaction(() => {
        // Create sale first
        const saleInfo = db.prepare(
          "INSERT INTO sales (user_id, docNumber, product_name, category, quantity, price, total, date, payment_method) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
        ).run(userId, docNumber || '', description || 'Jualan Am', category || 'SALES', 1, amount, amount, date, payment_method || 'bank');
        
        const saleId = saleInfo.lastInsertRowid;
        
        // Create record linked to sale
        const recordInfo = db.prepare(
          "INSERT INTO records (user_id, type, docType, docNumber, category, amount, date, description, image_url, raw_data, origin, sale_id, payment_method) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        ).run(userId, type, docType, docNumber, category, amount, date, description, image_url, raw_data, origin || 'manual', saleId, payment_method || 'bank');
        
        return recordInfo.lastInsertRowid;
      });
      
      try {
        const recordId = transaction();
        res.json({ id: recordId });
      } catch (err) {
        console.error('Error saving record and sale:', err);
        res.status(400).json({ error: "Failed to save record and sale" });
      }
    } else {
      const info = db.prepare(
        "INSERT INTO records (user_id, type, docType, docNumber, category, amount, date, description, image_url, raw_data, origin, payment_method) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      ).run(userId, type, docType, docNumber, category, amount, date, description, image_url, raw_data, origin || 'manual', payment_method || 'bank');
      res.json({ id: info.lastInsertRowid });
    }
  });

  app.delete("/api/records/:id", (req, res) => {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: "userId is required" });

    const transaction = db.transaction(() => {
      // Verify ownership
      const record = db.prepare("SELECT user_id, sale_id FROM records WHERE id = ?").get(req.params.id) as any;
      if (!record || record.user_id != userId) {
        throw new Error("Unauthorized");
      }

      if (record.sale_id) {
        // Delete from sales
        db.prepare("DELETE FROM sales WHERE id = ?").run(record.sale_id);
      }
      // Delete from records
      db.prepare("DELETE FROM records WHERE id = ?").run(req.params.id);
    });

    try {
      transaction();
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Failed to delete record" });
    }
  });

  app.put("/api/records/:id", (req, res) => {
    const { type, docType, docNumber, category, amount, date, description, image_url, reconciled, payment_method, userId } = req.body;
    if (!userId) return res.status(400).json({ error: "userId is required" });
    
    const transaction = db.transaction(() => {
      // Verify ownership
      const existingRecord = db.prepare("SELECT user_id, sale_id FROM records WHERE id = ?").get(req.params.id) as any;
      if (!existingRecord || existingRecord.user_id != userId) {
        throw new Error("Unauthorized");
      }

      // Update record
      db.prepare(
        "UPDATE records SET type = ?, docType = ?, docNumber = ?, category = ?, amount = ?, date = ?, description = ?, image_url = ?, reconciled = ?, payment_method = ? WHERE id = ?"
      ).run(type, docType, docNumber, category, amount, date, description, image_url, reconciled ? 1 : 0, payment_method || 'bank', req.params.id);
      
      const record = existingRecord;
      if (record && record.sale_id) {
        if (type === 'income') {
          db.prepare(
            "UPDATE sales SET docNumber = ?, product_name = ?, category = ?, total = ?, price = ?, date = ?, reconciled = ?, payment_method = ? WHERE id = ?"
          ).run(docNumber || '', description || 'Jualan Am', category || 'SALES', amount, amount, date, reconciled ? 1 : 0, payment_method || 'bank', record.sale_id);
        } else {
          // If type changed to expense, delete the sale
          db.prepare("DELETE FROM sales WHERE id = ?").run(record.sale_id);
          db.prepare("UPDATE records SET sale_id = NULL WHERE id = ?").run(req.params.id);
        }
      } else if (type === 'income') {
        // If it was an expense and now is income, create a sale
        const saleInfo = db.prepare(
          "INSERT INTO sales (user_id, docNumber, product_name, category, quantity, price, total, date, reconciled, payment_method) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        ).run(userId, docNumber || '', description || 'Jualan Am', category || 'SALES', 1, amount, amount, date, reconciled ? 1 : 0, payment_method || 'bank');
        db.prepare("UPDATE records SET sale_id = ? WHERE id = ?").run(saleInfo.lastInsertRowid, req.params.id);
      }
    });

    try {
      transaction();
      res.json({ success: true });
    } catch (err) {
      console.error('Error updating record and sale:', err);
      res.status(400).json({ error: err instanceof Error ? err.message : "Failed to update record and sale" });
    }
  });

  app.get("/api/stats", (req, res) => {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: "userId is required" });
    try {
      const stats = db.prepare(`
        SELECT 
          SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as total_income,
          SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as total_expense
        FROM records
        WHERE user_id = ?
      `).get(userId);
      
      const byCategory = db.prepare(`
        SELECT category, type, SUM(amount) as total
        FROM records
        WHERE user_id = ?
        GROUP BY category, type
      `).all(userId);

      res.json({ ...stats, byCategory });
    } catch (err) {
      console.error('Error in /api/stats:', err);
      res.status(500).json({ error: "Gagal mengambil statistik", details: err instanceof Error ? err.message : String(err) });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
    app.get("*", (req, res) => {
      res.sendFile(path.resolve("dist/index.html"));
    });
  }

  // Global error handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
    console.log(`Health check: http://0.0.0.0:${PORT}/api/health`);
  });
}

startServer();
