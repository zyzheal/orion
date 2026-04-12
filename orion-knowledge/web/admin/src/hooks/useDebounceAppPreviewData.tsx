import { useAppDispatch } from '@/store';
import { setAppPreviewData } from '@/store/slices/config';
import { debounce } from 'lodash-es';

const useDebounceAppPreviewData = () => {
  const dispatch = useAppDispatch();
  const debouncedDispatch = debounce((data: any) => {
    dispatch(setAppPreviewData(data));
  }, 500);
  return debouncedDispatch;
};

export default useDebounceAppPreviewData;
