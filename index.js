const express = require('express');
const cors = require('cors');
require('dotenv').config();
const app = express();
const {
    MongoClient,
    ServerApiVersion,
    ObjectId
} = require('mongodb');
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY);
const jwt = require('jsonwebtoken');
const port = process.env.PORT || 5000;


// middleware
app.use(cors());
app.use(express.json());

const verifyJWT = (req, res, next) => {
    const authorization = req.headers.authorization;
    if (!authorization) {
        return res.status(401).send({
            error: true,
            message: 'unauthorized access'
        });
    }
    // bearer token
    const token = authorization.split(' ')[1];

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).send({
                error: true,
                message: 'unauthorized access'
            })
        }
        req.decoded = decoded;
        next();
    })
}


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.voqisr3.mongodb.net/?retryWrites=true&w=majority`;

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

        // collections
        const usersCollection = client.db('summerDB').collection('users');
        const classesCollection = client.db('summerDB').collection('classes');
        const cartsCollection = client.db('summerDB').collection('carts');



        // jwt
        app.post('/jwt', (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
                expiresIn: '1h'
            })

            res.send({
                token
            })
        })

        // verify admin
        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = {
                email: email
            }
            const user = await usersCollection.findOne(query);
            if (user?.role !== 'Admin') {
                return res.status(403).send({
                    error: true,
                    message: 'forbidden message'
                });
            }
            next();
        }



        // create users
        app.post('/users', async (req, res) => {
            const user = req.body;
            // console.log(user);

            const query = {
                email: user.email
            };
            const existingUser = await usersCollection.findOne(query);
            // console.log('existing user', existingUser)

            if (existingUser) {
                return res.send({
                    message: 'user already exists'
                })
            }

            const result = await usersCollection.insertOne(user);
            res.send(result);
        })




        // common functionality
        // classes api for admin & specific instructor
        app.get('/classes', async (req, res) => {

            let query = {};
            if (req.query.instructorEmail) {
                query = {
                    instructorEmail: req.query.instructorEmail
                }
            }

            const result = await classesCollection.find(query).toArray();
            res.send(result)
        })

        // admin panel functionality
        // admin check
        app.get('/users/admin/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;

            if (req.decoded.email !== email) {
                res.send({
                    admin: false
                })
            }

            const query = {
                email: email
            }
            const user = await usersCollection.findOne(query);
            const result = {
                admin: user?.role === 'Admin'
            }
            res.send(result);
        })

        // users api
        app.get('/users', verifyJWT, verifyAdmin, async (req, res) => {
            const result = await usersCollection.find().toArray();
            res.send(result);
        })

        // making admin
        app.patch('/users/admin/:id', async (req, res) => {
            const id = req.params.id;
            const filter = {
                _id: new ObjectId(id)
            };
            const updateDoc = {
                $set: {
                    role: 'Admin'
                },
            };
            const result = await usersCollection.updateOne(filter, updateDoc);
            res.send(result);
        })

        // classes approval
        app.patch('/classes/approve/:id', async (req, res) => {
            const id = req.params.id;
            const filter = {
                _id: new ObjectId(id)
            };
            const updateDoc = {
                $set: {
                    status: 'approved'
                },
            };
            const result = await classesCollection.updateOne(filter, updateDoc);
            res.send(result);
        })

        // classes denied
        app.patch('/classes/deny/:id', async (req, res) => {
            const id = req.params.id;
            const filter = {
                _id: new ObjectId(id)
            };
            const updateDoc = {
                $set: {
                    status: 'denied'
                },
            };
            const result = await classesCollection.updateOne(filter, updateDoc);
            res.send(result);
        })

        // classes feedback
        app.patch('/classes/feedback/:id', async (req, res) => {
            const id = req.params.id;
            const feedbackMessage = req.body.feedback;
            // console.log(id, feedbackMessage)
            const filter = {
                _id: new ObjectId(id)
            };
            const updateDoc = {
                $set: {
                    feedback: feedbackMessage
                },
            };
            const result = await classesCollection.updateOne(filter, updateDoc);
            res.send(result);
        })


        //  instructor panel functionality

        // instructor check
        app.get('/users/instructor/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;

            if (req.decoded.email !== email) {
                res.send({
                    instructor: false
                })
            }

            const query = {
                email: email
            }
            const user = await usersCollection.findOne(query);
            const result = {
                instructor: user?.role === 'Instructor'
            }
            res.send(result);
        })

        // making instructor
        app.patch('/users/instructor/:id', async (req, res) => {
            const id = req.params.id;
            const filter = {
                _id: new ObjectId(id)
            };
            const updateDoc = {
                $set: {
                    role: 'Instructor'
                },
            };
            const result = await usersCollection.updateOne(filter, updateDoc);
            res.send(result);
        })

        // instructors api
        app.get('/instructors', async (req, res) => {
            const query = {
                role: 'Instructor'
            }

            const result = await usersCollection.find(query).toArray();

            res.send(result);
        })

        // create classes
        app.post('/classes', async (req, res) => {
            const newClass = req.body;
            // console.log(newClass);

            const result = await classesCollection.insertOne(newClass);
            res.send(result);
        })


        // single class api by id
        app.get('/classes/:id', async (req, res) => {
            const id = req.params.id;
            const query = {
                _id: new ObjectId(id)
            };
            const result = await classesCollection.findOne(query);
            res.send(result);
        })

        // update class
        app.put('/updateClass/:id', async (req, res) => {
            const id = req.params.id;
            const filter = {
                _id: new ObjectId(id)
            };
            const updatedClass = req.body;
            const options = {
                upsert: true
            };
            const cls = {
                $set: {
                    className: updatedClass.className,
                    classImage: updatedClass.classImage,
                    seats: updatedClass.seats,
                    price: updatedClass.price,
                }
            };
            const result = await classesCollection.updateOne(filter, cls, options);
            res.send(result);
        })


        // delete class
        app.delete('/classes/:id', async (req, res) => {
            const id = req.params.id;
            const query = {
                _id: new ObjectId(id)
            };
            const result = await classesCollection.deleteOne(query);

            res.send(result);
        })



        //  student panel functionality
        // approved classes api
        app.get('/approvedClasses', async (req, res) => {
            const query = {
                status: 'approved'
            }

            const result = await classesCollection.find(query).toArray();

            res.send(result);
        })


        // popular classes
        app.get('/popularClasses', async (req, res) => {
            const result = await classesCollection.find().sort({
                seats: -1
            }).limit(6).toArray();
            res.send(result);
        });

        // cart collection create 
        app.post('/carts', async (req, res) => {
            const item = req.body;
            // console.log(item);
            const result = await cartsCollection.insertOne(item);
            res.send(result);
        })

        // carts api
        app.get('/carts', async (req, res) => {
            const result = await cartsCollection.find().toArray();
            res.send(result);
        })

        // student selected classes api from cart collection
        app.get('/selectedClasses', async (req, res) => {
            const studentEmail = req.query.studentEmail;
            const query = {
                email: studentEmail
            };
            const result = await cartsCollection.find(query).toArray();
            res.send(result);
        })

        // delete class from cart
        app.delete('/selectedClasses/:id', async (req, res) => {
            const id = req.params.id;
            const query = {
                _id: new ObjectId(id)
            };
            const result = await cartsCollection.deleteOne(query);
            res.send(result);
        })


        // create payment intent
        app.post('/create-payment-intent', async (req, res) => {
            const price = req.body;
            console.log(price)

            const amount = parseInt(price * 100);
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            });

            res.send({
                clientSecret: paymentIntent.client_secret
            })
        })


        // Send a ping to confirm a successful connection
        // await client.db("admin").command({
        //     ping: 1
        // });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);



app.get('/', (req, res) => {
    res.send('Summer Camp server is running')
});

app.listen(port, () => {
    console.log(`Summer Camp server running on port: ${port}`)
})