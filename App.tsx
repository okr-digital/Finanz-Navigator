import React from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import { UserProvider } from './context/UserContext';
import { Layout } from './components/Layout';
import { Landing } from './pages/Landing';
import { Check } from './pages/Check';
import { Results } from './pages/Results';
import { Report } from './pages/Report';
import { Thanks } from './pages/Thanks';
import { ModulePlaceholder } from './pages/ModulePlaceholder';
import { PensionModule } from './pages/PensionModule';
import { FinanzierungModule } from './pages/FinanzierungModule';
import { RisikoModule } from './pages/RisikoModule';

const App: React.FC = () => {
  return (
    <UserProvider>
      <Router>
        <Layout>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/check" element={<Check />} />
            <Route path="/results" element={<Results />} />
            <Route path="/module/pension" element={<PensionModule />} />
            <Route path="/module/finanzierung" element={<FinanzierungModule />} />
            <Route path="/module/risiko" element={<RisikoModule />} />
            <Route path="/module/:id" element={<ModulePlaceholder />} />
            <Route path="/report" element={<Report />} />
            <Route path="/thanks" element={<Thanks />} />
          </Routes>
        </Layout>
      </Router>
    </UserProvider>
  );
};

export default App;