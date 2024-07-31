const express = require('express');
const bodyParser = require('body-parser');
const sql = require('mssql');
const cors = require('cors');

const app = express();
const port = 5000;

// Middleware
app.use(bodyParser.json());
app.use(cors()); // Enable CORS

// Azure SQL Database connection configuration
const dbConfig = {
  user: 'urbanwada', // Replace with your SQL Server username
  password: 'Admin@1845', // Replace with your SQL Server password
  server: 'urbanwada.database.windows.net', // Replace with your server name
  database: 'urbanwada', // Replace with your database name
  options: {
    encrypt: true, // Use encryption
  }
};

// Connect to the database
sql.connect(dbConfig).then(pool => {
  if (pool.connected) {
    console.log('Connected to Azure SQL Database');
  }

  // Reviews endpoint
  app.post('/api/reviews', async (req, res) => {
    try {
      const { name, mobile, address, dob, anniversary, feedback } = req.body;

      // Validate input data
      if (!name || !mobile || !address || !dob || !feedback) {
        return res.status(400).send('Missing required fields');
      }

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
      res.send('Review saved!');
    } catch (err) {
      console.error('SQL error:', err);
      res.status(500).send('Error saving review');
    }
  });

  // Get all tables endpoint
  app.get('/api/tables', async (req, res) => {
    try {
      const query = 'SELECT * FROM tables'; // Adjust this query as needed
      const result = await pool.request().query(query);
      res.json(result.recordset);
    } catch (err) {
      console.error('Error fetching tables:', err);
      res.status(500).send('Error fetching tables');
    }
  });

  // Book a table endpoint
  app.post('/api/book-table', async (req, res) => {
    try {
      const { name, mobile, date, time, tableId } = req.body;

      // Validate input data
      if (!name || !mobile || !date || !time || !tableId) {
        return res.status(400).send('Missing required fields');
      }

      // Ensure the date and time are valid
      const parsedDate = new Date(date);
      const parsedTime = new Date(`1970-01-01T${time}:00Z`);

      if (isNaN(parsedDate.getTime()) || isNaN(parsedTime.getTime())) {
        return res.status(400).send('Invalid date or time');
      }

      const formattedTime = parsedTime.toISOString().substr(11, 8); // Extract time in 'HH:MM:SS'

      // Check if the table is already booked at the specified date and time
      const checkQuery = `
        SELECT * FROM tables
        WHERE id = @tableId AND booked = 1 AND date = @date AND time = @time
      `;
      const checkRequest = pool.request();
      checkRequest.input('tableId', sql.Int, tableId);
      checkRequest.input('date', sql.Date, date);
      checkRequest.input('time', sql.Time, formattedTime);

      const checkResult = await checkRequest.query(checkQuery);

      if (checkResult.recordset.length > 0) {
        return res.status(400).send('Table is already booked at this time.');
      }

      // Update table booking
      const query = `
        UPDATE tables
        SET booked = 1, name = @name, mobile = @mobile, date = @date, time = @time
        WHERE id = @tableId
      `;
      const request = pool.request();
      request.input('name', sql.VarChar, name);
      request.input('mobile', sql.VarChar, mobile);
      request.input('date', sql.Date, date);
      request.input('time', sql.Time, formattedTime);
      request.input('tableId', sql.Int, tableId);

      await request.query(query);

      // Refresh table data
      const updatedTables = await pool.request().query('SELECT * FROM tables');
      res.json(updatedTables.recordset);
    } catch (err) {
      console.error('SQL error:', err);
      res.status(500).send('Error booking table');
    }
  });

}).catch(err => {
  console.error('Database connection failed:', err);
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
