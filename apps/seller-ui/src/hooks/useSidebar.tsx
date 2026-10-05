import { useAtom } from 'jotai'
import { activeSidebarItem } from '../config/constants';

const UseSidebar = () => {
    const [activeSidebar, setActiveSidebar] = useAtom(activeSidebarItem);
    return { activeSidebar, setActiveSidebar };

}

export default UseSidebar
