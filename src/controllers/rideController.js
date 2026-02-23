const supabase = require("../lib/supabaseAdmin");

// POST /api/rides — Create a new ride request
const createRide = async (req, res) => {
  const {
    pickup_address, dropoff_address,
    pickup_lat, pickup_lng,
    dropoff_lat, dropoff_lng,
    ride_type
  } = req.body;

  if (!pickup_address || !dropoff_address) {
    return res.status(400).json({ error: "Pickup and dropoff addresses are required" });
  }

  // Simple fare calculation (we'll improve with Maps API on Day 4)
  const distance_km = 5; // placeholder
  const fareMap = { standard: 2.5, premium: 4.0, xl: 3.5 };
  const ratePerKm = fareMap[ride_type] || 2.5;
  const fare = (distance_km * ratePerKm).toFixed(2);

  const { data, error } = await supabase
    .from("rides")
    .insert({
      rider_id: req.user.id,
      pickup_address, dropoff_address,
      pickup_lat, pickup_lng,
      dropoff_lat, dropoff_lng,
      fare,
      distance_km,
      ride_type: ride_type || "standard",
      status: "requested",
    })
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json({ message: "Ride requested!", ride: data });
};

// GET /api/rides — Get all rides for current user
const getRides = async (req, res) => {
  const { data, error } = await supabase
    .from("rides")
    .select("*")
    .or(`rider_id.eq.${req.user.id},driver_id.eq.${req.user.id}`)
    .order("created_at", { ascending: false });

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
};

// GET /api/rides/:id — Get a single ride
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

  // If driver is accepting, attach their ID
  if (status === "accepted") {
    updateData.driver_id = req.user.id;
  }

  const { data, error } = await supabase
    .from("rides")
    .update(updateData)
    .eq("id", req.params.id)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json({ message: `Ride ${status}`, ride: data });
};

// GET /api/rides/available — Drivers see all pending rides
const getAvailableRides = async (req, res) => {
  const { data, error } = await supabase
    .from("rides")
    .select("*")
    .eq("status", "requested")
    .order("created_at", { ascending: true });

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
};

module.exports = {
  createRide, getRides, getRideById,
  updateRideStatus, getAvailableRides
};