import { useMemo } from 'react';
import { Form } from 'antd';
import { useOpsToolsData } from './useOpsToolsData';
import type { OpsToolsData } from './useOpsToolsData';
import {
  getCronColumns,
  getIndexColumns,
  getTagentColumns,
  getFileColumns,
  getThemeColumns,
  getModuleColumns,
} from './columns';

export function useOpsToolsColumns(d: OpsToolsData, cronForm: ReturnType<typeof Form.useForm>[0]) {
  const cronColumns = useMemo(
    () =>
      getCronColumns({
        handleCronToggle: d.handleCronToggle,
        handleCronEdit: (job) => {
          cronForm.setFieldsValue({
            name: job.name,
            cronExpression: job.cronExpression,
            command: job.command,
            description: job.description,
          });
          d.handleCronEdit(job);
        },
        handleCronDelete: d.handleCronDelete,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [d.handleCronToggle, d.handleCronDelete],
  );

  const indexColumns = useMemo(
    () => getIndexColumns({ handleDeleteIndex: d.handleDeleteIndex }),
    [d.handleDeleteIndex],
  );

  const tagentColumns = useMemo(
    () => getTagentColumns({ handleTagentUpgrade: d.handleTagentUpgrade }),
    [d.handleTagentUpgrade],
  );

  const fileColumns = useMemo(
    () =>
      getFileColumns({
        handleDistributeOpen: (fileId: string) => {
          d.setDistributingFile(fileId);
          d.setDistributeModalOpen(true);
        },
        handleDeleteFile: d.handleDeleteFile,
      }),
    [d.handleDeleteFile, d.setDistributingFile, d.setDistributeModalOpen],
  );

  const themeColumns = useMemo(
    () =>
      getThemeColumns(
        {
          handleThemeToggle: d.handleThemeToggle,
          handleDeleteTheme: d.handleDeleteTheme,
        },
        d.loading,
      ),
    [d.handleThemeToggle, d.handleDeleteTheme, d.loading],
  );

  const moduleColumns = useMemo(
    () => getModuleColumns({ handleModuleToggle: d.handleModuleToggle }, d.loading),
    [d.handleModuleToggle, d.loading],
  );

  return { cronColumns, indexColumns, tagentColumns, fileColumns, themeColumns, moduleColumns };
}
