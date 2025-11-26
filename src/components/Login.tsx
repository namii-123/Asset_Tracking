import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  signInWithPopup,
  signInWithEmailAndPassword,
  signInWithRedirect,
  getRedirectResult,
  deleteUser,
  sendPasswordResetEmail,
  type User,
} from "firebase/auth";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  updateDoc,
} from "firebase/firestore";
import { auth, provider, db } from "../firebase/firebase";
import { toast } from "react-toastify";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEye } from "@fortawesome/free-solid-svg-icons";
import emailjs from "@emailjs/browser";

const EMAILJS_PUBLIC_KEY = "oiiPTVJU2reQ831XC";
const EMAILJS_SERVICE_ID = "service_nb6i81u";
const EMAILJS_TEMPLATE_ID = "template_s33sm7c";

type UserStatus = "email_pending" | "pending" | "approved" | "rejected";

interface ITSupplyUser {
  id: string;
  Email: string;
  Username: string;
  FirstName: string;
  LastName: string;
  MiddleInitial?: string;
  Position?: string;
  Department: string;
  Status: UserStatus;
  EmailVerified: boolean;
  CreatedAt: any;
  AuthUID: string;
  IDPictureBase64?: string;
}

export default function LoginForm({
  toggle,
  prefilledEmail,
}: {
  toggle: () => void;
  prefilledEmail?: string;
}) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPasswordTemp, setShowPasswordTemp] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as any)?.from as Location | undefined;
  const targetAfterLogin =
    from ? `${from.pathname}${from.search}${from.hash}` : "/dashboard";

  const [failedAttempts, setFailedAttempts] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [verificationInput, setVerificationInput] = useState("");
  const [sentCode, setSentCode] = useState("");
  const [userEmailForVerification, setUserEmailForVerification] = useState("");
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [codeExpiryTime, setCodeExpiryTime] = useState<Date | null>(null);

  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const togglePasswordVisibility = () => {
    setShowPasswordTemp(true);
    setTimeout(() => setShowPasswordTemp(false), 1000);
  };

  useEffect(() => {
    if (prefilledEmail) {
      setIdentifier(prefilledEmail);
      localStorage.setItem("lastIdentifier", prefilledEmail);
    } else {
      const saved = localStorage.getItem("lastIdentifier");
      if (saved) setIdentifier(saved);
    }
  }, [prefilledEmail]);

  useEffect(() => {
    const stored = localStorage.getItem(`failedAttempts_${identifier}`);
    if (stored) {
      const data = JSON.parse(stored);
      const now = Date.now();
      if (data.lockedUntil && now < data.lockedUntil) {
        setFailedAttempts(data.attempts);
        setIsLocked(true);
      } else if (data.lockedUntil && now >= data.lockedUntil) {
        localStorage.removeItem(`failedAttempts_${identifier}`);
        setFailedAttempts(0);
        setIsLocked(false);
      } else {
        setFailedAttempts(data.attempts || 0);
      }
    }
  }, [identifier]);

  const generateVerificationCode = (): string => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  };

  const sendVerificationCode = async (email: string, firstName: string): Promise<boolean> => {
    const code = generateVerificationCode();
    setSentCode(code);
    const expiryTime = new Date(Date.now() + 10 * 60 * 1000);
    setCodeExpiryTime(expiryTime);

    try {
      emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });
      await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
        to_email: email,
        passcode: code,
        time: expiryTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true }),
        login_url: window.location.origin,
        first_name: firstName,
      });
      toast.success("Verification code sent to your email!");
      return true;
    } catch (error) {
      console.error("Failed to send verification code:", error);
      toast.error("Failed to send verification code.");
      return false;
    }
  };

  const handleFailedAttempt = async (email: string) => {
    const newAttempts = failedAttempts + 1;
    setFailedAttempts(newAttempts);

    const lockoutData = {
      attempts: newAttempts,
      timestamp: Date.now(),
      lockedUntil: newAttempts >= 3 ? Date.now() + 30 * 60 * 1000 : undefined,
    };

    if (newAttempts >= 3) {
      setIsLocked(true);
      localStorage.setItem(`failedAttempts_${identifier}`, JSON.stringify(lockoutData));

      try {
        const q = query(collection(db, "IT_Supply_Users"), where("Email", "==", email));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const userData = snap.docs[0].data();
          setUserEmailForVerification(email);
          const sent = await sendVerificationCode(email, userData.FirstName || "User");
          if (sent) {
            setShowVerificationModal(true);
            toast.warning("Too many failed attempts. Verify your identity.");
          }
        }
      } catch (err) {
        toast.error("Account locked for 30 minutes.");
      }
    } else {
      localStorage.setItem(`failedAttempts_${identifier}`, JSON.stringify(lockoutData));
      toast.error(`Invalid credentials. ${3 - newAttempts} attempt(s) remaining.`);
    }
  };

  const handleVerifyCode = () => {
    if (!verificationInput) return toast.error("Enter the code.");
    if (codeExpiryTime && Date.now() > codeExpiryTime.getTime()) {
      toast.error("Code expired.");
      setShowVerificationModal(false);
      return;
    }
    if (verificationInput === sentCode) {
      localStorage.removeItem(`failedAttempts_${identifier}`);
      setFailedAttempts(0);
      setIsLocked(false);
      setShowVerificationModal(false);
      setVerificationInput("");
      setSentCode("");
      toast.success("Identity verified!");
    } else {
      toast.error("Invalid code.");
    }
  };

  const handleResendCode = async () => {
    if (!userEmailForVerification) return;
    const q = query(collection(db, "IT_Supply_Users"), where("Email", "==", userEmailForVerification));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const userData = snap.docs[0].data();
      await sendVerificationCode(userEmailForVerification, userData.FirstName || "User");
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail || !resetEmail.includes("@")) return toast.error("Valid email required.");

    setResetLoading(true);
    try {
      const q = query(collection(db, "IT_Supply_Users"), where("Email", "==", resetEmail));
      const snap = await getDocs(q);
      if (snap.empty) return toast.error("No account found.");

      const userDoc = snap.docs[0].data();
      if (userDoc.Status === "rejected") return toast.error("Account rejected.");
      if (userDoc.Status === "email_pending") return toast.error("Verify email first.");

      await sendPasswordResetEmail(auth, resetEmail);
      setResetSent(true);
      toast.success("Password reset email sent!");
    } catch (err: any) {
      toast.error(err.code === "auth/user-not-found" ? "No account found." : "Failed to send reset.");
    } finally {
      setResetLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const result = await getRedirectResult(auth);
        if (result) {
          await postSignInChecks(result.user, true);
          toast.success("Signed in with Google");
          navigate(targetAfterLogin, { replace: true });
        }
      } catch (e) {
        console.error(e);
      }
    })();
  }, [navigate, targetAfterLogin]);

  const findUserDocByAuthUID = async (uid: string): Promise<ITSupplyUser | null> => {
    const q = query(collection(db, "IT_Supply_Users"), where("AuthUID", "==", uid));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;

    const data = snapshot.docs[0].data();
    const id = snapshot.docs[0].id;

    const validStatuses: UserStatus[] = ["email_pending", "pending", "approved", "rejected"];
    if (!validStatuses.includes(data.Status as UserStatus)) return null;

    return { id, ...data } as ITSupplyUser;
  };

  const postSignInChecks = async (currentUser: User, isGoogle = false) => {
  const { email, uid } = currentUser;

  if (!email) {
    toast.error("No email found on the account.");
    await auth.signOut();
    throw new Error("missing-email");
  }

  localStorage.setItem("lastIdentifier", email);

  const userDoc = await findUserDocByAuthUID(uid);

  if (!userDoc) {
  
    toast.error(
      isGoogle
        ? "This Google account is not registered in the system. Please register first using the form."
        : "Account not found in system."
    );
    await auth.signOut();
    throw new Error("unregistered-user");
  }

  if (userDoc.Status === "email_pending") {
    await updateDoc(doc(db, "IT_Supply_Users", userDoc.id), {
      Status: "pending",
      EmailVerified: true,
    });
    toast.info("Email verified! Your registration is now pending admin approval.");
    await auth.signOut();
    throw new Error("awaiting-approval");
  }

  if (userDoc.Status !== "approved") {
    toast.error("Your account is pending admin approval.");
    await auth.signOut();
    throw new Error("not-approved");
  }

  return userDoc;
};



  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier || !password) return toast.error("Fill all fields.");
    if (isLocked) {
      setShowVerificationModal(true);
      return toast.error("Account locked.");
    }

    try {
      let emailToLogin = identifier;
      if (!identifier.includes("@")) {
        const q = query(collection(db, "IT_Supply_Users"), where("Username", "==", identifier));
        const snap = await getDocs(q);
        if (snap.empty) return toast.error("Username not found.");
        emailToLogin = snap.docs[0].data().Email;
      }

      localStorage.setItem("lastIdentifier", identifier);
      const cred = await signInWithEmailAndPassword(auth, emailToLogin, password);
      await postSignInChecks(cred.user);

      localStorage.removeItem(`failedAttempts_${identifier}`);
      toast.success("Welcome!");
      navigate(targetAfterLogin, { replace: true });
    } catch (err: any) {
      if (["missing-email", "unregistered-user", "awaiting-approval", "not-approved"].includes(err.message)) return;
      let emailForTracking = identifier.includes("@") ? identifier : "";
      if (!emailForTracking) {
        const q = query(collection(db, "IT_Supply_Users"), where("Username", "==", identifier));
        const snap = await getDocs(q);
        if (!snap.empty) emailForTracking = snap.docs[0].data().Email;
      }
      await handleFailedAttempt(emailForTracking || identifier);
    }
  };

  const handleGoogleSignIn = async () => {
  try {
    const result = await signInWithPopup(auth, provider);
    await postSignInChecks(result.user, true);
    toast.success("Signed in with Google!");
    navigate(targetAfterLogin, { replace: true });
  } catch (e: any) {
    if (e?.code === "auth/popup-blocked") {
      await signInWithRedirect(auth, provider);
      return;
    }

   
    if (!["unregistered-user", "awaiting-approval", "not-approved"].some((m) => e?.message?.includes(m))) {
      toast.error("Google Sign-In failed. Please try again.");
    }
  }
};

  return (
      <div className="form-card">
      <div className="login-head">
        <h2>Sign In</h2>
      </div>

      <form onSubmit={handleLogin}>
        <label>
          Username or Email:
          <input
            type="text"
            placeholder="Enter username or email"
            value={identifier}
            required
            onChange={(e) => setIdentifier(e.target.value)}
          />
        </label>

        <label>
          Password:
          <div className="password-wrapper">
            <input
              type={showPasswordTemp ? "text" : "password"}
              placeholder="Enter password"
              value={password}
              required
              onChange={(e) => setPassword(e.target.value)}
            />
            <span className="eye-icon" onClick={togglePasswordVisibility}>
              <FontAwesomeIcon icon={faEye} />
            </span>
          </div>
        </label>

        {failedAttempts > 0 && failedAttempts < 3 && (
          <div style={{
            padding: '0.5rem',
            background: '#fff3cd',
            border: '1px solid #ffc107',
            borderRadius: '4px',
            marginBottom: '1rem',
            fontSize: '0.875rem',
            color: '#856404'
          }}>
            Warning: {3 - failedAttempts} attempt(s) remaining before account lockout.
          </div>
        )}

        <button className="login-button" type="submit" disabled={isLocked}>
          {isLocked ? "Account Locked - Verify Identity" : "Sign In"}
        </button>
        
        <div style={{ 
          display: 'flex', 
          justifyContent: 'flex-end', 
          margin: '0.5rem 0 1rem' 
        }}>
          <span
            onClick={() => {
              setShowForgotPassword(true);
              setResetEmail(identifier || '');
            }}
            style={{ 
              cursor: 'pointer', 
              color: '#007BFF', 
              fontSize: '0.9rem',
              fontWeight: '500',
              textDecoration: 'underline'
            }}
          >
            Forgot Password?
          </span>
        </div>
      </form>

      <div className="or-divider">or</div>

      <button className="google-signin" onClick={handleGoogleSignIn}>
        <img
          src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
          alt="Google"
        />
        Sign in with Google
      </button>

      <div className="switch">
        Don't have an account?{" "}
        <span onClick={toggle} style={{ cursor: "pointer", color: "#007BFF" }}>
          Register
        </span>
      </div>

      {/* Verification Code Modal */}
      {showVerificationModal && (
        <div className="login-forgot-overlay">
          <div className="login-forgot-modal">
            <h3 className="login-forgot-title">Verify Your Identity</h3>
            <p className="login-forgot-desc">
              A 6-digit verification code has been sent to {userEmailForVerification}
            </p>
            <p style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.5rem' }}>
              Code expires in 10 minutes
            </p>

            <div className="login-forgot-form" style={{ marginTop: '1rem' }}>
              <input
                type="text"
                placeholder="Enter 6-digit code"
                value={verificationInput}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                  setVerificationInput(value);
                }}
                maxLength={6}
                className="login-forgot-input"
                autoFocus
                style={{ 
                  textAlign: 'center', 
                  fontSize: '1.5rem', 
                  letterSpacing: '0.5rem',
                  fontWeight: 'bold'
                }}
              />
              
              <div style={{ 
                marginTop: '1rem', 
                textAlign: 'center',
                fontSize: '0.875rem'
              }}>
                <span 
                  onClick={handleResendCode}
                  style={{ 
                    cursor: 'pointer', 
                    color: '#007BFF',
                    textDecoration: 'underline'
                  }}
                >
                  Resend Code
                </span>
              </div>

              <div className="login-forgot-actions" style={{ marginTop: '1.5rem' }}>
                <button
                  type="button"
                  className="login-forgot-btn login-forgot-btn-cancel"
                  onClick={() => {
                    setShowVerificationModal(false);
                    setVerificationInput("");
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="login-forgot-btn login-forgot-btn-submit"
                  onClick={handleVerifyCode}
                  disabled={verificationInput.length !== 6}
                >
                  Verify
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Forgot Password Modal */}
      {showForgotPassword && (
        <div className="login-forgot-overlay">
          <div className="login-forgot-modal">
            <h3 className="login-forgot-title">Reset Password</h3>
            <p className="login-forgot-desc">
              Enter your email to receive a password reset link.
            </p>

            {resetSent ? (
              <div className="login-forgot-success">
                <p>Check your email for the reset link!</p>
                <button
                  className="login-forgot-btn login-forgot-btn-primary"
                  onClick={() => {
                    setShowForgotPassword(false);
                    setResetSent(false);
                    setResetEmail("");
                  }}
                >
                  Back to Login
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="login-forgot-form">
                <input
                  type="email"
                  placeholder="Enter your email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  required
                  className="login-forgot-input"
                  autoFocus
                />
                <div className="login-forgot-actions">
                  <button
                    type="button"
                    className="login-forgot-btn login-forgot-btn-cancel"
                    onClick={() => {
                      setShowForgotPassword(false);
                      setResetEmail("");
                      setResetSent(false);
                    }}
                    disabled={resetLoading}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="login-forgot-btn login-forgot-btn-submit"
                    disabled={resetLoading}
                  >
                    {resetLoading ? "Sending..." : "Send Reset Link"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}