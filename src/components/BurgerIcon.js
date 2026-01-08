export default function BurgerIcon({ setShowSidebar, className }) {
  return (
    <svg
      onClick={() => setShowSidebar((prev) => !prev)}
      className={`flex items-center cursor-pointer z-30 ${className}`}
      fill="#46b574"
      viewBox="0 0 100 80"
      width="40"
      height="40"
    >
      <rect width="100" height="10"></rect>
      <rect y="30" width="100" height="10"></rect>
      <rect y="60" width="100" height="10"></rect>
    </svg>
  );
}
