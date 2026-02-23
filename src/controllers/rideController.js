const supabase = require("../lib/supabaseAdmin");

// Fare rates per km by ride type
const FARE_RATES = {
  standard: { base: 2.0, perKm: 1.5, perMin: 0.25 },
  premium:  { base: 5.0, perKm: 2.5, perMin: 0.40 },
  xl:       { base: 3.5, perKm: 2.0, perMin: 0.30 },
};

// Helper to calculate fare
const calculateFare = (distance_km, duration_mins, ride_type) => {
  const rate = FARE_RATES[ride_type] || FARE_RATES.standard;
  const fare = rate.base + (distance_km * rate.perKm) + (duration_mins * rate.perMin);
  return parseFloat(fare.toFixed(2));
};

// POST /api/rides/estimate — Fare estimate (no DB write)
const estimateFare = async (req, res) => {
  const { distance_km, duration_mins } = req.body;

  if (!distance_km || !duration_mins) {
    return res.status(400).json({ error: "distance_km and duration_mins are required" });
  }

  const estimates = {
    standard: calculateFare(distance_km, duration_mins, "standard"),
    premium:  calculateFare(distance_km, duration_mins, "premium"),
    xl:       calculateFare(distance_km, duration_mins, "xl"),
  };

  res.json({ estimates, distance_km, duration_mins });
};

// POST /api/rides — Create a ride request
const createRide = async (req, res) => {
  const {
    pickup_address, dropoff_address,
    pickup_lat,     pickup_lng,
    dropoff_lat,    dropoff_lng,
    ride_type,      distance_km,
    duration_mins,
  } = req.body;

  if (!pickup_address || !dropoff_address) {
    return res.status(400).json({ error: "Pickup and dropoff are required" });
  }

  const fare = calculateFare(
    distance_km   || 5,
    duration_mins || 10,
    ride_type     || "standard"
  );

  const { data, error } = await supabase
    .from("rides")
    .insert({
      rider_id: req.user.id,
      pickup_address,  dropoff_address,
      pickup_lat,      pickup_lng,
      dropoff_lat,     dropoff_lng,
      fare,
      distance_km:   distance_km   || 5,
      duration_mins: duration_mins || 10,
      ride_type:     ride_type     || "standard",
      status: "requested",
    })
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json({ message: "Ride requested!", ride: data });
};

// GET /api/rides — All rides for current user
const getRides = async (req, res) => {
  const { data, error } = await supabase
    .from("rides")
    .select("*")
    .or(`rider_id.eq.${req.user.id},driver_id.eq.${req.user.id}`)
    .order("created_at", { ascending: false });

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
};

// GET /api/rides/available — All pending rides for drivers
const getAvailableRides = async (req, res) => {
  const { data, error } = await supabase
    .from("rides")
    .select("*")
    .eq("status", "requested")
    .order("created_at", { ascending: true });

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
};

// GET /api/rides/:id — Single ride
const getRideById = async (req, res) => {
  const { data, error } = await supabase
    .from("rides")
    .select("*")
    .eq("id", req.params.id)
    .single();

  if (error) return res.status(404).json({ error: "Ride not found" });
  res.json(data);
};

// PATCH /api/rides/:id/status — Update ride status
const updateRideStatus = async (req, res) => {
  const { status } = req.body;
  const validStatuses = ["accepted", "in_progress", "completed", "cancelled"];

  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }

  const updateData = { status };
  if (status === "accepted") updateData.driver_id = req.user.id;

  const { data, error } = await supabase
    .from("rides")
    .update(updateData)
    .eq("id", req.params.id)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json({ message: `Ride ${status}`, ride: data });
};

module.exports = {
  createRide, getRides, getRideById,
  updateRideStatus, getAvailableRides,
  estimateFare,
};