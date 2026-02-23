const express = require("express");
const router = express.Router();
const authenticate = require("../middleware/authMiddleware");
const { getProfile, updateProfile } = require("../controllers/userController");

router.get("/profile", authenticate, getProfile);
router.put("/profile", authenticate, updateProfile);

module.exports = router;