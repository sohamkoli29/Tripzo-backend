const express = require("express");
const router = express.Router();
const authenticate = require("../middleware/authMiddleware");
const { getProfile, updateProfile,getDriverProfile  } = require("../controllers/userController");

router.get("/profile", authenticate, getProfile);
router.put("/profile", authenticate, updateProfile);
router.get("/driver/:id",      authenticate, getDriverProfile);
module.exports = router;