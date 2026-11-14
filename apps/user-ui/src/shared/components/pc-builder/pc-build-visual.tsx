// Decorative vector illustration; it does not represent a particular catalog product.
export default function PcBuildVisual() {
  return <svg viewBox="0 0 430 300" className="h-full w-full" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="pc-chassis" x1="117" y1="20" x2="350" y2="278" gradientUnits="userSpaceOnUse"><stop stopColor="#435773"/><stop offset="1" stopColor="#17253e"/></linearGradient>
      <linearGradient id="pc-glass" x1="160" y1="62" x2="320" y2="240" gradientUnits="userSpaceOnUse"><stop stopColor="#263c5b" stopOpacity=".92"/><stop offset="1" stopColor="#0d1629" stopOpacity=".98"/></linearGradient>
      <linearGradient id="pc-edge" x1="100" y1="30" x2="300" y2="250"><stop stopColor="#7dd3fc"/><stop offset=".5" stopColor="#818cf8"/><stop offset="1" stopColor="#3b82f6"/></linearGradient>
      <radialGradient id="pc-fan"><stop offset=".28" stopColor="#17263f"/><stop offset=".7" stopColor="#1e3a5f"/><stop offset=".8" stopColor="#a5b4fc"/><stop offset=".9" stopColor="#60a5fa"/><stop offset="1" stopColor="#1e3a5f" stopOpacity="0"/></radialGradient>
      <radialGradient id="pc-ground"><stop stopColor="#3b82f6" stopOpacity=".28"/><stop offset="1" stopColor="#3b82f6" stopOpacity="0"/></radialGradient>
    </defs>
    <ellipse cx="241" cy="275" rx="170" ry="23" fill="url(#pc-ground)"/>
    <path d="M125 47L183 18L346 42L346 253L288 282L125 257V47Z" fill="url(#pc-chassis)" stroke="#536780" strokeWidth="1.5"/>
    <path d="M125 47L288 73L346 42L183 18L125 47Z" fill="#445978"/>
    <path d="M288 73L346 42V253L288 282V73Z" fill="#15243c" stroke="#3c526d"/>
    <path d="M135 59L277 82V261L135 239V59Z" fill="url(#pc-glass)" stroke="#536d8d"/>
    <path d="M143 70L267 90V246L143 228V70Z" fill="#101c30"/>
    <path d="M150 82L219 93V171L150 160V82Z" fill="#21314b" stroke="#3e5270"/>
    <path d="M159 92L210 100V147L159 140V92Z" fill="#111d31" stroke="#5b7194"/>
    <path d="M174 105L196 109V131L174 127V105Z" fill="#233b5c" stroke="#8bbef7"/>
    <path d="M224 98V163M232 99V164" stroke="#77aaf0" strokeWidth="4"/>
    <path d="M151 176L253 192V205L151 190V176Z" fill="#354b6b" stroke="#667f9f"/>
    <path d="M154 179L250 194" stroke="url(#pc-edge)" strokeWidth="3"/>
    <path d="M146 210L265 229V248L146 230V210Z" fill="#1d2d47"/>
    <path d="M156 218L192 224" stroke="#516886" strokeWidth="2"/>
    {[106, 163, 220].map((y, index) => <g key={y} transform={`translate(314 ${y}) skewY(-27)`}><circle r="24" fill="#0c1729"/><circle r="23" fill="url(#pc-fan)"/><circle r="7" fill="#607a9f"/><path d="M0-17C12-13 11-3 4-1M17 0C13 12 3 11 1 4M0 17C-12 13-11 3-4 1M-17 0C-13-12-3-11-1-4" stroke={index === 1 ? '#93c5fd' : '#9fa8f5'} strokeWidth="5" strokeLinecap="round" opacity=".42"/></g>)}
    <path d="M279 81V263" stroke="url(#pc-edge)" strokeWidth="2"/>
    <path d="M144 247L144 260M270 268V280" stroke="#526982" strokeWidth="8"/>
    <path d="M211 33L259 40" stroke="#8ca0bb" strokeWidth="3" strokeLinecap="round"/>
    <circle cx="272" cy="42" r="2.5" fill="#93c5fd"/>
    <path d="M146 67L186 74L268 216V247L146 67Z" fill="#b8d6f5" opacity=".035"/>
    <circle cx="92" cy="85" r="3" fill="#60a5fa" opacity=".6"/><circle cx="379" cy="165" r="2" fill="#93c5fd" opacity=".5"/>
    <path d="M83 198H103M93 188V208" stroke="#6a93c8" strokeWidth="1.5" opacity=".6"/>
  </svg>;
}
