const supabase = require("../lib/supabaseAdmin");

// GET /api/users/profile — current user's own profile
const getProfile = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", req.user.id)
      .single();

    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// PUT /api/users/profile — update own profile
const updateProfile = async (req, res) => {
  try {
    const { full_name, phone, profile_picture } = req.body;

    const { data, error } = await supabase
      .from("users")
      .update({ full_name, phone, profile_picture })
      .eq("id", req.user.id)
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/users/driver/:id — public driver profile with avg_rating + reviews
const getDriverProfile = async (req, res) => {
  try {
    // Get driver user row (has avg_rating, total_ratings from trigger)
    const { data: driver, error: driverErr } = await supabase
      .from("users")
      .select("id, full_name, profile_picture, avg_rating, total_ratings, created_at")
      .eq("id", req.params.id)
      .eq("role", "driver")
      .single();

    if (driverErr || !driver) {
      return res.status(404).json({ error: "Driver not found" });
    }

    // Get recent ratings with reviewer name
    const { data: ratings } = await supabase
      .from("ratings")
      .select(`
        id, stars, review, created_at,
        users!ratings_rider_id_fkey (full_name, profile_picture)
      `)
      .eq("driver_id", req.params.id)
      .order("created_at", { ascending: false })
      .limit(10);

    // Star distribution
    const allRatings = ratings || [];
    const total      = driver.total_ratings || 0;
    const distribution = [5, 4, 3, 2, 1].map((star) => ({
      star,
      count:   allRatings.filter((r) => r.stars === star).length,
      percent: total > 0
        ? Math.round((allRatings.filter((r) => r.stars === star).length / total) * 100)
        : 0,
    }));

    res.json({
      driver,
      ratings:      allRatings,
      distribution,
      avg:          parseFloat(driver.avg_rating  || 0),
      total:        driver.total_ratings           || 0,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { getProfile, updateProfile, getDriverProfile };