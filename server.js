const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const sql = require('mssql');
const decrypt = require('./dcrypt');
const encrypt = require('./encrypt');
// const cookieParser = require('cookie-parser')

const app = express();
// app.use(cookieParser())
app.use(bodyParser.json());
app.use(express.json());
app.use(cors())

const dbConfig = {
    user: 'vijay_DemoSocietyUser',
    password: 'Z02g?ub6',
    server: '38.242.197.161',
    database: 'Vijay_DemoSociety',
    options: {
        encrypt: false,
        trustServerCertificate: true,
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
app.post('/login', async (req, res) => {
    const { userId, password, year } = req.body;

    const decryptedPassword = encrypt(password);

    try {
        const request = new sql.Request();
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
    }
});


app.get("/flats", async (req, res) => {
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

        const request = new sql.Request();

        request.input('SocietyID', sql.VarChar, societyid);
        const result = await request.query("SELECT CONCAT(w.WingName,f.FlatNumber) AS WingFlat,w.WingCode, f.ID AS FlatID from FlatMaster f inner join WingMaster w on f.BuildingName=w.WingCode and f.UserID=w.UserID and f.SocietyID=w.SocietyID WHERE w.SocietyID = @SocietyID;");

        res.json(result.recordset);
    } catch (error) {
        console.error('SQL FLAT error', error);
        res.status(500).send('Server FLAT error');
    }
});


app.post("/visitors", async (req, res) => {
    const { name, mobileNumber, date, image, wingCode, flatID, ID, SocietyID, Year } = req.body;
    try {
        const request = new sql.Request();

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
    }
});

app.get("/visitors", async (req, res) => {
    try {
        const request = new sql.Request();
        const result = await request.query('SELECT v.[Name],v.[Date],v.Wing ,w.WingName,v.Flat,f.FlatNumber,concat(v.[Wing],v.[Flat]) As WingFlat,v.[MobileNumber],v.[Photo] FROM [dbo].[VisitorMaster] v left join WingMaster w on w.WingCode=v.Wing and w.SocietyID=v.SocietyID and w.Prefix=v.Prefix left join FlatMaster f on f.ID=v.Flat and f.SocietyID=v.SocietyID and f.Prefix=v.Prefix');
        res.json(result.recordsets[0]);
    } catch (err) {
        console.error('SQL error', err);
        res.status(500).send('Server error');
    }
})

app.listen(3000, () => {
    console.log('Server is running on port 3000');
});

app.post('/member/login', async (req, res) => {
    const { mobileNumber, password, year } = req.body;

    const decryptedPassword = encrypt(password)

    try {
        const request = new sql.Request();
        request.input('mobileNumber', sql.VarChar, mobileNumber);
        request.input('password', sql.VarChar, decryptedPassword);
        request.input('year', sql.Int, year);

        const query = `SELECT m.ID,m.CodePWD,m.MasterCode,m.RegNo,convert (varchar,m.[Date],103) as [Date],m.MemberName,a.Wing,a.Flat,m.Guardian,m.GuardianAddress,m.MonthlyIncome,m.Occupation, convert (varchar,m.DOB,103) as DOB,m.PresentAddress,m.EmailID,m.Password,m.PermanentAddress,m.City,m.PhoneNumber,m.MobileNumber,m.Prefix,s.Name as StateName, convert (varchar,m.DateofJoiningSociety,103) as DateofJoiningSociety,convert (varchar,m.DateofLeavingSociety,103) as DateofLeavingSociety, m.MemberPhoto,m.UserID,m.SocietyID,m.State,m.PinCode from MemberRegistrationMaster m Left Join StateMaster s on m.State=s.Code Left join AssignFlat a on m.CodePWD=a.Member and m.UserID=a.UserID and m.SocietyID=a.SocietyID and a.Isactive='1' WHERE m.isdeleted='0' and (m.MobileNumber=@mobileNumber) And ( m.Password=@password)`;
        const result = await request.query(query);

        if (result.recordset.length > 0) {
            res.status(200).json({ msg: '🟢Login successful', data: result.recordset[0] });
        } else {
            res.status(401).json({ msg: '🔴Invalid credentials' });
        }
    } catch (error) {
        console.error('SQL error', error);
        res.status(500).json({ msg: 'Server error' });
    }
});

app.get('/member/nomination', async (req, res) => {
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
        const request = new sql.Request();
        // Add parameters to the request
        request.input('SocietyID', sql.VarChar, societyid);
        request.input('UserID', sql.VarChar, userid);
        const result = await request.query("Select n.ID as ID, ISNULL(n.MName,'') as MName,CONVERT(varchar,n.Date,103) as Date,w.WingName as MWing,f.FlatNumber as MFlat,n.NomineeName as NomineeName, n.NomineeAddress as NomineeAddress,n.NomineeAge as NomineeAge,n.NomineeRelation as NomineeRelation,n.AllotedPercentage as AllotedPercentage, ISnull(m.MemberName,'') as MemberName from Nomination n left join FlatMaster f on f.ID=n.MFlat and f.UserID=n.UserID and f.SocietyID=n.SocietyID left join WingMaster w on w.WingCode=n.MWing and w.UserID=n.UserID and w.SocietyID=n.SocietyID left join MemberRegistrationMaster m on m.CodePWD=n.MCode and m.UserID=n.UserID and m.SocietyID=n.SocietyID WHERE n.Isactive='1' and n.Isdeleted='0' and n.UserID=@UserID and n.SocietyID=@SocietyID");
        res.json(result.recordset);
        console.log("Result: ", result.recordset)

    } catch (error) {
        console.error('SQL NOMINATION GET error', error);
        res.status(500).json({ msg: 'Server NOMINATION GET error' });
    }
})

app.post('/member/complaint', async (req, res) => {

    const { subject, description, image, date, status, MemberSocietyID, MemberID, UserID, MemberYear, MemberName, MemberWing, MemberFlat } = req.body
    try {

        const request = new sql.Request();

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
    }
})

app.get('/member/complaints', async (req, res) => {

    try {

        const memberId = req.headers['memberid'];

        // Log the headers to check if they are being received
        console.log("Headers received:", req.headers);

        // Validate if these headers exist
        if (!memberId) {
            console.log("Missing Headers");
            return res.status(400).send('Missing headers');
        }

        const request = new sql.Request();
        request.input('memberId', sql.VarChar, memberId);
        const query = `
            SELECT [ID],[ComplaintCode],[Code],[MemberID],[MemberName],[Date],[Wing],[Flat],[Subject],[Description],[Status],[File],[Prefix],[UserID],[SocietyID],[IsActive],[IsDeleted] FROM [vijay_DemoSociety].[dbo].[ComplaintMaster] WHERE MemberID = @memberId
        `;
        const result = await request.query(query);
        res.json(result.recordsets[0]);
    } catch (error) {
        console.error(" 🔴SQL COMPLAINT GET ERROR", error);
        res.status(500).send(' 🔴Server error while fetching complaints');
    }
})

app.post('/fm/login', async (req, res) => {
    const { userId, password, year } = req.body;

    const decryptedPassword = encrypt(password)


    try {
        const request = new sql.Request();
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
    }
})

app.get('/fm/allcomplaints', async (req, res) => {
    try {

        const societyID = req.headers['societyid'];

        // Log the headers to check if they are being received
        console.log("Headers received:", req.headers);

        // Validate if these headers exist
        if (!societyID) {
            console.log("Missing Headers");
            return res.status(400).send('Missing headers');
        }

        const request = new sql.Request();
        request.input('societyID', sql.VarChar, societyID);
        const result = await request.query('SELECT [ID],[ComplaintCode],[Code],[MemberID],[MemberName],[Date],[Wing],[Flat],[Subject],[Description],[Status],[File],[Prefix],[UserID],[SocietyID],[IsActive],[IsDeleted] FROM [vijay_DemoSociety].[dbo].[ComplaintMaster_Details] WHERE SocietyID = @societyID');
        res.json(result.recordsets[0]);
    } catch (err) {
        console.error('SQL error', err);
        res.status(500).send('Server error');
    }
})

app.post('/member/service-request', async (req, res) => {

    const { subject, description, date, image, serviceStatus, serviceName, serviceCode, MemberSocietyID, MemberID, UserID, MemberYear, MemberName, MemberWing, MemberFlat, MemberCode, MemberMobileNumber } = req.body

    try {
        const request = new sql.Request();

        // const codeIDQuery = "SELECT MAX(ID) AS MaxCode FROM [vijay_DemoSociety].[dbo].[Service]"
        // const codeIDResult = await request.query(codeIDQuery)
        const codeQuery = "SELECT MAX(CAST(Code AS INT)) AS MaxCode FROM [vijay_DemoSociety].[dbo].[Service]";
        const codeResult = await request.query(codeQuery);

        // let newCodeID = 0;
        // if (codeIDResult.recordset.length > 0 && codeIDResult.recordset[0].MaxCode !== null) {
        //     const maxCode = parseInt(codeIDResult.recordset[0].MaxCode, 10);
        //     newCodeID = (maxCode + 1)
        // }

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
    }
})


app.get('/member/service-requests', async (req, res) => {
    try {
        const request = new sql.Request();
        // request.input('societyID', sql.VarChar, societyID);
        const result = await request.query('SELECT [ID],[Code],[ServiceName],[Date],[Wing],[Flat],[Name],[Mobile],[MemberID],[MemberCode],[MemberName],[Subject],[Description],[ServiceCode],[Status],[Prefix],[UserID],[SocietyID],[IsActive],[IsDeleted],[file] FROM [vijay_DemoSociety].[dbo].[Service]');
        res.json(result.recordsets[0]);
    } catch (error) {
        console.error('SQL error', error);
        res.status(500).send('Server error');
    }
})

app.post('/admin/login', async (req, res) => {

    const { userId, password, year } = req.body;

    const decryptedPassword = encrypt(password);

    try {
        const request = new sql.Request();
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
    }
})

app.get('/member/parking-slot', async (req, res) => {
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
        const request = new sql.Request();
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
    }
})


app.get('/member/account-ledger', async (req, res) => {
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
        const request = new sql.Request();
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
    }
})


app.get('/admin/complaint-track', async (req, res) => {
    try {
        const request = new sql.Request();
        const query = `
            SELECT [ID],[ComplaintCode],[Code],[MemberID],[MemberName],[Date],[Wing],[Flat],[Subject],[Description],[Status],[File],[Prefix],[UserID],[SocietyID],[IsActive],[IsDeleted] FROM [vijay_DemoSociety].[dbo].[ComplaintMaster]
        `;
        const result = await request.query(query);
        res.json(result.recordsets[0]);
    } catch (error) {
        console.error(" 🔴SQL COMPLAINT GET ERROR", error);
        res.status(500).send(' 🔴Server error while fetching complaints');
    }
})

app.get('/admin/service-requests', async (req, res) => {
    try {
        const request = new sql.Request();
        // request.input('societyID', sql.VarChar, societyID);
        const result = await request.query('SELECT [ID],[Code],[ServiceName],[Date],[Wing],[Flat],[Name],[Mobile],[MemberID],[MemberCode],[MemberName],[Subject],[Description],[ServiceCode],[Status],[Prefix],[UserID],[SocietyID],[IsActive],[IsDeleted],[file] FROM [vijay_DemoSociety].[dbo].[Service]');
        res.json(result.recordsets[0]);
    } catch (error) {
        console.error('SQL error', error);
        res.status(500).send('Server error');
    }
})

app.get('/admin/parking-slot', async (req, res) => {
    try {


        // Initializing a new SQL Request
        const request = new sql.Request();
        // Add parameters to the request

        const result = await request.query("SELECT [ID],[Code],[Date],[Slot],[Member],[SlotCode],[Name],[UserId],[SocietyId],[Prefix],[IsActive],[IsDeleted] FROM [vijay_DemoSociety].[dbo].[AssignSlot]");
        res.json(result.recordset);
        console.log("Result: ", result.recordset)
    } catch (error) {
        console.error('SQL error', error);
        res.status(500).json({ msg: 'Server error' });
    }
})