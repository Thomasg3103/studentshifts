import { useApp } from "../context/AppContext";
import { signOut } from "../lib/auth";

export default function PendingCompanyPage() {
  const { currentUser, setCurrentUser } = useApp();
  const isRejected = currentUser?.verificationStatus === "rejected";

  const handleSignOut = async () => {
    await signOut();
    setCurrentUser(null);
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#fafafa", padding: "1rem" }}>
      <div style={{ maxWidth: "480px", width: "100%", backgroundColor: "#fff", borderRadius: "1rem", boxShadow: "0 4px 24px rgba(0,0,0,0.07)", padding: "2.5rem 2rem", textAlign: "center" }}>
        <div style={{
          width: "56px", height: "56px", borderRadius: "50%",
          background: isRejected ? "linear-gradient(135deg,#fee2e2,#fecaca)" : "linear-gradient(135deg,#dbeafe,#bfdbfe)",
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 1.25rem", fontSize: "1.75rem",
        }}>
          {isRejected ? "✕" : "⏳"}
        </div>
        <h1 style={{ margin: "0 0 0.5rem", fontSize: "1.35rem", fontWeight: 800, color: "#1e293b" }}>
          {isRejected ? "Verification Unsuccessful" : "Awaiting Verification"}
        </h1>
        <p style={{ margin: "0 0 1.75rem", fontSize: "0.9rem", color: "#64748b", lineHeight: 1.6 }}>
          {isRejected
            ? "Your company account could not be verified. This may be due to an invalid CRO number or unclear details. Please contact us at hello@studentshifts.ie to resolve this."
            : "Your company account is under review. We typically verify accounts within 1–2 business days. You'll receive an email once approved."}
        </p>
        <button
          onClick={handleSignOut}
          style={{ padding: "0.75rem 2rem", borderRadius: "0.5rem", border: "1.5px solid #e2e8f0", background: "#fff", color: "#374151", fontWeight: 600, fontSize: "0.9rem", cursor: "pointer", fontFamily: "inherit" }}
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}
