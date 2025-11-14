"use client";

import { useState, useEffect } from "react";
import {
  addDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { db, auth } from "../firebase/firebase";
import emailjs from "@emailjs/browser";
import { toast } from "react-toastify";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEye } from "@fortawesome/free-solid-svg-icons";

const EMAILJS_PUBLIC_KEY = "oiiPTVJU2reQ831XC";
const EMAILJS_SERVICE_ID = "service_nb6i81u";
const EMAILJS_TEMPLATE_ID = "template_6qph2gb";

/* ---------- VALIDATION HELPERS ---------- */
const validatePassword = (pwd: string) => {
  const e: string[] = [];
  if (pwd.length < 8) e.push("At least 8 characters");
  if (!/[A-Z]/.test(pwd)) e.push("Include uppercase letter");
  if (!/[a-z]/.test(pwd)) e.push("Include lowercase letter");
  if (!/\d/.test(pwd)) e.push("Include numeric character");
  return e;
};

const validateMiddleInitial = (v: string) =>
  !v ? null : v.length > 1 ? "1 letter only" : /^[A-Za-z]$/.test(v) ? null : "Letter only";

const validateContact = (n: string) => {
  const clean = n.replace(/\D/g, "");
  if (!clean) return "Required";
  if (clean.length !== 11) return "Exactly 11 digits";
  if (!/^09/.test(clean)) return "Must start with 09";
  return null;
};

/* ---------- COMPRESS IMAGE ---------- */
const compressImage = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = (e) => {
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);

    img.onload = () => {
      const canvas = document.createElement("canvas");
      const MAX = 800; // max width/height
      let { width, height } = img;
      if (width > height && width > MAX) {
        height = (height * MAX) / width;
        width = MAX;
      } else if (height > MAX) {
        width = (width * MAX) / height;
        height = MAX;
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, width, height);

      // quality 0.75 → < 1 MB guaranteed
      resolve(canvas.toDataURL("image/jpeg", 0.75));
    };
    img.onerror = reject;
  });

export default function RegisterForm({ toggle }: { toggle: () => void }) {
  /* ---------- FORM STATE ---------- */
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [middleInitial, setMiddleInitial] = useState("");
  const [position, setPosition] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [idPicture, setIdPicture] = useState<File | null>(null);
  const [role, setRole] = useState<"Medical" | "IT" | null>(null);

  const passwordErrors = validatePassword("");
  const contactError = validateContact(contactNumber);
  const miError = validateMiddleInitial(middleInitial);

  /* ---------- LOAD ROLE FROM LOCAL storage ---------- */
  useEffect(() => {
    const r = localStorage.getItem("registerRole") as "Medical" | "IT" | null;
    if (r) setRole(r);
  }, []);

  /* ---------- CONTACT INPUT (numeric only) ---------- */
  const onContactChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.replace(/\D/g, "").slice(0, 11);
    setContactNumber(v);
  };

  /* ---------- MIDDLE INITIAL (1 uppercase) ---------- */
  const onMIChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.toUpperCase().slice(0, 1);
    setMiddleInitial(e.target.value.toUpperCase().slice(0, 1));
  };

  /* ---------- SUBMIT ---------- */
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (contactError) return toast.error(contactError);
    if (!idPicture) return toast.error("ID picture required");
    if (miError) return toast.error(miError);

    try {
      // ---- uniqueness checks ----
      const [emailSnap, userSnap] = await Promise.all([
        getDocs(query(collection(db, "IT_Supply_Users"), where("Email", "==", email))),
        getDocs(query(collection(db, "IT_Supply_Users"), where("Username", "==", username))),
      ]);
      if (!emailSnap.empty) return toast.error("Email already used");
      if (!userSnap.empty) return toast.error("Username already used");

      toast.info("Creating account…");

      // ---- temp password ----
      const tempPwd = Math.random().toString(36).slice(-8);

      // ---- auth user ----
      const cred = await createUserWithEmailAndPassword(auth, email, tempPwd);

      // ---- compress & base64 ----
      const base64 = await compressImage(idPicture);

      // ---- save to Firestore ----
      await addDoc(collection(db, "IT_Supply_Users"), {
        AuthUID: cred.user.uid,
        Email: email,
        Username: username,
        FirstName: firstName,
        LastName: lastName,
        MiddleInitial: middleInitial,
        Position: position,
        ContactNumber: contactNumber,
        Department: "",
        Status: "approved",
        ActivationStatus: "pending",
        CreatedAt: serverTimestamp(),
        IDPictureBase64: base64, // ← ALWAYS has data:image/jpeg;base64,
      });

      // ---- send email ----
      emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });
      const expire = new Date(Date.now() + 30 * 60 * 1000);
      await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
        to_email: email,
        passcode: tempPwd,
        time: expire.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true }),
        login_url: window.location.origin,
        first_name: firstName,
      });

      toast.success("Temporary password sent!");
      toggle();
    } catch (err: any) {
      console.error(err);
      toast.error(err.code?.includes("email-already") ? "Email already in use" : err.message ?? "Failed");
    }
  };

  /* ---------- UI ---------- */
  return (
    <div className="form-card">
      <div className="login-head">
        <h2>Create an Account</h2>
      </div>

      <form onSubmit={handleRegister}>
        {/* Username */}
        <label>Username</label>
        <input
          type="text"
          placeholder="Username"
          required
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />

        {/* First / Middle */}
        <div className="register-row">
          <div>
            <label>First Name</label>
            <input
              type="text"
              placeholder="First Name"
              required
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
          </div>
          <div>
            <label>Middle Initial</label>
            <input
              type="text"
              placeholder="M.I."
              maxLength={1}
              value={middleInitial}
              onChange={onMIChange}
            />
            {miError && <p className="text-red-600 text-xs">{miError}</p>}
          </div>
        </div>

        {/* Last / Position */}
        <div className="register-row">
          <div>
            <label>Last Name</label>
            <input
              type="text"
              placeholder="Last Name"
              required
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </div>
          <div>
            <label>Position</label>
            <select required value={position} onChange={(e) => setPosition(e.target.value)}>
              <option value="" disabled>
                Position
              </option>
              {role === "Medical" ? (
                <>
                  <option value="Clinical">Clinical</option>
                  <option value="Radiology">Radiology</option>
                  <option value="Dental">Dental</option>
                  <option value="DDE">DDE</option>
                </>
              ) : (
                <>
                  <option value="Supply Unit">Supply Unit</option>
                  <option value="IT Personnel">IT Personnel</option>
                </>
              )}
            </select>
          </div>
        </div>

        {/* Contact */}
<label className="form-label">Contact Number</label>
<input
  type="text"
  placeholder="09171234567"
  required
  value={contactNumber}
  onChange={onContactChange}
  maxLength={11}
  className="form-input"
/>
{contactError && (
  <p className="form-error">{contactError}</p>
)}
        {/* Email */}
        <label>Email for Verification</label>
        <input
          type="email"
          placeholder="email@example.com"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        {/* ID Picture */}
        <label>ID Picture (max 1 MB)</label>
        {idPicture && (
        <button
  type="button"
  className="preview-btn"
  onClick={() => {
    const url = URL.createObjectURL(idPicture);
    const win = window.open();
    win?.document.write(
      `<html>
         <head><title>ID Preview</title></head>
         <body style="margin:0;background:#111;display:flex;align-items:center;justify-content:center;height:100vh;overflow:hidden;">
           <img src="${url}" style="max-width:98%;max-height:98%;border-radius:8px;box-shadow:0 8px 32px rgba(0,0,0,0.5);"/>
         </body>
       </html>`
    );
  }}
>
  <FontAwesomeIcon icon={faEye} />
  Preview
</button>
        )}
        <input
          type="file"
          accept="image/*"
          required
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            if (!f) return setIdPicture(null);
            if (!f.type.startsWith("image/")) return toast.error("Image only");
            if (f.size > 1024 * 1024) return toast.error("≤ 1 MB");
            setIdPicture(f);
          }}
        />

        <button type="submit" className="login-button mt-4">
          Sign Up
        </button>
      </form>

      <div className="switch">
        Already have an account? <span onClick={toggle}>Login</span>
      </div>
    </div>
  );
}