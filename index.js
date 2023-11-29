const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
require('dotenv').config()
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
const port = process.env.PORT || 5000;


app.use(cors());
app.use(express.json());



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.dospc0a.mongodb.net/?retryWrites=true&w=majority`;

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
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();

        const usersCollection = client.db("cookingDB").collection("users");
        const mealsCollection = client.db("cookingDB").collection("meals");
        const aboutMeCollection = client.db("cookingDB").collection("aboutMe");
        const upcomingCollection = client.db("cookingDB").collection("upcoming");
        const reviewsCollection = client.db("cookingDB").collection("reviews");
        const membershipCollection = client.db("cookingDB").collection("membership");
        const mealRequestCollection = client.db("cookingDB").collection("mealRequest");


        // middleware
        const verifyToken = (req, res, next) => {
            // console.log('inside verify',req.headers.authorization);
            if (!req.headers.authorization) {
                return res.status(401).send({ message: 'Unauthorized access' })
            }
            const token = req.headers.authorization.split(' ')[1];
            jwt.verify(token, process.env.SECRET, (err, decoded) => {
                if (err) {
                    return res.status(401).send({ message: 'Unauthorized access' })
                }
                req.decoded = decoded;
                next();
            })
        }

        // verify admin after verify token
        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            const isAdmin = user?.role === 'Admin'
            if (!isAdmin) {
                return res.status(403).send({ message: 'Forbidden Access' });
            }
            next();
        }

        // jwt related apis
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.SECRET, { expiresIn: '1h' });
            res.send({ token })
        })


        // users related apis
        app.get('/users',  async (req, res) => {
            const result = await usersCollection.find().toArray();
            res.send(result);
        })
        app.get('/users/:email',  async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const result = await usersCollection.findOne(query);
            res.send(result);
        })
        app.post('/users', async (req, res) => {
            const user = req.body;

            const query = { email: user?.email };
            const existingUser = await usersCollection.findOne(query);
            if (existingUser) {
                return res.send({ message: 'User already exist', insertedId: null })
            }
            const result = await usersCollection.insertOne(user);
            res.send(result);
        })

        app.get('/users/admin/:email',verifyToken,  async (req, res) => {
            const email = req.params.email;
            // console.log(email, req.decoded)
            if (email !== req.decoded.email) {
                return res.status(403).send({ message: 'Forbidden access' })
            }
            const query = { email: email };
            console.log(query)
            const user = await usersCollection.findOne(query);
            console.log(user)
            let admin = false;
            if (user) {
                admin = user?.role === 'Admin';
            }
            res.send({ admin });
        })

        app.patch('/users/admin/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set: {
                    role: 'Admin'
                }
            }
            const result = await usersCollection.updateOne(filter, updatedDoc);
            res.send(result);
        })
        app.patch('/users/:email', async (req, res) => {
            const email = req.params.email;
            const filter = { email: email };
            const { info } = req.body;
            const updatedDoc = {
                $set: {
                    packageName: info.packageName,
                    badge: info?.image?.props?.src,
                }
            }
            // console.log(updatedDoc)
            const result = await usersCollection.updateOne(filter, updatedDoc);
            res.send(result);

        })



        // meals related apis
        app.get('/meals', async (req, res) => {
            const result = await mealsCollection.find().toArray();
            res.send(result)
        })
        app.get('/meals/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await mealsCollection.findOne(query);
            res.send(result);
        })
        app.post('/meals', async (req, res) => {
            const meal = req.body;
            const result = await mealsCollection.insertOne(meal);
            res.send(result);
        })
        // for review
        app.patch('/meals/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const info = req.body;
            if (info.check !== 'review') {
                return;
            }
            const updatedDoc = {
                $inc: {
                    reviews: info.reviewed,
                }
            }
            const result = await mealsCollection.updateOne(filter, updatedDoc);
            res.send(result);
        })
        // for like
        app.patch('/meals/like/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const info = req.body;

            const existingEmail = await mealsCollection.findOne(filter)
            const find = existingEmail.likes.includes(info.liked);
            if (find) {
                return res.send({ message: 'Already liked' })
            }

            const updatedDoc = {
                $addToSet: { likes: info.liked }
            }
            const result = await mealsCollection.updateOne(filter, updatedDoc);
            res.send(result);
        })
        app.delete('/meals/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await mealsCollection.deleteOne(query);
            res.send(result);
        })



        // review related apis
        app.get('/reviews', async (req, res) => {
            const result = await reviewsCollection.find().toArray();
            res.send(result);
        })
        app.get('/reviews/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const result = await reviewsCollection.find(query).toArray();
            res.send(result);
        })
        app.post('/reviews', async (req, res) => {
            const reviews = req.body;
            const result = await reviewsCollection.insertOne(reviews);
            res.send(result);
        })
        // app.patch('/reviews/:id', async(req,res)=>{
        //     const id = req.params.id;
        //     const filter = {_id: new ObjectId(id)};
        //     const info = req.body;
        //     const updatedDoc = {
        //         $set: {
        //             review: info
        //         }
        //     }
        // })
        app.delete('/reviews/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await reviewsCollection.deleteOne(query);
            res.send(result);
        })



        // membership related apis
        app.get('/packages', async (req, res) => {
            const result = await membershipCollection.find().toArray();
            res.send(result);
        })



        // upcoming meals related apis
        app.get('/upcoming', async (req, res) => {
            const result = await upcomingCollection.find().toArray();
            res.send(result);
        })
        app.post('/upcoming', async (req, res) => {
            const meals = req.body;
            const result = await upcomingCollection.insertOne(meals);
            res.send(result);
        })
        app.patch('/upcoming/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const info = req.body;

            const existingEmail = await upcomingCollection.findOne(filter)
            const find = existingEmail?.likes?.includes(info.liked);
            if (find) {
                return res.send({ message: 'Already liked' })
            }

            const updatedDoc = {
                $addToSet: { likes: info.liked }
            }
            const result = await upcomingCollection.updateOne(filter, updatedDoc);
            res.send(result);
        })


        // meal request related apis
        app.get('/mealRequest/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const result = await mealRequestCollection.find(query).toArray();
            res.send(result);
        })
        app.get('/mealRequest', async (req, res) => {
            const result = await mealRequestCollection.find().toArray();
            res.send(result);
        })
        app.post('/mealRequest', async (req, res) => {
            const meals = req.body;
            const result = await mealRequestCollection.insertOne(meals);
            res.send(result);
        })
        app.patch('/mealRequest/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const info = req.body;
            const updatedDoc = {
                $set: {
                    status: info.status
                }
            }
            const result = await mealRequestCollection.updateOne(filter, updatedDoc);
            res.send(result);
        })
        app.delete('/mealRequest/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await mealRequestCollection.deleteOne(query);
            res.send(result);
        })


        // about me related apis
        app.get('/about/:email', async(req,res)=>{
            const email = req.params.email;
            const query = {email: email};
            const result = await aboutMeCollection.findOne(query);
            res.send(result)
        })
        app.post('/about', async(req,res)=>{
            const info = req.body;
            const result = await aboutMeCollection.insertOne(info);
            res.send(result);
        })



        // payment related apis
        app.post('/create-payment-intent', async (req, res) => {
            const { price } = req.body;
            const amount = parseInt(price * 100);

            const paymentIntent = await stripe.paymentIntents.create({
                amount,
                currency: "usd",
                payment_method_types: ["card"]
            });
            res.send({
                clientSecret: paymentIntent.client_secret
            })
        })



        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });
        // console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);




app.get('/', (req, res) => {
    res.send('Cooking God is cooking');
})
app.listen(port, () => {
    console.log(`Cooking God is cooking on port: ${port}`);
})




