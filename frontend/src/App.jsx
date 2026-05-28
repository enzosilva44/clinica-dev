import { Routes, Route, Navigate } from "react-router-dom";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Patients from "./pages/Patients";
import PatientDetails from "./pages/PatientDetails";
import CreatePatient from "./pages/CreatePatient";
import EditPatient from "./pages/EditPatient";
import Agenda from "./pages/Agenda";
import Procedures from "./pages/Procedures";
import Products from "./pages/Products";
import Financeiro from "./pages/Financeiro";
import Clube from "./pages/Clube";
import Documents from "./pages/Documents";
import Relatorios from "./pages/Relatorios";
import Automacoes from "./pages/Automacoes";

function App() {
  const token = localStorage.getItem("token");

  if (!token) return <Login />;

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/patients" element={<Patients />} />
      <Route path="/patients/create" element={<CreatePatient />} />
      <Route path="/patients/:id" element={<PatientDetails />} />
      <Route path="/patients/:id/edit" element={<EditPatient />} />
      <Route path="/agenda" element={<Agenda />} />
      <Route path="/procedures" element={<Procedures />} />
      <Route path="/products" element={<Products />} />
      <Route path="/financeiro" element={<Financeiro />} />
      <Route path="/clube" element={<Clube />} />
      <Route path="/documents" element={<Documents />} />
      <Route path="/documentos" element={<Navigate to="/documents" />} />
      <Route path="/relatorios" element={<Relatorios />} />
      <Route path="/automacoes" element={<Automacoes />} />
      <Route path="*" element={<Navigate to="/dashboard" />} />
    </Routes>
  );
}

export default App;
