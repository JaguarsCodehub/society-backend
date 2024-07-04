// server.js
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const sql = require('mssql');

const app = express();
app.use(bodyParser.json());
app.use(cors())

const dbConfig = {
    user: 'vijay_DemoSocietyUser',
    password: 'Z02g?ub6',
    server: '38.242.197.161', // IP address of the SQL server
    database: 'Vijay_DemoSociety',
    options: {
        encrypt: false, // Use this if you're on Windows Azure
        trustServerCertificate: true, // Change to true for local dev / self-signed certs
    },
};



sql.connect(dbConfig, (err) => {
    if (err) {
        console.log('Error connecting to the database:', err);
    } else {
        console.log('Connected to the database');
    }
});

app.get('/api/data', async (req, res) => {
    try {
        const request = new sql.Request();
        const result = await request.query('SELECT [ID],[Code],[Name],[UserName],[Mobile],[Email],[Password],[Role],[Active],[StoreCount],[IsActive],[IsDeleted],[Tag1],[Tag2],[Tag3],[Tag4],[Tag5],[CreateDate],[ModifyDate],[ActiveDate],[UpdateDate],[UserID],[SocietyID],[Prefix] FROM [vijay_DemoSociety].[dbo].[UserMaster]'); // Replace YourTable with your actual table name
        res.json(result.recordset);
    } catch (err) {
        console.error('SQL error', err);
        res.status(500).send('Server error');
    }
});
// app.post('/login', async (req, res) => {
//     const { userId, password, year } = req.body;

//     try {
//         const request = new sql.Request();
//         request.input('userId', sql.VarChar, userId);
//         request.input('password', sql.VarChar, password);
//         request.input('year', sql.Int, year);

//         const query = `SELECT [ID], [UserName], [Role], [Active], [SocietyID], [PREFIX] 
//                      FROM [vijay_DemoSociety].[dbo].[UserMaster] 
//                      WHERE [UserName] = @userId AND [Password] = @password`;

//         const result = await request.query(query);

//         if (result.recordset.length > 0) {
//             res.status(200).json({ msg: 'Login successful', data: result.recordset[0] });
//         } else {
//             res.status(401).json({ msg: 'Invalid credentials' });
//         }
//     } catch (error) {
//         console.error('SQL error', error);
//         res.status(500).json({ msg: 'Server error' });
//     }
// });

app.post('/login', async (req, res) => {
    const { userId, password, year } = req.body;

    try {
        const request = new sql.Request();
        request.input('userId', sql.VarChar, userId);
        request.input('password', sql.VarChar, password);
        request.input('year', sql.Int, year);

        const query = `
            SELECT u.[ID], u.[Name], u.[UserName], u.[Role], u.[Active], u.[Prefix], isnull(s.SocietyID, '') as SocietyID
            FROM [vijay_DemoSociety].[dbo].[UserMaster] u
            LEFT JOIN societyregmaster s ON s.UserID = u.ID or s.UserID = u.UserID
            WHERE u.UserName = @userId AND u.Password = @password AND u.IsActive = 1;
        `;

        const result = await request.query(query);
        console.log(result)

        if (result.recordset.length > 0) {
            const userData = result.recordset[0];
            console.log(userData)
            res.status(200).json({
                msg: 'Login successful',
                data: {
                    Name: userData.Name,
                    SocietyID: userData.SocietyID,
                    UserID: userData.ID,
                },
            });
        } else {
            res.status(401).json({ msg: 'Invalid credentials' });
        }
    } catch (error) {
        console.error('SQL error', error);
        res.status(500).json({ msg: 'Server error' });
    }
});

app.get("/flats", async (req, res) => {
    try {
        const request = new sql.Request();
        // const query = `SELECT CONCAT(w.WingName,f.FlatNumber) AS WingFlat,w.WingCode AS WingFlatCode from FlatMaster f inner join WingMaster w on f.BuildingName=w.WingCode and f.UserID=w.UserID and f.SocietyID=w.SocietyID `;
        const result = await request.query("SELECT CONCAT(w.WingName,f.FlatNumber) AS WingFlat,w.WingCode AS WingFlatCode from FlatMaster f inner join WingMaster w on f.BuildingName=w.WingCode and f.UserID=w.UserID and f.SocietyID=w.SocietyID")
        res.json(result.recordset);
    } catch (error) {
        console.error('SQL FLAT error', error);
        res.status(500).send('Server FLAT error');
    }
})
app.post("/visitors", async (req, res) => {
    const { name, mobileNumber, date, image, flat } = req.body;

    try {

        const request = new sql.Request()

        // Parameter binding to prevent SQL injection
        request.input('name', sql.VarChar, name);
        request.input('mobileNumber', sql.VarChar, mobileNumber);
        request.input('date', sql.DateTime, new Date(date)); // Ensure date is in correct format
        request.input('image', sql.VarChar, image); // Assuming image is a URL or base64 string
        request.input('flat', sql.Int, flat); // Use sql.Int for integer types

        // SQL Insert Query
        const query = `
            INSERT INTO [dbo].[VisitorMaster] 
            ([Name], [MobileNumber], [Date], [Photo], [Flat]) 
            VALUES 
            (@name, @mobileNumber, @date, @image, @flat);
        `;

        // Execute the query
        const result = await request.query(query);
        res.status(200).json({ msg: 'Data was added successfully', data: result.recordset });
        // console.log("success", result)
    } catch (error) {
        console.error("SQL VISITORS POST ERROR", error);
        res.status(500).send('Server error while adding visitor data');
    }
});

app.listen(3000, () => {
    console.log('Server is running on port 3000');
});


// const result = await request.query('INSERT INTO [dbo].[VisitorMaster] ([Name], [MobileNumber], [Date], [Photo], [Flat]) VALUES (@name, @mobileNumber, @date, @image, @flat)');
