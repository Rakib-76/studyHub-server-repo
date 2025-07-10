const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()
const app = express();
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
    await client.db('admin').command({ping: 1});
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