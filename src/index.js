const express = require("express");
const cors = require("cors");
require("dotenv").config();

const userRoutes = require("./routes/userRoutes");
const rideRoutes = require("./routes/rideRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const driverRoutes = require("./routes/driverRoutes");
const razorpayRoutes = require("./routes/razorpayRoutes");
const ratingsRoutes = require("./routes/ratingsRoutes");
const supabase = require("./lib/supabaseAdmin");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(
  cors({
    origin: process.env.CLIENT_URL,
  })
);
app.use(express.json());
// Health check — keep Render + Supabase alive
app.get('/api/health', async (req, res) => {
  try {
    await supabase.from('test').select('message').limit(1).single();
    res.status(200).json({ alive: true, db: 'connected' });
  } catch (err) {
    res.status(200).json({ alive: true, db: 'error' });
  }
});
// Routes
app.use("/api/users", userRoutes);
app.use("/api/rides", rideRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/driver", driverRoutes);  
app.use("/api/razorpay", razorpayRoutes);
app.use("/api/ratings", ratingsRoutes);

// Health check
app.get("/", (req, res) => {
  res.json({ message: "🚖 Cab Booking API is running!" });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});