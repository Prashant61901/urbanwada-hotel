const express = require('express');
const bodyParser = require('body-parser');
const sql = require('mssql');
const cors = require('cors');

const app = express();
const port = 5000;

// Middleware
app.use(bodyParser.json());
app.use(cors());

// SQL Server connection configuration
const dbConfig = {
  user: 'urbanwada',
  password: 'Admin@1845',
  server: 'urbanwada.database.windows.net',
  database: 'urbanwada',
  options: {
    encrypt: true,
    trustServerCertificate: false
  }
};

// Connect to the database
const poolPromise = sql.connect(dbConfig);

app.post('/api/reviews', async (req, res) => {
  try {
    const { name, mobile, address, dob, anniversary, feedback } = req.body;

    // Validate input data
    if (!name || !mobile || !address || !dob || !feedback) {
      return res.status(400).send('Missing required fields');
    }

    // Insert data into database
    const pool = await poolPromise;
    const query = `
      INSERT INTO reviews (name, mobile, address, dob, anniversary, feedback)
      VALUES (@name, @mobile, @address, @dob, @anniversary, @feedback)
    `;
    const request = pool.request();
    request.input('name', sql.VarChar, name);
    request.input('mobile', sql.VarChar, mobile);
    request.input('address', sql.Text, address);
    request.input('dob', sql.Date, dob);
    request.input('anniversary', sql.Date, anniversary);
    request.input('feedback', sql.Text, feedback);

    await request.query(query);

    res.status(200).send('Review saved to database');
  } catch (err) {
    console.error('Error saving review:', err.message);
    res.status(500).send('Error saving review: ' + err.message);
  }
});
// Fetch all tables
app.get('/api/tables', async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query('SELECT * FROM tableshow');
    res.json(result.recordset);
  } catch (err) {
    console.error('Error fetching tables:', err.message);
    res.status(500).send('Error fetching tables: ' + err.message);
  }
});

// Book a table
app.post('/api/book-table', async (req, res) => {
  const { name, mobile, tableId } = req.body;

  try {
    const pool = await poolPromise;

    // Update table status to booked and save customer info
    await pool.request()
      .input('name', sql.NVarChar, name)
      .input('mobile', sql.NVarChar, mobile)
      .input('tableId', sql.Int, tableId)
      .query(`
        UPDATE tableshow
        SET Status = 'Booked', CustomerName = @name, CustomerMobile = @mobile
        WHERE TableID = @tableId
      `);

    // Insert booking record
    await pool.request()
      .input('tableId', sql.Int, tableId)
      .input('name', sql.NVarChar, name)
      .input('mobile', sql.NVarChar, mobile)
      .query(`
        INSERT INTO Bookings (TableID, CustomerName, CustomerMobile)
        VALUES (@tableId, @name, @mobile)
      `);

    res.status(200).send('Table booked successfully');
  } catch (err) {
    console.error('Error booking table:', err.message);
    res.status(500).send('Error booking table: ' + err.message);
  }
});

// Exit a booking and update table status to available
app.post('/api/exit-booking/:tableId', async (req, res) => {
  const { tableId } = req.params;

  try {
    const pool = await poolPromise;

    // Delete booking from the database
    await pool.request()
      .input('tableId', sql.Int, tableId)
      .query('DELETE FROM Bookings WHERE TableID = @tableId');

    // Update table status to available
    await pool.request()
      .input('tableId', sql.Int, tableId)
      .query('UPDATE tableshow SET Status = \'Available\', CustomerName = NULL, CustomerMobile = NULL WHERE TableID = @tableId');

    res.status(200).send('Booking exited and table status updated to available');
  } catch (err) {
    console.error('Error exiting booking:', err.message);
    res.status(500).send('Error exiting booking: ' + err.message);
  }
});

// Start server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});


