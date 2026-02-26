const supabase = require("../lib/supabaseAdmin");

// POST /api/ratings — submit or update a rating
const createRating = async (req, res) => {
  try {
    const { ride_id, stars, review } = req.body;

    if (!ride_id)              return res.status(400).json({ error: "ride_id is required" });
    if (!stars || stars < 1 || stars > 5)
      return res.status(400).json({ error: "stars must be 1–5" });

    // Verify ride belongs to this rider and is completed
    const { data: ride, error: rideErr } = await supabase
      .from("rides").select("*").eq("id", ride_id).single();

    if (rideErr || !ride)          return res.status(404).json({ error: "Ride not found" });
    if (ride.rider_id !== req.user.id) return res.status(403).json({ error: "Not your ride" });
    if (ride.status !== "completed")   return res.status(400).json({ error: "Can only rate completed rides" });
    if (!ride.driver_id)               return res.status(400).json({ error: "No driver on this ride" });

    // Check if already rated → update instead of insert
    const { data: existing } = await supabase
      .from("ratings").select("id").eq("ride_id", ride_id).eq("rider_id", req.user.id).maybeSingle();

    if (existing) {
      const { data, error } = await supabase
        .from("ratings").update({ stars, review: review || null })
        .eq("id", existing.id).select().single();
      if (error) return res.status(400).json({ error: error.message });
      return res.json({ message: "Rating updated!", rating: data });
    }

    const { data, error } = await supabase
      .from("ratings")
      .insert({ ride_id, rider_id: req.user.id, driver_id: ride.driver_id, stars, review: review || null })
      .select().single();

    if (error) return res.status(400).json({ error: error.message });
    res.status(201).json({ message: "Rating submitted!", rating: data });
  } catch (err) {
    console.error("createRating error:", err);
    res.status(500).json({ error: err.message });
  }
};

// GET /api/ratings/ride/:ride_id — get current rider's rating for a ride
const getRatingByRide = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("ratings").select("*")
      .eq("ride_id", req.params.ride_id)
      .eq("rider_id", req.user.id)
      .maybeSingle();
    if (error) return res.status(400).json({ error: error.message });
    res.json({ rating: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/ratings/driver/:driver_id — public ratings for a driver
const getDriverRatings = async (req, res) => {
  try {
    const { data: ratings, error } = await supabase
      .from("ratings")
      .select(`id, stars, review, created_at, users!ratings_rider_id_fkey(full_name, profile_picture)`)
      .eq("driver_id", req.params.driver_id)
      .order("created_at", { ascending: false });

    if (error) return res.status(400).json({ error: error.message });

    const total = ratings.length;
    const avg   = total > 0 ? parseFloat((ratings.reduce((s, r) => s + r.stars, 0) / total).toFixed(2)) : 0;
    const dist  = [5,4,3,2,1].map(star => ({
      star,
      count:   ratings.filter(r => r.stars === star).length,
      percent: total > 0 ? Math.round((ratings.filter(r => r.stars === star).length / total) * 100) : 0,
    }));

    res.json({ ratings, avg, total, distribution: dist });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/ratings/my-ratings — driver sees their own received ratings
const getMyRatings = async (req, res) => {
  try {
    const { data: ratings, error } = await supabase
      .from("ratings")
      .select(`id, stars, review, created_at, users!ratings_rider_id_fkey(full_name, profile_picture)`)
      .eq("driver_id", req.user.id)
      .order("created_at", { ascending: false });

    if (error) return res.status(400).json({ error: error.message });

    const total = ratings.length;
    const avg   = total > 0 ? parseFloat((ratings.reduce((s, r) => s + r.stars, 0) / total).toFixed(2)) : 0;
    const dist  = [5,4,3,2,1].map(star => ({
      star,
      count:   ratings.filter(r => r.stars === star).length,
      percent: total > 0 ? Math.round((ratings.filter(r => r.stars === star).length / total) * 100) : 0,
    }));

    res.json({ ratings, avg, total, distribution: dist });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { createRating, getRatingByRide, getDriverRatings, getMyRatings };