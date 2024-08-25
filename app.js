if(process.env.NODE_ENV !== 'production'){  
      require('dotenv').config()
};

const express = require("express");
const path = require("path");
const mysql = require("mysql2");
const methodOverride = require("method-override");
const { v4: uuidv4 } = require("uuid");
const { validationResult, body } = require("express-validator");

const app = express();
const port = 3307;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride('_method'));
app.use(express.json());

const pool = mysql.createPool({
      host:process.env.HOST,
      user: process.env.USER,
      database: process.env.DATABASE,
      password: process.env.PASSWORD,
      connectionLimit: 10
});

function query(sql, params) {
      return new Promise((resolve, reject) => {
      pool.query(sql, params, (err, results) => {
            if (err) return reject(err);
            resolve(results);
      });
      });
}


const url = "https://ipapi.co/json/";

async function getLocation(url, retries = 3, delay = 1000) {
      try {
            const response = await fetch(url);
            if (!response.ok) {
            if (response.status === 429 && retries > 0) {
                  console.warn(`Rate limit exceeded. Retrying in ${delay} ms...`);
                  await new Promise(resolve => setTimeout(resolve, delay));
                  return getLocation(url, retries - 1, delay * 2); 
            }
            throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await response.json();
            } catch (err) {
            console.error('Error fetching location:', err.message);
            throw err;
            }
      }


const validation = [
      body('name').notEmpty().withMessage('Name is required'),
      body('address').notEmpty().withMessage('Address is required'),
      body('latitude').isFloat({ min: -90, max: 90 }).withMessage('Invalid latitude'),
      body('longitude').isFloat({ min: -180, max: 180 }).withMessage('Invalid longitude')
];

app.get('/listSchools', async (req, res) => {
      const q = "SELECT * FROM school";
      try {
            const results = await query(q);
            res.render('listSchools', { results });
      } catch (err) {
            console.error('Error fetching schools:', err);
            res.status(500).send("Error in DB");
      }
});

app.post('/listSchools', async (req, res) => {
            const loc = await getLocation(url);
            let { latitude: lat1, longitude: lon1 } = req.body;
            const userLat = lat1 || loc.latitude;
            const userLong = lon1 || loc.longitude;
            const q = `SELECT *, (6371 * acos(cos(radians(?)) * cos(radians(latitude)) * cos(radians(longitude) - radians(?)) + sin(radians(?)) * sin(radians(latitude)))) AS distance FROM school ORDER BY distance ASC;`;
            try {
            const results = await query(q, [userLat, userLong, userLat]);
            res.render('listSchools', { results });
            } catch (err) {
            console.error('Error calculating distances:', err);
            res.status(500).send("Error in DB or fetching location");
      }
});

app.get('/addSchool', (req, res) => {
      res.render('addSchool');
});

app.post('/addSchool', validation, async (req, res) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
      }
      const { name, address, latitude, longitude } = req.body;
      const id = uuidv4();
      const q = "INSERT INTO school (id, name, address, latitude, longitude) VALUES (?, ?, ?, ?, ?)";
      try {
      await query(q, [id, name, address, latitude, longitude]);
      // res.render('listSchools', { results });
      res.status(201).json({ message: "School added successfully" });
      } catch (err) {
      console.error('Error adding school:', err);
      res.status(500).send("Error in DB");
      }
});

app.get('/', (req, res) => {
      res.send("Welcome to the school project!");
});

app.listen(port, () => {
      console.log(`Server running on port ${port}`);
});


pool.on('error', (err) => {
      console.error('MySQL connection error:', err);
});
