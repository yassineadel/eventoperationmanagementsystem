import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { lazy, Suspense } from 'react';
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
import RequireAdmin from './Components/Admin/RequireAdmin';
import TicketsProvider from './Components/Tickets/TicketsProvider';
import Chatbot from './Components/Chatbot/Chatbot';
const EventsListing = lazy(() => import('./Components/Discovery/EventsListing'));
const EventDetail = lazy(() => import('./Components/Discovery/EventDetail'));
const Confirmation = lazy(() => import('./Components/Tickets/Confirmation'));
const MyTickets = lazy(() => import('./Components/Tickets/MyTickets'));
const TicketDetail = lazy(() => import('./Components/Tickets/TicketDetail'));
const TransferTicket = lazy(() => import('./Components/Tickets/TransferTicket'));
const RefundRequest = lazy(() => import('./Components/Tickets/RefundRequest'));
// The admin console loads only behind RequireAdmin, so customers never download it.
const AdminHomePage = lazy(() => import('./Components/Admin/AdminHomePage'));
const VenueListPage = lazy(() => import('./Components/Admin/VenueListPage'));
const VenueDetailPage = lazy(() => import('./Components/Admin/VenueDetailPage'));
const VenueAddPage = lazy(() => import('./Components/Admin/VenueFormPage').then((m) => ({ default: m.VenueAddPage })));
const VenueEditPage = lazy(() => import('./Components/Admin/VenueFormPage').then((m) => ({ default: m.VenueEditPage })));
const OrderListPage = lazy(() => import('./Components/Admin/OrderListPage'));
const OrderDetailPage = lazy(() => import('./Components/Admin/OrderDetailPage'));
const TicketListPage = lazy(() => import('./Components/Admin/TicketListPage'));
const TicketDetailPage = lazy(() => import('./Components/Admin/TicketDetailPage'));
const RefundRequestsPage = lazy(() => import('./Components/Admin/RefundRequestsPage'));
const EventListPage = lazy(() => import('./Components/Admin/EventListPage'));
const EventDetailPage = lazy(() => import('./Components/Admin/EventDetailPage'));
const EventAddPage = lazy(() => import('./Components/Admin/EventFormPage').then((m) => ({ default: m.EventAddPage })));
const EventEditPage = lazy(() => import('./Components/Admin/EventFormPage').then((m) => ({ default: m.EventEditPage })));
const EventTicketsPage = lazy(() => import('./Components/Admin/EventTicketsPage'));
const UserListPage = lazy(() => import('./Components/Admin/UserListPage'));
const UserDetailPage = lazy(() => import('./Components/Admin/UserDetailPage'));
// The admin console (reads and writes the real database). Loaded only when an admin opens it.
const ConsoleLayout = lazy(() => import('./Components/Console/ConsoleLayout'));
const DashboardPage = lazy(() => import('./Components/Console/DashboardPage'));
const ConsoleEvents = lazy(() => import('./Components/Console/EventsPage'));
const ConsoleEvent = lazy(() => import('./Components/Console/EventPage'));
const ConsoleEventForm = lazy(() => import('./Components/Console/EventFormPage'));
const ConsoleOrders = lazy(() => import('./Components/Console/OrdersPages').then((m) => ({ default: m.OrdersPage })));
const ConsoleOrder = lazy(() => import('./Components/Console/OrdersPages').then((m) => ({ default: m.OrderPage })));
const ConsoleTickets = lazy(() => import('./Components/Console/TicketsPages').then((m) => ({ default: m.TicketsPage })));
const ConsoleTicket = lazy(() => import('./Components/Console/TicketsPages').then((m) => ({ default: m.TicketPage })));
const ConsoleRefunds = lazy(() => import('./Components/Console/RefundsPage'));
const ConsoleUsers = lazy(() => import('./Components/Console/UsersPages').then((m) => ({ default: m.UsersPage })));
const ConsoleUser = lazy(() => import('./Components/Console/UsersPages').then((m) => ({ default: m.UserPage })));
const ConsoleVenues = lazy(() => import('./Components/Console/VenuesPages').then((m) => ({ default: m.VenuesPage })));
const ConsoleVenue = lazy(() => import('./Components/Console/VenuesPages').then((m) => ({ default: m.VenuePage })));
const ConsoleVenueForm = lazy(() => import('./Components/Console/VenuesPages').then((m) => ({ default: m.VenueFormPage })));
const ConsoleStaff = lazy(() => import('./Components/Console/StaffActivityPages').then((m) => ({ default: m.StaffPage })));
const ConsoleActivity = lazy(() => import('./Components/Console/StaffActivityPages').then((m) => ({ default: m.ActivityPage })));

// The customer help chat stays off the admin console.
function CustomerChatbot() {
  const { pathname } = useLocation();
  return pathname.startsWith('/admin') ? null : <Chatbot />;
}

function App() {
  return(
    <PreferencesProvider>
      <SessionProvider>
      <SavedEventsProvider>
      <BookingProvider>
      <TicketsProvider>
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
            <Route path="/orders/:orderRef/confirmation" element={<Confirmation />} />
            <Route path="/my-tickets" element={<MyTickets />} />
            <Route path="/my-tickets/:ticketId" element={<TicketDetail />} />
            <Route path="/my-tickets/:ticketId/transfer" element={<TransferTicket />} />
            <Route path="/my-tickets/:ticketId/refund" element={<RefundRequest />} />
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
          {/* Admin console: admins only, every page reads and writes the database */}
          <Route path="/admin" element={<Suspense fallback={null}><ConsoleLayout /></Suspense>}>
            <Route index element={<DashboardPage />} />
            <Route path="events" element={<ConsoleEvents />} />
            <Route path="events/new" element={<ConsoleEventForm />} />
            <Route path="events/:eventId" element={<ConsoleEvent />} />
            <Route path="events/:eventId/edit" element={<ConsoleEventForm />} />
            <Route path="orders" element={<ConsoleOrders />} />
            <Route path="orders/:orderId" element={<ConsoleOrder />} />
            <Route path="tickets" element={<ConsoleTickets />} />
            <Route path="tickets/:ticketId" element={<ConsoleTicket />} />
            <Route path="refunds" element={<ConsoleRefunds />} />
            <Route path="users" element={<ConsoleUsers />} />
            <Route path="users/:userId" element={<ConsoleUser />} />
            <Route path="venues" element={<ConsoleVenues />} />
            <Route path="venues/new" element={<ConsoleVenueForm />} />
            <Route path="venues/:slug" element={<ConsoleVenue />} />
            <Route path="venues/:slug/edit" element={<ConsoleVenueForm />} />
            <Route path="staff" element={<ConsoleStaff />} />
            <Route path="activity" element={<ConsoleActivity />} />
          </Route>
          {/* The first admin console design (sample data), kept for reference */}
          <Route path="/admin-preview" element={<RequireAdmin />}>
            <Route index element={<AdminHomePage />} />
            <Route path="events" element={<EventListPage />} />
            <Route path="events/new" element={<EventAddPage />} />
            <Route path="events/:eventId" element={<EventDetailPage />} />
            <Route path="events/:eventId/edit" element={<EventEditPage />} />
            <Route path="events/:eventId/tickets" element={<EventTicketsPage />} />
            <Route path="venues" element={<VenueListPage />} />
            <Route path="venues/new" element={<VenueAddPage />} />
            <Route path="venues/:venueId" element={<VenueDetailPage />} />
            <Route path="venues/:venueId/edit" element={<VenueEditPage />} />
            <Route path="orders" element={<OrderListPage />} />
            <Route path="orders/:orderId" element={<OrderDetailPage />} />
            <Route path="tickets" element={<TicketListPage />} />
            <Route path="tickets/:code" element={<TicketDetailPage />} />
            <Route path="refunds" element={<RefundRequestsPage />} />
            <Route path="users" element={<UserListPage />} />
            <Route path="users/:userId" element={<UserDetailPage />} />
          </Route>
        </Routes>
        <CustomerChatbot />
      </BrowserRouter>
      </TicketsProvider>
      </BookingProvider>
      </SavedEventsProvider>
      </SessionProvider>
    </PreferencesProvider>
  )


}

export default App
