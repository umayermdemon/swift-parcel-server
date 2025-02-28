const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const app = express();
require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const port = process.env.PORT || 5000;

//middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.2fsgp3y.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    // Send a ping to confirm a successful connection

    const userCollection = client.db("swiftParcelDB").collection("users");
    const parcelCollection = client.db("swiftParcelDB").collection("parcels");
    const reviewCollection = client.db("swiftParcelDB").collection("reviews");

    //jwt related api
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_SECRET_TOKEN, {
        expiresIn: "1hr",
      });
      res.send({ token });
    });

    // middlewares

    // verify token
    const verifyToken = (req, res, next) => {
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "Unauthorized Access" });
      }
      const token = req.headers.authorization.split(" ")[1];

      jwt.verify(token, process.env.ACCESS_SECRET_TOKEN, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: "Unauthorized Access" });
        }
        req.decoded = decoded;
        next();
      });
    };

    // verify admin
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const isAdmin = user?.role === "Admin";
      if (!isAdmin) {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };
    //user related Api
    app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });
    app.get("/users/registeredUser", async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    app.get("/countUsers", async (req, res) => {
      const totalUsers = await userCollection.countDocuments({
        role: "User",
      });
      res.send({ totalUsers });
    });

    app.get("/users/:role", verifyToken, verifyAdmin, async (req, res) => {
      const page = parseInt(req.query.page);
      const size = parseInt(req.query.size);
      const role = req.params.role;
      const query = { role: role };
      const result = await userCollection
        .find(query)
        .skip(page * size)
        .limit(size)
        .toArray();
      res.send(result);
    });
    app.get("/users/deliverymanRole/:role", async (req, res) => {
      const role = req.params.role;
      const query = { role: role };
      const result = await userCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/users/user/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const filter = { email: email };
      const result = await userCollection.findOne(filter);
      res.send(result);
    });

    // admin api
    app.get("/users/admin/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "Forbidden Access" });
      }
      const query = { email: email };
      const user = await userCollection.findOne(query);
      let isAdmin = false;
      if (user) {
        isAdmin = user?.role === "Admin";
      }
      res.send({ isAdmin });
    });

    //delivery man api
    app.get("/users/deliveryMan/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "Forbidden Access" });
      }
      const query = { email: email };
      const user = await userCollection.findOne(query);
      let isDeliveryMan = false;
      if (user) {
        isDeliveryMan = user?.role === "Delivery Man";
      }
      res.send({ isDeliveryMan });
    });

    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      if (user.email === null) {
        return res.send({ message: "email invalid", email: null });
      }
      const isExistUser = await userCollection.findOne(query);
      if (isExistUser) {
        return res.send({ message: "user already exist", insertedId: null });
      }
      const result = userCollection.insertOne(user);
      res.send(result);
    });

    app.get("/users/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await userCollection.findOne(query);
      res.send(result);
    });

    app.put("/users/:email", async (req, res) => {
      const email = req.params.email;
      const phoneNumber = req.body.phoneNumber;
      const options = { upsert: true };
      const filter = { email: email };
      const user = await userCollection.findOne(filter);
      const updatedDoc = {
        $set: {
          phoneNumber: phoneNumber,
        },
      };
      const result = await userCollection.updateOne(user, updatedDoc, options);
      res.send(result);
    });

    app.patch(
      "/users/admin/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updatedDoc = {
          $set: {
            role: "Admin",
          },
        };
        const result = await userCollection.updateOne(filter, updatedDoc);
        res.send(result);
      }
    );
    app.patch(
      "/users/deliveryMan/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updatedDoc = {
          $set: {
            role: "Delivery Man",
          },
        };
        const result = await userCollection.updateOne(filter, updatedDoc);
        res.send(result);
      }
    );

    // parcel related api
    app.get("/parcels", verifyToken, verifyAdmin, async (req, res) => {
      const result = await parcelCollection.find().toArray();
      res.send(result);
    });
    app.get("/parcels/bookedParcel", async (req, res) => {
      const result = await parcelCollection.find().toArray();
      res.send(result);
    });
    app.get("/parcels/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = await parcelCollection.findOne(filter);
      res.send(result);
    });
    app.get("/parcels/delivered/:status", verifyToken, async (req, res) => {
      const status = req.params.status;
      const filter = { status: status };
      const result = await parcelCollection.find(filter).toArray();
      res.send(result);
    });
    app.get("/parcels/totalDelivered/:status", async (req, res) => {
      const status = req.params.status;
      const filter = { status: status };
      const result = await parcelCollection.find(filter).toArray();
      res.send(result);
    });
    app.get("/parcels/parcelDelivered/:id", async (req, res) => {
      const id = req.params.id;
      const query = {
        deliveryManId: id,
      };
      const result = await parcelCollection.find(query).toArray();
      res.send(result);
    });
    app.get("/parcels/bookedParcel/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await parcelCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/parcels/parcel/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await parcelCollection.find(query).toArray();
      res.send(result);
    });
    app.get("/parcels/deliveryMan/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { deliveryManId: id };
      const result = await parcelCollection.find(query).toArray();
      res.send(result);
    });

    app.post("/parcels", async (req, res) => {
      const parcel = req.body;
      const result = await parcelCollection.insertOne(parcel);
      res.send(result);
    });
    app.put("/parcels/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const data = req.body;
      const options = { upsert: true };
      const updatedDoc = {
        $set: {
          status: data.status,
          deliveryManId: data.deliveryManId,
          approximateDeliveryDate: data.approximateDeliveryDate,
        },
      };
      const result = await parcelCollection.updateOne(
        filter,
        updatedDoc,
        options
      );
      res.send(result);
    });
    app.patch("/parcels/update/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const data = req.body;
      console.log(data);
      const updatedDoc = {
        $set: {
          name: data.name,
          email: data.email,
          phoneNumber: data.phoneNumber,
          parcelDeliveryAddress: data.parcelDeliveryAddress,
          parcelType: data.parcelType,
          parcelWeight: data.parcelWeight,
          receiversName: data.receiversName,
          receiversPhoneNumber: data.receiversPhoneNumber,
          deliveryAddressLatitude: data.deliveryAddressLatitude,
          deliveryAddressLongitude: data.deliveryAddressLongitude,
          requestedDeliveryDate: data.requestedDeliveryDate,
          price: data.price,
          bookingDate: data.bookingDate,
        },
      };
      const result = await parcelCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });
    app.patch("/parcels/cancel/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const data = req.body;
      console.log(data);
      const updatedDoc = {
        $set: {
          status: data.status,
        },
      };
      const result = await parcelCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });
    app.patch("/parcels/deliver/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const data = req.body;
      const updatedDoc = {
        $set: {
          status: data.status,
        },
      };
      const result = await parcelCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    app.patch("/parcels/deliver/cancel/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const data = req.body;
      console.log(data);
      const updatedDoc = {
        $set: {
          status: data.status,
        },
      };
      const result = await parcelCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });
    app.delete("/parcels/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await parcelCollection.deleteOne(query);
      res.send(result);
    });

    //  review related api
    app.get("/reviews", async (req, res) => {
      const result = await reviewCollection.find().toArray();
      res.send(result);
    });
    app.get("/reviews/:id", async (req, res) => {
      const id = req.params.id;
      const query = { deliveryManId: id };
      const result = await reviewCollection.find(query).toArray();
      res.send(result);
    });
    app.post("/reviews", verifyToken, async (req, res) => {
      const review = req.body;
      const result = await reviewCollection.insertOne(review);
      res.send(result);
    });

    // payment intent
    app.post("/create-payment-intent", async (req, res) => {
      const { charge } = req.body;
      const amount = parseInt(charge * 100);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount || 0,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({ clientSecret: paymentIntent.client_secret });
    });
    app.patch("/parcels/payment/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const data = req.body;
      const updatedDoc = {
        $set: {
          payment_status: data.paymentStatus,
          trans_id: data.trans_id,
        },
      };
      const result = await parcelCollection.updateOne(
        filter,
        updatedDoc,
        options
      );
      res.send(result);
    });

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
