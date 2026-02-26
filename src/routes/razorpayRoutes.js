const express      = require("express");
const router       = express.Router();
const authenticate = require("../middleware/authMiddleware");
const {
  createOrder,
  verifyPayment,
  cashPayment,
  getPaymentStatus,
} = require("../controllers/razorpayController");

router.post("/create-order",           authenticate, createOrder);
router.post("/verify-payment",         authenticate, verifyPayment);
router.post("/cash-payment",           authenticate, cashPayment);
router.get("/payment-status/:ride_id", authenticate, getPaymentStatus);

module.exports = router;