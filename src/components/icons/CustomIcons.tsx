import React from "react";

export const NFTIcon = ({ size = 32, className = "" }) => (
  <img
    src="/icons/NFT.png"
    alt="NFT Icon"
    width={size}
    height={size}
    className={className}
    style={{ display: "inline-block" }}
  />
);

export const ThunderIcon = ({ size = 32, color = "#5d43ef", className = "" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 32 32"
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    xmlnsXlink="http://www.w3.org/1999/xlink"
  >
    <path
      d="M15.84,1a15.121,15.121,0,0,1,15.24,15A15.121,15.121,0,0,1,15.84,31,15.121,15.121,0,0,1,.6,16,15.121,15.121,0,0,1,15.84,1Z"
      fill="none"
      stroke={color}
      strokeWidth="1"
      fillRule="evenodd"
    />
    <image
      x="11"
      y="6"
      width="10"
      height="18"
      xlinkHref="data:img/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAASCAYAAABit09LAAAA10lEQVQokX2RvwtBURTHPw8p/4CUUZkNymiw2JUe5U8gIyabUWG0KYMsMstiMBnFZDGzGCx+dOveOh3P+y7ne+738+47p+s1Snf+aA/MgZGJI3+gJlAADu4gCEzYWx7ALgyc2rqWhxosAnXrt2HgwtY3MJNBTPgBkLT+CqRE/nEmA3TERwa6BP16qUaIq/5pwB6QI1y+AbsKeal+A6zMjHnAE0EZGIq+6rY+qxt84c1T3uQyUjXbnICJ3topDWRtU5FB0BMajYFjGNi3taXn0WAUaP9MDXwB9XofgOLnusIAAAAASUVORK5CYII="
    />
  </svg>
);

export const NeftitLogoSymbolIcon = ({ size = 32, className = "" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 32 32"
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    xmlnsXlink="http://www.w3.org/1999/xlink"
  >
    <circle
      cx="16.25"
      cy="16"
      r="15.25"
      fill="none"
      stroke="#5d43ef"
      strokeWidth="1"
    />
    <image
      x="8"
      y="7"
      width="17"
      height="19"
      xlinkHref="data:img/png;base64,iVBORw0KGgoAAAANSUhEUgAAABEAAAATCAYAAAB2pebxAAABlklEQVQ4jY3TTYjNYRTH8c8YCyWZhexQXqamWEhSNE0NiW6axZQIC0Q23nY2aprF1DRLFtMspBQLEs0spimSGjVeFpqUYkkpJMpC8tKpc6fHvzv372zOueec53v/z++cp+PY7i9qbBNOYhWeYqLavrQG0I8Hxe+AncAu/Goml7QBLMNMxrdxCR+xA8NlYzvIXXTmFQ5iFPuzdvR/IIeLA40i37zCnzrIStzMODT4VNSa+Rt1kPvpH+FakQ8devAZQ+0gp9CXnztQ5GPMlzPeXE5GZcSrcwd+Yhu+FbXp9CHuWpxGF37gXUCOYCMuZON7bMVgflEv1uMh7mEu+2LkH0Kz2NgDSX+Di9iXTefwO//tLebxAuuydqW8zmTGy3En4+14XtHrVgLmSkBV2JdYgastALFchzJuVGoLkJ3YECLhbKWnq9iL4znilpDu9I+rDZhKHw/xeov6AuRV+j2VsZ8vXmy5N/9Y88CzVH8LXmMca3IKYfEAv9dBwvbiSWozVuRH8kUvaiUkFicAZ3Jjv+bh2XYA+AveO1E4yZFjugAAAABJRU5ErkJggg=="
    />
  </svg>
); 