// App.tsx

import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import AuthPage from './components/authpage';
import Dashboard from './components/assetmanagement/Dashboard';
import AssetManagement  from './components/assetmanagement/AssetManagement';



import DashboardSuperAdmin from './components/superadmin/DashboardSuperAdmin';
import Profile from './components/superadmin/Profile';
import Supply from './components/superadmin/Supply';
import ClinicalLab from './components/superadmin/ClinicalLab';
import Radiology from './components/superadmin/Radiology';
import Dental from './components/superadmin/Dental';
import DDE from './components/superadmin/DDE';
import Notifications from './components/superadmin/Notifications';
import VerifyAccount from "./components/Verification";
import Trial from './components/superadmin/trial';
import RequireAuth from "./components/RequireAuth";
import DeletedAssets from './components/assetmanagement/DeletedAssets';

import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
// App.tsx
import initEmailJS from './utils/emailjs';

initEmailJS(); 

import { SearchProvider } from "./context/SearchContext";

const App: React.FC = () => {
  return (
    <Router>
      
      <SearchProvider>
        <div className="App">
          <Routes>
            <Route path="/verify-account" element={<VerifyAccount />} />
            <Route path="/" element={<AuthPage />} />

            {/* Protected routes */}
            <Route element={<RequireAuth />}>

              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/assets" element={<AssetManagement />} />
             
              <Route path="/dashadmin" element={<DashboardSuperAdmin />} />
              <Route path="/deleted-assets" element={<DeletedAssets />} />
              <Route path="/profiled" element={<Profile />} /> 
              <Route path="/supply" element={<Supply />} />  
              <Route path="/clinical" element={<ClinicalLab />} /> 
              <Route path="/radiology" element={<Radiology />} /> 
              <Route path="/dental" element={<Dental />} /> 
              <Route path="/dde" element={<DDE />} /> 
              <Route path="/notif" element={<Notifications />} /> 
             
              <Route path="/trial" element={<Trial />} /> 
            </Route>
          </Routes>

        
          <ToastContainer position="top-center" autoClose={2000} hideProgressBar={false} closeButton={false} pauseOnHover closeOnClick/>
        </div>
      </SearchProvider>
    </Router>
  );
};

export default App;
