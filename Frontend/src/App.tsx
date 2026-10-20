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
import DiscoveryLayout from './Components/Discovery/DiscoveryLayout';
import EventsListing from './Components/Discovery/EventsListing';
import EventDetail from './Components/Discovery/EventDetail';
import NotFound from './Components/Discovery/NotFound';
import ScrollToRoute from './Components/Discovery/ScrollToRoute';
import SavedEventsProvider from './Components/Discovery/SavedEventsProvider';
import SessionProvider from './Components/Auth/SessionProvider';
import ProfileLayout from './Components/Profile/ProfileLayout';
import ProfileDetails from './Components/Profile/ProfileDetails';
import AccountSettings from './Components/Profile/AccountSettings';
import BookingProvider from './Components/Booking/BookingProvider';
import TicketSelection from './Components/Booking/TicketSelection';
import Cart from './Components/Booking/Cart';
import Checkout from './Components/Booking/Checkout';
import VenueListPage from './Components/Admin/VenueListPage';
import VenueDetailPage from './Components/Admin/VenueDetailPage';
import { VenueAddPage, VenueEditPage } from './Components/Admin/VenueFormPage';
import OrderListPage from './Components/Admin/OrderListPage';
import OrderDetailPage from './Components/Admin/OrderDetailPage';
import TicketListPage from './Components/Admin/TicketListPage';
import TicketDetailPage from './Components/Admin/TicketDetailPage';

function App() {
  return(
    <PreferencesProvider>
      <SessionProvider>
      <SavedEventsProvider>
      <BookingProvider>
      <BrowserRouter>
        <ScrollToRoute />
        <Routes>
          <Route path='/' element={<Homepage/>}/>
          <Route element={<DiscoveryLayout />}>
            <Route path="/events" element={<EventsListing />} />
            <Route path="/events/:eventId" element={<EventDetail />} />
            <Route path="/events/:eventId/tickets" element={<TicketSelection />} />
            <Route path="/cart" element={<Cart />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/profile" element={<ProfileLayout />}>
              <Route index element={<ProfileDetails />} />
              <Route path="settings" element={<AccountSettings />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Route>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          {/* The backend redirects here after Google sign-in */}
          <Route path="/auth/callback" element={<AuthCallback />} />
          {/* Admin console: venues (add, edit, delete) */}
          <Route path="/admin/venues" element={<VenueListPage />} />
          <Route path="/admin/venues/new" element={<VenueAddPage />} />
          <Route path="/admin/venues/:venueId" element={<VenueDetailPage />} />
          <Route path="/admin/venues/:venueId/edit" element={<VenueEditPage />} />
          {/* Admin console: orders & tickets */}
          <Route path="/admin/orders" element={<OrderListPage />} />
          <Route path="/admin/orders/:orderId" element={<OrderDetailPage />} />
          <Route path="/admin/tickets" element={<TicketListPage />} />
          <Route path="/admin/tickets/:code" element={<TicketDetailPage />} />
        </Routes>
      </BrowserRouter>
      </BookingProvider>
      </SavedEventsProvider>
      </SessionProvider>
    </PreferencesProvider>
  )


}

export default App
