const supabase = require("../lib/supabaseAdmin");

// INR fare rates — kept very low for testing
const FARE_RATES = {
  standard: { base: 20,  perKm: 8,  perMin: 1   },
  premium:  { base: 40,  perKm: 14, perMin: 2   },
  xl:       { base: 30,  perKm: 11, perMin: 1.5 },
};

const calculateFare = (distance_km, duration_mins, ride_type) => {
  const rate = FARE_RATES[ride_type] || FARE_RATES.standard;
  const fare = rate.base + (distance_km * rate.perKm) + (duration_mins * rate.perMin);
  return parseFloat(fare.toFixed(2));
};

// POST /api/rides/estimate
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

// POST /api/rides
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

// GET /api/rides
const getRides = async (req, res) => {
  const { data, error } = await supabase
    .from("rides")
    .select("*")
    .or(`rider_id.eq.${req.user.id},driver_id.eq.${req.user.id}`)
    .order("created_at", { ascending: false });
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
};

// GET /api/rides/available
const getAvailableRides = async (req, res) => {
  const { lat, lng, radius_km = 10 } = req.query;
  const { data: rides, error } = await supabase
    .from("rides")
    .select("*")
    .eq("status", "requested")
    .order("created_at", { ascending: true });
  if (error) return res.status(400).json({ error: error.message });

  if (lat && lng) {
    const dLat = parseFloat(lat);
    const dLng = parseFloat(lng);
    const getDistanceKm = (lat1, lng1, lat2, lng2) => {
      const R = 6371;
      const dLat = ((lat2 - lat1) * Math.PI) / 180;
      const dLng = ((lng2 - lng1) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };
    const nearby = rides
      .map((r) => ({
        ...r,
        distance_from_driver: r.pickup_lat && r.pickup_lng
          ? getDistanceKm(dLat, dLng, r.pickup_lat, r.pickup_lng)
          : 999,
      }))
      .filter((r) => r.distance_from_driver <= parseFloat(radius_km))
      .sort((a, b) => a.distance_from_driver - b.distance_from_driver);
    return res.json(nearby);
  }
  res.json(rides);
};

// GET /api/rides/:id
const getRideById = async (req, res) => {
  const { data, error } = await supabase
    .from("rides")
    .select("*")
    .eq("id", req.params.id)
    .single();
  if (error) return res.status(404).json({ error: "Ride not found" });
  res.json(data);
};

// PATCH /api/rides/:id/status
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