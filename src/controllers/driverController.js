const supabase = require("../lib/supabaseAdmin");

// Haversine formula — calculates distance between 2 lat/lng points in km
const getDistanceKm = (lat1, lng1, lat2, lng2) => {
  const R    = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// PUT /api/driver/location — Update driver's current location & online status
const updateLocation = async (req, res) => {
  const { lat, lng, is_online } = req.body;

  if (!lat || !lng) {
    return res.status(400).json({ error: "lat and lng are required" });
  }

  const { data, error } = await supabase
    .from("driver_locations")
    .upsert({
      driver_id: req.user.id,
      lat,
      lng,
      is_online: is_online ?? true,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json({ message: "Location updated", location: data });
};

// GET /api/driver/status — Get driver's current online status
const getDriverStatus = async (req, res) => {
  const { data, error } = await supabase
    .from("driver_locations")
    .select("*")
    .eq("driver_id", req.user.id)
    .single();

  if (error || !data) {
    return res.json({ is_online: false, lat: null, lng: null });
  }
  res.json(data);
};

// GET /api/driver/available-rides — Rides near the driver
const getAvailableRides = async (req, res) => {
  const { lat, lng, radius_km = 10 } = req.query;

  // Get all requested rides
  const { data: rides, error } = await supabase
    .from("rides")
    .select("*")
    .eq("status", "requested")
    .order("created_at", { ascending: true });

  if (error) return res.status(400).json({ error: error.message });

  // If driver location provided, sort by distance
  if (lat && lng) {
    const driverLat = parseFloat(lat);
    const driverLng = parseFloat(lng);

    const nearbyRides = rides
      .map((ride) => ({
        ...ride,
        distance_from_driver: ride.pickup_lat && ride.pickup_lng
          ? getDistanceKm(driverLat, driverLng, ride.pickup_lat, ride.pickup_lng)
          : 999,
      }))
      .filter((ride) => ride.distance_from_driver <= parseFloat(radius_km))
      .sort((a, b) => a.distance_from_driver - b.distance_from_driver);

    return res.json(nearbyRides);
  }

  res.json(rides);
};

// GET /api/driver/my-rides — Driver's accepted/completed rides
const getMyRides = async (req, res) => {
  const { data, error } = await supabase
    .from("rides")
    .select("*")
    .eq("driver_id", req.user.id)
    .order("created_at", { ascending: false });

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
};

// GET /api/driver/stats — Driver earnings and trip stats
const getDriverStats = async (req, res) => {
  const { data: rides, error } = await supabase
    .from("rides")
    .select("*")
    .eq("driver_id", req.user.id)
    .eq("status", "completed");

  if (error) return res.status(400).json({ error: error.message });

  const today = new Date().toDateString();

  const totalEarnings = rides.reduce(
    (sum, r) => sum + parseFloat(r.fare || 0), 0
  );

  const todayRides = rides.filter(
    (r) => new Date(r.updated_at).toDateString() === today
  );

  const todayEarnings = todayRides.reduce(
    (sum, r) => sum + parseFloat(r.fare || 0), 0
  );

  res.json({
    total_trips:     rides.length,
    total_earnings:  parseFloat(totalEarnings.toFixed(2)),
    today_trips:     todayRides.length,
    today_earnings:  parseFloat(todayEarnings.toFixed(2)),
  });
};

module.exports = {
  updateLocation,
  getDriverStatus,
  getAvailableRides,
  getMyRides,
  getDriverStats,
};