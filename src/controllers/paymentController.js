const supabase = require("../lib/supabaseAdmin");

// POST /api/payments — Create a payment record for a ride
const createPayment = async (req, res) => {
  const { ride_id, payment_method } = req.body;

  // Get the ride to fetch the fare
  const { data: ride, error: rideError } = await supabase
    .from("rides")
    .select("*")
    .eq("id", ride_id)
    .single();

  if (rideError || !ride) return res.status(404).json({ error: "Ride not found" });
  if (ride.status !== "completed") {
    return res.status(400).json({ error: "Ride must be completed before payment" });
  }

  const { data, error } = await supabase
    .from("payments")
    .insert({
      ride_id,
      rider_id: req.user.id,
      amount: ride.fare,
      payment_method: payment_method || "card",
      status: "pending", // Stripe will update this to 'completed' on Day 8
    })
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json({ message: "Payment initiated", payment: data });
};

// GET /api/payments — Get all payments for current user
const getPayments = async (req, res) => {
  const { data, error } = await supabase
    .from("payments")
    .select(`*, rides(pickup_address, dropoff_address, fare)`)
    .eq("rider_id", req.user.id)
    .order("created_at", { ascending: false });

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
};

// GET /api/payments/:id — Get a single payment
const getPaymentById = async (req, res) => {
  const { data, error } = await supabase
    .from("payments")
    .select(`*, rides(pickup_address, dropoff_address, fare)`)
    .eq("id", req.params.id)
    .single();

  if (error) return res.status(404).json({ error: "Payment not found" });
  res.json(data);
};

module.exports = { createPayment, getPayments, getPaymentById };