const express      = require("express");
const router       = express.Router();
const authenticate = require("../middleware/authMiddleware");
const { createRating, getRatingByRide, getDriverRatings, getMyRatings } = require("../controllers/ratingsController");

router.post("/",                    authenticate, createRating);
router.get("/ride/:ride_id",        authenticate, getRatingByRide);
router.get("/driver/:driver_id",    authenticate, getDriverRatings);
router.get("/my-ratings",           authenticate, getMyRatings);

module.exports = router;