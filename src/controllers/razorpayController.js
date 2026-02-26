const Razorpay = require("razorpay");
const crypto   = require("crypto");
const supabase = require("../lib/supabaseAdmin");

const razorpay = new Razorpay({
  key_id:     process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// POST /api/razorpay/create-order
const createOrder = async (req, res) => {
  try {
    const { ride_id } = req.body;
    if (!ride_id) return res.status(400).json({ error: "ride_id is required" });

    const { data: ride, error: rideError } = await supabase
      .from("rides")
      .select("*")
      .eq("id", ride_id)
      .single();

    if (rideError || !ride) return res.status(404).json({ error: "Ride not found" });
    if (ride.rider_id !== req.user.id) return res.status(403).json({ error: "Not your ride" });

    // ✅ Allow payment during in_progress OR completed (not just completed)
    if (!["in_progress", "completed"].includes(ride.status)) {
      return res.status(400).json({
        error: "Payment can only be made once the ride has started",
      });
    }

    // Check already paid
    const { data: existingPayment } = await supabase
      .from("payments")
      .select("id")
      .eq("ride_id", ride_id)
      .in("status", ["completed", "cash"])
      .maybeSingle();

    if (existingPayment) return res.status(400).json({ error: "Ride already paid" });

    const amountInPaise = Math.round(parseFloat(ride.fare) * 100);

    const order = await razorpay.orders.create({
      amount:   amountInPaise,
      currency: "INR",
      receipt:  "ride_" + ride.id.slice(0, 8),
      notes: {
        ride_id:   ride.id,
        rider_id:  ride.rider_id,
        driver_id: ride.driver_id || "",
      },
    });

    // Upsert payment record — avoid duplicate pending rows if user retries
    const { data: existing } = await supabase
      .from("payments")
      .select("id")
      .eq("ride_id", ride_id)
      .eq("status", "pending")
      .maybeSingle();

    if (existing) {
      // Update the existing pending record with new order id
      await supabase
        .from("payments")
        .update({ stripe_payment_id: order.id })
        .eq("id", existing.id);
    } else {
      const { error: insertError } = await supabase.from("payments").insert({
        ride_id,
        rider_id:          req.user.id,
        amount:            ride.fare,
        currency:          "inr",
        status:            "pending",
        payment_method:    "razorpay",
        stripe_payment_id: order.id,
      });

      if (insertError) {
        console.error("Payment insert error:", insertError);
        return res.status(500).json({
          error: "Failed to create payment record: " + insertError.message,
        });
      }
    }

    res.json({
      orderId:  order.id,
      amount:   ride.fare,
      currency: "INR",
      keyId:    process.env.RAZORPAY_KEY_ID,
      ride,
    });
  } catch (err) {
    console.error("createOrder error:", err);
    res.status(500).json({ error: err.message });
  }
};

// POST /api/razorpay/verify-payment
const verifyPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      ride_id,
    } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !ride_id) {
      return res.status(400).json({ error: "Missing payment verification fields" });
    }

    // Verify HMAC signature
    const body     = razorpay_order_id + "|" + razorpay_payment_id;
    const expected = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest("hex");

    if (expected !== razorpay_signature) {
      return res.status(400).json({ error: "Invalid payment signature" });
    }

    const { data: payment, error } = await supabase
      .from("payments")
      .update({
        status:            "completed",
        stripe_payment_id: razorpay_payment_id,
      })
      .eq("stripe_payment_id", razorpay_order_id)
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });

    res.json({ message: "Payment verified!", payment });
  } catch (err) {
    console.error("verifyPayment error:", err);
    res.status(500).json({ error: err.message });
  }
};

// POST /api/razorpay/cash-payment  — driver marks ride as cash paid
const cashPayment = async (req, res) => {
  try {
    const { ride_id } = req.body;
    if (!ride_id) return res.status(400).json({ error: "ride_id is required" });

    const { data: ride, error: rideError } = await supabase
      .from("rides")
      .select("*")
      .eq("id", ride_id)
      .single();

    if (rideError || !ride) return res.status(404).json({ error: "Ride not found" });
    if (ride.driver_id !== req.user.id) return res.status(403).json({ error: "Not your ride" });
    if (ride.status !== "in_progress")  return res.status(400).json({ error: "Ride must be in progress" });

    // Check already paid
    const { data: existing } = await supabase
      .from("payments")
      .select("id")
      .eq("ride_id", ride_id)
      .in("status", ["completed", "cash"])
      .maybeSingle();

    if (existing) return res.status(400).json({ error: "Payment already recorded" });

    const { data: payment, error: insertError } = await supabase
      .from("payments")
      .insert({
        ride_id,
        rider_id:       ride.rider_id,
        amount:         ride.fare,
        currency:       "inr",
        status:         "cash",
        payment_method: "cash",
      })
      .select()
      .single();

    if (insertError) {
      console.error("Cash payment insert error:", insertError);
      return res.status(500).json({
        error: "Failed to record cash payment: " + insertError.message,
      });
    }

    res.json({ message: "Cash payment recorded!", payment });
  } catch (err) {
    console.error("cashPayment error:", err);
    res.status(500).json({ error: err.message });
  }
};

// GET /api/razorpay/payment-status/:ride_id
const getPaymentStatus = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("payments")
      .select("*")
      .eq("ride_id", req.params.ride_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return res.json({ status: "unpaid", payment: null });

    res.json({ status: data.status, payment: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { createOrder, verifyPayment, cashPayment, getPaymentStatus };