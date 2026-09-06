import { useAtom } from 'jotai';
import { activeSideBarAtom } from '../../configs/constants';

const useSidebar = () => {
  const [activeSidebar, setActiveSidebar] = useAtom(activeSideBarAtom);
  return { activeSidebar, setActiveSidebar }
}

export default useSidebar
