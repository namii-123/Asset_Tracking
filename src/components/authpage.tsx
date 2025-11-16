import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Login from "./Login";
import Register from "./Register";
import "../assets/auth.css";

export default function AuthPage() {
  const [isRegistering, setIsRegistering] = useState(false);
  const [prefilledEmail, setPrefilledEmail] = useState("");
  const navigate = useNavigate();

  const toggleForm = (email?: string) => {
    setIsRegistering((prev) => !prev);
    if (email) {
      setPrefilledEmail(email);
    } else {
      setPrefilledEmail("");
    }
  };

  useEffect(() => {
    const wrapper = document.querySelector(".auth-wrapper") as HTMLElement;
    const switchLinks = document.querySelectorAll(".switch span");

    switchLinks.forEach((link) => {
      link.addEventListener("click", () => {
        wrapper?.classList.toggle("register-active");
      });
    });

    return () => {
      switchLinks.forEach((link) => {
        link.removeEventListener("click", () => {});
      });
    };
  }, []);

  return (
    <div className="auth-page">
      <div className="auth-wrapper">
        <div className="auth-left">
          <div className="logo-container">
            <div
              onClick={() => navigate("/dashadmin")}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  navigate("/dashadmin");
                }
              }}
              style={{ cursor: "pointer", display: "inline-block" }}
              aria-label="Go to dashadmin"
            >
              <img className="rounded-logo" src="/dohlogo1.png" alt="DOH Logo" />
            </div>
            <h1>Department of Health</h1>
            <h2>Treatment & Rehabilitation Center - Argao</h2>
            <p>IT Asset Tracking System</p>
          </div>
        </div>

        <div className={`auth-right ${isRegistering ? "slide-left" : "slide-right"}`}>
          {isRegistering ? (
            <Register toggle={toggleForm} />
          ) : (
            <Login toggle={() => toggleForm()} prefilledEmail={prefilledEmail} />
          )}
        </div>
      </div>
    </div>
  );
}