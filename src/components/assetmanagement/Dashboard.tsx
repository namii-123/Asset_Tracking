import React, { useEffect, useState, useMemo } from 'react';
import "../../assets/dashboard.css";
import "../../assets/notification.css";
import { Link, useNavigate } from 'react-router-dom';
import '@fortawesome/fontawesome-free/css/all.min.css';
import AssetManagement from './AssetManagement';
import { Package, PlusCircle, AlertCircle, FileBarChart2, QrCode, LogOut } from 'lucide-react';
import Requests from "./Requests";
import { signOut, updatePassword } from "firebase/auth";
import { auth, db } from "../../firebase/firebase";
import { toast } from "react-toastify";
import { useCurrentUserFullName } from "../../hooks/useCurrentUserFullName";
import SearchInput from './SearchInput';
import { onAuthStateChanged } from "firebase/auth";
import { getDoc, collection, query, where, getDocs, doc, updateDoc } from "firebase/firestore";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEye, faEyeSlash, faUser, faSpinner } from '@fortawesome/free-solid-svg-icons';

// Custom hook: Load profile picture safely
const useProfilePicture = () => {
  const [base64, setBase64] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setLoading(true);
      if (!user) {
        setBase64(null);
        setLoading(false);
        return;
      }

      try {
        const userDocRef = doc(db, "IT_Supply_Users", user.uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
          const raw = userDoc.data()?.IDPictureBase64 ?? null;

          if (raw) {
            if (raw.startsWith('data:image')) {
              setBase64(raw);
            } else if (/^\/9j/.test(raw) || /^iVBOR/.test(raw)) {
              setBase64(`data:image/jpeg;base64,${raw}`);
            } else {
              console.warn("Invalid base64 format");
              setBase64(null);
            }
          } else {
            setBase64(null);
          }
        } else {
          setBase64(null);
        }
      } catch (error) {
        console.error("Error fetching profile picture:", error);
        setBase64(null);
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
  }, []);

  // Create object URL only when base64 changes
  const pictureUrl = useMemo(() => {
    if (!base64) return null;
    try {
      const binary = atob(base64.split(',')[1]);
      const array = Uint8Array.from(binary, c => c.charCodeAt(0));
      const blob = new Blob([array], { type: 'image/jpeg' });
      return URL.createObjectURL(blob);
    } catch (e) {
      console.error("Failed to create blob URL:", e);
      return null;
    }
  }, [base64]);

  // Cleanup object URL
  useEffect(() => {
    return () => {
      if (pictureUrl) URL.revokeObjectURL(pictureUrl);
    };
  }, [pictureUrl]);

  return { pictureUrl, loading };
};

const Dashboard = () => {
  const { fullName, loading: nameLoading } = useCurrentUserFullName();
  const { pictureUrl, loading: picLoading } = useProfilePicture();

  const [currentView, setCurrentView] = useState<'dashboard' | 'qr' | 'generate' | 'requestsdata' | 'reports' | 'reports-analytics' | 'profile' | 'assets' | 'people' | 'request-consumables' | 'manage-consumable-requests'>('assets');
  const [activeView, setActiveView] = useState<'dashboard' | 'generate' | 'reports' | 'requestsdata' | 'reports-analytics' | 'qr' | 'profile' | 'assets' | 'people' | 'request-consumables' | 'manage-consumable-requests'>('assets');
  const [searchQuery, setSearchQuery] = useState('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showNotif, setShowNotif] = useState(false);
  const [notificationFilter, setNotificationFilter] = useState<'all' | 'unread'>('all');
  const [openOptionsId, setOpenOptionsId] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
  const [showSignOutModal, setShowSignOutModal] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const navigate = useNavigate();

  // Password validation
  const getPasswordErrors = (pwd: string): string[] => {
    const errors: string[] = [];
    if (pwd.length < 8) errors.push("At least 8 characters");
    if (!/[A-Z]/.test(pwd)) errors.push("Include uppercase letter");
    if (!/[a-z]/.test(pwd)) errors.push("Include lowercase letter");
    if (!/\d/.test(pwd)) errors.push("Include numeric character");
    return errors;
  };

  const passwordErrors = getPasswordErrors(newPassword);
  const toggleNewPasswordVisibility = () => setShowNewPassword(!showNewPassword);
  const toggleConfirmPasswordVisibility = () => setShowConfirmNewPassword(!showConfirmNewPassword);

  // Check activation status → show password modal if pending
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setShowChangePasswordModal(false);
        return;
      }
      try {
        const q = query(collection(db, "IT_Supply_Users"), where("AuthUID", "==", user.uid));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          const userData = snapshot.docs[0].data();
          setShowChangePasswordModal(userData.ActivationStatus === "pending");
        }
      } catch (error) {
        console.error("Error checking activation status:", error);
        setShowChangePasswordModal(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // Handle password change
  const handleChangePassword = async () => {
    if (passwordErrors.length > 0) {
      toast.error("Please fix password requirements.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }
    const user = auth.currentUser;
    if (!user) return;
    setIsUpdating(true);
    try {
      await updatePassword(user, newPassword);
      const q = query(collection(db, "IT_Supply_Users"), where("AuthUID", "==", user.uid));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const userRef = doc(db, "IT_Supply_Users", snapshot.docs[0].id);
        await updateDoc(userRef, { ActivationStatus: "completed" });
      }
      toast.success("Password updated successfully!");
      setShowChangePasswordModal(false);
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      console.error("Error updating password:", error);
      let msg = "Failed to update password.";
      if (error.code === "auth/weak-password") msg = "Password too weak.";
      else if (error.code === "auth/requires-recent-login") msg = "Session expired. Please log in again.";
      toast.error(msg);
    } finally {
      setIsUpdating(false);
    }
  };

  // Sign out
  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOut(auth);
      toast.info("Signed out");
      navigate("/", { replace: true });
    } catch (err) {
      console.error(err);
      toast.error("Sign out failed.");
    } finally {
      setSigningOut(false);
    }
  };

  // Notifications (mock)
  type Notification = {
    id: number;
    message: string;
    timestamp: string;
    isRead: boolean;
  };
  const [notifications] = useState<Notification[]>([
    { id: 1, message: 'License Expiring Soon', timestamp: '1h ago', isRead: false },
    { id: 2, message: 'New Asset Assigned', timestamp: '2d ago', isRead: true },
    { id: 3, message: 'Asset Maintenance Required', timestamp: '3h ago', isRead: false },
    { id: 4, message: 'Asset Deleted', timestamp: '5d ago', isRead: true },
    { id: 5, message: 'Warranty Expired', timestamp: '1w ago', isRead: false },
    { id: 6, message: 'New Meeting Scheduled', timestamp: '10m ago', isRead: false },
    { id: 7, message: 'System Update Reminder', timestamp: '2h ago', isRead: true },
  ]);

  const filteredNotifications = notifications.filter(n =>
    notificationFilter === 'all' ? true : !n.isRead
  );

  const toggleNotif = () => setShowNotif(!showNotif);
  const toggleReadStatus = (id: number) => { /* implement later */ };
  const handleDelete = (id: number) => { /* implement later */ };
  const handleOptionsToggle = (id: number) => {
    setOpenOptionsId(prev => (prev === id ? null : id));
  };

  const getIconClass = (message: string): string => {
    const lowerMsg = message.toLowerCase();
    if (lowerMsg.includes('profile')) return 'fas fa-user-circle';
    if (lowerMsg.includes('license')) return 'fas fa-id-badge';
    if (lowerMsg.includes('maintenance')) return 'fas fa-cogs';
    if (lowerMsg.includes('report')) return 'fas fa-file-alt';
    if (lowerMsg.includes('approval') || lowerMsg.includes('request')) return 'fas fa-check-circle';
    if (lowerMsg.includes('meeting')) return 'fas fa-users';
    return 'fas fa-info-circle';
  };

  const toggleSidebar = () => setSidebarCollapsed(!sidebarCollapsed);

  const navItems = [
    { title: "New Asset", category: "Asset" },
    { title: "New Accessory", category: "Accessory" },
    { title: "New Consumable", category: "Consumable" },
    { title: "New Component", category: "Component" },
  ];

  const dashboardData = {
    desktops: { total: 132, functional: 92, defective: 10, unserviceable: 30 },
    laptops: { total: 47, functional: 18, defective: 9, unserviceable: 20 },
    printers: { total: 50, functional: 40, defective: 5, unserviceable: 5 },
    servers: { total: 20, functional: 15, defective: 3, unserviceable: 2 },
    otherDevices: { total: 90, functional: 33, defective: 17, unserviceable: 40 },
    accessories: { total: 90, functional: 17, defective: 32, unserviceable: 41 },
    components: { total: 50, functional: 30, defective: 10, unserviceable: 10 },
    licenses: { total: 60, expiringIn1Month: 20, expiringIn2Months: 25, expiringIn3Months: 20 },
    consumables: { total: 200 },
    machineryEquipment: { total: 150 },
    functionalProperty: { total: 80 },
    insuredProperty: { total: 100 },
    defectiveProperty: { total: 60 },
    assignedCustodian: { total: 50 },
    unserviceableProperty: { total: 70 },
    otherTable: [{ category: 'People', users: 10, toApprove: 3 }],
    newItems: { asset: 5, licenses: 3, accessory: 2, consumable: 1, components: 5 },
  };

  const [showCards, setShowCards] = useState(false);
  const items = [
    { label: 'Consumables', total: dashboardData.consumables.total, icon: 'fas fa-tint', viewLink: 'consumables' },
    { label: 'Machinery & Equipment', total: dashboardData.machineryEquipment.total, icon: 'fas fa-building', viewLink: 'machineryEquipment' },
    { label: 'Functional Property', total: dashboardData.functionalProperty.total, icon: 'fas fa-box-open', viewLink: 'functionalProperty' },
    { label: 'Insured Property', total: dashboardData.insuredProperty.total, icon: 'fas fa-shield-alt', viewLink: 'insuredProperty' },
    { label: 'Defective Property', total: dashboardData.defectiveProperty.total, icon: 'fas fa-tools', viewLink: 'defectiveProperty' },
    { label: 'Assigned Custodian', total: dashboardData.assignedCustodian.total, icon: 'fas fa-user-shield', viewLink: 'assignedCustodian' },
    { label: 'Unserviceable Property', total: dashboardData.unserviceableProperty.total, icon: 'fas fa-exclamation-triangle', viewLink: 'unserviceableProperty' }
  ];

  return (
    <div className="dashboard-body">
      {/* Block interaction if password modal is open */}
      {showChangePasswordModal && (
        <div
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.7)',
            zIndex: 999,
            pointerEvents: 'auto',
          }}
          onClick={(e) => e.stopPropagation()}
        />
      )}

      <div className={`dashboard-container ${sidebarCollapsed ? 'collapsed' : ''}`}>
        <aside className="sidebar">
          <div className="sidebar-header">
            <div
              onClick={() => { setCurrentView('assets'); setActiveView('assets'); }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { setCurrentView('assets'); setActiveView('assets'); } }}
              style={{ cursor: 'pointer', display: 'inline-block' }}
              aria-label="Go to Asset Management"
            >
              <img className="dashboard-logos" src="/logosaproject.jpg" alt="DOH Logo" />
            </div>
            <div className="logo-doh">DOH-TRC Argao</div>
            <button className="toggle-sidebar-btns" onClick={toggleSidebar}>
              ☰
            </button>
          </div>
          <nav className="menu">
            <Link to="#" className={`menu-items ${activeView === 'assets' ? 'active' : ''}`}
              onClick={() => { setCurrentView('assets'); setActiveView('assets'); }}>
              <Package className="menu-icon" />
              <span>Asset Management</span>
            </Link>
            <Link to="#" className={`menu-items ${activeView === 'generate' ? 'active' : ''}`}
              onClick={() => { setCurrentView('generate'); setActiveView('generate'); }}>
              <PlusCircle className="menu-icon" />
              <span>Add Asset</span>
            </Link>
            <Link to="#" className={`menu-items ${activeView === 'request-consumables' ? 'active' : ''}`}
              onClick={() => { setCurrentView('request-consumables'); setActiveView('request-consumables'); navigate('/request-consumables'); }}>
              <i className="fas fa-boxes menu-icon"></i>
              <span>Request Consumables</span>
            </Link>
            <Link to="#" className={`menu-items ${activeView === 'reports' ? 'active' : ''}`}
              onClick={() => { setCurrentView('reports'); setActiveView('reports'); }}>
              <AlertCircle className="menu-icon" />
              <span>Reported Issues</span>
            </Link>
            <Link to="#" className={`menu-items ${activeView === 'reports-analytics' ? 'active' : ''}`}
              onClick={() => { setCurrentView('reports-analytics'); setActiveView('reports-analytics'); }}>
              <FileBarChart2 className="menu-icon" />
              <span>Reports / Analytics</span>
            </Link>
            <Link to="#" className={`menu-items ${activeView === 'qr' ? 'active' : ''}`}
              onClick={() => { setCurrentView('qr'); setActiveView('qr'); }}>
              <QrCode className="menu-icon" />
              <span>QR Scanner</span>
            </Link>
            <Link to="#" className="menu-items logout"
              onClick={(e) => { e.preventDefault(); setShowSignOutModal(true); }}
              aria-disabled={signingOut}>
              <LogOut className="menu-icon" />
              <span>Sign Out</span>
            </Link>
          </nav>
        </aside>

        <div className="main-content">
          <header className="main-header">
            {(currentView === 'reports' || currentView === 'assets') && <SearchInput placeholder="Search assets or personnel..." />}
            {currentView === 'dashboard' && <h2 className="asset-overview-heading">Dashboard Overview</h2>}
            {currentView === 'generate' && <h2 className="asset-overview-heading">Add Asset</h2>}
            {(currentView !== 'reports' && currentView !== 'assets' && currentView !== 'dashboard' && currentView !== 'generate') && <div style={{ width: '250px' }}></div>}

            <div className="user-info">
              <div
                className="profile-picture-circle"
                onClick={() => { setCurrentView('profile'); setActiveView('profile'); }}
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  overflow: 'hidden',
                  border: '2px solid #0d6efd',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#f5f5f5',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                }}
              >
                {picLoading ? (
                  <FontAwesomeIcon icon={faSpinner} spin style={{ color: '#999', fontSize: '18px' }} />
                ) : pictureUrl ? (
                  <img
                    src={pictureUrl}
                    alt="Profile"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      const icon = e.currentTarget.nextElementSibling as HTMLElement;
                      if (icon) icon.classList.remove('hidden');
                    }}
                  />
                ) : null}
                <FontAwesomeIcon
                  icon={faUser}
                  className="hidden"
                  style={{ fontSize: '20px', color: '#666' }}
                />
              </div>

              <span
                className="welcome-text"
                onClick={() => { setCurrentView('profile'); setActiveView('profile'); }}
                style={{ cursor: 'pointer' }}
              >
                {nameLoading ? "Loading..." : fullName || "User"}
              </span>
            </div>
          </header>

          <div className="content-here">
            {currentView === 'dashboard' && (
              <div className="table-content">
                {/* Your dashboard content here */}
              </div>
            )}
            {currentView === 'assets' && <AssetManagement />}
            {currentView === 'requestsdata' && <Requests />}
            {/* Add other views as needed */}
          </div>
        </div>
      </div>

      {/* CHANGE PASSWORD MODAL */}
      {showChangePasswordModal && (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="modal-content" style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', width: '420px', maxWidth: '90vw', boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <i className="fas fa-lock" style={{ fontSize: '36px', color: '#0d6efd' }}></i>
              <h3 style={{ margin: '12px 0 8px', fontSize: '18px' }}>Set Your Password (Required)</h3>
              <p style={{ color: '#666', fontSize: '14px', margin: 0 }}>Welcome! Please create a secure password to complete your account setup.</p>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500' }}>New Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter password"
                  style={{ width: '100%', padding: '10px 40px 10px 12px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }}
                  required
                />
                <span onClick={toggleNewPasswordVisibility} style={{ position: 'absolute', right: '12px', top: '35%', transform: 'translateY(-50%)', cursor: 'pointer', color: '#666', fontSize: '16px' }}>
                  <FontAwesomeIcon icon={showNewPassword ? faEyeSlash : faEye} />
                </span>
              </div>
              {newPassword && passwordErrors.length > 0 && (
                <div style={{ marginTop: '8px', fontSize: '12px', color: '#dc3545' }}>
                  {passwordErrors.map((err, i) => <div key={i}>• {err}</div>)}
                </div>
              )}
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500' }}>Confirm Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showConfirmNewPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm password"
                  style={{ width: '100%', padding: '10px 40px 10px 12px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }}
                  required
                />
                <span onClick={toggleConfirmPasswordVisibility} style={{ position: 'absolute', right: '12px', top: '35%', transform: 'translateY(-50%)', cursor: 'pointer', color: '#666', fontSize: '16px' }}>
                  <FontAwesomeIcon icon={showConfirmNewPassword ? faEyeSlash : faEye} />
                </span>
              </div>
              {confirmPassword && newPassword !== confirmPassword && (
                <p style={{ marginTop: '6px', fontSize: '12px', color: '#dc3545' }}>Passwords do not match.</p>
              )}
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={handleChangePassword}
                disabled={isUpdating || passwordErrors.length > 0 || newPassword !== confirmPassword}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#0d6efd',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  opacity: isUpdating || passwordErrors.length > 0 || newPassword !== confirmPassword ? 0.6 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                {isUpdating ? 'Updating...' : <>Set Password</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SIGN OUT MODAL */}
      {showSignOutModal && (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001 }}>
          <div className="modal-content" style={{ backgroundColor: 'white', padding: '24px', borderRadius: '8px', width: '380px', maxWidth: '90vw', textAlign: 'center' }}>
            <i className="fas fa-sign-out-alt" style={{ fontSize: '32px', color: '#dc3545', marginBottom: '16px' }}></i>
            <h3 style={{ margin: '0 0 16px' }}>Are you sure you want to sign out?</h3>
            <p style={{ color: '#666', fontSize: '14px', marginBottom: '20px' }}>You will be logged out of the system.</p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button onClick={() => setShowSignOutModal(false)} style={{ padding: '8px 16px', backgroundColor: '#ccc', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                Cancel
              </button>
              <button
                onClick={handleSignOut}
                disabled={signingOut}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  opacity: signingOut ? 0.6 : 1,
                }}
              >
                {signingOut ? 'Signing out...' : 'Sign Out'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;