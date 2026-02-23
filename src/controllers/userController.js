const supabase = require("../lib/supabaseAdmin");

// GET /api/users/profile
const getProfile = async (req, res) => {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", req.user.id)
    .single();

  if (error) return res.status(404).json({ error: "User not found" });
  res.json(data);
};

// PUT /api/users/profile
const updateProfile = async (req, res) => {
  const { full_name, phone, profile_picture, role } = req.body;

  const { data, error } = await supabase
    .from("users")
    .update({ full_name, phone, profile_picture, role })
    .eq("id", req.user.id)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json({ message: "Profile updated", user: data });
};

module.exports = { getProfile, updateProfile };