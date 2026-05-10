"use client";

import { useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import InputField from "./InputField";
import ImageUpload from "./ImageUpload";
import PlayingStyleSelector from "./PlayingStyleSelector";
import RoleSelector from "./RoleSelector";
import PaymentQR from "./PaymentQR";
import SuccessModal from "./SuccessModal";

// Initial form state
const INITIAL_STATE = {
  name: "",
  mobile: "",
  previousTeam: "",
  Age: "",
  playerPhotoBase64: "",
  playingStyle: [],
  role: "",
  paymentScreenshotBase64: "",
  transactionId: "",
};

const INITIAL_ERRORS = {};

/**
 * Main Registration Form
 * Client component — handles all form state, validation & submission
 */
export default function RegistrationForm() {
  const [form, setForm] = useState(INITIAL_STATE);
  const [errors, setErrors] = useState(INITIAL_ERRORS);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successData, setSuccessData] = useState(null);

  // --- Field Handlers ---
  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const handleImageSelect = (field) => (base64, error) => {
    setForm((prev) => ({ ...prev, [field]: base64 || "" }));
    setErrors((prev) => ({ ...prev, [field]: error || "" }));
  };

  const handlePlayingStyleChange = (styles) => {
    setForm((prev) => ({ ...prev, playingStyle: styles }));
    if (errors.playingStyle)
      setErrors((prev) => ({ ...prev, playingStyle: "" }));
  };

  const handleRoleChange = (role) => {
    setForm((prev) => ({ ...prev, role }));
    if (errors.role) setErrors((prev) => ({ ...prev, role: "" }));
  };

  // --- Validation ---
  const validate = () => {
    const newErrors = {};

    if (!form.name.trim()) newErrors.name = "Full name is required";
    else if (form.name.trim().length < 2)
      newErrors.name = "Name must be at least 2 characters";

    if (!form.mobile) {
      newErrors.mobile = "Mobile number is required";
    } else if (!/^[6-9]\d{9}$/.test(form.mobile)) {
      newErrors.mobile = "Enter a valid 10-digit Indian mobile number";
    }

    if (!form.playerPhotoBase64)
      newErrors.playerPhotoBase64 = "Player photo is required";

    if (form.playingStyle.length === 0) {
      newErrors.playingStyle = "Select at least 1 playing style";
    } else if (form.playingStyle.length > 2) {
      newErrors.playingStyle = "Maximum 2 playing styles allowed";
    }

    if (!form.role) newErrors.role = "Player role is required";

    if (!form.paymentScreenshotBase64)
      newErrors.paymentScreenshotBase64 = "Payment screenshot is required";

    if (!form.transactionId.trim())
      newErrors.transactionId = "Transaction ID is required";
    else if (form.transactionId.trim().length < 4)
      newErrors.transactionId = "Enter a valid transaction ID";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // --- Submit ---
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validate()) {
      toast.error("Please fix the errors before submitting");
      // Scroll to first error
      const firstError = document.querySelector('[data-error="true"]');
      firstError?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    setIsSubmitting(true);
    const loadingToast = toast.loading("Submitting your registration...");

    try {
      const response = await axios.post("/api/register", form);

      toast.dismiss(loadingToast);
      toast.success("Registration submitted successfully! 🏏");
      setSuccessData(response.data.data);
    } catch (err) {
      toast.dismiss(loadingToast);
      const message =
        err.response?.data?.message || "Registration failed. Please try again.";
      toast.error(message);
      console.error("Registration error:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Reset after success ---
  const handleCloseSuccess = () => {
    setSuccessData(null);
    setForm(INITIAL_STATE);
    setErrors(INITIAL_ERRORS);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <>
      {/* Success Modal */}
      {successData && (
        <SuccessModal player={successData} onClose={handleCloseSuccess} />
      )}

      {/* Form Card */}
      <div
        className="relative rounded-3xl overflow-hidden"
        style={{
          background: `
linear-gradient(
  180deg,
  rgba(6,18,33,0.98) 0%,
  rgba(10,25,48,0.98) 45%,
  rgba(4,10,20,0.98) 100%
)
`,
          border: "1px solid rgba(0,170,255,0.18)",
          boxShadow: `
0 0 25px rgba(0,170,255,0.12),
0 0 60px rgba(0,0,0,0.8),
inset 0 0 18px rgba(255,140,0,0.06)
`,
        }}
      >
        {/* Top green accent line */}
        <div
          className="h-1 w-full"
          style={{
            background: `
linear-gradient(
90deg,
rgba(0,170,255,1) 0%,
rgba(255,183,0,1) 50%,
rgba(231,111,6,1) 100%
)
`,
          }}
        />

        {/* Form header */}
        <div
          className="px-6 sm:px-8 pt-8 pb-6"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
              style={{
                background: "rgba(6, 18, 33, 0.15)",
                border: "1px solid rgba(6,18,33,1)",
              }}
            >
              📋
            </div>
            <div>
              <h2
                className="text-xl font-bold tracking-wide"
                style={{
                  fontFamily: "var(--font-display)",
                  color: "var(--color-text)",
                  letterSpacing: "0.08em",
                }}
              >
                PLAYER REGISTRATION
              </h2>
              <p className="text-xs" style={{ color: "var(--color-text-dim)" }}>
                Fill all fields carefully — all information must be accurate
              </p>
            </div>
          </div>
        </div>

        {/* Form fields */}
        <form
          onSubmit={handleSubmit}
          className="px-6 sm:px-8 py-8 flex flex-col gap-8"
          noValidate
        >
          {/* Section: Personal Info */}
          <FormSection label="Personal Information" icon="👤" index={0}>
            <InputField
              label="Full Name"
              name="name"
              value={form.name}
              onChange={handleChange("name")}
              placeholder="Enter your full name"
              required
              error={errors.name}
              icon="✍️"
              data-error={!!errors.name}
            />
            <InputField
              label="Mobile Number"
              name="mobile"
              type="tel"
              value={form.mobile}
              onChange={handleChange("mobile")}
              placeholder="10-digit mobile number"
              required
              error={errors.mobile}
              icon="📱"
              maxLength={10}
              hint="Indian mobile numbers only (starting with 6, 7, 8 or 9)"
            />

            <InputField
              label="Player Age"
              name="Age"
              type="Number"
              value={form.Age}
              onChange={handleChange("Age")}
              placeholder="Enter your Age"
              required
              error={errors.Age}
              icon="✍️"
              data-error={!!errors.Age}
            />

            <InputField
              label="Previous Team"
              name="previousTeam"
              value={form.previousTeam}
              onChange={handleChange("previousTeam")}
              placeholder="Enter your previous team if any"
              error={errors.previousTeam}
              icon="✍️"
              data-error={!!errors.previousTeam}
            />
          </FormSection>

          {/* Section: Player Photo */}
          <FormSection label="Player Photo" icon="📸" index={1}>
            <ImageUpload
              label="Upload Your Photo"
              name="playerPhoto"
              onImageSelect={handleImageSelect("playerPhotoBase64")}
              previewUrl={form.playerPhotoBase64}
              error={errors.playerPhotoBase64}
              icon="🤳"
              hint="Clear face photo — JPG, PNG or WebP, max 5MB"
              required
            />
          </FormSection>

          {/* Section: Playing Details */}
          <FormSection label="Playing Details" icon="🏏" index={2}>
            <PlayingStyleSelector
              selected={form.playingStyle}
              onChange={handlePlayingStyleChange}
              error={errors.playingStyle}
            />
            <RoleSelector
              selected={form.role}
              onChange={handleRoleChange}
              error={errors.role}
            />
          </FormSection>

          {/* Section: Payment */}
          <FormSection label="Payment" icon="💳" index={3}>
            <PaymentQR />
            <ImageUpload
              label="Payment Screenshot"
              name="paymentScreenshot"
              onImageSelect={handleImageSelect("paymentScreenshotBase64")}
              previewUrl={form.paymentScreenshotBase64}
              error={errors.paymentScreenshotBase64}
              icon="📲"
              hint="Screenshot of successful UPI payment"
              required
            />
            <InputField
              label="Transaction ID"
              name="transactionId"
              value={form.transactionId}
              onChange={handleChange("transactionId")}
              placeholder="e.g. TXN123456789"
              required
              error={errors.transactionId}
              icon="🔑"
              hint="Found in your UPI payment receipt or SMS"
            />
          </FormSection>

          {/* Tournament Notes */}
          <div
            className="rounded-2xl p-5 flex flex-col gap-3"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.08)",
              boxShadow: "inset 0 0 20px rgba(0,0,0,0.25)",
            }}
          >
            {/* Header */}
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{
                  background: "rgba(245,158,11,0.12)",
                  border: "1px solid rgba(245,158,11,0.2)",
                }}
              >
                📢
              </div>

              <h3
                className="text-sm font-bold tracking-widest uppercase"
                style={{
                  color: "#fbbf24",
                  fontFamily: "var(--font-display)",
                }}
              >
                Important Notes
              </h3>
            </div>

            {/* Notes */}
            <div
              className="text-sm leading-7 flex flex-col gap-2"
              style={{
                color: "rgba(232,245,233,0.72)",
                fontFamily: "var(--font-body)",
              }}
            >
              <p>
                <span style={{ color: "#fbbf24" }}>•</span> Auction dates,
                tournament rules and match schedules will be communicated later
                in the official WhatsApp group.
              </p>

              <p>
                <span style={{ color: "#fbbf24" }}>•</span> Everything will be
                informed before the auction so teams can prepare strategies
                accordingly.
              </p>

              <p>
                <span style={{ color: "#fbbf24" }}>•</span> Registration/payment
                once completed will be strictly non-refundable under any
                circumstances.
              </p>

              <p>
                <span style={{ color: "#fbbf24" }}>•</span> Any invalid
                information or fake payment proof may result in direct
                disqualification from the tournament.
              </p>
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="relative w-full py-4 rounded-xl font-bold text-base tracking-widest uppercase transition-all duration-200 overflow-hidden group"
              style={{
                background: isSubmitting
                  ? "rgba(34,197,94,0.3)"
                  : "linear-gradient(135deg, #16a34a 0%, #22c55e 50%, #16a34a 100%)",
                color: "#fff",
                fontFamily: "var(--font-display)",
                letterSpacing: "0.15em",
                cursor: isSubmitting ? "not-allowed" : "pointer",
                boxShadow: isSubmitting
                  ? "none"
                  : "0 8px 32px rgba(34,197,94,0.35)",
                fontSize: "16px",
              }}
            >
              {/* Shimmer overlay */}
              {!isSubmitting && (
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  style={{
                    background:
                      "linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)",
                    backgroundSize: "200% 100%",
                    animation: "shimmer 1.5s linear infinite",
                  }}
                />
              )}

              {/* Button content */}
              <span className="relative flex items-center justify-center gap-3">
                {isSubmitting ? (
                  <>
                    <Spinner />
                    Submitting Registration...
                  </>
                ) : (
                  <>
                    <span>🏏</span>
                    Register Now
                    <span>→</span>
                  </>
                )}
              </span>
            </button>

            <p
              className="text-center text-xs mt-3"
              style={{ color: "var(--color-text-dim)" }}
            >
              By registering, you confirm all information is accurate and
              payment has been completed.
              <br />
              By Registering You also abide to all rules and regulations of the
              Crazy Cricket League 2026.
            </p>
          </div>
        </form>
      </div>
    </>
  );
}

// Section wrapper with label
function FormSection({ label, icon, index, children }) {
  return (
    <div
      className="form-section flex flex-col gap-5"
      style={{ animationDelay: `${0.1 + index * 0.05}s` }}
    >
      {/* Section label */}
      <div className="flex items-center gap-3">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center text-sm"
          style={{
            background: "rgba(34,197,94,0.1)",
            border: "1px solid rgba(34,197,94,0.2)",
          }}
        >
          {icon}
        </div>
        <h3
          className="text-xs font-semibold tracking-widest uppercase"
          style={{
            color: "rgba(34,197,94,0.8)",
            fontFamily: "var(--font-accent)",
          }}
        >
          {label}
        </h3>
        <div
          className="flex-1 h-px"
          style={{ background: "rgba(34,197,94,0.1)" }}
        />
      </div>

      {/* Fields */}
      <div className="flex flex-col gap-4">{children}</div>
    </div>
  );
}

// Loading spinner
function Spinner() {
  return (
    <svg
      className="animate-spin"
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle
        cx="9"
        cy="9"
        r="7"
        stroke="rgba(255,255,255,0.3)"
        strokeWidth="2"
      />
      <path
        d="M9 2a7 7 0 0 1 7 7"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
