const express = require("express");
const router = express.Router();
const authenticate = require("../middleware/authMiddleware");
const {
  createRide, getRides, getRideById,
  updateRideStatus, getAvailableRides
} = require("../controllers/rideController");

router.post("/", authenticate, createRide);
router.get("/", authenticate, getRides);
router.get("/available", authenticate, getAvailableRides);
router.get("/:id", authenticate, getRideById);
router.patch("/:id/status", authenticate, updateRideStatus);

module.exports = router;