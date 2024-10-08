require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const http = require('http')
const sql = require('mssql');
const decrypt = require('./dcrypt');
const encrypt = require('./encrypt');
const cookieParser = require('cookie-parser')

const app = express();
// app.use(cookieParser())
app.use(bodyParser.json());
app.use(express.json());
app.use(cors())

const dbConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_NAME,
    options: {
        encrypt: true,
        trustServerCertificate: true,
        enableArithAbort: true
    },
};

async function getDbConnection() {
    try {
        const pool = await sql.connect(dbConfig);
        return pool;
    } catch (err) {
        console.error('Error connecting to the database:', err);
        throw err;
    }
}

app.get('/', (req, res) => {
    res.send('Hello World');
});

app.get('/api/data', async (req, res) => {
    let connection;
    try {
        connection = await getDbConnection();
        const request = connection.request();
        const result = await request.query('SELECT [ID],[Code],[Name],[UserName],[Mobile],[Email],[Password],[Role],[Active],[StoreCount],[IsActive],[IsDeleted],[Tag1],[Tag2],[Tag3],[Tag4],[Tag5],[CreateDate],[ModifyDate],[ActiveDate],[UpdateDate],[UserID],[SocietyID],[Prefix] FROM [vijay_DemoSociety].[dbo].[UserMaster]'); // Replace YourTable with your actual table name
        res.json(result.recordset);
    } catch (err) {
        console.error('SQL error', err);
        res.status(500).send('Server error');
    } finally {
        if (connection) {
            await connection.close();
        }
    }
});
app.post('/login', async (req, res) => {
    const { userId, password, year, expoPushToken } = req.body;

    const decryptedPassword = encrypt(password);

    let connection;
    try {
        connection = await getDbConnection();
        const request = connection.request();
        request.input('userId', sql.VarChar, userId);
        request.input('password', sql.VarChar, decryptedPassword);
        request.input('year', sql.Int, year);
        request.input('expoPushToken', sql.VarChar, expoPushToken);

        const query = `
            UPDATE UserMaster
            SET expoPushtoken = @expoPushToken 
            WHERE UserName = @userId AND Password = @password;

            SELECT u.[ID], u.[Name], u.[UserName], u.[Role], u.[Active], u.[Prefix], isnull(s.SocietyID, '') as SocietyID
             FROM [vijay_DemoSociety].[dbo].[UserMaster] u
             LEFT JOIN societyregmaster s ON s.UserID = u.ID or s.UserID = u.UserID
             WHERE u.UserName = @userId AND u.Password = @password AND u.IsActive = 1;
        `;
        const result = await request.query(query);

        if (result.recordset.length > 0) {
            res.status(200).json({ msg: '🟢Login successful', data: result.recordset[0] });
        } else {
            res.status(401).json({ msg: '🔴Invalid credentials' });
        }
    } catch (error) {
        console.error('SQL error', error);
        res.status(500).json({ msg: 'Server error' });
    } finally {
        if (connection) {
            await connection.close();
        }
    }
});


app.get("/flats", async (req, res) => {
    let connection;
    try {
        const societyid = req.headers['societyid'];

        // Log the headers to check if they are being received
        console.log("Headers received:", req.headers);

        // Validate if these headers exist
        if (!societyid) {
            console.log("Missing Headers");
            return res.status(400).send('Missing headers');
        }

        console.log("Cookies: ", societyid);

        connection = await getDbConnection();
        const request = connection.request();

        request.input('SocietyID', sql.VarChar, societyid);
        const result = await request.query("SELECT CONCAT(w.WingName,f.FlatNumber) AS WingFlat,w.WingCode, f.ID AS FlatID from FlatMaster f inner join WingMaster w on f.BuildingName=w.WingCode and f.UserID=w.UserID and f.SocietyID=w.SocietyID WHERE w.SocietyID = @SocietyID;");

        res.json(result.recordset);
    } catch (error) {
        console.error('SQL FLAT error', error);
        res.status(500).send('Server FLAT error');
    } finally {
        if (connection) {
            await connection.close();
        }
    }
});


app.post("/visitors", async (req, res) => {
    const { name, mobileNumber, date, image, wingCode, flatID, ID, SocietyID, Year } = req.body;
    let connection;
    try {
        connection = await getDbConnection();
        const request = connection.request();

        // Query Database to get the Max Code from the Table
        const codeQuery = "SELECT MAX(CAST(Code AS INT)) AS MaxCode FROM [dbo].[VisitorMaster]";
        const codeResult = await request.query(codeQuery);

        // Extract the maximum Code and increment it by 1
        let newCode = "00001"; // Default value if no records are found
        if (codeResult.recordset.length > 0 && codeResult.recordset[0].MaxCode !== null) {
            const maxCode = parseInt(codeResult.recordset[0].MaxCode, 10);
            newCode = String(maxCode + 1).padStart(5, '0'); // Ensure the new Code is always 5 digits
            console.log(newCode)
        }
        console.log(Year)

        // Parameter binding to prevent SQL injection
        request.input('code', sql.VarChar, newCode);
        request.input('name', sql.VarChar, name);
        request.input('mobileNumber', sql.VarChar, mobileNumber);
        request.input('date', sql.DateTime, new Date(date));
        request.input('image', sql.VarChar, image);
        request.input('wingCode', sql.VarChar, wingCode);
        request.input('flatID', sql.Int, flatID);
        request.input('userID', sql.Int, ID);
        request.input('societyID', sql.Int, SocietyID);
        request.input('year', sql.VarChar, Year);
        const query = `
            INSERT INTO [dbo].[VisitorMaster] 
            ([Code], [Name], [MobileNumber], [Date], [Photo], [Flat], [Wing], [UserID], [SocietyID], [Prefix]) 
            VALUES 
            (@code, @name, @mobileNumber, @date, @image, @flatID, @wingCode, @userID, @societyID, @year);
        `;

        // Execute the query
        const result = await request.query(query);
        res.status(200).json({ msg: '🟢 Data was added to the Database successfully', data: result.recordset });

    } catch (error) {
        console.error(" 🔴SQL VISITORS POST ERROR", error);
        res.status(500).send(' 🔴Server error while adding visitor data');
    } finally {
        if (connection) {
            await connection.close();
        }
    }
});

app.get("/visitors", async (req, res) => {
    let pool;
    try {
        pool = await getDbConnection();
        const result = await pool.request().query('SELECT v.[Name],v.[Date],v.Wing ,w.WingName,v.Flat,f.FlatNumber,concat(v.[Wing],v.[Flat]) As WingFlat,v.[MobileNumber],v.[Photo] FROM [dbo].[VisitorMaster] v left join WingMaster w on w.WingCode=v.Wing and w.SocietyID=v.SocietyID and w.Prefix=v.Prefix left join FlatMaster f on f.ID=v.Flat and f.SocietyID=v.SocietyID and f.Prefix=v.Prefix');
        res.json(result.recordsets[0]);
    } catch (err) {
        console.error('SQL error', err);
        res.status(500).send('Server error');
    } finally {
        if (pool) {
            await pool.close();
        }
    }
});

app.listen(4000, () => {
    console.log('Server is running on port 3000');
});

app.post('/member/login', async (req, res) => {
    const { mobileNumber, password, year, expoPushToken } = req.body;

    const decryptedPassword = encrypt(password)

    let connection;
    try {
        connection = await getDbConnection();
        const request = connection.request();
        request.input('mobileNumber', sql.VarChar, mobileNumber);
        request.input('password', sql.VarChar, decryptedPassword);
        request.input('year', sql.Int, year);
        request.input('expoPushToken', sql.VarChar, expoPushToken);

        const query = `
            UPDATE MemberRegistrationMaster 
            SET pushtoken = @expoPushToken 
            WHERE MobileNumber = @mobileNumber AND Password = @password;

            SELECT m.ID,m.pushtoken,m.CodePWD,m.MasterCode,m.RegNo,convert (varchar,m.[Date],103) as [Date],m.MemberName,a.Wing,a.Flat,m.Guardian,m.GuardianAddress,m.MonthlyIncome,m.Occupation, convert (varchar,m.DOB,103) as DOB,m.PresentAddress,m.EmailID,m.Password,m.PermanentAddress,m.City,m.PhoneNumber,m.MobileNumber,m.Prefix,s.Name as StateName, convert (varchar,m.DateofJoiningSociety,103) as DateofJoiningSociety,convert (varchar,m.DateofLeavingSociety,103) as DateofLeavingSociety, m.MemberPhoto,m.UserID,m.SocietyID,m.State,m.PinCode from MemberRegistrationMaster m Left Join StateMaster s on m.State=s.Code Left join AssignFlat a on m.CodePWD=a.Member and m.UserID=a.UserID and m.SocietyID=a.SocietyID and a.Isactive='1' WHERE m.isdeleted='0' and (m.MobileNumber=@mobileNumber) And ( m.Password=@password)
        `;

        const result = await request.query(query);

        if (result.recordset.length > 0) {
            res.status(200).json({ msg: '🟢Login successful', data: result.recordset[0] });
        } else {
            res.status(401).json({ msg: '🔴Invalid credentials' });
        }
    } catch (error) {
        console.error('SQL error', error);
        res.status(500).json({ msg: 'Server error' });
    } finally {
        if (connection) {
            await connection.close();
        }
    }
});

app.get('/member/nomination', async (req, res) => {
    let connection;
    try {
        const societyid = req.headers['societyid'];
        const userid = req.headers['userid'];

        // Log the headers to check if they are being received
        console.log("Headers received:", req.headers);

        // Validate if these headers exist
        if (!societyid || !userid) {
            console.log("Missing Headers");
            return res.status(400).send('Missing headers');
        }

        console.log("Cookies-SocietyID: ", societyid);
        console.log("Cookies-UserID: ", userid);

        // Initializing a new SQL Request
        connection = await getDbConnection();
        const request = connection.request();
        // Add parameters to the request
        request.input('SocietyID', sql.VarChar, societyid);
        request.input('UserID', sql.VarChar, userid);
        const result = await request.query("Select n.ID as ID, ISNULL(n.MName,'') as MName,CONVERT(varchar,n.Date,103) as Date,w.WingName as MWing,f.FlatNumber as MFlat,n.NomineeName as NomineeName, n.NomineeAddress as NomineeAddress,n.NomineeAge as NomineeAge,n.NomineeRelation as NomineeRelation,n.AllotedPercentage as AllotedPercentage, ISnull(m.MemberName,'') as MemberName from Nomination n left join FlatMaster f on f.ID=n.MFlat and f.UserID=n.UserID and f.SocietyID=n.SocietyID left join WingMaster w on w.WingCode=n.MWing and w.UserID=n.UserID and w.SocietyID=n.SocietyID left join MemberRegistrationMaster m on m.CodePWD=n.MCode and m.UserID=n.UserID and m.SocietyID=n.SocietyID WHERE n.Isactive='1' and n.Isdeleted='0' and n.UserID=@UserID and n.SocietyID=@SocietyID");
        res.json(result.recordset);
        console.log("Result: ", result.recordset)

    } catch (error) {
        console.error('SQL NOMINATION GET error', error);
        res.status(500).json({ msg: 'Server NOMINATION GET error' });
    } finally {
        if (connection) {
            await connection.close();
        }
    }
})

app.post('/member/complaint', async (req, res) => {

    const { subject, description, image, date, status, MemberSocietyID, MemberID, UserID, MemberYear, MemberName, MemberWing, MemberFlat } = req.body
    let connection;
    try {

        connection = await getDbConnection();
        const request = connection.request();

        const codeQuery = "SELECT MAX(CAST(ComplaintCode AS INT)) AS MaxCode FROM [vijay_DemoSociety].[dbo].[ComplaintMaster]";
        const codeResult = await request.query(codeQuery);

        let newCode = "0001"; // Default value if no records are found
        if (codeResult.recordset.length > 0 && codeResult.recordset[0].MaxCode !== null) {
            const maxCode = parseInt(codeResult.recordset[0].MaxCode, 10);
            newCode = String(maxCode + 1).padStart(4, '0'); // Ensure the new Code is always 4 digits
        }

        request.input('complaintcode', sql.VarChar, newCode);
        request.input('memberId', sql.VarChar, MemberID);
        request.input('membername', sql.VarChar, MemberName);
        request.input('date', sql.DateTime, date);
        request.input('wing', sql.VarChar, MemberWing);
        request.input('flat', sql.VarChar, MemberFlat);
        request.input('subject', sql.VarChar, subject);
        request.input('description', sql.VarChar, description);
        request.input('status', sql.VarChar, status);
        request.input('file', sql.VarChar, image);
        request.input('prefix', sql.VarChar, MemberYear);
        request.input('userid', sql.Int, UserID);
        request.input('societyid', sql.Int, MemberSocietyID);

        const query = `
            INSERT INTO [dbo].[ComplaintMaster]([ComplaintCode],[MemberID],[MemberName],[Date],[Wing],[Flat],[Subject],[Description],[Status],[File],[Prefix],[UserID],[SocietyID])
                VALUES(@complaintcode,@memberid,@membername,@date,@wing,@flat,@subject,@description,@status,@file,@prefix,@userid,@societyid)
            INSERT INTO [dbo].[ComplaintMaster_Details]([ComplaintCode],[MemberID],[MemberName],[Date],[Wing],[Flat],[Subject],[Description],[Status],[File],[Prefix],[UserID],[SocietyID])
                VALUES(@complaintcode,@memberid,@membername,@date,@wing,@flat,@subject,@description,@status,@file,@prefix,@userid,@societyid)
        `;

        // Execute the query
        const result = await request.query(query);
        res.status(200).json({ msg: '🟢 Data was added to the Database successfully', data: result.recordset });

    } catch (error) {
        console.error(" 🔴SQL COMPLAINT POST ERROR", error);
        res.status(500).send(' 🔴Server error while posting complaints');
    } finally {
        if (connection) {
            await connection.close();
        }
    }
})

app.get('/member/complaints', async (req, res) => {

    let connection;
    try {

        const memberId = req.headers['memberid'];

        // Log the headers to check if they are being received
        console.log("Headers received:", req.headers);

        // Validate if these headers exist
        if (!memberId) {
            console.log("Missing Headers");
            return res.status(400).send('Missing headers');
        }

        connection = await getDbConnection();
        const request = connection.request();
        request.input('memberId', sql.VarChar, memberId);
        const query = `
            SELECT [ID],[ComplaintCode],[Code],[MemberID],[MemberName],[Date],[Wing],[Flat],[Subject],[Description],[Status],[File],[Prefix],[UserID],[SocietyID],[IsActive],[IsDeleted] FROM [vijay_DemoSociety].[dbo].[ComplaintMaster] WHERE MemberID = @memberId
        `;
        const result = await request.query(query);
        res.json(result.recordsets[0]);
    } catch (error) {
        console.error(" 🔴SQL COMPLAINT GET ERROR", error);
        res.status(500).send(' 🔴Server error while fetching complaints');
    } finally {
        if (connection) {
            await connection.close();
        }
    }
})

app.post('/fm/login', async (req, res) => {
    const { userId, password, year } = req.body;

    const decryptedPassword = encrypt(password);

    let connection;
    try {
        connection = await getDbConnection();
        const request = connection.request();
        request.input('userId', sql.VarChar, userId);
        request.input('password', sql.VarChar, decryptedPassword);
        request.input('year', sql.Int, year);

        const query = `SELECT u.[ID], u.[Name], u.[UserName], u.[Role], u.[Active], u.[Prefix], isnull(s.SocietyID, '') as SocietyID
             FROM [vijay_DemoSociety].[dbo].[UserMaster] u
             LEFT JOIN societyregmaster s ON s.UserID = u.ID or s.UserID = u.UserID
             WHERE u.UserName = @userId AND u.Password = @password AND u.IsActive = 1;`;
        const result = await request.query(query);

        if (result.recordset.length > 0) {
            res.status(200).json({ msg: '🟢Login successful', data: result.recordset[0] });
        } else {
            res.status(401).json({ msg: '🔴Invalid credentials' });
        }
    } catch (error) {
        console.error('SQL error', error);
        res.status(500).json({ msg: 'Server error' });
    } finally {
        if (connection) {
            await connection.close();
        }
    }
})

app.get('/fm/allcomplaints', async (req, res) => {
    let connection;
    try {

        const societyID = req.headers['societyid'];

        // Log the headers to check if they are being received
        console.log("Headers received:", req.headers);

        // Validate if these headers exist
        if (!societyID) {
            console.log("Missing Headers");
            return res.status(400).send('Missing headers');
        }

        connection = await getDbConnection();
        const request = connection.request();
        request.input('societyID', sql.VarChar, societyID);
        const result = await request.query('SELECT [ID],[ComplaintCode],[Code],[MemberID],[MemberName],[Date],[Wing],[Flat],[Subject],[Description],[Status],[File],[Prefix],[UserID],[SocietyID],[IsActive],[IsDeleted] FROM [vijay_DemoSociety].[dbo].[ComplaintMaster_Details] WHERE SocietyID = @societyID');
        res.json(result.recordsets[0]);
    } catch (err) {
        console.error('SQL error', err);
        res.status(500).send('Server error');
    } finally {
        if (connection) {
            await connection.close();
        }
    }
})

app.post('/member/service-request', async (req, res) => {

    const { subject, description, date, image, serviceStatus, serviceName, serviceCode, MemberSocietyID, MemberID, UserID, MemberYear, MemberName, MemberWing, MemberFlat, MemberCode, MemberMobileNumber } = req.body
    let connection;
    try {
        connection = await getDbConnection();
        const request = connection.request();

        // const codeIDQuery = "SELECT MAX(ID) AS MaxCode FROM [vijay_DemoSociety].[dbo].[Service]"
        // const codeIDResult = await request.query(codeIDQuery)
        const codeQuery = "SELECT MAX(CAST(Code AS INT)) AS MaxCode FROM [vijay_DemoSociety].[dbo].[Service]";
        const codeResult = await request.query(codeQuery);


        let newCode = "0001"; // Default value if no records are found
        if (codeResult.recordset.length > 0 && codeResult.recordset[0].MaxCode !== null) {
            const maxCode = parseInt(codeResult.recordset[0].MaxCode, 10);
            newCode = String(maxCode + 1).padStart(4, '0'); // Ensure the new Code is always 4 digits
        }


        // request.input('id', sql.Int, newCodeID);
        request.input('code', sql.VarChar, newCode);
        request.input('memberId', sql.Int, MemberID);
        request.input('membername', sql.VarChar, MemberName);
        request.input('membermobileNumber', sql.VarChar, MemberMobileNumber);
        request.input('date', sql.DateTime, date);
        request.input('wing', sql.VarChar, MemberWing);
        request.input('flat', sql.VarChar, MemberFlat);
        request.input('memberCode', sql.VarChar, MemberCode);
        request.input('subject', sql.VarChar, subject);
        request.input('description', sql.VarChar, description);
        request.input('status', sql.Int, serviceStatus);
        request.input('serviceName', sql.VarChar, serviceName);
        request.input('serviceCode', sql.VarChar, serviceCode);
        request.input('file', sql.VarChar, image);
        request.input('prefix', sql.VarChar, MemberYear);
        request.input('userid', sql.Int, UserID);
        request.input('societyid', sql.Int, MemberSocietyID);

        const query = `
            INSERT INTO [vijay_DemoSociety].[dbo].[Service] ([Code],[ServiceName],[Date],[Wing],[Flat],[Name],[Mobile],[MemberID],[MemberCode],[MemberName],[Subject],[Description],[ServiceCode],[Status],[Prefix],[UserID],[SocietyID],[file])
                VALUES(@code,@serviceName,@date,@wing,@flat,@membername,@membermobileNumber,@memberId,@memberCode,@membername,@subject,@description,@serviceCode,@status,@prefix,@userid,@societyid,@file)
        `;
        // Execute the query
        const result = await request.query(query);
        console.log("🟢 Data was added to the Database successfully")
        res.status(200).json({ msg: '🟢 Data was added to the Database successfully', data: result.recordset });

    } catch (error) {
        console.error(" 🔴SQL SERVICE POST ERROR", error);
        res.status(500).send(' 🔴Server error while posting service requests');
    } finally {
        if (connection) {
            await connection.close();
        }
    }
})


app.get('/member/service-requests', async (req, res) => {
    let connection;
    try {
        connection = await getDbConnection();
        const request = connection.request();
        // request.input('societyID', sql.VarChar, societyID);
        const result = await request.query('SELECT [ID],[Code],[ServiceName],[Date],[Wing],[Flat],[Name],[Mobile],[MemberID],[MemberCode],[MemberName],[Subject],[Description],[ServiceCode],[Status],[Prefix],[UserID],[SocietyID],[IsActive],[IsDeleted],[file] FROM [vijay_DemoSociety].[dbo].[Service]');
        res.json(result.recordsets[0]);
    } catch (error) {
        console.error('SQL error', error);
        res.status(500).send('Server error');
    } finally {
        if (connection) {
            await connection.close();
        }
    }
})

app.post('/admin/login', async (req, res) => {

    const { userId, password, year } = req.body;

    const decryptedPassword = encrypt(password);

    let connection;
    try {
        connection = await getDbConnection();
        const request = connection.request();
        request.input('userId', sql.VarChar, userId);
        request.input('password', sql.VarChar, decryptedPassword);
        request.input('year', sql.Int, year);

        const query = `SELECT u.[ID], u.[Name], u.[UserName], u.[Role], u.[Active], u.[Prefix], isnull(s.SocietyID, '') as SocietyID
             FROM [vijay_DemoSociety].[dbo].[UserMaster] u
             LEFT JOIN societyregmaster s ON s.UserID = u.ID or s.UserID = u.UserID
             WHERE u.UserName = @userId AND u.Password = @password AND u.IsActive = 1;`;
        const result = await request.query(query);

        if (result.recordset.length > 0) {
            res.status(200).json({ msg: '🟢Login successful', data: result.recordset[0] });
        } else {
            res.status(401).json({ msg: '🔴Invalid credentials' });
        }
    } catch (error) {
        console.error('SQL error', error);
        res.status(500).json({ msg: 'Server error' });
    } finally {
        if (connection) {
            await connection.close();
        }
    }
})

app.get('/member/parking-slot', async (req, res) => {
    let connection;
    try {
        const societyid = req.headers['societyid'];
        const userid = req.headers['userid'];
        const membercode = req.headers['membercode'];

        // Log the headers to check if they are being received
        console.log("Headers received:", req.headers);

        // Validate if these headers exist
        if (!societyid || !userid) {
            console.log("Missing Headers");
            return res.status(400).send('Missing headers');
        }

        // Initializing a new SQL Request
        connection = await getDbConnection();
        const request = connection.request();
        // Add parameters to the request
        request.input('societyid', sql.VarChar, societyid);
        request.input('userid', sql.VarChar, userid);
        request.input('membercode', sql.VarChar, membercode);
        const result = await request.query("SELECT [ID],[Code],[Date],[Slot],[Member],[SlotCode],[Name],[UserId],[SocietyId],[Prefix],[IsActive],[IsDeleted] FROM [vijay_DemoSociety].[dbo].[AssignSlot] WHERE UserId = @userid and SocietyId = @societyid and Member = @membercode");
        res.json(result.recordset);
        console.log("Result: ", result.recordset)
    } catch (error) {
        console.error('SQL error', error);
        res.status(500).json({ msg: 'Server error' });
    } finally {
        if (connection) {
            await connection.close();
        }
    }
})


app.get('/member/account-ledger', async (req, res) => {
    let connection;
    try {

        const societyid = req.headers['societyid'];
        const userid = req.headers['userid'];
        const partyCode = req.headers['membermastercode']

        // Log the headers to check if they are being received
        console.log("Headers received:", req.headers);

        // Validate if these headers exist
        if (!societyid || !userid || !partyCode) {
            console.log("Missing Headers");
            return res.status(400).send('Missing headers');
        }

        // Initializing a new SQL Request
        connection = await getDbConnection();
        const request = connection.request();
        // Add parameters to the request
        request.input('societyid', sql.VarChar, societyid);
        request.input('userid', sql.VarChar, userid);
        request.input('membermastercode', sql.VarChar, partyCode);

        const query = `SELECT l.[Type],l.Srl,l.MainType,l.SubType,l.Prefix,l.Code,l.AltCode,l.Wing,l.FlatId as Flat ,isnull(TransactionNumber,'') as TransactionNumber,isnull(l.ReferenceCode,'') as ReferenceCode,isnull(l.PaymentMode,'') as PaymentMode,isnull(l.Reference,'') as Reference, isnull(l.Narr,'') as Narration,isnull(l.Value,'') as Value,Convert(varchar,l.DocDate,101) as DocDate, 'CustomerName'=
				   Case 
				   When (l.FlatId=c.Flat and l.FlatId>0) then concat(w.WingName,' ',f.FlatNumber)
				   Else c.Name
				   End,
					cast(l.Debit as decimal(10,2)) as Debit,cast(l.Credit as Decimal(10,2)) as Credit,'0' as Balance,l.BillNumber,concat(w.WingName,' ',f.FlatNumber) Member FROM Ledger l
					left join Master c on l.AltCode=c.Code and l.UserID=c.UserID and l.SocietyID=c.CompanyID
					left join WingMaster w on l.Wing=w.WingCode and l.UserID=w.UserID and l.SocietyID=w.SocietyID and w.IsActive='1'
					left join FlatMaster f on l.FlatId=f.ID and l.UserID=f.UserID and l.SocietyID=f.SocietyID and f.IsActive='1'
					
					WHERE
					 (
								@userid			= 0
								OR l.UserID	= @userid
						)
						and
						(
							@membermastercode ='' or
							l.Code=@membermastercode
						)
						and
						(
							@societyid =0 or 
							l.SocietyID=@societyid
						)`;
        const result = await request.query(query);
        res.json(result.recordset);
        console.log("Result: ", result.recordset)

    } catch (error) {
        console.log("SQL LEDGER GET ERROR", error)
        res.status(500).json({ msg: "Server Error" })
    } finally {
        if (connection) {
            await connection.close();
        }
    }
})


app.get('/admin/complaint-track', async (req, res) => {
    let connection;
    try {
        connection = await getDbConnection();
        const request = connection.request();
        const query = `
            SELECT [ID],[ComplaintCode],[Code],[MemberID],[MemberName],[Date],[Wing],[Flat],[Subject],[Description],[Status],[File],[Prefix],[UserID],[SocietyID],[IsActive],[IsDeleted] FROM [vijay_DemoSociety].[dbo].[ComplaintMaster]
        `;
        const result = await request.query(query);
        res.json(result.recordsets[0]);
    } catch (error) {
        console.error(" 🔴SQL COMPLAINT GET ERROR", error);
        res.status(500).send(' 🔴Server error while fetching complaints');
    } finally {
        if (connection) {
            await connection.close();
        }
    }
})

app.get('/admin/service-requests', async (req, res) => {
    let connection;
    try {
        connection = await getDbConnection();
        const request = connection.request();
        // request.input('societyID', sql.VarChar, societyID);
        const result = await request.query('SELECT [ID],[Code],[ServiceName],[Date],[Wing],[Flat],[Name],[Mobile],[MemberID],[MemberCode],[MemberName],[Subject],[Description],[ServiceCode],[Status],[Prefix],[UserID],[SocietyID],[IsActive],[IsDeleted],[file] FROM [vijay_DemoSociety].[dbo].[Service]');
        res.json(result.recordsets[0]);
    } catch (error) {
        console.error('SQL error', error);
        res.status(500).send('Server error');
    } finally {
        if (connection) {
            await connection.close();
        }
    }
})

app.get('/admin/parking-slot', async (req, res) => {
    let connection;
    try {


        // Initializing a new SQL Request
        connection = await getDbConnection();
        const request = connection.request();
        // Add parameters to the request

        const result = await request.query("SELECT [ID],[Code],[Date],[Slot],[Member],[SlotCode],[Name],[UserId],[SocietyId],[Prefix],[IsActive],[IsDeleted] FROM [vijay_DemoSociety].[dbo].[AssignSlot]");
        res.json(result.recordset);
        console.log("Result: ", result.recordset)
    } catch (error) {
        console.error('SQL error', error);
        res.status(500).json({ msg: 'Server error' });
    } finally {
        if (connection) {
            await connection.close();
        }
    }
})

app.post('/notices', async (req, res) => {
    const { title, content, author } = req.body;

    let connection;
    try {
        connection = await getDbConnection();
        const request = connection.request();

        // Generate a unique code for the notice
        // const codeQuery = "SELECT MAX(CAST(Code AS INT)) AS MaxCode FROM [dbo].[NoticeMaster]";
        // const codeResult = await request.query(codeQuery);
        // let newCode = "00001";
        // if (codeResult.recordset.length > 0 && codeResult.recordset[0].MaxCode !== null) {
        //     const maxCode = parseInt(codeResult.recordset[0].MaxCode, 10);
        //     newCode = String(maxCode + 1).padStart(5, '0');
        // }

        // Parameter binding to prevent SQL injection
        // request.input('code', sql.VarChar, newCode);
        request.input('title', sql.VarChar, title);
        request.input('content', sql.VarChar, content);
        request.input('author', sql.VarChar, author);
        request.input('date', sql.DateTime, new Date());

        const query = `
            INSERT INTO [dbo].[NoticeMaster] 
            ([Title], [Content], [Author], [Date], [IsActive], [IsDeleted]) 
            VALUES 
            (@title, @content, @author, @date, 1, 0);
        `;

        // Execute the query
        const result = await request.query(query);
        res.status(200).json({ msg: '🟢 Notice was added successfully' });

    } catch (error) {
        console.error(" 🔴SQL NOTICE POST ERROR", error);
        res.status(500).send(' 🔴Server error while adding notice');
    } finally {
        if (connection) {
            await connection.close();
        }
    }
});

app.get('/notices', async (req, res) => {
    let connection;
    try {
        connection = await getDbConnection();
        const request = connection.request();

        const query = `
            SELECT [ID], [Title], [Content], [Author], [Date]
            FROM [dbo].[NoticeMaster]
            WHERE [IsActive] = 1 AND [IsDeleted] = 0
            ORDER BY [Date] DESC
        `;

        const result = await request.query(query);
        res.status(200).json({ msg: '🟢 Notices fetched successfully', data: result.recordset });
    } catch (error) {
        console.error(" 🔴SQL NOTICE GET ERROR", error);
        res.status(500).send(' 🔴Server error while fetching notices');
    } finally {
        if (connection) {
            await connection.close();
        }
    }
});


// Create a new poll
app.post('/polls', async (req, res) => {
    let connection;
    try {
        const { question, options } = req.body;
        connection = await getDbConnection();
        const result = await connection.request()
            .input('question', sql.NVarChar, question)
            .input('options', sql.NVarChar, JSON.stringify(options))
            .input('votes', sql.NVarChar, JSON.stringify(new Array(options.length).fill(0)))
            .query('INSERT INTO Polls (question, options, votes) OUTPUT INSERTED.id VALUES (@question, @options, @votes)');

        res.json({ id: result.recordset[0].id });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    } finally {
        if (connection) {
            await connection.close();
        }
    }
});

// Get all polls
app.get('/polls', async (req, res) => {
    let connection;
    try {
        connection = await getDbConnection();
        const request = connection.request();
        const query = `SELECT * FROM Polls`;
        const result = await request.query(query);
        res.json(result.recordset.map(poll => ({
            ...poll,
            options: JSON.parse(poll.options),
            votes: JSON.parse(poll.votes)
        })));
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    } finally {
        if (connection) {
            await connection.close();
        }
    }
});

// Vote on a poll
app.post('/polls/:id/vote', async (req, res) => {
    let connection;
    try {
        const { id } = req.params;
        const { optionIndex } = req.body;

        connection = await getDbConnection();
        // First, get the current votes
        const currentPoll = await connection.request()
            .input('id', sql.Int, id)
            .query('SELECT votes FROM Polls WHERE id = @id');

        const votes = JSON.parse(currentPoll.recordset[0].votes);
        votes[optionIndex]++;

        // Update the votes
        const updateRequest = connection.request();
        await updateRequest
            .input('id', sql.Int, id)
            .input('votes', sql.NVarChar, JSON.stringify(votes))
            .query('UPDATE Polls SET votes = @votes WHERE id = @id');

        res.json({ message: 'Vote recorded successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    } finally {
        if (connection) {
            await connection.close();
        }
    }
});


app.post('/api/create-register', async (req, res) => {
    const { owners, jointMembers } = req.body;

    let connection;
    try {
        connection = await getDbConnection();
        const transaction = new sql.Transaction(connection);

        try {
            await transaction.begin();

            // Get the max code and increment it
            const maxCodeResult = await transaction.request()
                .query('SELECT MAX(CAST(Code AS INT)) AS MaxCode FROM JRegisters');

            let newCode = 1;
            if (maxCodeResult.recordset[0].MaxCode) {
                newCode = maxCodeResult.recordset[0].MaxCode + 1;
            }
            const codeString = newCode.toString().padStart(4, '0');

            // Convert owners and jointMembers arrays to JSON strings
            const ownersJson = JSON.stringify(owners);
            const jointMembersJson = JSON.stringify(jointMembers);

            // Insert JRegister entry
            const result = await transaction.request()
                .input('Code', sql.VarChar(10), codeString)
                .input('Owners', sql.NVarChar(sql.MAX), ownersJson)
                .input('JointMembers', sql.NVarChar(sql.MAX), jointMembersJson)
                .query('INSERT INTO JRegisters (Code, Owners, JointMembers) VALUES (@Code, @Owners, @JointMembers)');

            await transaction.commit();
            res.status(201).json({ message: 'J Register created successfully', code: codeString });
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    } catch (error) {
        console.error('Error creating J Register:', error);
        res.status(500).json({ message: 'Error creating J Register' });
    } finally {
        if (connection) {
            await connection.close();
        }
    }
});

app.get('/api/all-registers', async (req, res) => {
    let connection;
    try {
        connection = await getDbConnection();
        const result = await connection.request().query(`
            SELECT 
                ID AS RegisterID,
                Code AS RegisterCode,
                CreatedAt,
                Owners,
                JointMembers
            FROM 
                JRegisters
            ORDER BY 
                CreatedAt DESC;
        `);

        // Parse JSON strings to objects
        const formattedResult = result.recordset.map(record => ({
            ...record,
            Owners: JSON.parse(record.Owners),
            JointMembers: JSON.parse(record.JointMembers)
        }));

        res.json(formattedResult);
    } catch (error) {
        console.error('Error fetching all registers:', error);
        res.status(500).json({ message: 'Error fetching all registers' });
    } finally {
        if (connection) {
            await connection.close();
        }
    }
});

// ... existing code ...

app.get('/member/visitors', async (req, res) => {
    let connection;
    try {
        const wingCode = req.headers['wingcode'];
        const flatId = req.headers['flatid'];

        // Log the headers to check if they are being received
        console.log("Headers received:", req.headers);

        // Validate if these headers exist
        if (!wingCode || !flatId) {
            console.log("Missing Headers");
            return res.status(400).send('Missing headers: wingCode and flatId are required');
        }

        connection = await getDbConnection();
        const request = connection.request();
        request.input('wingCode', sql.VarChar, wingCode);
        request.input('flatId', sql.Int, flatId);

        const query = `
            SELECT [Name], [MobileNumber], [Date], [Photo]
            FROM [dbo].[VisitorMaster]
            WHERE Wing = @wingCode AND Flat = @flatId
            ORDER BY [Date] DESC
        `;

        const result = await request.query(query);

        if (result.recordset.length > 0) {
            res.status(200).json({
                msg: '🟢 Visitor data fetched successfully',
                data: result.recordset
            });
        } else {
            res.status(404).json({ msg: 'No visitors found for this flat' });
        }
    } catch (error) {
        console.error('SQL error', error);
        res.status(500).json({ msg: 'Server error while fetching visitor data' });
    } finally {
        if (connection) {
            await connection.close();
        }
    }
});

// ... rest of your code ...

app.post('/sendNotification', async (req, res) => {
    const { wingCode, flatID, message } = req.body;

    let connection;
    try {
        connection = await getDbConnection();
        const request = connection.request();
        request.input('wingCode', sql.VarChar, wingCode);
        request.input('flatID', sql.Int, flatID);

        const query = `
        SELECT m.pushtoken
        FROM MemberRegistrationMaster m
        JOIN AssignFlat a ON m.CodePWD = a.Member AND m.UserID = a.UserID AND m.SocietyID = a.SocietyID
        WHERE a.Wing = @wingCode AND a.Flat = @flatID AND a.Isactive = '1'
      `;

        const result = await request.query(query);

        if (result.recordset.length > 0 && result.recordset[0].pushtoken) {
            const expoPushToken = result.recordset[0].pushtoken;
            await sendPushNotification(expoPushToken, message, wingCode, flatID);
            res.status(200).json({ msg: 'Notification sent successfully' });
        } else {
            res.status(404).json({ msg: 'Member not found or push token not available' });
        }
    } catch (error) {
        console.error('Error sending notification:', error);
        res.status(500).json({ msg: 'Server error' });
    } finally {
        if (connection) {
            await connection.close();
        }
    }
});

// Modify this endpoint to handle member responses
app.post('/visitorResponse', async (req, res) => {
    const { response, wingCode, flatID } = req.body;

    if (!response || !wingCode || !flatID) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        // Log the response
        console.log(`Response: ${response}, WingCode: ${wingCode}, FlatID: ${flatID}`);

        // Update the visitor's status in your database
        // await updateVisitorStatus(response, wingCode, flatID);

        // Notify the security or reception about the decision
        await notifySecurityAboutVisitor(response, wingCode, flatID);

        // If you have a real-time system, you might want to emit an event
        // io.emit('visitorResponseUpdated', { visitorId, response, wingCode, flatID });

        res.status(200).json({ message: 'Response received and processed successfully' });
    } catch (error) {
        console.error('Error processing visitor response:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

async function updateVisitorStatus(response, wingCode, flatID) {
    // Implement the logic to update the visitor's status in your database
    // For example:
    const request = new sql.Request();
    await request.query`
        UPDATE VisitorTable
        SET Status = ${response}, WingCode = ${wingCode}, FlatID = ${flatID}
        WHERE VisitorID = ${visitorId}
    `;

    console.log("VisitorStatusUpdated:", response, wingCode, flatID)
}

async function notifySecurityAboutVisitor(response, wingCode, flatID) {
    let connection;
    try {
        connection = await getDbConnection();
        const request = connection.request();

        // Fetch the watchman's expoPushToken
        const query = `
            SELECT u.expoPushToken
            FROM UserMaster u
            WHERE u.UserName = 'watchman'
        `;

        request.input('wingCode', sql.VarChar, wingCode);
        request.input('flatID', sql.Int, flatID);

        const result = await request.query(query);

        if (result.recordset.length > 0 && result.recordset[0].expoPushToken) {
            const expoPushToken = result.recordset[0].expoPushToken;
            const message = `Visitor shoudl be ${response === 'Allowed' ? 'allowed' : 'denied'}.`;

            // Send the notification
            await sendPushNotification(expoPushToken, message, wingCode, flatID);
            console.log('Notification sent to watchman:', message);
        } else {
            console.log('Watchman not found or push token not available');
        }
    } catch (error) {
        console.error('Error notifying security about visitor:', error);
    } finally {
        if (connection) {
            await connection.close();
        }
    }
}

async function sendPushNotification(expoPushToken, message, wingCode, flatID) {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'Accept-encoding': 'gzip, deflate',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            to: expoPushToken,
            sound: 'default',
            title: 'Visitor Alert',
            body: message,
            data: { wingCode, flatID },
            categoryId: 'visitor_response',
            buttons: [
                { id: 'yes', title: 'Yes' },
                { id: 'no', title: 'No' }
            ],
        }),
    });

    const result = await response.json();
    console.log('Notification sent:', result);
}

async function sendPushNotificationToWatchman(expoPushToken, message, wingCode, flatID) {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'Accept-encoding': 'gzip, deflate',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            to: expoPushToken,
            sound: 'default',
            title: 'Visitor Alert',
            body: message,
            data: { wingCode, flatID },
        }),
    });

    const result = await response.json();
    console.log('Notification sent:', result);
}
// CREATE TABLE NoticeMaster (
//     ID INT IDENTITY(1,1) PRIMARY KEY,
//     Title NVARCHAR(255) NOT NULL,
//     Content NVARCHAR(MAX) NOT NULL,
//     Author NVARCHAR(100) NOT NULL,
//     Date DATETIME NOT NULL,
//     IsActive BIT NOT NULL DEFAULT 1,
//     IsDeleted BIT NOT NULL DEFAULT 0
// );

// CREATE TABLE Polls (
//     id INT IDENTITY(1,1) PRIMARY KEY,
//     question NVARCHAR(255) NOT NULL,
//     options NVARCHAR(MAX) NOT NULL,
//     votes NVARCHAR(MAX) NOT NULL,
//     created_at DATETIME DEFAULT GETDATE()
// );

module.exports = app;