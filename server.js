require('dotenv').config();
const express = require('express');
const admin = require('firebase-admin');
const cron = require('node-cron');
const twilio = require('twilio');

const app = express();
const PORT = process.env.PORT || 3000;

// 🔹 Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  }),
});

const db = admin.firestore();

// 🔹 Twilio Setup
const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH);

// 🔹 Watchdog Runs Every Minute
cron.schedule('* * * * *', async () => {
  console.log("Checking heartbeat...");

  const snapshot = await db.collection('heartbeat').get();
  const now = Date.now();

  snapshot.forEach(async (doc) => {
    const data = doc.data();

    if (!data.timestamp) return;

    const lastUpdate = data.timestamp.toDate().getTime();
    const diffMinutes = (now - lastUpdate) / 60000;

    if (diffMinutes > 2 && !data.alerted) {

      console.log("User inactive. Sending alert...");

      await client.messages.create({
        body: `DRSTI ALERT 🚨\nUser device inactive.\nLast Location:\nhttps://maps.google.com/?q=${data.latitude},${data.longitude}`,
        from: process.env.TWILIO_NUMBER,
        to: process.env.EMERGENCY_NUMBER,
      });

      await db.collection('heartbeat')
        .doc(doc.id)
        .update({ alerted: true });
    }
  });
});

app.get('/', (req, res) => {
  res.send("Drsti Backend Running");
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

