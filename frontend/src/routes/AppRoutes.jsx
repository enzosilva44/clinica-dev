import { Navigate, Routes, Route } from "react-router-dom";

import Login from "../pages/Login";
import Dashboard from "../pages/Dashboard";
import Patients from "../pages/Patients";
import CreatePatient from "../pages/CreatePatient";
import PatientDetails from "../pages/PatientDetails";
import Agenda from "../pages/Agenda";
import Procedures from "../pages/Procedures";
import PrivateRoute from "./PrivateRoute";
import Products from "../pages/Products";
import Financeiro from "../pages/Financeiro";
import Clube from "../pages/Clube";
import Documents from "../pages/Documents";
import Analytics from "../pages/Relatorios";
import Faturamento from "../pages/Faturamento";
import EditPatient from "../pages/EditPatient";
import Automacoes from "../pages/Automacoes";
import LandingPage from "../pages/LandingPage";
import Register from "../pages/Register";
import Signup from "../pages/Signup";
import FeatureRoute from "./FeatureRoute";
import Settings from "../pages/Settings";

export default function AppRoutes() {
  return (
    <Routes>
      {/* ── Público ── */}
      <Route path="/"         element={<LandingPage />} />
      <Route path="/landing"  element={<LandingPage />} />
      <Route path="/login"    element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/cadastro" element={<Signup />} />

      {/* ── Sistema clínica ── */}
      <Route path="/dashboard"         element={<PrivateRoute><Dashboard /></PrivateRoute>} />
      <Route path="/patients"          element={<PrivateRoute><Patients /></PrivateRoute>} />
      <Route path="/patients/create"   element={<PrivateRoute><CreatePatient /></PrivateRoute>} />
      <Route path="/patients/:id"      element={<PrivateRoute><PatientDetails /></PrivateRoute>} />
      <Route path="/patients/:id/edit" element={<PrivateRoute><EditPatient /></PrivateRoute>} />
      <Route path="/agenda"            element={<PrivateRoute><Agenda /></PrivateRoute>} />
      <Route path="/products"          element={<PrivateRoute><FeatureRoute feature="stock"><Products /></FeatureRoute></PrivateRoute>} />
      <Route path="/procedures"        element={<PrivateRoute><Procedures /></PrivateRoute>} />
      <Route path="/financeiro"        element={<PrivateRoute><FeatureRoute feature="financial"><Financeiro /></FeatureRoute></PrivateRoute>} />
      <Route path="/clube"             element={<PrivateRoute><FeatureRoute feature="clube"><Clube /></FeatureRoute></PrivateRoute>} />
      <Route path="/documents"         element={<PrivateRoute><FeatureRoute feature="documents"><Documents /></FeatureRoute></PrivateRoute>} />
      <Route path="/analytics"         element={<PrivateRoute><FeatureRoute feature="analytics"><Analytics /></FeatureRoute></PrivateRoute>} />
      <Route path="/faturamento"       element={<PrivateRoute><FeatureRoute feature="faturamento"><Faturamento /></FeatureRoute></PrivateRoute>} />
      <Route path="/automacoes"        element={<PrivateRoute><FeatureRoute feature="whatsapp"><Automacoes /></FeatureRoute></PrivateRoute>} />
      <Route path="/settings"          element={<PrivateRoute><Settings /></PrivateRoute>} />

      {/* ── Redirects ── */}
      <Route path="/documentos" element={<Navigate to="/documents" replace />} />
      <Route path="/relatorios" element={<Navigate to="/analytics" replace />} />
    </Routes>
  );
}
