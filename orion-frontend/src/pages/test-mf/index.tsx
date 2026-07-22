/**
 * Test Micro-Frontend - 重定向到 TestMFLoader
 */
import { Navigate } from 'react-router-dom';

const TestMFIndex = () => <Navigate to="/test-mf" replace />;
export default TestMFIndex;
