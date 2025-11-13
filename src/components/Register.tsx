// RegisterForm.tsx
import { useState } from "react";
import { db, auth } from "../firebase/firebase";
import { toast } from "react-toastify";
import {
  addDoc,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import {
  createUserWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEye } from "@fortawesome/free-solid-svg-icons";

// Helper: Convert file to Base64
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
};

export default function RegisterForm({ toggle }: { toggle: (email?: string) => void }) {
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [middleInitial, setMiddleInitial] = useState("");
  const [username, setUsername] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [idPicture, setIdPicture] = useState<File | null>(null);

  // Toggle password visibility (1 second)
  const togglePasswordVisibility = () => {
    setShowPassword(true);
    setTimeout(() => setShowPassword(false), 1000);
  };

  const toggleConfirmPasswordVisibility = () => {
    setShowConfirmPassword(true);
    setTimeout(() => setShowConfirmPassword(false), 1000);
  };

  // Validate Contact Number
  const validateContactNumber = (number: string): boolean => {
    const clean = number.replace(/\D/g, "");
    return /^09\d{9}$/.test(clean) && clean.length === 11;
  };

  // Strong Password Validation
  const validatePassword = (pwd: string): { isValid: boolean; message?: string } => {
    if (pwd.length < 8) {
      return { isValid: false, message: "Password must be at least 8 characters long." };
    }
    if (!/[A-Z]/.test(pwd)) {
      return { isValid: false, message: "Password must contain at least one uppercase letter." };
    }
    if (!/[a-z]/.test(pwd)) {
      return { isValid: false, message: "Password must contain at least one lowercase letter." };
    }
    if (!/[0-9]/.test(pwd)) {
      return { isValid: false, message: "Password must contain at least one number." };
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(pwd)) {
      return { isValid: false, message: "Password must contain at least one special character." };
    }
    return { isValid: true };
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate Contact Number
    if (!contactNumber) {
      toast.error("Contact Number is required.");
      return;
    }
    if (!validateContactNumber(contactNumber)) {
      toast.error("Contact Number must be 11 digits and start with 09.");
      return;
    }

    // Validate Password
    if (!password || !confirmPassword) {
      toast.error("Password is required.");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      toast.error(passwordValidation.message!);
      return;
    }

    try {
      // Check existing email
      const emailQuery = query(collection(db, "IT_Supply_Users"), where("Email", "==", email));
      const emailSnapshot = await getDocs(emailQuery);
      if (!emailSnapshot.empty) {
        toast.error("This email is already in use.");
        return;
      }

      // Check existing username
      const usernameQuery = query(collection(db, "IT_Supply_Users"), where("Username", "==", username));
      const usernameSnapshot = await getDocs(usernameQuery);
      if (!usernameSnapshot.empty) {
        toast.error("This username is already in use.");
        return;
      }

      // Check existing contact number
      const contactQuery = query(collection(db, "IT_Supply_Users"), where("ContactNumber", "==", contactNumber));
      const contactSnapshot = await getDocs(contactQuery);
      if (!contactSnapshot.empty) {
        toast.error("This contact number is already registered.");
        return;
      }

      toast.info("Creating account...");

      // Create Firebase Auth account
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      await updateProfile(user, {
        displayName: `${firstName} ${lastName}`,
      });

      // Convert image
      let idPicBase64 = "";
      if (idPicture) {
        idPicBase64 = await fileToBase64(idPicture);
      }

      // Save to Firestore
      await addDoc(collection(db, "IT_Supply_Users"), {
        Email: email,
        Username: username,
        FirstName: firstName,
        LastName: lastName,
        MiddleInitial: middleInitial || "",
        ContactNumber: contactNumber,
        Department: "",
        Status: "approved",
        CreatedAt: new Date(),
        AuthUID: user.uid,
        IDPictureBase64: idPicBase64 || null,
      });

      // SUCCESS: Show message & slide to Login
      toast.success("Account created! Please login.");

      // Clear form
      setEmail("");
      setFirstName("");
      setLastName("");
      setMiddleInitial("");
      setUsername("");
      setContactNumber("");
      setPassword("");
      setConfirmPassword("");
      setIdPicture(null);

      // Slide back to Login + Auto-fill email
      toggle(email);

    } catch (error: any) {
      console.error("Registration error:", error);
      if (error.code === "auth/email-already-in-use") {
        toast.error("This email is already registered.");
      } else if (error.code === "auth/weak-password") {
        toast.error("Password is too weak. Follow the requirements.");
      } else {
        toast.error("Failed to register. Please try again.");
      }
    }
  };

  return (
    <div className="form-card">
      <div className="login-head">
        <h2>Create an Account</h2>
      </div>

      <form onSubmit={handleRegister}>
        {/* First Name + Last Name */}
        <div className="register-row">
          <div>
            <label>First Name</label>
            <input
              type="text"
              placeholder="First Name"
              value={firstName}
              required
              onChange={(e) => setFirstName(e.target.value)}
            />
          </div>
          <div>
            <label>Last Name</label>
            <input
              type="text"
              placeholder="Last Name"
              value={lastName}
              required
              onChange={(e) => setLastName(e.target.value)}
            />
          </div>
        </div>

        {/* Middle Initial + Username */}
        <div className="register-row">
          <div>
            <label>Middle Initial</label>
            <input
              type="text"
              placeholder="M.I."
              value={middleInitial}
              onChange={(e) => setMiddleInitial(e.target.value)}
            />
          </div>
          <div>
            <label>Username</label>
            <input
              type="text"
              placeholder="Enter username"
              value={username}
              required
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
        </div>

        {/* Contact Number */}
        <label>Contact Number</label>
        <input
          type="text"
          placeholder="e.g., 09123456789"
          value={contactNumber}
          required
          maxLength={11}
          onChange={(e) => {
            const value = e.target.value.replace(/\D/g, "").slice(0, 11);
            setContactNumber(value);
          }}
          style={{ fontFamily: "monospace", letterSpacing: "1px" }}
        />
        

        {/* Email */}
        <label>Email</label>
        <input
          type="email"
          placeholder="Enter your email"
          value={email}
          required
          onChange={(e) => setEmail(e.target.value)}
        />

        {/* Password with Eye Icon */}
        <label>Password</label>
        <div className="password-wrapper">
          <input
            type={showPassword ? "text" : "password"}
            placeholder="Create password"
            value={password}
            required
            onChange={(e) => setPassword(e.target.value)}
          />
          <span className="eye-icon" onClick={togglePasswordVisibility}>
            <FontAwesomeIcon icon={faEye} />
          </span>
        </div>
        <small style={{ color: "#007BFF", fontSize: "12px", marginTop: "-10px", display: "block" }}>
          At least 8 chars • 1 uppercase • 1 lowercase • 1 number • 1 special char
        </small>

        {/* Confirm Password */}
        <label>Confirm Password</label>
        <div className="password-wrapper">
          <input
            type={showConfirmPassword ? "text" : "password"}
            placeholder="Confirm password"
            value={confirmPassword}
            required
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
          <span className="eye-icon" onClick={toggleConfirmPasswordVisibility}>
            <FontAwesomeIcon icon={faEye} />
          </span>
        </div>

        {/* ID Picture (Optional) */}
        <label>ID Picture (Optional)</label>
        {idPicture && (
          <button
            type="button"
            style={{
              margin: "8px 0",
              padding: "6px 12px",
              backgroundColor: "#007BFF",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "14px",
            }}
            onClick={() => {
              const imageUrl = URL.createObjectURL(idPicture);
              const win = window.open();
              if (win) {
                win.document.write(`
                  <html>
                    <head><title>ID Preview</title></head>
                    <body style="margin:0;background:#000;display:flex;justify-content:center;align-items:center;height:100vh;">
                      <img src="${imageUrl}" style="max-width:100%;max-height:100%;object-fit:contain;" />
                    </body>
                  </html>
                `);
              }
            }}
          >
            Preview Image
          </button>
        )}
        <input
          type="file"
          accept="image/*"
          onChange={(e) => {
            const file = e.target.files?.[0] || null;
            if (!file) {
              setIdPicture(null);
              return;
            }
            if (!file.type.startsWith("image/")) {
              toast.error("Only image files are allowed.");
              e.target.value = "";
              setIdPicture(null);
              return;
            }
            if (file.size > 1024 * 1024) {
              toast.error("Image must be under 1MB.");
              e.target.value = "";
              setIdPicture(null);
              return;
            }
            setIdPicture(file);
          }}
        />

        {/* Submit */}
        <button type="submit" className="login-button">
          Register
        </button>
      </form>

      <div className="switch">
        Already have an account? <span onClick={() => toggle()}>Login</span>
      </div>
    </div>
  );
}