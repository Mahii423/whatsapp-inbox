"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../utils/supabase/client";

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSignup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoading(true);
    setError("");
    setMessage("");

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          business_name: businessName,
        },
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    if (data.session) {
      router.push("/");
      router.refresh();
      return;
    }

    setMessage(
      "Account created. Please check your email to confirm your account."
    );

    setLoading(false);
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f4f6f8",
        padding: "20px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "420px",
          background: "#fff",
          padding: "32px",
          borderRadius: "16px",
          boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <div
            style={{
              width: "55px",
              height: "55px",
              margin: "0 auto 14px",
              borderRadius: "14px",
              background: "#25d366",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "26px",
              fontWeight: 700,
            }}
          >
            W
          </div>

          <h1 style={{ margin: 0, fontSize: "24px" }}>
            Create your account
          </h1>

          <p style={{ color: "#68737c", marginTop: "8px" }}>
            Start your WhatsApp Inbox workspace
          </p>
        </div>

        <form onSubmit={handleSignup}>
          <label style={{ display: "block", marginBottom: "7px" }}>
            Business Name
          </label>

          <input
            type="text"
            required
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            placeholder="Your business name"
            style={{
              width: "100%",
              padding: "12px",
              border: "1px solid #ddd",
              borderRadius: "9px",
              marginBottom: "18px",
              outline: "none",
            }}
          />

          <label style={{ display: "block", marginBottom: "7px" }}>
            Email
          </label>

          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            style={{
              width: "100%",
              padding: "12px",
              border: "1px solid #ddd",
              borderRadius: "9px",
              marginBottom: "18px",
              outline: "none",
            }}
          />

          <label style={{ display: "block", marginBottom: "7px" }}>
            Password
          </label>

          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 6 characters"
            style={{
              width: "100%",
              padding: "12px",
              border: "1px solid #ddd",
              borderRadius: "9px",
              marginBottom: "18px",
              outline: "none",
            }}
          />

          {error && (
            <p
              style={{
                color: "#d93025",
                background: "#fff1f0",
                padding: "10px",
                borderRadius: "8px",
                fontSize: "13px",
              }}
            >
              {error}
            </p>
          )}

          {message && (
            <p
              style={{
                color: "#168943",
                background: "#eefaf1",
                padding: "10px",
                borderRadius: "8px",
                fontSize: "13px",
              }}
            >
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "13px",
              border: 0,
              borderRadius: "9px",
              background: "#25d366",
              color: "#fff",
              fontWeight: 700,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Creating account..." : "Create Account"}
          </button>
        </form>

        <p
          style={{
            textAlign: "center",
            marginTop: "22px",
            color: "#68737c",
            fontSize: "14px",
          }}
        >
          Already have an account?{" "}
          <a href="/login" style={{ color: "#168943" }}>
            Sign in
          </a>
        </p>
      </div>
    </main>
  );
}