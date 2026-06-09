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

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/landing" element={<LandingPage />} />
      <Route
        path="/"
        element={<Login />}
      />

      <Route
        path="/dashboard"
        element={
          <PrivateRoute>
            <Dashboard />
          </PrivateRoute>
        }
      />

      <Route
        path="/patients"
        element={
          <PrivateRoute>
            <Patients />
          </PrivateRoute>
        }
      />

      <Route
        path="/patients/create"
        element={
          <PrivateRoute>
            <CreatePatient />
          </PrivateRoute>
        }
      />

      <Route
        path="/patients/:id"
        element={
          <PrivateRoute>
            <PatientDetails />
          </PrivateRoute>
        }
      />

      <Route
        path="/agenda"
        element={
          <PrivateRoute>
            <Agenda />
          </PrivateRoute>
        }
      />

        <Route
          path="/products"
          element={
            <PrivateRoute>
              <Products />
            </PrivateRoute>
          }
        />

      <Route
        path="/procedures"
        element={
          <PrivateRoute>
            <Procedures />
          </PrivateRoute>
        }
      />

      <Route
        path="/financeiro"
        element={
          <PrivateRoute>
            <Financeiro />
          </PrivateRoute>
        }
      />

      <Route
        path="/clube"
        element={
          <PrivateRoute>
            <Clube />
          </PrivateRoute>
        }
      />

      <Route
        path="/documents"
        element={
          <PrivateRoute>
            <Documents />
          </PrivateRoute>
        }
      />

      <Route
        path="/documentos"
        element={<Navigate to="/documents" replace />}
      />

      <Route
        path="/patients/:id/edit"
        element={
          <PrivateRoute>
            <EditPatient />
          </PrivateRoute>
        }
      />

      <Route
        path="/analytics"
        element={
          <PrivateRoute>
            <Analytics />
          </PrivateRoute>
        }
      />
      <Route path="/relatorios" element={<Navigate to="/analytics" />} />

      <Route
        path="/faturamento"
        element={
          <PrivateRoute>
            <Faturamento />
          </PrivateRoute>
        }
      />

      <Route
        path="/automacoes"
        element={
          <PrivateRoute>
            <Automacoes />
          </PrivateRoute>
        }
      />
    </Routes>

    
  );
}
