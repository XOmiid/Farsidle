export function Icon({ name, size = 22, ...props }) {
  const paths = {
    home: 'M3 10 12 3l9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z',
    collection: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
    trophy: 'M8 3h8v7a4 4 0 0 1-8 0ZM8 5H4v3a4 4 0 0 0 4 4m8-7h4v3a4 4 0 0 1-4 4m-4 2v6m-4 1h8',
    user: 'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 21v-2a8 8 0 0 1 16 0v2',
    arrow: 'm14 5-7 7 7 7M7 12h14',
    close: 'm6 6 12 12M6 18 18 6',
    help: 'M9 8a3 3 0 1 1 5 2c-2 1-2 2-2 3m0 4h.01',
    sound: 'm3 10 5-1 5-5v16l-5-5-5-1Zm14-3a7 7 0 0 1 0 10',
    star: 'm12 2 3 7 7 1-5 5 1 7-6-4-6 4 1-7-5-5 7-1Z',
    check: 'm5 12 4 4L20 5',
    coins: 'M20 9c0 3-16 3-16 0s16-3 16 0ZM4 9v7c0 4 16 4 16 0V9M4 13c0 4 16 4 16 0',
    chevron: 'm9 5 7 7-7 7',
    share: 'M12 16V3m-5 5 5-5 5 5M5 13v7h14v-7',
    refresh: 'M20 7V2l-4 4a8 8 0 1 0 4 10m0-9h-5',
    flame: 'M13 2c2 6-3 7-2 11 2 0 4-2 4-4 4 4 5 12-3 13-10 0-9-10-4-15 0 3 1 4 2 4 2-3 3-5 3-9Z',
    logout: 'M9 4H4v16h5m4-13 5 5-5 5m-5-5h13',
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d={paths[name] || paths.star} />
    </svg>
  );
}
export default function GameArt({ type = 'letters', hero = false }) {
  return (
    <svg
      className={'game-art' + (hero ? ' art-hero' : '')}
      viewBox="0 0 240 210"
      fill="none"
      aria-hidden="true"
    >
      {type === 'letters' && (
        <>
          <g transform="rotate(-13 80 90)">
            <rect
              x="29"
              y="38"
              width="85"
              height="92"
              rx="18"
              fill="#FF7557"
              stroke="#252239"
              strokeWidth="3"
            />
            <text
              x="71"
              y="104"
              textAnchor="middle"
              fontSize="55"
              fill="#FFF9EB"
              fontFamily="Tahoma"
            >
              ف
            </text>
          </g>
          <g transform="rotate(10 160 125)">
            <rect
              x="116"
              y="85"
              width="83"
              height="92"
              rx="18"
              fill="#FFD35B"
              stroke="#252239"
              strokeWidth="3"
            />
            <text
              x="158"
              y="150"
              textAnchor="middle"
              fontSize="53"
              fill="#252239"
              fontFamily="Tahoma"
            >
              ا
            </text>
          </g>
          <path d="m173 30 4 12 12 4-12 4-4 12-4-12-12-4 12-4Z" fill="#5867E8" />
          <circle cx="46" cy="171" r="7" fill="#5867E8" />
        </>
      )}
      {type === 'globe' && (
        <>
          <circle cx="120" cy="102" r="70" fill="#5867E8" stroke="#252239" strokeWidth="3" />
          <ellipse cx="120" cy="102" rx="32" ry="70" stroke="#C6E3FF" strokeWidth="3" />
          <path
            d="M50 102h140M61 65c30 18 85 18 118 0M61 140c30-18 85-18 118 0"
            stroke="#C6E3FF"
            strokeWidth="3"
          />
          <path d="m170 22 35 48-25-4-15 20Z" fill="#FFD35B" stroke="#252239" strokeWidth="3" />
          <path
            d="M63 168c37 20 75 20 111 0"
            stroke="#252239"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </>
      )}
      {type === 'color' && (
        <>
          <circle cx="90" cy="84" r="49" fill="#FF765F" stroke="#252239" strokeWidth="3" />
          <circle cx="151" cy="84" r="49" fill="#FFD35B" stroke="#252239" strokeWidth="3" />
          <circle cx="120" cy="135" r="49" fill="#A58AF5" stroke="#252239" strokeWidth="3" />
          <path d="m48 154 4 10 10 4-10 4-4 10-4-10-10-4 10-4Z" fill="#252239" />
          <circle cx="194" cy="135" r="5" fill="#FF765F" />
        </>
      )}
      {type === 'music' && (
        <>
          <g transform="rotate(-9 120 105)">
            <rect
              x="34"
              y="49"
              width="172"
              height="115"
              rx="20"
              fill="#FFF9EB"
              stroke="#252239"
              strokeWidth="3"
            />
            {[0, 1, 2, 3, 4].map((i) => (
              <path key={i} d={'M' + (63 + i * 29) + ' 49v115'} stroke="#252239" strokeWidth="2" />
            ))}
            {[0, 1, 3, 4].map((i) => (
              <rect key={i} x={53 + i * 29} y="49" width="19" height="67" rx="4" fill="#252239" />
            ))}
          </g>
          <path
            d="M182 24v28m0-28 19-4v25"
            stroke="#FF765F"
            strokeWidth="6"
            strokeLinecap="round"
          />
          <circle cx="175" cy="54" r="8" fill="#FF765F" />
          <circle cx="194" cy="48" r="8" fill="#FF765F" />
        </>
      )}
      {type === 'memory' && (
        <>
          <g transform="rotate(9 120 100)">
            {[0, 1, 2].map((n) => (
              <g key={n}>
                <rect
                  x={33 + n * 60}
                  y={49 + n * 13}
                  width="65"
                  height="91"
                  rx="13"
                  fill={['#FF765F', '#5867E8', '#FFD35B'][n]}
                  stroke="#252239"
                  strokeWidth="3"
                />
                <text
                  x={65 + n * 60}
                  y={108 + n * 13}
                  textAnchor="middle"
                  fontSize="39"
                  fill={n === 2 ? '#252239' : '#FFF9EB'}
                  fontFamily="Tahoma"
                >
                  {['۷', '۲', '۹'][n]}
                </text>
              </g>
            ))}
          </g>
          <path d="m58 166 9 9 17-19" stroke="#252239" strokeWidth="4" strokeLinecap="round" />
        </>
      )}
      {type === 'team' && (
        <>
          <circle cx="78" cy="70" r="27" fill="#FF765F" stroke="#252239" strokeWidth="3" />
          <path
            d="M34 165v-26a44 44 0 0 1 88 0v26"
            fill="#FF765F"
            stroke="#252239"
            strokeWidth="3"
          />
          <circle cx="162" cy="70" r="27" fill="#5867E8" stroke="#252239" strokeWidth="3" />
          <path
            d="M118 165v-26a44 44 0 0 1 88 0v26"
            fill="#5867E8"
            stroke="#252239"
            strokeWidth="3"
          />
          <path d="m101 58 19-20 20 20" stroke="#FFD35B" strokeWidth="6" strokeLinecap="round" />
        </>
      )}
      {type === 'grid' && (
        <>
          <g transform="rotate(-8 120 105)">
            {Array.from({ length: 16 }, (_, i) => (
              <rect
                key={i}
                x={42 + (i % 4) * 39}
                y={28 + Math.floor(i / 4) * 39}
                width="38"
                height="38"
                rx="5"
                fill={[1, 7, 8, 14].includes(i) ? '#252239' : i === 5 ? '#FFD35B' : '#FFF9EB'}
                stroke="#252239"
                strokeWidth="2"
              />
            ))}
          </g>
          <path
            d="m180 155 25-25 12 12-25 25-17 6Z"
            fill="#FF765F"
            stroke="#252239"
            strokeWidth="3"
          />
        </>
      )}
    </svg>
  );
}
