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
    const sessionsCollection = db.collection("sessions")



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
    app.delete('/admin/sessions/reject/:id', async (req, res) => {
      const id = req.params.id;
      const result = await sessionsCollection.deleteOne({ _id: new ObjectId(id) });
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


