/**
 * Pipeline Service - 重定向到 PipelineMonitor
 */
import { Navigate } from 'react-router-dom';

const PipelineServiceIndex = () => <Navigate to="/observability/pipelines/monitor" replace />;
export default PipelineServiceIndex;
