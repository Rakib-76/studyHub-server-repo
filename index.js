const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()
const app = express();
const jwt = require("jsonwebtoken")
require('dotenv').config();
const port = process.env.PORT || 3000;


app.use(cors());
app.use(express.json());





const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.mrsp38p.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {

    await client.connect();
    const db = client.db('studyHub');
    const usersCollection = db.collection('users');
    const sessionsCollection = db.collection("sessions");
    const materialsCollection = db.collection("materials")



    // midleware
    // Middleware: verify token
    const verifyJWT = (req, res, next) => {
      const authHeader = req.headers.authorization;
      if (!authHeader) return res.status(401).send({ message: 'Unauthorized' });

      const token = authHeader.split(' ')[1];
      jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) return res.status(403).send({ message: 'Forbidden' });
        req.decoded = decoded;
        next();
      });
    };

    // Middleware: check admin role
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const user = await usersCollection.findOne({ email });

      if (user?.role !== 'admin') {
        return res.status(403).send({ message: 'Access Denied: Admin Only' });
      }

      next();
    };




    app.post('/users', async (req, res) => {
      const email = req.body.email;
      const userExists = await usersCollection.findOne({ email })
      if (userExists) {
        // update last log in
        return res.status(200).send({ message: 'User already exists', inserted: false });
      }
      const user = req.body;
      const result = await usersCollection.insertOne(user);
      res.send(result);
    })

    app.post('/jwt', (req, res) => {
      const { email } = req.body;

      const token = jwt.sign({ email }, process.env.JWT_SECRET, {
        expiresIn: '1h'
      });

      res.send({ token });
    });

    // create session by tutor
    // POST /sessions
    app.post("/sessions", async (req, res) => {
      const sessionData = req.body;
      const result = await db.collection("sessions").insertOne(sessionData);
      res.send(result);
    });



    // Express.js route example
    app.post('/users/social', async (req, res) => {
      const user = req.body;
      const existingUser = await usersCollection.findOne({ email: user.email });

      if (!existingUser) {
        const result = await usersCollection.insertOne(user);
        return res.send({ inserted: true, insertedId: result.insertedId });
      } else {
        return res.send({ inserted: false, message: "User already exists" });
      }
    });


    // study session get

    app.get("/sessions", async (req, res) => {
      const result = await sessionsCollection.find().toArray();
      res.send(result);
    });

    // session details page 
    app.get("/sessions/:id", async (req, res) => {
      const { id } = req.params;
      const session = await sessionsCollection.findOne({ _id: new ObjectId(id) });
      res.send(session);
    });

    // to get tutor list
    app.get("/users", async (req, res) => {
      const roleFilter = req.query.tutor ? "tutor" : null;

      let query = {};
      if (roleFilter) query = { role: roleFilter };

      const users = await usersCollection.find(query).toArray();
      res.send(users);
    });

    // admin view all users 
    app.get("/users", async (req, res) => {
      const search = req.query.search || "";
      const query = {
        $or: [
          { name: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } }
        ]
      };
      const result = await usersCollection.find(query).toArray();
      res.send(result);
    });

    // admin upadate user role
    app.patch("/users/role/:id", async (req, res) => {
      const { id } = req.params;
      const { role } = req.body;

      const result = await usersCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { role } }
      );

      res.send(result);
    });

    // Get all study sessions
    app.get('/admin/sessions', verifyJWT, verifyAdmin, async (req, res) => {
      const sessions = await sessionsCollection.find().toArray();
      res.send(sessions);
    });

    // Approve session
    app.patch('/admin/sessions/approve/:id', async (req, res) => {
      const id = req.params.id;
      const { fee } = req.body;
      const result = await sessionsCollection.updateOne(
        { _id: new ObjectId(id) },
        {
          $set: {
            status: "approved",
            fee: Number(fee)
          }
        }
      );
      res.send(result);
    });

    // Reject session
    // Just update status to "rejected (only admin)"
    app.patch('/admin/sessions/reject/:id', async (req, res) => {
      const id = req.params.id;

      const result = await sessionsCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { status: "rejected" } }
      );

      res.send(result);
    });


    // Delete session (only approved)
    app.delete('/admin/sessions/:id', async (req, res) => {
      const id = req.params.id;
      const result = await sessionsCollection.deleteOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    // Update session (optional fields)
    app.patch('/admin/sessions/:id', async (req, res) => {
      const id = req.params.id;
      const updateFields = req.body;
      const result = await sessionsCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: updateFields }
      );
      res.send(result);
    });

    // Get all materials (Admin only)
    app.get("/admin/materials", verifyJWT, verifyAdmin, async (req, res) => {
      const materials = await db.collection("materials").find().toArray();
      res.send(materials);
    });

    // Delete material by ID(Admin only)
    app.delete("/admin/materials/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const result = await db.collection("materials").deleteOne({ _id: new ObjectId(id) });
      res.send(result);
    });


    // view approve and regected session by tutor
    app.get("/tutor/sessions", verifyJWT, async (req, res) => {
      const email = req.query.email;
      const sessions = await sessionsCollection
        .find({ tutorEmail: email })
        .toArray();
      res.send(sessions);
    });

    // update and patch method by tutor
    app.patch('/sessions/request/:id', async (req, res) => {
      try {
        const id = req.params.id;

        if (!ObjectId.isValid(id)) {
          return res.status(400).send({ error: "Invalid session ID" });
        }

        const filter = { _id: new ObjectId(id) };

        // Find session first (optional, if you want to check status)
        const session = await sessionsCollection.findOne(filter);
        if (!session) {
          return res.status(404).send({ error: "Session not found" });
        }
        if (session.status !== "rejected") {
          return res.status(400).send({ error: "Session is not rejected, can't request approval" });
        }

        // Update status
        const update = { $set: { status: "pending" } };
        const result = await sessionsCollection.updateOne(filter, update);

        res.send({ message: "Approval request sent", modifiedCount: result.modifiedCount });
      } catch (error) {
        console.error("Error updating session status:", error);
        res.status(500).send({ error: "Internal Server Error" });
      }
    });

    // this is tutor create a session materials
    app.post('/tutor/materials', verifyJWT, async (req, res) => {
      try {
        const { title, sessionId, tutorEmail, imageURL, resourceLink } = req.body;
        if (!title || !sessionId || !tutorEmail) {
          return res.status(400).send({ error: 'Missing required fields' });
        }

        const newMaterial = {
          title,
          sessionId,
          tutorEmail,
          imageURL: imageURL || '',
          resourceLink: resourceLink || '',
          createdAt: new Date(),
        };

        const result = await materialsCollection.insertOne(newMaterial);
        res.send({ success: true, insertedId: result.insertedId });
      } catch (error) {
        console.error(error);
        res.status(500).send({ error: 'Server error while uploading material' });
      }
    });

    // TO GET APPROVE SESSION INTO TUTOR 
    app.post('/tutor/materials', verifyJWT, async (req, res) => {
      try {
        const { title, sessionId, tutorEmail, imageURL, resourceLink } = req.body;
        if (!title || !sessionId || !tutorEmail) {
          return res.status(400).send({ error: 'Missing required fields' });
        }

        const newMaterial = {
          title,
          sessionId,
          tutorEmail,
          imageURL: imageURL || '',
          resourceLink: resourceLink || '',
          createdAt: new Date(),
        };

        const result = await materialsCollection.insertOne(newMaterial);
        res.send({ success: true, insertedId: result.insertedId });
      } catch (error) {
        console.error(error);
        res.status(500).send({ error: 'Server error while uploading material' });
      }
    });

    // Approve session get by  tutor 

    app.get('/tutor/sessions/approved', verifyJWT, async (req, res) => {
      const email = req.query.email;

      // ✅ check if token decoded email and query email match
      if (req.decoded?.email !== email) {
        return res.status(403).send({ error: 'Forbidden access' });
      }

      const sessions = await sessionsCollection
        .find({ tutorEmail: email, status: "approved" })
        .toArray();

      res.send(sessions);
    });

    // Get all materials uploaded by a tutor
    app.get('/tutor/materials', verifyJWT, async (req, res) => {
      const email = req.query.email;
      if (req.decoded?.email !== email) {
        return res.status(403).send({ error: 'Forbidden access' });
      }

      const materials = await materialsCollection.find({ tutorEmail: email }).toArray();
      res.send(materials);
    });

    // Update a material
    app.patch('/tutor/materials/:id', verifyJWT, async (req, res) => {
      const id = req.params.id;
      const { title, resourceLink } = req.body;
      const result = await materialsCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { title, resourceLink } }
      );
      res.send(result);
    });








    app.get('/users/:email', async (req, res) => {
      const email = req.params.email;
      const user = await usersCollection.findOne({ email: email });
      if (!user) return res.status(404).send({ message: 'User not found' });
      res.send({ role: user.role });
    });



    app.get('/admin/dashboard', verifyJWT, verifyAdmin, (req, res) => {
      res.send({ message: 'Welcome Admin' });
    });




    await client.db('admin').command({ ping: 1 });
    console.log("Pingged your deployment . You successfully connected to the mongodb");


  } finally {

  }
}
run().catch(console.dir);



app.get('/', (req, res) => {
  res.send('StudyHub server is ready')
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})


// done kore dilam