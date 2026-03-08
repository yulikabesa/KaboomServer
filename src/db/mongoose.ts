import mongoose from "mongoose";

console.log('mongoose url is: ' + process.env.MONGODB_URL as string);
mongoose.connect(process.env.MONGODB_URL as string, {
    // useUnifiedTopology: true,
    // useNewUrlParser: true
    dbName: 'Kaboom-api'
});
