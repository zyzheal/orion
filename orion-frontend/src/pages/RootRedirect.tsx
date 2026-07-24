import React from 'react';
import { Navigate } from 'react-router-dom';

const RootRedirect: React.FC = () => {
  return <Navigate to="/login" replace />;
};

export default RootRedirect;
