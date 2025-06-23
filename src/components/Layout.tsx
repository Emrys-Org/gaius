import Footer from './Footer'
import Navbar from './Navbar'
import { Outlet } from 'react-router'

export function MainLayout() {
  return (
    <>
      <Navbar />
      <main>
        <Outlet />
      </main>
      <Footer />
    </>
  )
}

export function MinimalLayout() {
  return <Outlet />
}
