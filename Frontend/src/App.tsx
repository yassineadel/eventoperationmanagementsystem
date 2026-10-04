import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './App.css'
import Login from './Components/LoginPage/Login'
import Homepage from './Components/Homepage/Homepage';

function App() {
  return(
    <BrowserRouter>
      <Routes>
        <Route path='/' element={<Homepage/>}/>
        <Route path="/Login" element={<Login />} />
      </Routes>
    </BrowserRouter>
  )
 
  
}

export default App
