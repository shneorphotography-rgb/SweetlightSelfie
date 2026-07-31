import TopNavbar from './TopNavbar';
import SideNavbar from './SideNavbar';
import HamburgerMenu from './HamburgerMenu';

export default function Navigation({ sections, navStyle }) {
  switch (navStyle) {
    case 'top':
      return <TopNavbar sections={sections} />;
    case 'side':
      return <SideNavbar sections={sections} />;
    case 'hamburger':
      return <HamburgerMenu sections={sections} />;
    default:
      return <TopNavbar sections={sections} />;
  }
}
