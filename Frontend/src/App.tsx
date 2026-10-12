import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './App.css'
import Homepage from './Components/Homepage/Homepage';
import PreferencesProvider from './Components/Auth/PreferencesProvider';
import Login from './Components/LoginPage/Login'
import Register from './Components/RegisterPage/Register';
import VerifyEmail from './Components/VerifyEmailPage/VerifyEmail';
import ForgotPassword from './Components/ForgotPasswordPage/ForgotPassword';
import ResetPassword from './Components/ResetPasswordPage/ResetPassword';
import AuthCallback from './Components/AuthCallbackPage/AuthCallback';

function App() {
  return(
    <PreferencesProvider>
      <BrowserRouter>
        <Routes>
          <Route path='/' element={<Homepage/>}/>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          {/* The backend redirects here after Google sign-in */}
          <Route path="/auth/callback" element={<AuthCallback />} />
        </Routes>
      </BrowserRouter>
    </PreferencesProvider>
  )


}

export default App
