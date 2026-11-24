import React from 'react';

/** Huy hiệu Grimoire tối giản khắc đồng cổ */
export function GrimoireCrest({ className = 'w-8 h-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" className={className} aria-hidden="true">
      <rect x="6" y="6" width="52" height="52" stroke="#C5A059" strokeWidth="1.2" strokeOpacity="0.65" />
      <rect x="10" y="10" width="44" height="44" stroke="#C5A059" strokeWidth="0.7" strokeOpacity="0.3" />
      <path d="M32 13L46 32L32 51L18 32L32 13Z" stroke="#E2C88D" strokeWidth="1.3" />
      <circle cx="32" cy="32" r="7.5" stroke="#C5A059" strokeWidth="1.2" />
      <circle cx="32" cy="32" r="2.2" fill="#8E2933" />
      <path d="M32 8V18M32 46V56M8 32H18M46 32H56" stroke="#C5A059" strokeWidth="1" strokeOpacity="0.7" />
    </svg>
  );
}

/** Tranh nền Sảnh Chính: Đại Thư Viện Vòm Gothic & Nhật Thực Đồng Cổ (Elden Ring style) */
export function HeroCitadelArt({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 900 420"
      preserveAspectRatio="xMidYMid slice"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="eclipseGlow" cx="74%" cy="46%" r="38%">
          <stop offset="0%" stopColor="#E2C88D" stopOpacity="0.28" />
          <stop offset="38%" stopColor="#C5A059" stopOpacity="0.11" />
          <stop offset="70%" stopColor="#8E2933" stopOpacity="0.06" />
          <stop offset="100%" stopColor="#090807" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="brassStroke" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#E2C88D" stopOpacity="0.82" />
          <stop offset="55%" stopColor="#C5A059" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#C5A059" stopOpacity="0.05" />
        </linearGradient>
        <linearGradient id="leftFade" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#090807" stopOpacity="0.98" />
          <stop offset="46%" stopColor="#090807" stopOpacity="0.82" />
          <stop offset="100%" stopColor="#090807" stopOpacity="0.12" />
        </linearGradient>
      </defs>

      {/* Nền nhật thực đồng cổ */}
      <rect width="900" height="420" fill="#0B0A08" />
      <rect width="900" height="420" fill="url(#eclipseGlow)" />

      {/* Vòng thiên văn Astrolabe (vẽ nét siêu mảnh kiểu bản khắc Elden Ring) */}
      <g transform="translate(670, 195)" opacity="0.9">
        <circle r="158" stroke="#C5A059" strokeWidth="0.7" strokeOpacity="0.22" strokeDasharray="3 5" />
        <circle r="130" stroke="#C5A059" strokeWidth="1" strokeOpacity="0.35" />
        <circle r="118" stroke="#C5A059" strokeWidth="0.6" strokeOpacity="0.2" />
        <circle r="72" stroke="#E2C88D" strokeWidth="1.4" strokeOpacity="0.75" />
        <circle r="66" fill="#090807" stroke="#8E2933" strokeWidth="1.2" strokeOpacity="0.65" />
        {/* Vầng hào quang nhật thực */}
        <path d="M-92 0 H92 M0 -92 V92" stroke="#C5A059" strokeWidth="0.7" strokeOpacity="0.35" />
        <path d="M-110 -110 L110 110 M110 -110 L-110 110" stroke="#C5A059" strokeWidth="0.5" strokeOpacity="0.2" />
        <polygon points="0,-130 9,-112 0,-118 -9,-112" fill="#C5A059" fillOpacity="0.6" />
        <polygon points="0,130 9,112 0,118 -9,112" fill="#C5A059" fillOpacity="0.6" />
      </g>

      {/* Kiến trúc vòm nhà thờ Gothic nhiều lớp chiều sâu */}
      <g stroke="url(#brassStroke)" fill="none">
        {/* Vòm chính */}
        <path d="M490 420 V195 C490 100 570 42 670 18 C770 42 850 100 850 195 V420" strokeWidth="1.4" />
        <path d="M518 420 V204 C518 122 585 72 670 50 C755 72 822 122 822 204 V420" strokeWidth="0.9" strokeOpacity="0.65" />
        {/* Cột đá mảnh & gân vòm */}
        <line x1="556" y1="88" x2="556" y2="420" strokeWidth="0.8" strokeOpacity="0.35" />
        <line x1="784" y1="88" x2="784" y2="420" strokeWidth="0.8" strokeOpacity="0.35" />
        <path d="M556 420 V260 C556 210 605 170 670 155 C735 170 784 210 784 260 V420" strokeWidth="0.8" strokeOpacity="0.45" />
        {/* Tháp nhọn phụ bên trái */}
        <path d="M365 420 V245 C365 182 405 142 448 122 C490 142 530 182 530 245 V420" strokeWidth="0.8" strokeOpacity="0.35" />
        {/* Đường chân trời sàn đá */}
        <line x1="340" y1="378" x2="900" y2="378" stroke="#C5A059" strokeWidth="0.7" strokeOpacity="0.25" />
      </g>

      {/* Bóng tòa tháp tiền cảnh tạo chiều sâu */}
      <path d="M635 378 L652 292 L670 258 L688 292 L705 378 Z" fill="#0B0A08" stroke="#C5A059" strokeWidth="0.9" strokeOpacity="0.5" />
      <circle cx="670" cy="312" r="4" fill="#8E2933" />

      {/* Che tối mượt bên trái để chữ tiêu đề sắc nét tuyệt đối */}
      <rect width="900" height="420" fill="url(#leftFade)" />
    </svg>
  );
}

/** 1. Listening: Chuông đồng cổ trong vòm tháp đá */
export function ListeningBellArt({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 320 180" fill="none" className={className} aria-hidden="true">
      <defs>
        <radialGradient id="bellGlow" cx="50%" cy="48%" r="52%">
          <stop offset="0%" stopColor="#C5A059" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#0D0C0A" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="320" height="180" fill="#0E0C0A" />
      <rect width="320" height="180" fill="url(#bellGlow)" />
      {/* Vòm tháp chuông */}
      <path d="M88 180 V88 C88 45 120 20 160 12 C200 20 232 45 232 88 V180" stroke="#C5A059" strokeWidth="0.9" strokeOpacity="0.32" />
      {/* Sóng âm khắc mảnh */}
      <circle cx="160" cy="96" r="52" stroke="#C5A059" strokeWidth="0.7" strokeOpacity="0.28" strokeDasharray="2 4" />
      <circle cx="160" cy="96" r="70" stroke="#C5A059" strokeWidth="0.6" strokeOpacity="0.16" />
      {/* Xích treo */}
      <line x1="160" y1="14" x2="160" y2="54" stroke="#E2C88D" strokeWidth="1.2" />
      {/* Thân chuông cổ chạm khắc */}
      <path
        d="M160 54 C138 54 128 70 126 94 L118 122 C116 127 120 132 126 132 H194 C200 132 204 127 202 122 L194 94 C192 70 182 54 160 54 Z"
        fill="#161310"
        stroke="#E2C88D"
        strokeWidth="1.4"
      />
      <path d="M126 116 H194" stroke="#C5A059" strokeWidth="0.9" strokeOpacity="0.65" />
      <path d="M132 84 H188" stroke="#C5A059" strokeWidth="0.7" strokeOpacity="0.45" />
      {/* Quả lắc chuông */}
      <circle cx="160" cy="139" r="5" fill="#8E2933" stroke="#E2C88D" strokeWidth="1" />
    </svg>
  );
}

/** 2. Reading: Cổ thư mở trên bục đá với hào quang đồng */
export function ReadingTomeArt({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 320 180" fill="none" className={className} aria-hidden="true">
      <defs>
        <radialGradient id="tomeGlow" cx="50%" cy="48%" r="52%">
          <stop offset="0%" stopColor="#E2C88D" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#0D0C0A" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="320" height="180" fill="#0E0C0A" />
      <rect width="320" height="180" fill="url(#tomeGlow)" />
      {/* Vòng sao cổ ngữ phía sau sách */}
      <circle cx="160" cy="78" r="56" stroke="#C5A059" strokeWidth="0.7" strokeOpacity="0.25" />
      <path d="M160 22 L166 54 L196 42 L172 68 L208 78 L172 88" stroke="#C5A059" strokeWidth="0.6" strokeOpacity="0.25" />
      {/* Sách cổ mở rộng */}
      <path
        d="M78 134 C106 122 138 124 160 138 C182 124 214 122 242 134 V64 C214 52 182 54 160 68 C138 54 106 52 78 64 V134 Z"
        fill="#15120F"
        stroke="#E2C88D"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <line x1="160" y1="68" x2="160" y2="138" stroke="#C5A059" strokeWidth="1.2" />
      {/* Các dòng chữ khắc mảnh trên hai trang */}
      <g stroke="#C5A059" strokeWidth="0.8" strokeOpacity="0.45">
        <line x1="94" y1="80" x2="144" y2="84" />
        <line x1="94" y1="92" x2="144" y2="96" />
        <line x1="94" y1="104" x2="138" y2="108" />
        <line x1="176" y1="84" x2="226" y2="80" />
        <line x1="176" y1="96" x2="226" y2="92" />
        <line x1="182" y1="108" x2="226" y2="104" />
      </g>
      {/* Dây đánh dấu đỏ huyết */}
      <path d="M160 138 V158 L154 152 L148 158 V136" fill="#8E2933" stroke="#E2C88D" strokeWidth="0.6" />
    </svg>
  );
}

/** 3. Writing: Lông vũ quạ, cuộn giấy & con dấu sáp huyết trầm */
export function WritingQuillArt({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 320 180" fill="none" className={className} aria-hidden="true">
      <defs>
        <radialGradient id="quillGlow" cx="55%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#8E2933" stopOpacity="0.24" />
          <stop offset="55%" stopColor="#C5A059" stopOpacity="0.1" />
          <stop offset="100%" stopColor="#0D0C0A" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="320" height="180" fill="#0E0C0A" />
      <rect width="320" height="180" fill="url(#quillGlow)" />
      {/* Cuộn giấy da tối màu */}
      <rect x="74" y="42" width="132" height="106" fill="#15120F" stroke="#C5A059" strokeWidth="1" strokeOpacity="0.5" />
      <g stroke="#C5A059" strokeWidth="0.75" strokeOpacity="0.35">
        <line x1="92" y1="64" x2="178" y2="64" />
        <line x1="92" y1="78" x2="170" y2="78" />
        <line x1="92" y1="92" x2="162" y2="92" />
        <line x1="92" y1="106" x2="146" y2="106" />
      </g>
      {/* Con dấu sáp đỏ huyết */}
      <circle cx="110" cy="126" r="11" fill="#8E2933" stroke="#E2C88D" strokeWidth="1" />
      <circle cx="110" cy="126" r="6" stroke="#E2C88D" strokeWidth="0.7" strokeOpacity="0.7" />
      {/* Lông vũ sắc mảnh vươn chéo */}
      <path
        d="M150 132 C164 104 188 68 238 30 C230 62 214 96 174 118 Z"
        fill="#1A1613"
        stroke="#E2C88D"
        strokeWidth="1.4"
      />
      <path d="M144 140 L236 32" stroke="#E2C88D" strokeWidth="1.3" />
      <path d="M186 78 L210 72 M176 92 L202 88 M198 62 L218 58" stroke="#C5A059" strokeWidth="0.7" strokeOpacity="0.6" />
    </svg>
  );
}

/** 4. Speaking: Lư hương đồng & ngọn lửa vàng-huyết trầm */
export function SpeakingBrazierArt({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 320 180" fill="none" className={className} aria-hidden="true">
      <defs>
        <radialGradient id="flameGlow" cx="50%" cy="46%" r="52%">
          <stop offset="0%" stopColor="#E2C88D" stopOpacity="0.28" />
          <stop offset="45%" stopColor="#8E2933" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#0D0C0A" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="320" height="180" fill="#0E0C0A" />
      <rect width="320" height="180" fill="url(#flameGlow)" />
      {/* Vòng hào quang thanh âm */}
      <circle cx="160" cy="76" r="46" stroke="#C5A059" strokeWidth="0.7" strokeOpacity="0.28" />
      <circle cx="160" cy="76" r="62" stroke="#C5A059" strokeWidth="0.5" strokeOpacity="0.14" strokeDasharray="3 5" />
      {/* Ngọn lửa điêu khắc sắc sảo */}
      <path
        d="M160 32 C174 52 184 68 180 88 C177 101 169 108 160 108 C151 108 143 101 140 88 C136 68 146 52 160 32 Z"
        fill="#8E2933"
        fillOpacity="0.72"
        stroke="#E2C88D"
        strokeWidth="1.3"
      />
      <path
        d="M160 54 C167 66 171 78 168 90 C166 98 163 102 160 102 C157 102 154 98 152 90 C149 78 153 66 160 54 Z"
        fill="#E2C88D"
        fillOpacity="0.82"
      />
      {/* Chậu lư hương đồng cổ */}
      <path d="M116 112 H204 L192 134 H128 L116 112 Z" fill="#161310" stroke="#E2C88D" strokeWidth="1.4" />
      <path d="M148 134 L142 156 H178 L172 134" stroke="#C5A059" strokeWidth="1.2" />
      <line x1="126" y1="156" x2="194" y2="156" stroke="#C5A059" strokeWidth="1.3" />
    </svg>
  );
}
