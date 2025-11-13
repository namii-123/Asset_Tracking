// App.tsx
 
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import AuthPage from './components/authpage';
import Dashboard from './components/assetmanagement/Dashboard';
import AssetManagement  from './components/assetmanagement/AssetManagement';



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
          
            <Route path="/" element={<AuthPage />} />

            {/* Protected routes */}
            <Route element={<RequireAuth />}>

              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/assets" element={<AssetManagement />} />
             
            
              <Route path="/deleted-assets" element={<DeletedAssets />} />
              
            </Route>
          </Routes>

        
          <ToastContainer position="top-center" autoClose={2000} hideProgressBar={false} closeButton={false} pauseOnHover closeOnClick/>
        </div>
      </SearchProvider>
    </Router>
  );
};

export default App;
