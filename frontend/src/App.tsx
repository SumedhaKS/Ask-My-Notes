import './App.css'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import Signup from './pages/Signup'
import Signin from './pages/Signin'
import ChatApp from './pages/ChatApp'
import { healthChecker } from './lib/health_check_service'
import { useEffect } from 'react'

function App() {
  useEffect(() => {
    healthChecker()
  }, [])

  return (
    <BrowserRouter>
      <Routes>
        <Route path='*' element={<Signin />} />
        <Route path='/signup' element={<Signup />} />
        <Route path='/signin' element={<Signin />} />
        <Route path='/chat' element={<ChatApp />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
