const express    = require("express");
const router     = express.Router();
const authenticate = require("../middleware/authMiddleware");
const {
  updateLocation,
  getDriverStatus,
  getAvailableRides,
  getMyRides,
  getDriverStats,
} = require("../controllers/driverController");

router.put("/location",         authenticate, updateLocation);
router.get("/status",           authenticate, getDriverStatus);
router.get("/available-rides",  authenticate, getAvailableRides);
router.get("/my-rides",         authenticate, getMyRides);
router.get("/stats",            authenticate, getDriverStats);

module.exports = router;