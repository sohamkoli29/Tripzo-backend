const express = require("express");
const router = express.Router();
const authenticate = require("../middleware/authMiddleware");
const {
  createPayment, getPayments, getPaymentById
} = require("../controllers/paymentController");

router.post("/", authenticate, createPayment);
router.get("/", authenticate, getPayments);
router.get("/:id", authenticate, getPaymentById);

module.exports = router;