import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { auth, provider, db } from "../firebase/firebase";
import {
  signInWithPopup,
  signInWithEmailAndPassword,
  signInWithRedirect,
  getRedirectResult,
  type User,
  deleteUser,
  sendPasswordResetEmail,
} from "firebase/auth";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  updateDoc,
} from "firebase/firestore";
import { toast } from "react-toastify";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEye } from "@fortawesome/free-solid-svg-icons";

// Define allowed status values
type UserStatus = "email_pending" | "pending" | "approved" | "rejected";

// User document structure from Firestore
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

// Updated Props: Accepts prefilledEmail
export default function LoginForm({ 
  toggle, 
  prefilledEmail 
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

  // Toggle password visibility (temporary)
  const togglePasswordVisibility = () => {
    setShowPasswordTemp(true);
    setTimeout(() => setShowPasswordTemp(false), 1000);
  };

  // Auto-fill email if provided from Register
  useEffect(() => {
    if (prefilledEmail) {
      setIdentifier(prefilledEmail);
      localStorage.setItem("lastIdentifier", prefilledEmail);
    } else {
      // Fallback: load last used identifier
      const saved = localStorage.getItem("lastIdentifier");
      if (saved) setIdentifier(saved);
    }
  }, [prefilledEmail]);

  const [showForgotPassword, setShowForgotPassword] = useState(false);
const [resetEmail, setResetEmail] = useState("");
const [resetSent, setResetSent] = useState(false);
const [resetLoading, setResetLoading] = useState(false);



const handleForgotPassword = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!resetEmail || !resetEmail.includes("@")) {
    toast.error("Please enter a valid email address.");
    return;
  }

  setResetLoading(true);
  try {
    // Check if email exists in your Firestore users
    const q = query(collection(db, "IT_Supply_Users"), where("Email", "==", resetEmail));
    const snap = await getDocs(q);

    if (snap.empty) {
      toast.error("No account found with this email.");
      setResetLoading(false);
      return;
    }

    const userDoc = snap.docs[0].data();
    const status = userDoc.Status as UserStatus;

    if (status === "rejected") {
      toast.error("This account has been rejected. Contact admin.");
      setResetLoading(false);
      return;
    }

    if (status === "email_pending") {
      toast.error("Please verify your email first using the link sent during registration.");
      setResetLoading(false);
      return;
    }

    // Send password reset email via Firebase Auth
    await sendPasswordResetEmail(auth, resetEmail);
    setResetSent(true);
    toast.success("Password reset email sent! Check your inbox.");
  } catch (error: any) {
    console.error("Forgot password error:", error);
    if (error.code === "auth/user-not-found") {
      toast.error("No account found with this email.");
    } else {
      toast.error("Failed to send reset email. Try again.");
    }
  } finally {
    setResetLoading(false);
  }
};


  // Handle redirect result (Google Sign-In)
  useEffect(() => {
    (async () => {
      try {
        const result = await getRedirectResult(auth);
        if (!result) return;
        await postSignInChecks(result.user, true);
        toast.success(`Signed in with Google`);
        navigate(targetAfterLogin, { replace: true });
      } catch (e) {
        console.error("Redirect login error:", e);
      }
    })();
  }, [navigate, targetAfterLogin]);

  // Find user document by Auth UID
  const findUserDocByAuthUID = async (uid: string): Promise<ITSupplyUser | null> => {
    const q = query(collection(db, "IT_Supply_Users"), where("AuthUID", "==", uid));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;

    const docData = snapshot.docs[0].data();
    const id = snapshot.docs[0].id;

    if (!docData.Email || !docData.AuthUID || !docData.hasOwnProperty("Status")) {
      console.warn("Invalid user document:", { id, ...docData });
      return null;
    }

    const validStatuses: UserStatus[] = ["email_pending", "pending", "approved", "rejected"];
    const status = docData.Status as string;
    if (!validStatuses.includes(status as UserStatus)) {
      console.warn("Invalid Status:", status);
      return null;
    }

    return {
      id,
      Email: docData.Email,
      Username: docData.Username,
      FirstName: docData.FirstName,
      LastName: docData.LastName,
      MiddleInitial: docData.MiddleInitial,
      Position: docData.Position,
      Department: docData.Department || "",
      Status: status as UserStatus,
      EmailVerified: docData.EmailVerified ?? false,
      CreatedAt: docData.CreatedAt || new Date(),
      AuthUID: docData.AuthUID,
      IDPictureBase64: docData.IDPictureBase64,
    };
  };

  // Centralized post-login checks
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
      toast.error(isGoogle
        ? "Google account not registered in system."
        : "Account not found in system."
      );
      throw new Error("unregistered-user");
    }

    if (userDoc.Status === "email_pending") {
      const userRef = doc(db, "IT_Supply_Users", userDoc.id);
      await updateDoc(userRef, { Status: "pending", EmailVerified: true });
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

  // Handle Email/Username + Password Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier || !password) {
      toast.error("Please fill in all fields.");
      return;
    }

    try {
      let emailToLogin = identifier;
      localStorage.setItem("lastIdentifier", identifier);

      if (!identifier.includes("@")) {
        const q = query(collection(db, "IT_Supply_Users"), where("Username", "==", identifier));
        const snap = await getDocs(q);
        if (snap.empty) {
          toast.error("Username not found.");
          return;
        }
        emailToLogin = snap.docs[0].data().Email;
      }

      const userCredential = await signInWithEmailAndPassword(auth, emailToLogin, password);
      await postSignInChecks(userCredential.user, false);
      toast.success(`Welcome, ${emailToLogin}!`);
      navigate(targetAfterLogin, { replace: true });
    } catch (error: any) {
      if ([
        "missing-email",
        "unregistered-user",
        "awaiting-approval",
        "not-approved"
      ].includes(error.message)) {
        return;
      }
      console.error("Login error:", error);
      toast.error("Invalid username/email or password.");
    }
  };

  // Handle Google Sign-In
  const handleGoogleSignIn = async () => {
    try {
      const result = await signInWithPopup(auth, provider);
      try {
        await postSignInChecks(result.user, true);
        toast.success("Signed in with Google!");
        navigate(targetAfterLogin, { replace: true });
      } catch (err) {
        try {
          await deleteUser(result.user);
          console.log("Deleted unauthorized Google account:", result.user.email);
        } catch (delErr) {
          console.warn("Failed to delete account:", delErr);
        }
      }
    } catch (e: any) {
      if (
        e?.code === "auth/popup-blocked" ||
        e?.code === "auth/operation-not-supported-in-this-environment" ||
        e?.code === "auth/unauthorized-domain"
      ) {
        await signInWithRedirect(auth, provider);
        return;
      }
      if (![
        "unregistered-user",
        "awaiting-approval",
        "not-approved"
      ].some(msg => e?.message?.includes(msg))) {
        console.error("Google Sign-In error:", e);
        toast.error("Google Sign-In failed.");
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

        <button className="login-button" type="submit">
          Sign In
        </button>
     <div style={{ 
  display: 'flex', 
  justifyContent: 'flex-end', 
  margin: '0.5rem 0 1rem' 
}}>
  <span
    onClick={() => {
      setShowForgotPassword(true);
      setResetEmail(identifier || ''); // Auto-fill email if exists
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