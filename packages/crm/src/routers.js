import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage/LoginPage';
import ProfilePage from './pages/ProfilePage/ProfilePage';
import NotFound from './components/NotFound/NotFound';
import MainContainer from './components/MainContainer/MainContainer';
import ProtectedRoute from './components/ProtectedRoute/ProtectedRoute';
import EmployeeSchedulePage from "./pages/EmployeeSchedulePage/EmployeeSchedulePage";
import DepartmentsPage from "./pages/DepartmentsPage/DepartmentsPage";
import TypesPage from "./pages/TypesPage/TypesPage";
import RedisShiftsPage from "./pages/RedisShiftsPage/RedisShiftsPage";

const AppRouter = () => {
  return (
      <Routes>
          {/* Публичный маршрут */}
          <Route path="/login" element={
              <MainContainer showSidebar={false}>
                  <LoginPage/>
              </MainContainer>
          }/>

          {/* Редирект с корня на dashboard */}
          <Route path="/" element={<Navigate to="/dashboard" replace/>}/>

          {/* Защищённые маршруты */}
          <Route path="/dashboard" element={
              <ProtectedRoute>
                  <MainContainer>
                      <div>Dashboard</div>
                  </MainContainer>
              </ProtectedRoute>
          }/>

          <Route path="/profile" element={
              <ProtectedRoute>
                  <MainContainer>
                      <ProfilePage/>
                  </MainContainer>
              </ProtectedRoute>
          }/>

          <Route path='/shifts' element={
              <ProtectedRoute>
                  <MainContainer>
                      <EmployeeSchedulePage/>
                  </MainContainer>
              </ProtectedRoute>
          }/>

          <Route path='/departments' element={
              <ProtectedRoute>
                  <MainContainer>
                      <DepartmentsPage/>
                  </MainContainer>
              </ProtectedRoute>
          }/>

          <Route path='/types' element={
              <ProtectedRoute>
                  <MainContainer>
                      <TypesPage/>
                  </MainContainer>
              </ProtectedRoute>
          }/>

          <Route path='/pool' element={
              <ProtectedRoute>
                  <MainContainer>
                      <RedisShiftsPage/>
                  </MainContainer>
              </ProtectedRoute>
          }/>

          {/* 404 */}
          <Route path="*" element={
              <MainContainer showSidebar={false}>
                  <NotFound/>
              </MainContainer>
          }/>
      </Routes>
  );
};

export default AppRouter;
